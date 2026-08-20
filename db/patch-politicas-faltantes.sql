-- ============================================================
-- PATCH — políticas que faltavam (idempotente)
-- Rodar no SQL Editor do Supabase. Depois de aplicado, dobrar
-- este conteúdo dentro de varanda-schema.sql e apagar o arquivo.
--
-- Contexto: RLS que bloqueia um DELETE ou um SELECT não devolve
-- erro pro client — devolve 0 linhas. Então cada um dos itens
-- abaixo era uma falha silenciosa (armadilha nº3 do CONTEXTO),
-- que nenhum Alert.alert no app ia pegar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. DESCURTIR — curtidas só tinha select + insert.
--    Sem isso o botão de curtir só funciona de ida.
-- ------------------------------------------------------------
drop policy if exists "descurtir post" on curtidas;
create policy "descurtir post" on curtidas
  for delete using (usuario_id = auth.uid());

-- ------------------------------------------------------------
-- 2. DESMARCAR PRESENÇA — rsvps só tinha select + insert.
--    O toggleRsvp do app já fazia o delete desde sempre; ele
--    nunca removeu nada de fato.
-- ------------------------------------------------------------
drop policy if exists "desmarcar presenca" on rsvps;
create policy "desmarcar presenca" on rsvps
  for delete using (usuario_id = auth.uid());

-- ------------------------------------------------------------
-- 3. RETIRAR APOIO — mesma classe de buraco em apoios.
--    (Sugestões: dá pra apoiar, não dá pra desapoiar.)
-- ------------------------------------------------------------
drop policy if exists "retirar apoio" on apoios;
create policy "retirar apoio" on apoios
  for delete using (usuario_id = auth.uid());

-- ------------------------------------------------------------
-- 4. VER NOME DOS VIZINHOS
--    usuarios só tinha "select using (id = auth.uid())", ou seja
--    cada usuário só enxerga o próprio perfil. O embed
--    usuarios!autor_id(nome) do Mural volta null pra todo post de
--    outra pessoa — é por isso que o feed mostra "Vizinho" em vez
--    do nome real. Também bloquearia a "lista de condôminos".
--
--    Função security definer pra evitar recursão de RLS (vinculos
--    tem RLS próprio e seria reavaliado dentro da policy).
--
--    ATENÇÃO / DECISÃO EM ABERTO: RLS é por linha, não por coluna.
--    Liberar a linha libera telefone e foto_url junto com o nome
--    pra qualquer vizinho que chame a API direto (a UI mostrar só
--    o nome não protege nada). Se telefone tiver que ficar
--    restrito ao síndico, o caminho é mover contato pra uma tabela
--    separada com policy própria. Ver CONTEXTO.md, Parte 2.
-- ------------------------------------------------------------
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

drop policy if exists "ver vizinhos do meu condominio" on usuarios;
create policy "ver vizinhos do meu condominio" on usuarios
  for select using (id in (select usuarios_do_meu_condominio()));
