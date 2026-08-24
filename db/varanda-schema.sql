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

do $$ begin
  create type status_reserva as enum ('pendente', 'aprovada', 'recusada');
exception when duplicate_object then null; end $$;

-- Cargo no condominio, separado da relacao com a unidade. Nao tem 'sindico'
-- de proposito: o sindico continua vivendo em vinculos.papel, uma fonte de
-- verdade por cargo.
do $$ begin
  create type cargo_condominio as enum ('subsindico', 'conselho');
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

-- Indice de expressao em vez de constraint porque `bloco` e nullable e em
-- unique constraint dois NULLs nao conflitam: sem o coalesce, "sem bloco /
-- 101" entraria infinitas vezes.
create unique index if not exists unidades_sem_duplicata
  on unidades (condominio_id, coalesce(bloco, ''), numero);

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

-- ---------- SUGESTOES (EM SAIDA) ----------
-- Descontinuada em 21/08/2026. "Solicitacao" carrega um contrato — eu peco,
-- alguem decide, tem um estado — e sugestao nao tem isso: e proposta em busca
-- de adesao, e adesao o Mural ja faz melhor (curtida, comentario, o predio
-- inteiro vendo). As sugestoes ativas viraram posts; ver
-- db/migracao-solicitacoes.sql.
--
-- As tabelas seguem de pe so ate a migracao ser conferida no celular. Depois:
--   drop table apoios;  drop table sugestoes;
create table if not exists sugestoes (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  descricao text not null,
  categoria text,
  status status_sugestao not null default 'analise',
  arquivado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Migrada para `curtidas` junto com `sugestoes`. Ver comentario acima.
create table if not exists apoios (
  sugestao_id uuid not null references sugestoes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  primary key (sugestao_id, usuario_id)
);

-- Para onde cada sugestao foi no Mural. Torna a migracao idempotente e
-- permite desfazer enquanto estas tabelas existirem.
alter table sugestoes
  add column if not exists migrado_para_post uuid references posts(id) on delete set null;

-- ---------- PROBLEMAS  (na interface: "Manutencao") ----------
-- A tabela mantem o nome antigo de proposito: renomear arrastaria policies,
-- a FK de historico_status e o seed, sem ganho nenhum. Na tela isto se chama
-- Manutencao e e um tipo de solicitacao — relatar um vazamento e pedir um
-- conserto, com status e prazo, ao contrario de sugestao, que era conversa.
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
  -- area_comum: o predio inteiro ve. false = so o autor e quem pode_gerir().
  -- O default e `true` de proposito: a visibilidade publica entrega dedup
  -- (tres vizinhos relatando o mesmo portao geram tres chamados) e pressao
  -- (o badge "aberto ha X dias" so cobra porque o predio ve o numero). Quem
  -- nao pensar no assunto publica pro predio; o privado e a excecao.
  area_comum boolean not null default true,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Para bancos que nasceram antes de 22/08/2026.
alter table problemas
  add column if not exists area_comum boolean not null default true;

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
  -- restrito: so sindico, subsindico e conselho enxergam. O canal do gabinete.
  restrito boolean not null default false,
  data_expiracao timestamptz,
  criado_em timestamptz not null default now()
);

-- Aviso fixado e o que o predio ve primeiro; restrito e o que a maioria nem
-- ve. As duas coisas juntas desperdicam o destaque: pro morador comum o topo
-- do Oficial ficaria vazio sem explicacao.
alter table avisos drop constraint if exists avisos_restrito_nao_fixa;
alter table avisos add constraint avisos_restrito_nao_fixa
  check (not (restrito and fixado));

-- Um aviso fixado por vez, garantido no banco e nao na tela: tres caminhos
-- diferentes criam aviso fixado (o formulario do sindico, o RPC
-- salvar_regras quando o regimento muda, e o cancelamento de reuniao).
-- Garantir na UI seria lembrar disso nos tres e esquecer no quarto.
create or replace function garantir_um_aviso_fixado()
returns trigger
language plpgsql
security definer
as $$
begin
  update avisos
  set fixado = false
  where condominio_id = new.condominio_id
    and id <> new.id
    and fixado;
  return null;
end;
$$;

-- AFTER, e so quando o novo valor e true: o update ali dentro dispara o
-- gatilho de novo nas outras linhas, mas com fixado = false, e o `when`
-- corta a recursao.
drop trigger if exists aviso_fixado_unico on avisos;
create trigger aviso_fixado_unico
after insert or update of fixado on avisos
for each row when (new.fixado)
execute function garantir_um_aviso_fixado();

