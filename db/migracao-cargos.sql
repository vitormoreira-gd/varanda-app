-- ============================================================
-- MIGRAÇÃO — Subsíndico, conselho fiscal e canal do gabinete
-- Rodar uma vez no SQL Editor do Supabase. Já está dobrada
-- dentro de varanda-schema.sql; depois de aplicada, este
-- arquivo pode ser apagado.
-- ============================================================

do $$ begin
  create type cargo_condominio as enum ('subsindico', 'conselho');
exception when duplicate_object then null; end $$;

-- Cargo é coisa do condomínio, não da unidade. `vinculos.papel` mistura os
-- dois desde o schema original: um síndico que aluga aparece como 'sindico'
-- e a informação de que é inquilino se perde. Aqui os dois convivem — dá pra
-- ser inquilino do 302 E subsíndico.
--
-- O síndico continua vivendo em vinculos.papel, de propósito: uma fonte de
-- verdade por cargo. Este enum não tem 'sindico'.
create table if not exists cargos (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  cargo cargo_condominio not null,
  atribuido_por uuid references usuarios(id),
  criado_em timestamptz not null default now(),
  unique (condominio_id, usuario_id)
);

-- ---------- FUNÇÕES DE PERMISSÃO ----------

-- Security definer pra não depender da policy de vinculos: a checagem
-- precisa valer mesmo pra quem não enxerga o vínculo do outro.
create or replace function mora_no_condominio(p_usuario_id uuid, p_condominio_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from vinculos v
    join unidades u on u.id = v.unidade_id
    where v.usuario_id = p_usuario_id
      and v.status = 'aprovado'
      and u.condominio_id = p_condominio_id
  );
$$;

create or replace function tem_cargo(p_condominio_id uuid, p_cargos cargo_condominio[])
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from cargos c
    where c.usuario_id = auth.uid()
      and c.condominio_id = p_condominio_id
      and c.cargo = any(p_cargos)
  );
$$;

-- Quem escreve: síndico e subsíndico. Substitui eh_sindico() em todas as
-- policies de escrita — eh_sindico() continua existindo e só é usada onde o
-- poder é exclusivo do síndico (atribuir cargo).
create or replace function pode_gerir(p_condominio_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select eh_sindico(p_condominio_id)
      or tem_cargo(p_condominio_id, array['subsindico']::cargo_condominio[]);
$$;

-- Quem tem leitura ampliada: os dois acima mais o conselho fiscal. É também
-- a audiência do canal restrito do Oficial.
create or replace function pode_fiscalizar(p_condominio_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select pode_gerir(p_condominio_id)
      or tem_cargo(p_condominio_id, array['conselho']::cargo_condominio[]);
$$;

grant execute on function mora_no_condominio(uuid, uuid) to authenticated;
grant execute on function tem_cargo(uuid, cargo_condominio[]) to authenticated;
grant execute on function pode_gerir(uuid) to authenticated;
grant execute on function pode_fiscalizar(uuid) to authenticated;

-- ---------- POLICIES DE CARGOS ----------
alter table cargos enable row level security;

-- Todo mundo do condomínio vê quem é subsíndico e quem é conselho: cargo
-- oculto é o tipo de coisa que gera desconfiança em assembleia.
drop policy if exists "ver cargos do meu condominio" on cargos;
create policy "ver cargos do meu condominio" on cargos
  for select using (condominio_id in (select condominios_do_usuario()));

-- Atribuir cargo é o ÚNICO poder que fica exclusivo do síndico, mesmo com o
-- subsíndico herdando governança. Sem isso um subsíndico se promoveria (ou
-- promoveria terceiros) e não haveria caminho de volta.
drop policy if exists "sindico atribui cargo" on cargos;
create policy "sindico atribui cargo" on cargos
  for insert with check (
    eh_sindico(condominio_id)
    and mora_no_condominio(usuario_id, condominio_id)
  );

drop policy if exists "sindico troca cargo" on cargos;
create policy "sindico troca cargo" on cargos
  for update using (eh_sindico(condominio_id))
  with check (
    eh_sindico(condominio_id)
    and mora_no_condominio(usuario_id, condominio_id)
  );

drop policy if exists "sindico remove cargo" on cargos;
create policy "sindico remove cargo" on cargos
  for delete using (eh_sindico(condominio_id));

-- ---------- CANAL RESTRITO DO OFICIAL ----------
-- Aviso, votação e reunião podem ser marcados como restritos: só síndico,
-- subsíndico e conselho enxergam e interagem.
alter table avisos add column if not exists restrito boolean not null default false;
alter table votacoes add column if not exists restrito boolean not null default false;
alter table reunioes add column if not exists restrito boolean not null default false;

drop policy if exists "ver avisos do meu condominio" on avisos;
create policy "ver avisos do meu condominio" on avisos
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (not restrito or pode_fiscalizar(condominio_id))
  );

drop policy if exists "ver votacoes do meu condominio" on votacoes;
create policy "ver votacoes do meu condominio" on votacoes
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (not restrito or pode_fiscalizar(condominio_id))
  );

