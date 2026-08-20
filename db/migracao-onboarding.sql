-- ============================================================
-- MIGRAÇÃO — onboarding self-service (idempotente)
-- Rodar no SQL Editor do Supabase. Depois de aplicado, dobrar
-- dentro de varanda-schema.sql e apagar este arquivo.
-- ============================================================

-- ------------------------------------------------------------
-- CÓDIGOS DE FUNDAÇÃO
-- Gate de entrada de condomínio novo: você emite um código por
-- condomínio quando fecha o trial, e quem digitar vira o primeiro
-- síndico. Resolve o paradoxo do primeiro síndico — eh_sindico()
-- exige um vínculo aprovado que ainda não existe, e não pode ser
-- o próprio usuário se declarando síndico.
--
-- Para emitir um código novo, rode no SQL Editor:
--   insert into codigos_fundacao (codigo, observacao)
--   values ('VARANDA-2026-ABC', 'Ed. Fulano — trial iniciado 20/08');
-- ------------------------------------------------------------
create table if not exists codigos_fundacao (
  codigo text primary key,
  observacao text,
  usado_por uuid references usuarios(id),
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- RLS ligado e SEM nenhuma policy: ninguém lê nem escreve pela API.
-- O único caminho é a função fundar_condominio(), que roda como
-- security definer. Isso impede alguém de listar códigos não usados.
alter table codigos_fundacao enable row level security;

-- ------------------------------------------------------------
-- FUNDAR CONDOMÍNIO
-- Cria condomínio + a unidade do síndico + o vínculo já aprovado,
-- numa transação só, e queima o código.
-- ------------------------------------------------------------
create or replace function fundar_condominio(
  p_codigo text,
  p_nome_condominio text,
  p_endereco text,
  p_bloco text,
  p_numero text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_usado_por uuid;
  v_condominio_id uuid;
  v_unidade_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Precisa estar logado para fundar um condomínio';
  end if;

  if not exists (select 1 from usuarios u where u.id = auth.uid()) then
    raise exception 'Complete seu perfil antes de fundar um condomínio';
  end if;

  -- for update segura o código até o fim da transação: dois cliques
  -- simultâneos não conseguem usar o mesmo código duas vezes.
  select cf.usado_por into v_usado_por
  from codigos_fundacao cf
  where cf.codigo = p_codigo
  for update;

  if not found then
    raise exception 'Código de fundação inválido';
  end if;

  if v_usado_por is not null then
    raise exception 'Este código de fundação já foi usado';
  end if;

  insert into condominios (nome, endereco)
  values (p_nome_condominio, nullif(p_endereco, ''))
  returning id into v_condominio_id;

  insert into unidades (condominio_id, bloco, numero)
  values (v_condominio_id, nullif(p_bloco, ''), p_numero)
  returning id into v_unidade_id;

  insert into vinculos (usuario_id, unidade_id, papel, status)
  values (auth.uid(), v_unidade_id, 'sindico', 'aprovado');

  update codigos_fundacao
  set usado_por = auth.uid(), usado_em = now()
  where codigo = p_codigo;

  return v_condominio_id;
end;
$$;

grant execute on function fundar_condominio(text, text, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- SÍNDICO CADASTRA UNIDADES
-- Insert direto com policy resolve — não precisa de RPC, porque
-- aqui o condominio_id já é conhecido e eh_sindico() já funciona.
-- ------------------------------------------------------------
drop policy if exists "sindico cria unidade" on unidades;
create policy "sindico cria unidade" on unidades
  for insert with check (eh_sindico(condominio_id));
