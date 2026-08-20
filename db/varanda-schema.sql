-- ============================================================
-- VARANDA — schema completo (idempotente)
-- Pode colar e rodar este script quantas vezes precisar.
-- Ele não vai falhar se algo já existir.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- TIPOS ----------
do $$ begin
  create type papel_vinculo as enum ('proprietario', 'inquilino', 'sindico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_vinculo as enum ('pendente', 'aprovado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_item as enum ('aberto', 'em_andamento', 'resolvido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_sugestao as enum ('analise', 'aprovada', 'implementada');
exception when duplicate_object then null; end $$;

-- ---------- CONDOMÍNIO E UNIDADES ----------
create table if not exists condominios (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  endereco text,
  criado_em timestamptz not null default now()
);

create table if not exists unidades (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  bloco text,
  numero text not null,
  codigo_convite text unique default substr(md5(random()::text), 1, 8)
);

-- ---------- USUÁRIOS ----------
create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  telefone text,
  foto_url text,
  criado_em timestamptz not null default now()
);

create table if not exists vinculos (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  unidade_id uuid not null references unidades(id) on delete cascade,
  papel papel_vinculo not null default 'proprietario',
  status status_vinculo not null default 'pendente',
  criado_em timestamptz not null default now(),
  unique (usuario_id, unidade_id)
);

-- ---------- CÓDIGOS DE FUNDAÇÃO ----------
-- Gate de entrada de condomínio novo: um código é emitido fora do app e
-- quem digitar vira o primeiro síndico. Resolve o paradoxo do primeiro
-- síndico — eh_sindico() exige um vínculo aprovado que ainda não existe,
-- e não pode ser o próprio usuário se declarando síndico.
--
-- Para emitir um código:
--   insert into codigos_fundacao (codigo, observacao)
--   values ('VARANDA-2026-ABC', 'Ed. Fulano — trial iniciado 20/08');
create table if not exists codigos_fundacao (
  codigo text primary key,
  observacao text,
  usado_por uuid references usuarios(id),
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------- MURAL (posts sociais) ----------
create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);

create table if not exists curtidas (
  post_id uuid not null references posts(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  primary key (post_id, usuario_id)
);

create table if not exists comentarios (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);

-- ---------- SUGESTÕES ----------
create table if not exists sugestoes (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  descricao text not null,
  categoria text,
  status status_sugestao not null default 'analise',
  criado_em timestamptz not null default now()
);

create table if not exists apoios (
  sugestao_id uuid not null references sugestoes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  primary key (sugestao_id, usuario_id)
);

-- ---------- PROBLEMAS ----------
create table if not exists problemas (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  categoria text,
  local text,
  descricao text not null,
  foto_url text,
  status status_item not null default 'aberto',
  criado_em timestamptz not null default now()
);

create table if not exists historico_status (
  id uuid primary key default uuid_generate_v4(),
  problema_id uuid not null references problemas(id) on delete cascade,
  status status_item not null,
  autor_id uuid references usuarios(id),
  criado_em timestamptz not null default now()
);

-- ---------- AVISOS (síndico) ----------
create table if not exists avisos (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  texto text not null,
  fixado boolean not null default true,
  data_expiracao timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------- VOTAÇÕES (voto por unidade) ----------
create table if not exists votacoes (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  descricao text,
  opcoes text[] not null,
  data_inicio timestamptz not null default now(),
  data_fim timestamptz not null
);

create table if not exists votos (
  id uuid primary key default uuid_generate_v4(),
  votacao_id uuid not null references votacoes(id) on delete cascade,
  unidade_id uuid not null references unidades(id) on delete cascade,
  usuario_id uuid not null references usuarios(id),
  opcao text not null,
  criado_em timestamptz not null default now(),
  unique (votacao_id, unidade_id)
);

-- ---------- REUNIÕES ----------
create table if not exists reunioes (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  data_hora timestamptz not null,
  local text,
  pauta text,
  criado_em timestamptz not null default now()
);

create table if not exists rsvps (
  reuniao_id uuid not null references reunioes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  confirmado boolean not null default true,
  primary key (reuniao_id, usuario_id)
);

-- ============================================================
-- FUNÇÕES AUXILIARES (create or replace já é seguro pra repetir)
-- ============================================================
create or replace function condominios_do_usuario()
returns setof uuid
language sql
security definer
stable
as $$
  select u.condominio_id
  from vinculos v
  join unidades u on u.id = v.unidade_id
  where v.usuario_id = auth.uid()
    and v.status = 'aprovado';
$$;

create or replace function eh_sindico(p_condominio_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from vinculos v
    join unidades u on u.id = v.unidade_id
    where v.usuario_id = auth.uid()
      and v.status = 'aprovado'
      and v.papel = 'sindico'
      and u.condominio_id = p_condominio_id
  );
$$;

-- Quem sao os usuarios que dividem condominio comigo. Security definer
-- pra evitar recursao de RLS: vinculos tem policy propria e seria
-- reavaliado dentro da policy de usuarios.
create or replace function usuarios_do_meu_condominio()
returns setof uuid
language sql
security definer
stable
as $$
  select distinct v.usuario_id
  from vinculos v
  join unidades u on u.id = v.unidade_id
  where v.status = 'aprovado'
    and u.condominio_id in (select condominios_do_usuario());
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table condominios enable row level security;
alter table unidades enable row level security;
alter table usuarios enable row level security;
alter table vinculos enable row level security;
alter table posts enable row level security;
alter table curtidas enable row level security;
alter table comentarios enable row level security;
alter table sugestoes enable row level security;
alter table apoios enable row level security;
alter table problemas enable row level security;
alter table historico_status enable row level security;
alter table avisos enable row level security;
alter table votacoes enable row level security;
alter table votos enable row level security;
alter table reunioes enable row level security;
alter table rsvps enable row level security;
-- codigos_fundacao fica com RLS ligado e SEM nenhuma policy, de propósito:
-- ninguém lê nem escreve pela API, o único caminho é fundar_condominio(),
-- que roda como security definer. Impede listar códigos ainda não usados.
alter table codigos_fundacao enable row level security;

drop policy if exists "usuario ve proprio perfil" on usuarios;
create policy "usuario ve proprio perfil" on usuarios
  for select using (id = auth.uid());

-- Sem esta policy cada usuario so enxerga o proprio perfil, o embed
-- usuarios!autor_id(nome) do Mural volta null e todo post aparece como
-- "Vizinho". Atencao: RLS e por linha, nao por coluna — libera telefone
-- e foto_url junto com o nome.
drop policy if exists "ver vizinhos do meu condominio" on usuarios;
create policy "ver vizinhos do meu condominio" on usuarios
  for select using (id in (select usuarios_do_meu_condominio()));

drop policy if exists "usuario edita proprio perfil" on usuarios;
create policy "usuario edita proprio perfil" on usuarios
  for update using (id = auth.uid());

drop policy if exists "usuario cria proprio perfil" on usuarios;
create policy "usuario cria proprio perfil" on usuarios
  for insert with check (id = auth.uid());

drop policy if exists "usuario ve proprios vinculos" on vinculos;
create policy "usuario ve proprios vinculos" on vinculos
  for select using (usuario_id = auth.uid());

drop policy if exists "usuario solicita vinculo" on vinculos;
create policy "usuario solicita vinculo" on vinculos
  for insert with check (usuario_id = auth.uid());

-- NOVO: síndico enxerga e aprova vínculos pendentes do seu condomínio
drop policy if exists "sindico ve vinculos do condominio" on vinculos;
create policy "sindico ve vinculos do condominio" on vinculos
  for select using (
    eh_sindico((select condominio_id from unidades where id = unidade_id))
  );

drop policy if exists "sindico aprova vinculo" on vinculos;
create policy "sindico aprova vinculo" on vinculos
  for update using (
    eh_sindico((select condominio_id from unidades where id = unidade_id))
  );

drop policy if exists "ver posts do meu condominio" on posts;
create policy "ver posts do meu condominio" on posts
  for select using (condominio_id in (select condominios_do_usuario()));

drop policy if exists "criar post no meu condominio" on posts;
create policy "criar post no meu condominio" on posts
  for insert with check (
    autor_id = auth.uid()
    and condominio_id in (select condominios_do_usuario())
  );

drop policy if exists "ver curtidas" on curtidas;
create policy "ver curtidas" on curtidas
  for select using (
    post_id in (select id from posts where condominio_id in (select condominios_do_usuario()))
  );

drop policy if exists "curtir post" on curtidas;
create policy "curtir post" on curtidas
  for insert with check (usuario_id = auth.uid());

drop policy if exists "descurtir post" on curtidas;
create policy "descurtir post" on curtidas
  for delete using (usuario_id = auth.uid());

drop policy if exists "ver comentarios" on comentarios;
create policy "ver comentarios" on comentarios
  for select using (
    post_id in (select id from posts where condominio_id in (select condominios_do_usuario()))
  );

drop policy if exists "comentar" on comentarios;
create policy "comentar" on comentarios
  for insert with check (autor_id = auth.uid());

drop policy if exists "ver sugestoes do meu condominio" on sugestoes;
create policy "ver sugestoes do meu condominio" on sugestoes
  for select using (condominio_id in (select condominios_do_usuario()));

drop policy if exists "criar sugestao" on sugestoes;
create policy "criar sugestao" on sugestoes
  for insert with check (
    autor_id = auth.uid()
    and condominio_id in (select condominios_do_usuario())
  );

drop policy if exists "sindico atualiza status da sugestao" on sugestoes;
create policy "sindico atualiza status da sugestao" on sugestoes
  for update using (eh_sindico(condominio_id));

drop policy if exists "ver apoios" on apoios;
create policy "ver apoios" on apoios
  for select using (
    sugestao_id in (select id from sugestoes where condominio_id in (select condominios_do_usuario()))
  );

drop policy if exists "apoiar sugestao" on apoios;
create policy "apoiar sugestao" on apoios
  for insert with check (usuario_id = auth.uid());

drop policy if exists "retirar apoio" on apoios;
create policy "retirar apoio" on apoios
  for delete using (usuario_id = auth.uid());

drop policy if exists "ver problemas do meu condominio" on problemas;
create policy "ver problemas do meu condominio" on problemas
  for select using (condominio_id in (select condominios_do_usuario()));

drop policy if exists "relatar problema" on problemas;
create policy "relatar problema" on problemas
  for insert with check (
    autor_id = auth.uid()
    and condominio_id in (select condominios_do_usuario())
  );

drop policy if exists "sindico atualiza status do problema" on problemas;
create policy "sindico atualiza status do problema" on problemas
  for update using (eh_sindico(condominio_id));

drop policy if exists "ver historico" on historico_status;
create policy "ver historico" on historico_status
  for select using (
    problema_id in (select id from problemas where condominio_id in (select condominios_do_usuario()))
  );

drop policy if exists "sindico registra historico" on historico_status;
create policy "sindico registra historico" on historico_status
  for insert with check (
    problema_id in (select id from problemas where eh_sindico(condominio_id))
  );

drop policy if exists "ver avisos do meu condominio" on avisos;
create policy "ver avisos do meu condominio" on avisos
  for select using (condominio_id in (select condominios_do_usuario()));

drop policy if exists "sindico cria aviso" on avisos;
create policy "sindico cria aviso" on avisos
  for insert with check (eh_sindico(condominio_id) and autor_id = auth.uid());

drop policy if exists "sindico edita aviso" on avisos;
create policy "sindico edita aviso" on avisos
  for update using (eh_sindico(condominio_id));

drop policy if exists "ver votacoes do meu condominio" on votacoes;
create policy "ver votacoes do meu condominio" on votacoes
  for select using (condominio_id in (select condominios_do_usuario()));

drop policy if exists "sindico cria votacao" on votacoes;
create policy "sindico cria votacao" on votacoes
  for insert with check (eh_sindico(condominio_id) and autor_id = auth.uid());

drop policy if exists "ver votos do meu condominio" on votos;
create policy "ver votos do meu condominio" on votos
  for select using (
    votacao_id in (select id from votacoes where condominio_id in (select condominios_do_usuario()))
  );

drop policy if exists "registrar voto" on votos;
create policy "registrar voto" on votos
  for insert with check (
    usuario_id = auth.uid()
    and unidade_id in (
      select unidade_id from vinculos
      where usuario_id = auth.uid() and status = 'aprovado'
    )
  );

drop policy if exists "ver reunioes do meu condominio" on reunioes;
create policy "ver reunioes do meu condominio" on reunioes
  for select using (condominio_id in (select condominios_do_usuario()));

drop policy if exists "sindico cria reuniao" on reunioes;
create policy "sindico cria reuniao" on reunioes
  for insert with check (eh_sindico(condominio_id) and autor_id = auth.uid());

drop policy if exists "ver rsvps" on rsvps;
create policy "ver rsvps" on rsvps
  for select using (
    reuniao_id in (select id from reunioes where condominio_id in (select condominios_do_usuario()))
  );

drop policy if exists "confirmar presenca" on rsvps;
create policy "confirmar presenca" on rsvps
  for insert with check (usuario_id = auth.uid());

drop policy if exists "desmarcar presenca" on rsvps;
create policy "desmarcar presenca" on rsvps
  for delete using (usuario_id = auth.uid());

drop policy if exists "ver meu condominio" on condominios;
create policy "ver meu condominio" on condominios
  for select using (id in (select condominios_do_usuario()));

drop policy if exists "ver unidades do meu condominio" on unidades;
create policy "ver unidades do meu condominio" on unidades
  for select using (condominio_id in (select condominios_do_usuario()));

-- Insert direto com policy resolve o cadastro de unidades pelo síndico —
-- não precisa de RPC, porque aqui o condominio_id já existe e
-- eh_sindico() já funciona.
drop policy if exists "sindico cria unidade" on unidades;
create policy "sindico cria unidade" on unidades
  for insert with check (eh_sindico(condominio_id));

-- NOVO: síndico pode remover post/comentário do feed (moderação)
drop policy if exists "sindico modera posts" on posts;
create policy "sindico modera posts" on posts
  for delete using (eh_sindico(condominio_id));

drop policy if exists "sindico modera comentarios" on comentarios;
create policy "sindico modera comentarios" on comentarios
  for delete using (
    post_id in (select id from posts where eh_sindico(condominio_id))
  );

-- ============================================================
-- RPC: resolve o paradoxo do primeiro acesso — pra se vincular
-- a uma unidade seria preciso já enxergá-la, mas o RLS de
-- unidades só libera leitura pra quem já tem vínculo aprovado.
-- Essa função roda com permissão elevada só pra essa operação.
-- ============================================================
drop function if exists vincular_por_codigo(text);

create or replace function vincular_por_codigo(p_codigo text)
returns table (id_unidade uuid, status_atual status_vinculo)
language plpgsql
security definer
as $$
declare
  v_unidade_id uuid;
begin
  select u.id into v_unidade_id
  from unidades u
  where u.codigo_convite = p_codigo;

  if v_unidade_id is null then
    raise exception 'Código de convite inválido';
  end if;

  insert into vinculos (usuario_id, unidade_id)
  values (auth.uid(), v_unidade_id)
  on conflict (usuario_id, unidade_id) do nothing;

  return query
  select v.unidade_id, v.status
  from vinculos v
  where v.usuario_id = auth.uid() and v.unidade_id = v_unidade_id;
end;
$$;

grant execute on function vincular_por_codigo(text) to authenticated;

-- ============================================================
-- RPC: funda um condomínio novo. Cria condomínio + a unidade do
-- síndico + o vínculo já aprovado numa transação só, e queima o
-- código de fundação.
-- ============================================================
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