drop policy if exists "ver reunioes do meu condominio" on reunioes;
create policy "ver reunioes do meu condominio" on reunioes
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (not restrito or pode_fiscalizar(condominio_id))
  );

-- Filho NÃO herda a visibilidade do pai sozinho: estas policies reconferiam
-- só o condomínio, então sem repetir a cláusula de restrito aqui o vizinho
-- não veria a votação restrita mas leria os votos dela.
drop policy if exists "ver votos do meu condominio" on votos;
create policy "ver votos do meu condominio" on votos
  for select using (
    votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
    )
  );

drop policy if exists "registrar voto" on votos;
create policy "registrar voto" on votos
  for insert with check (
    usuario_id = auth.uid()
    and unidade_id in (
      select unidade_id from vinculos
      where usuario_id = auth.uid() and status = 'aprovado'
    )
    and votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
    )
  );

drop policy if exists "ver rsvps" on rsvps;
create policy "ver rsvps" on rsvps
  for select using (
    reuniao_id in (
      select id from reunioes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
    )
  );

drop policy if exists "confirmar presenca" on rsvps;
create policy "confirmar presenca" on rsvps
  for insert with check (
    usuario_id = auth.uid()
    and reuniao_id in (
      select id from reunioes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
    )
  );

-- ---------- ESCRITA: eh_sindico() -> pode_gerir() ----------

drop policy if exists "sindico ve vinculos do condominio" on vinculos;
create policy "sindico ve vinculos do condominio" on vinculos
  for select using (
    pode_fiscalizar((select condominio_id from unidades where id = unidade_id))
  );

drop policy if exists "sindico aprova vinculo" on vinculos;
create policy "sindico aprova vinculo" on vinculos
  for update using (
    pode_gerir((select condominio_id from unidades where id = unidade_id))
  );

drop policy if exists "sindico atualiza status da sugestao" on sugestoes;
create policy "sindico atualiza status da sugestao" on sugestoes
  for update using (pode_gerir(condominio_id));

drop policy if exists "sindico atualiza status do problema" on problemas;
create policy "sindico atualiza status do problema" on problemas
  for update using (pode_gerir(condominio_id));

drop policy if exists "sindico registra historico" on historico_status;
create policy "sindico registra historico" on historico_status
  for insert with check (
    problema_id in (select id from problemas where pode_gerir(condominio_id))
  );

drop policy if exists "sindico cria aviso" on avisos;
create policy "sindico cria aviso" on avisos
  for insert with check (pode_gerir(condominio_id) and autor_id = auth.uid());

drop policy if exists "sindico edita aviso" on avisos;
create policy "sindico edita aviso" on avisos
  for update using (pode_gerir(condominio_id));

drop policy if exists "sindico cria votacao" on votacoes;
create policy "sindico cria votacao" on votacoes
  for insert with check (pode_gerir(condominio_id) and autor_id = auth.uid());

drop policy if exists "sindico cria reuniao" on reunioes;
create policy "sindico cria reuniao" on reunioes
  for insert with check (pode_gerir(condominio_id) and autor_id = auth.uid());

drop policy if exists "sindico edita reuniao" on reunioes;
create policy "sindico edita reuniao" on reunioes
  for update using (pode_gerir(condominio_id));

drop policy if exists "sindico decide reserva" on reservas;
create policy "sindico decide reserva" on reservas
  for update using (pode_gerir(condominio_id));

drop policy if exists "sindico cria unidade" on unidades;
create policy "sindico cria unidade" on unidades
  for insert with check (pode_gerir(condominio_id));

drop policy if exists "sindico modera posts" on posts;
create policy "sindico modera posts" on posts
  for delete using (pode_gerir(condominio_id));

drop policy if exists "sindico modera comentarios" on comentarios;
create policy "sindico modera comentarios" on comentarios
  for delete using (
    post_id in (select id from posts where pode_gerir(condominio_id))
  );

-- Editar as regras é governança, e o subsíndico herdou governança.
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
  if not pode_gerir(p_condominio_id) then
    raise exception 'Só o síndico ou o subsíndico podem editar as regras';
  end if;

  if coalesce(trim(p_texto), '') = '' then
    raise exception 'As regras não podem ficar em branco';
  end if;

  select r.texto, r.versao into v_texto_atual, v_versao
  from regras r
  where r.condominio_id = p_condominio_id
  for update;

  if not found then
    v_versao := 1;
    insert into regras (condominio_id, texto, versao, atualizado_por, atualizado_em)
    values (p_condominio_id, trim(p_texto), v_versao, auth.uid(), now());
  else
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
