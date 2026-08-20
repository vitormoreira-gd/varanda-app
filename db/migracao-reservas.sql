-- ============================================================
-- MIGRAÇÃO — reserva do salão (idempotente)
-- Rodar no SQL Editor do Supabase. Depois de aplicado, dobrar dentro de
-- varanda-schema.sql e apagar este arquivo.
-- ============================================================

do $$ begin
  create type status_reserva as enum ('pendente', 'aprovada', 'recusada');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- RESERVAS
-- Um salão por condomínio, reservado por dia inteiro. Se um dia existirem
-- várias áreas comuns (salão, churrasqueira, quadra), isso vira uma tabela
-- `areas_comuns` e uma FK aqui — hoje seria complexidade sem demanda.
--
-- Reserva é por UNIDADE, não por pessoa, na mesma lógica do voto: quem
-- reservou foi o apartamento 102, não o Fulano.
-- ------------------------------------------------------------
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

alter table reservas enable row level security;

drop policy if exists "ver reservas do meu condominio" on reservas;
create policy "ver reservas do meu condominio" on reservas
  for select using (condominio_id in (select condominios_do_usuario()));

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
  for update using (eh_sindico(condominio_id));

-- O morador desiste do próprio pedido. O síndico não apaga: ele recusa,
-- e a recusa fica registrada.
drop policy if exists "cancelar propria reserva" on reservas;
create policy "cancelar propria reserva" on reservas
  for delete using (usuario_id = auth.uid());