-- ---------- VOTAÇÕES (voto por unidade) ----------
create table if not exists votacoes (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  autor_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  descricao text,
  opcoes text[] not null,
  restrito boolean not null default false,
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
  -- Cancelamento e soft de proposito: quem confirmou presenca precisa VER
  -- que foi cancelada. Apagar a linha faria a reuniao sumir em silencio.
  cancelada_em timestamptz,
  motivo_cancelamento text,
  restrito boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists rsvps (
  reuniao_id uuid not null references reunioes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  confirmado boolean not null default true,
  primary key (reuniao_id, usuario_id)
);

-- ---------- RESERVA DO SALÃO ----------
-- Um salão por condomínio, reservado por dia inteiro. Se um dia existirem
-- várias áreas comuns (salão, churrasqueira, quadra), isso vira uma tabela
-- `areas_comuns` e uma FK aqui — hoje seria complexidade sem demanda.
--
-- Reserva é por UNIDADE, não por pessoa, na mesma lógica do voto: quem
-- reservou foi o apartamento 102, não o Fulano.
create table if not exists reservas (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  unidade_id uuid not null references unidades(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  data date not null,
  observacao text,
  status status_reserva not null default 'pendente',
  criado_em timestamptz not null default now()
);

-- Só UMA reserva aprovada por data. Índice parcial em vez de constraint
-- porque pendentes e recusadas podem coexistir à vontade na mesma data —
-- é justamente isso que dá ao síndico a escolha entre dois pedidos.
create unique index if not exists reservas_uma_aprovada_por_data
  on reservas (condominio_id, data)
  where status = 'aprovada';

-- E uma unidade não pede a mesma data duas vezes.
create unique index if not exists reservas_um_pedido_por_unidade_data
  on reservas (unidade_id, data)
  where status = 'pendente';

-- ---------- REGRAS DO CONDOMÍNIO ----------
-- Uma linha por condomínio: o regimento é um só. A PK ser o condominio_id
-- já garante isso, sem constraint extra. Não há histórico de versões —
-- o rastro de cada alteração é o aviso que o RPC publica junto.
create table if not exists regras (
  condominio_id uuid primary key references condominios(id) on delete cascade,
  texto text not null,
  versao int not null default 1,
  atualizado_por uuid references usuarios(id),
  atualizado_em timestamptz not null default now()
);

-- ---------- CARGOS (subsindico e conselho fiscal) ----------
-- `vinculos.papel` mistura relacao com a unidade (proprietario/inquilino) e
-- cargo no condominio (sindico) desde o schema original: um sindico que
-- aluga aparece como 'sindico' e a informacao de que e inquilino se perde.
-- Aqui os dois convivem — da pra ser inquilino do 302 E subsindico.
create table if not exists cargos (
  id uuid primary key default uuid_generate_v4(),
  condominio_id uuid not null references condominios(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  cargo cargo_condominio not null,
  atribuido_por uuid references usuarios(id),
  criado_em timestamptz not null default now(),
  unique (condominio_id, usuario_id)
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
alter table reservas enable row level security;
alter table regras enable row level security;
alter table cargos enable row level security;

-- Quem e sindico e quem e subsindico, para o Mural marcar embaixo do nome.
--
-- Precisa ser security definer porque a informacao estava pela metade: o
-- subsindico vem de `cargos`, mas o SINDICO vem de `vinculos.papel`, e a
-- policy de vinculos so libera a linha pro proprio dono e pra quem
-- pode_fiscalizar(). Um morador comum nao tinha como descobrir quem e o
-- sindico do proprio predio.
--
-- Devolve so o rotulo. Abrir o select de `vinculos` pro predio resolveria
-- tambem, mas entregaria unidade e status do vinculo de todo mundo junto.
--
-- Os nomes de retorno sao distintos das colunas das tabelas (`id_usuario`,
-- nao `usuario_id`) por causa da armadilha nº2: em `returns table` o
-- Postgres cria uma variavel com o nome da coluna de retorno, e ela colide
-- com a coluna homonima dentro do corpo.
create or replace function papeis_do_condominio(p_condominio_id uuid)
returns table (id_usuario uuid, rotulo text)
language sql
security definer
stable
as $$
  select v.usuario_id, 'Síndico'::text
  from vinculos v
  join unidades u on u.id = v.unidade_id
  where u.condominio_id = p_condominio_id
    and v.status = 'aprovado'
    and v.papel = 'sindico'

  union all

  select c.usuario_id, 'Subsíndico'::text
  from cargos c
  where c.condominio_id = p_condominio_id
    and c.cargo = 'subsindico';
$$;

-- So responde sobre condominio de que o proprio usuario participa. Sem esta
-- checagem, o security definer acima viraria vazamento entre condominios:
-- daria pra passar qualquer condominio_id e listar o sindico dele.
create or replace function papeis_do_meu_condominio(p_condominio_id uuid)
returns table (id_usuario uuid, rotulo text)
language sql
security definer
stable
as $$
  select p.id_usuario, p.rotulo
  from papeis_do_condominio(p_condominio_id) p
  where p_condominio_id in (select condominios_do_usuario());
$$;

revoke execute on function papeis_do_condominio(uuid) from public;
revoke execute on function papeis_do_condominio(uuid) from anon;
revoke execute on function papeis_do_condominio(uuid) from authenticated;
grant execute on function papeis_do_meu_condominio(uuid) to authenticated;

-- Datas em que o salao ja esta reservado, para o seletor de data desabilitar.
--
-- Existe porque a policy de `reservas` passou a mostrar so as da propria
-- unidade: sem esta funcao o cliente nao teria como saber o que bloquear.
-- Devolve O MINIMO — so as datas, sem unidade, sem nome, sem motivo. Abrir a
-- policy de volta resolveria tambem, e entregaria tudo o que foi escondido.
--
-- So as APROVADAS bloqueiam. Varias unidades podem disputar a mesma data com
-- pedidos pendentes, e e isso que da ao sindico a escolha entre dois pedidos.
--
-- Armadilha nº14: a clausula final e o que impede passar um condominio_id
-- qualquer e mapear a agenda do salao de outro predio.
create or replace function datas_ocupadas(p_condominio_id uuid, p_de date, p_ate date)
returns setof date
language sql
security definer
stable
as $$
  select r.data
  from reservas r
  where r.condominio_id = p_condominio_id
    and r.status = 'aprovada'
    and r.data between p_de and p_ate
    and p_condominio_id in (select condominios_do_usuario())
  order by r.data;
$$;

revoke execute on function datas_ocupadas(uuid, date, date) from public;
revoke execute on function datas_ocupadas(uuid, date, date) from anon;
grant execute on function datas_ocupadas(uuid, date, date) to authenticated;

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
    pode_fiscalizar((select condominio_id from unidades where id = unidade_id))
  );

drop policy if exists "sindico aprova vinculo" on vinculos;
create policy "sindico aprova vinculo" on vinculos
  for update using (
    pode_gerir((select condominio_id from unidades where id = unidade_id))
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
  for update using (pode_gerir(condominio_id));

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

-- Conselho fiscal fica de fora do pedido privado de proposito: ele fiscaliza
-- contas, nao queixa domestica. E a unica clausula do app que usa
-- pode_gerir() onde pode_fiscalizar() pareceria natural.
drop policy if exists "ver problemas do meu condominio" on problemas;
create policy "ver problemas do meu condominio" on problemas
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (
      area_comum
      or autor_id = auth.uid()
      or pode_gerir(condominio_id)
    )
  );

drop policy if exists "relatar problema" on problemas;
create policy "relatar problema" on problemas
  for insert with check (
    autor_id = auth.uid()
    and condominio_id in (select condominios_do_usuario())
  );

drop policy if exists "sindico atualiza status do problema" on problemas;
create policy "sindico atualiza status do problema" on problemas
  for update using (pode_gerir(condominio_id));

-- Armadilha nº8: filho nao herda visibilidade do pai. Sem repetir a clausula
-- de `area_comum` aqui, o pedido privado some da tela do vizinho e o
-- historico dele continua legivel pela API.
drop policy if exists "ver historico" on historico_status;
create policy "ver historico" on historico_status
  for select using (
    problema_id in (
      select id from problemas
      where condominio_id in (select condominios_do_usuario())
        and (
          area_comum
          or autor_id = auth.uid()
          or pode_gerir(condominio_id)
        )
    )
  );

drop policy if exists "sindico registra historico" on historico_status;
create policy "sindico registra historico" on historico_status
  for insert with check (
    problema_id in (select id from problemas where pode_gerir(condominio_id))
  );

drop policy if exists "ver avisos do meu condominio" on avisos;
create policy "ver avisos do meu condominio" on avisos
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (not restrito or pode_fiscalizar(condominio_id))
  );

drop policy if exists "sindico cria aviso" on avisos;
create policy "sindico cria aviso" on avisos
  for insert with check (pode_gerir(condominio_id) and autor_id = auth.uid());

drop policy if exists "sindico edita aviso" on avisos;
create policy "sindico edita aviso" on avisos
  for update using (pode_gerir(condominio_id));

drop policy if exists "ver votacoes do meu condominio" on votacoes;
create policy "ver votacoes do meu condominio" on votacoes
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (not restrito or pode_fiscalizar(condominio_id))
  );

drop policy if exists "sindico cria votacao" on votacoes;
create policy "sindico cria votacao" on votacoes
  for insert with check (pode_gerir(condominio_id) and autor_id = auth.uid());

-- Apuracao so pro gabinete. Antes esta policy liberava o condominio inteiro,
-- e um morador comum lia pela API nao so o placar como QUAL UNIDADE votou o
-- que — o voto nunca foi secreto, a tela e que nao mostrava.
--
-- Cada um enxerga o voto da propria unidade (a tela precisa saber o que
-- marcar); quem fiscaliza enxerga todos. O conselho entra junto via
-- pode_fiscalizar: conferir apuracao e o que o cargo existe pra fazer.
drop policy if exists "ver votos do meu condominio" on votos;
create policy "ver votos do meu condominio" on votos
  for select using (
    votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
    )
    and (
      unidade_id in (
        select unidade_id from vinculos
        where usuario_id = auth.uid() and status = 'aprovado'
      )
      or pode_fiscalizar((select v.condominio_id from votacoes v where v.id = votacao_id))
    )
  );

