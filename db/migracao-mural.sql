-- ============================================================
-- MIGRAÇÃO — Cargos no Mural e regras de destaque do Oficial
--
--   1. quem é síndico/subsíndico, visível a todo o prédio
--   2. conselho fiscal deixa de ser público
--   3. um aviso fixado por vez
--   4. aviso restrito não pode ser fixado
-- Rodar uma vez no SQL Editor do Supabase. Já está dobrada dentro de
-- varanda-schema.sql; depois de aplicada, este arquivo pode ser apagado.
--
-- Mexe em dados de leve: desfixa avisos restritos e colapsa fixados
-- duplicados (o seed de demonstração tinha um aviso restrito fixado). Não
-- precisa re-rodar o seed — mas o arquivo do seed também foi corrigido, então
-- re-rodar não vai reintroduzir o problema.
-- ============================================================

-- ---------- 1. QUEM É SÍNDICO E SUBSÍNDICO, VISÍVEL A TODOS ----------
-- O Mural marca embaixo do nome quem é síndico e quem é subsíndico, pra que
-- um morador recém-chegado saiba de quem está lendo. Essa informação estava
-- pela metade:
--
--   - subsíndico vem de `cargos`, que TODO o condomínio já lia;
--   - síndico vem de `vinculos.papel`, e a policy de `vinculos` só libera a
--     linha pro próprio dono e pra quem pode_fiscalizar(). Um morador comum
--     não tinha como descobrir quem é o síndico do próprio prédio.
--
-- A saída é uma função `security definer` que devolve SÓ o rótulo do cargo.
-- Abrir a policy de select de `vinculos` para o prédio inteiro resolveria
-- também, mas entregaria junto unidade e status do vínculo de todo mundo —
-- muito mais do que a pergunta pede.
--
-- Nomes de retorno propositalmente distintos das colunas das tabelas
-- (`id_usuario`, não `usuario_id`): em função que usa `returns table`, o
-- Postgres cria uma variável com o nome da coluna de retorno e ela colide
-- com a coluna homônima dentro do corpo (armadilha nº2).
create or replace function papeis_do_condominio(p_condominio_id uuid)
returns table (id_usuario uuid, rotulo text)
language sql
security definer
stable
as $$
  -- Síndico: mora em vinculos.papel.
  select v.usuario_id, 'Síndico'::text
  from vinculos v
  join unidades u on u.id = v.unidade_id
  where u.condominio_id = p_condominio_id
    and v.status = 'aprovado'
    and v.papel = 'sindico'

  union all

  -- Subsíndico: mora em cargos. O conselho fiscal NÃO entra aqui — quem
  -- fiscaliza as contas não precisa ser anunciado no mural.
  select c.usuario_id, 'Subsíndico'::text
  from cargos c
  where c.condominio_id = p_condominio_id
    and c.cargo = 'subsindico';
$$;

-- Só responde sobre condomínio de que o próprio usuário participa. Sem esta
-- checagem, `security definer` viraria um vazamento entre condomínios: daria
-- pra passar qualquer condominio_id e listar o síndico dele.
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

-- ---------- 2. CONSELHO FISCAL DEIXA DE SER PÚBLICO ----------
-- Reverte parte da decisão tomada com a tabela `cargos`: ela nascia legível
-- pelo condomínio inteiro, com o argumento de que "cargo oculto gera
-- desconfiança em assembleia". Decisão do Vitor em 21/08/2026: o morador
-- comum precisa saber a quem recorrer — síndico e subsíndico — e o conselho
-- fiscal não é isso. Ele fiscaliza contas; anunciá-lo no mural não ajuda o
-- morador e expõe quem aceitou o cargo.
--
-- Sem reescrever esta policy, esconder o conselho na função acima seria
-- teatro: a tabela continuaria legível direto pela API.
--
-- Nenhum risco de auto-bloqueio: pode_fiscalizar() é security definer e lê
-- `cargos` por fora do RLS, então o próprio conselheiro continua enxergando
-- a linha dele.
drop policy if exists "ver cargos do meu condominio" on cargos;
create policy "ver cargos do meu condominio" on cargos
  for select using (
    condominio_id in (select condominios_do_usuario())
    and (cargo = 'subsindico' or pode_fiscalizar(condominio_id))
  );

-- ---------- 3. UM AVISO FIXADO POR VEZ ----------
-- Vira invariante de banco, não disciplina de tela: hoje três caminhos
-- diferentes criam aviso fixado (o formulário do síndico, o RPC
-- `salvar_regras` quando o regimento muda, e o cancelamento de reunião).
-- Garantir na UI significaria lembrar disso nos três, e esquecer no quarto.
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

-- AFTER, e disparando só quando o novo valor é `true`: o próprio update lá
-- dentro dispara o gatilho de novo nas outras linhas, mas com fixado = false,
-- e aí o `when` corta a recursão.
drop trigger if exists aviso_fixado_unico on avisos;
create trigger aviso_fixado_unico
after insert or update of fixado on avisos
for each row when (new.fixado)
execute function garantir_um_aviso_fixado();

-- ---------- 4. RESTRITO NÃO FIXA ----------
-- Aviso fixado é o que o prédio inteiro vê primeiro. Um aviso do gabinete
-- ocupando esse lugar desperdiça o destaque: para o morador comum ele nem
-- existe, e o topo do Oficial fica vazio sem explicação.
--
-- Limpa antes de restringir, senão o `alter table` falha na linha do seed.
update avisos set fixado = false where restrito and fixado;

-- E colapsa os fixados que já existem: mantém o mais recente de cada
-- condomínio. O gatilho acima só vale daqui pra frente.
update avisos a
set fixado = false
where a.fixado
  and exists (
    select 1 from avisos b
    where b.condominio_id = a.condominio_id
      and b.fixado
      and (b.criado_em, b.id) > (a.criado_em, a.id)
  );

alter table avisos drop constraint if exists avisos_restrito_nao_fixa;
alter table avisos add constraint avisos_restrito_nao_fixa
  check (not (restrito and fixado));

-- ---------- 5. RECARREGAR O CACHE DO POSTGREST ----------
-- O PostgREST guarda em cache a lista de funções expostas pela API. Criar a
-- função não é suficiente: sem este aviso ele responde
-- "could not find the function public.papeis_do_meu_condominio in the schema
-- cache" até reiniciar sozinho. Vale pra toda função nova chamada via .rpc().
notify pgrst, 'reload schema';
