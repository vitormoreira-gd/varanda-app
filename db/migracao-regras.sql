-- ============================================================
-- MIGRAÇÃO — Regras do condomínio (Fase 3)
-- Rodar uma vez no SQL Editor do Supabase. Já está dobrada
-- dentro de varanda-schema.sql; depois de aplicada, este
-- arquivo pode ser apagado.
-- ============================================================

-- Uma linha por condomínio: o regimento é um só. A PK ser o
-- condominio_id já garante isso, sem constraint extra.
create table if not exists regras (
  condominio_id uuid primary key references condominios(id) on delete cascade,
  texto text not null,
  versao int not null default 1,
  atualizado_por uuid references usuarios(id),
  atualizado_em timestamptz not null default now()
);

alter table regras enable row level security;

-- Só existe policy de leitura de propósito: escrever é sempre
-- pelo RPC salvar_regras, que publica o aviso na mesma
-- transação. Sem policy de insert/update não há caminho que
-- altere as regras sem avisar ninguém.
drop policy if exists "ver regras do meu condominio" on regras;
create policy "ver regras do meu condominio" on regras
  for select using (condominio_id in (select condominios_do_usuario()));

-- ============================================================
-- RPC: salva as regras e publica o aviso numa transação só.
-- Se o texto não mudou, não incrementa versão nem avisa.
-- ============================================================
create or replace function salvar_regras(
  p_condominio_id uuid,
  p_texto text,
  p_resumo text default null
)
returns int
language plpgsql
security definer
as $$
declare
  v_texto_atual text;
  v_versao int;
begin
  if not eh_sindico(p_condominio_id) then
    raise exception 'Só o síndico pode editar as regras do condomínio';
  end if;

  if coalesce(trim(p_texto), '') = '' then
    raise exception 'As regras não podem ficar em branco';
  end if;

  -- for update segura a linha até o fim da transação: dois
  -- cliques simultâneos não geram duas versões iguais.
  select r.texto, r.versao into v_texto_atual, v_versao
  from regras r
  where r.condominio_id = p_condominio_id
  for update;

  if not found then
    v_versao := 1;
    insert into regras (condominio_id, texto, versao, atualizado_por, atualizado_em)
    values (p_condominio_id, trim(p_texto), v_versao, auth.uid(), now());
  else
    -- Salvar sem mudar nada não é alteração: devolve a versão
    -- atual e não dispara aviso.
    if v_texto_atual = trim(p_texto) then
      return v_versao;
    end if;

    v_versao := v_versao + 1;
    update regras
    set texto = trim(p_texto),
        versao = v_versao,
        atualizado_por = auth.uid(),
        atualizado_em = now()
    where condominio_id = p_condominio_id;
  end if;

  insert into avisos (condominio_id, autor_id, titulo, texto, fixado)
  values (
    p_condominio_id,
    auth.uid(),
    case when v_versao = 1
      then 'Regras do condomínio publicadas'
      else 'Regras do condomínio atualizadas'
    end,
    coalesce(
      nullif(trim(p_resumo), ''),
      'As regras do condomínio mudaram. A versão ' || v_versao || ' já está na aba Oficial.'
    ),
    true
  );

  return v_versao;
end;
$$;

grant execute on function salvar_regras(uuid, text, text) to authenticated;