-- `data_fim > now()` nas duas policies abaixo: a tela sempre filtrou por
-- prazo, mas nada impedia registrar voto em votacao encerrada direto pela
-- API. Com insert e update coexistindo, criterios diferentes divergiriam.
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
        and data_fim > now()
    )
  );

-- Trocar o voto enquanto a votacao esta aberta.
--
-- Voto e POR UNIDADE, nao por pessoa (unique (votacao_id, unidade_id) desde o
-- schema original). Entao quem troca nao precisa ser quem lancou: qualquer
-- morador aprovado da mesma unidade pode. E o voto do 302, nao o do Fulano.
-- O `with check` grava usuario_id = auth.uid(), registrando quem trocou.
--
-- Nao ha policy de delete de proposito: da pra TROCAR o voto, nao pra
-- retira-lo. Retratar-se para "nao votei" mudaria o denominador do quorum, e
-- isso e decisao de assembleia, nao de tela.
drop policy if exists "trocar voto" on votos;
create policy "trocar voto" on votos
  for update
  using (
    unidade_id in (
      select unidade_id from vinculos
      where usuario_id = auth.uid() and status = 'aprovado'
    )
    and votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
        and data_fim > now()
    )
  )
  with check (
    usuario_id = auth.uid()
    and unidade_id in (
      select unidade_id from vinculos
      where usuario_id = auth.uid() and status = 'aprovado'
    )
    and votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
        and data_fim > now()
    )
  );

