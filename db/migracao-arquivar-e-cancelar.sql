-- ============================================================
-- MIGRAÇÃO — arquivar solicitações, cancelar reunião, unique de unidade
-- Rodar no SQL Editor do Supabase. Depois de aplicado, dobrar dentro de
-- varanda-schema.sql e apagar este arquivo.
-- ============================================================

-- ------------------------------------------------------------
-- ARQUIVAR SUGESTÕES E PROBLEMAS
-- Soft delete: some da lista ativa, continua acessível no filtro
-- "Arquivadas". Nada é apagado — o histórico do condomínio importa.
-- Não precisa de policy nova: "sindico atualiza status da sugestao" e
-- "sindico atualiza status do problema" já liberam update pro síndico.
-- ------------------------------------------------------------
alter table sugestoes add column if not exists arquivado_em timestamptz;
alter table problemas add column if not exists arquivado_em timestamptz;

-- ------------------------------------------------------------
-- CANCELAR REUNIÃO
-- Cancelamento é soft de propósito: quem confirmou presença precisa VER
-- que foi cancelada. Apagar a linha faria a reunião sumir em silêncio da
-- tela de quem estava contando com ela — pior que não ter o recurso.
-- ------------------------------------------------------------
alter table reunioes add column if not exists cancelada_em timestamptz;
alter table reunioes add column if not exists motivo_cancelamento text;

-- reunioes tinha select e insert, faltava update.
drop policy if exists "sindico edita reuniao" on reunioes;
create policy "sindico edita reuniao" on reunioes
  for update using (eh_sindico(condominio_id));

-- ------------------------------------------------------------
-- UNIQUE DE UNIDADE (dívida técnica registrada no backlog)
-- A checagem de duplicata só existia no client. Índice de expressão em
-- vez de constraint porque `bloco` é nullable, e em unique constraint
-- dois NULLs não conflitam — sem o coalesce, "sem bloco / 101" poderia
-- ser cadastrado infinitas vezes.
--
-- Se já houver duplicata no banco, a criação falha. Para conferir antes:
--   select condominio_id, coalesce(bloco, ''), numero, count(*)
--   from unidades
--   group by 1, 2, 3
--   having count(*) > 1;
-- ------------------------------------------------------------
create unique index if not exists unidades_sem_duplicata
  on unidades (condominio_id, coalesce(bloco, ''), numero);
