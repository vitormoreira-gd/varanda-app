-- ============================================================
-- MIGRAÇÃO — Aviso vira o container: reunião e votação penduram nele
-- Rodar uma vez no SQL Editor do Supabase. Já está dobrada dentro de
-- db/varanda-schema.sql; depois de aplicada, este arquivo pode ser apagado.
--
-- Não apaga nada e não move dado nenhum: só acrescenta duas colunas
-- nulas, dois índices e um gatilho. As linhas que já existem ficam com
-- `aviso_id` nulo e continuam aparecendo sozinhas no feed.
-- ============================================================

-- POR QUE
--
-- O Oficial tinha quatro sub-abas — Avisos, Reuniões, Votações e Regras — e
-- isso obrigava o morador a saber em qual delas a informação estava antes de
-- procurá-la. Mas reunião e votação quase nunca nascem sozinhas: elas são
-- CONSEQUÊNCIA de um aviso. "Vamos trocar o corrimão" é o aviso; a votação
-- sobre o orçamento e a assembleia que decide são desdobramentos dele.
--
-- Separá-las em abas obrigava o síndico a publicar três vezes a mesma coisa,
-- e o morador a juntar as três de cabeça. Agora o aviso é o container: um
-- card, com o texto em cima e, embaixo, o botão de presença e a enquete.

alter table reunioes
  add column if not exists aviso_id uuid references avisos(id) on delete cascade;

alter table votacoes
  add column if not exists aviso_id uuid references avisos(id) on delete cascade;

-- O feed busca "as reuniões e votações destes avisos" a cada carregamento.
create index if not exists reunioes_por_aviso on reunioes (aviso_id) where aviso_id is not null;
create index if not exists votacoes_por_aviso on votacoes (aviso_id) where aviso_id is not null;

-- ---------- O RESTRITO DO PAI MANDA NO FILHO ----------
--
-- Esta é a parte que não pode falhar, e é a armadilha nº8 outra vez.
--
-- `avisos`, `reunioes` e `votacoes` têm cada uma a sua coluna `restrito` e a
-- sua policy. Se o síndico publicar um aviso restrito com uma votação
-- pendurada e a votação nascer com restrito = false, o morador comum não
-- veria o aviso — mas veria a votação solta no feed, com o título contando
-- exatamente aquilo que o aviso escondia. E, pior, leria os votos dela.
--
-- Garantir isso na tela seria lembrar em dois lugares hoje e esquecer no
-- terceiro amanhã. Aqui vira invariante: filho pendurado em aviso restrito
-- É restrito, independentemente do que o cliente mandou.
create or replace function herdar_restrito_do_aviso()
returns trigger
language plpgsql
as $fn$
begin
  if new.aviso_id is not null then
    select a.restrito into new.restrito
    from avisos a
    where a.id = new.aviso_id;
  end if;
  return new;
end
$fn$;

drop trigger if exists reuniao_herda_restrito on reunioes;
create trigger reuniao_herda_restrito
  before insert or update of aviso_id, restrito on reunioes
  for each row execute function herdar_restrito_do_aviso();

drop trigger if exists votacao_herda_restrito on votacoes;
create trigger votacao_herda_restrito
  before insert or update of aviso_id, restrito on votacoes
  for each row execute function herdar_restrito_do_aviso();

-- Nada aqui exige `aviso_id`: reunião e votação continuam podendo existir
-- sozinhas. É o que mantém as linhas antigas funcionando, e o que deixa o
-- síndico marcar uma reunião avulsa sem ter de inventar um aviso para ela.

notify pgrst, 'reload schema';