drop policy if exists "ver reunioes do meu condominio" on reunioes;
create policy "ver reunioes do meu condominio" on reunioes
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (not restrito or pode_fiscalizar(condominio_id))
  );

drop policy if exists "sindico cria reuniao" on reunioes;
create policy "sindico cria reuniao" on reunioes
  for insert with check (pode_gerir(condominio_id) and autor_id = auth.uid());

-- reunioes tinha select e insert; o update entrou junto do cancelamento.
drop policy if exists "sindico edita reuniao" on reunioes;
create policy "sindico edita reuniao" on reunioes
  for update using (pode_gerir(condominio_id));

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

drop policy if exists "desmarcar presenca" on rsvps;
create policy "desmarcar presenca" on rsvps
  for delete using (usuario_id = auth.uid());

-- A lista do salao e da propria unidade. O argumento contra fechar era que
-- ela informa se o dia 20 esta livre — cai por terra assim que o seletor de
-- data bloqueia as datas ocupadas via datas_ocupadas(): a disponibilidade
-- passa a ser entregue pelo calendario, e quem reservou o dia 21 deixa de
-- ser informacao necessaria.
--
-- pode_gerir() e nao pode_fiscalizar(): quem aprova precisa ver os pedidos;
-- o conselho nao tem o que fazer com o motivo da festa do vizinho.
drop policy if exists "ver reservas do meu condominio" on reservas;
create policy "ver reservas do meu condominio" on reservas
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (
      unidade_id in (
        select unidade_id from vinculos
        where usuario_id = auth.uid() and status = 'aprovado'
      )
      or pode_gerir(condominio_id)
    )
  );

