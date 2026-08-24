-- ============================================================
-- MIGRAÇÃO — Sugestões viram posts do Mural
-- Rodar uma vez no SQL Editor do Supabase. Rode DEPOIS de
-- db/migracao-mural.sql e db/migracao-votos.sql.
--
-- MEXE EM DADOS. É reversível enquanto as tabelas existirem: a coluna
-- `migrado_para_post` guarda de onde veio cada post.
-- ============================================================

-- POR QUE
--
-- "Solicitação" carrega um contrato: eu peço, alguém decide, tem um estado.
-- Sugestão não tem isso — é proposta em busca de adesão, e adesão o Mural já
-- faz melhor, com curtida, comentário e o prédio inteiro vendo.
--
-- Problema, ao contrário, FICA: relatar um vazamento é pedir um conserto, e
-- disso depende o contador de "aberto há X dias", que é a resposta do app à
-- queixa nº1 contra síndico. Ele só troca de nome (vira "Manutenção") e de
-- casa (passa a ser um tipo de solicitação). Nenhum dado de `problemas` se
-- move nesta migração.

-- ---------- 1. RASTRO DA MIGRAÇÃO ----------
-- Guarda para onde cada sugestão foi. Serve pra tornar o script idempotente
-- (rodar duas vezes não duplica post) e pra permitir desfazer enquanto as
-- tabelas antigas existirem.
alter table sugestoes
  add column if not exists migrado_para_post uuid references posts(id) on delete set null;

-- ---------- 2. SUGESTÕES -> POSTS ----------
do $$
declare
  s record;
  novo_post uuid;
  quantos int := 0;
begin
  -- Só as ativas. As arquivadas foram tiradas de circulação de propósito
  -- pelo síndico, e o Mural não tem arquivo — republicá-las seria desfazer
  -- uma decisão dele.
  for s in
    select * from sugestoes
    where migrado_para_post is null
      and arquivado_em is null
    order by criado_em
  loop
    -- `posts` não tem título: o título vira a primeira linha, que é como as
    -- pessoas escrevem em grupo mesmo. A categoria se perde — era uma lista
    -- fixa imposta pelo app, não algo que o morador escreveu.
    insert into posts (condominio_id, autor_id, texto, criado_em)
    values (
      s.condominio_id,
      s.autor_id,
      s.titulo || E'\n\n' || s.descricao,
      s.criado_em
    )
    returning id into novo_post;

    -- Apoio e curtida são a mesma coisa: par (item, usuário). A PK de
    -- `curtidas` já impede duplicata.
    insert into curtidas (post_id, usuario_id)
    select novo_post, a.usuario_id
    from apoios a
    where a.sugestao_id = s.id
    on conflict do nothing;

    update sugestoes set migrado_para_post = novo_post where id = s.id;
    quantos := quantos + 1;
  end loop;

  raise notice 'Sugestões migradas para o Mural: %', quantos;
end $$;

-- ---------- 3. O QUE NÃO FOI FEITO AQUI, E POR QUÊ ----------
-- As tabelas `sugestoes` e `apoios` continuam de pé. Apagar agora tornaria a
-- migração irreversível antes de alguém conferir o resultado no celular.
-- Quando estiver confirmado, é só:
--
--   drop table apoios;
--   drop table sugestoes;
--
-- (nesta ordem — `apoios` referencia `sugestoes`). As policies e o enum
-- `status_sugestao` caem junto ou podem ser removidos depois.