-- Mesma checagem de unidade usada em `votos`: não basta o usuario_id bater,
-- a unidade tem que ser mesmo dele — senão dá pra reservar em nome do vizinho.
drop policy if exists "pedir reserva" on reservas;
create policy "pedir reserva" on reservas
  for insert with check (
    usuario_id = auth.uid()
    and condominio_id in (select condominios_do_usuario())
    and unidade_id in (
      select unidade_id from vinculos
      where usuario_id = auth.uid() and status = 'aprovado'
    )
  );

drop policy if exists "sindico decide reserva" on reservas;
create policy "sindico decide reserva" on reservas
  for update using (pode_gerir(condominio_id));

-- O morador desiste do próprio pedido. O síndico não apaga: ele recusa,
-- e a recusa fica registrada.
drop policy if exists "cancelar propria reserva" on reservas;
create policy "cancelar propria reserva" on reservas
  for delete using (usuario_id = auth.uid());

drop policy if exists "ver meu condominio" on condominios;
create policy "ver meu condominio" on condominios
  for select using (id in (select condominios_do_usuario()));

drop policy if exists "ver unidades do meu condominio" on unidades;
create policy "ver unidades do meu condominio" on unidades
  for select using (condominio_id in (select condominios_do_usuario()));

-- Insert direto com policy resolve o cadastro de unidades pelo síndico —
-- não precisa de RPC, porque aqui o condominio_id já existe e
-- pode_gerir() já funciona.
drop policy if exists "sindico cria unidade" on unidades;
create policy "sindico cria unidade" on unidades
  for insert with check (pode_gerir(condominio_id));

-- NOVO: síndico pode remover post/comentário do feed (moderação)
drop policy if exists "sindico modera posts" on posts;
create policy "sindico modera posts" on posts
  for delete using (pode_gerir(condominio_id));

drop policy if exists "sindico modera comentarios" on comentarios;
create policy "sindico modera comentarios" on comentarios
  for delete using (
    post_id in (select id from posts where pode_gerir(condominio_id))
  );

-- O condominio inteiro ve quem e SUBSINDICO; conselho fiscal so o gabinete.
--
-- A tabela nasceu legivel por todos, com o argumento de que "cargo oculto
-- gera desconfianca em assembleia". Revisto em 21/08/2026: o morador precisa
-- saber a quem recorrer — sindico e subsindico — e o conselho fiscal nao e
-- isso. Ele fiscaliza contas; anuncia-lo no mural nao ajuda o morador e
-- expoe quem aceitou o cargo.
--
-- Sem esta clausula, esconder o conselho em papeis_do_condominio() seria
-- teatro: a tabela continuaria legivel direto pela API.
--
-- Nao ha risco de auto-bloqueio: pode_fiscalizar() e security definer e le
-- `cargos` por fora do RLS, entao o proprio conselheiro enxerga a linha dele.
drop policy if exists "ver cargos do meu condominio" on cargos;
create policy "ver cargos do meu condominio" on cargos
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (cargo = 'subsindico' or pode_fiscalizar(condominio_id))
  );

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

-- Regras têm SÓ policy de leitura, de propósito: escrever é sempre pelo RPC
-- salvar_regras, que publica o aviso na mesma transação. Sem policy de
-- insert/update não existe caminho que mude as regras sem avisar ninguém.
drop policy if exists "ver regras do meu condominio" on regras;
create policy "ver regras do meu condominio" on regras
  for select using (condominio_id in (select condominios_do_usuario()));

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
  if not pode_gerir(p_condominio_id) then
    raise exception 'Só o síndico ou o subsíndico podem editar as regras';
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

-- ============================================================
-- O PostgREST guarda em cache a lista de funcoes expostas pela API. Sem este
-- aviso, uma funcao recem-criada responde "could not find the function ... in
-- the schema cache" ate ele reiniciar sozinho.
-- ============================================================
notify pgrst, 'reload schema';
