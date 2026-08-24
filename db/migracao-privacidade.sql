-- ============================================================
-- MIGRAÇÃO — Solicitação privada: manutenção da unidade e salão individual
-- Rodar uma vez no SQL Editor do Supabase. Já está dobrada dentro de
-- varanda-schema.sql; depois de aplicada, este arquivo pode ser apagado.
--
-- Rodar DEPOIS das outras três (mural, votos, solicitações). Não depende
-- delas pra funcionar, mas `pode_gerir()` precisa existir — veio na
-- migração de cargos, já aplicada em 21/08/2026.
--
-- Toca em dados só pra criar a coluna `area_comum` com default `true`: todo
-- pedido de manutenção que já existe continua público, que é como ele foi
-- escrito. O resto são policies e uma função nova.
-- ============================================================

-- ------------------------------------------------------------
-- 1. MANUTENÇÃO — área comum vs. minha unidade
-- ------------------------------------------------------------
-- Até aqui todo pedido de conserto era público, e isso não era descuido: a
-- visibilidade pública entrega duas coisas que nenhuma tela substitui.
--
--   dedup   — três vizinhos relatando o mesmo portão sem saber uns dos
--             outros geram três chamados e a sensação de que ninguém liga.
--   pressão — o badge "aberto há X dias" só cobra porque o prédio inteiro
--             está vendo o número.
--
-- Por isso `area_comum` é o DEFAULT: quem não pensar no assunto publica pro
-- prédio, e as duas propriedades acima seguem valendo. O que muda é a
-- torneira do próprio banheiro, que nunca precisou de plateia.
alter table problemas
  add column if not exists area_comum boolean not null default true;

comment on column problemas.area_comum is
  'true = o prédio inteiro vê (dedup e pressão). false = só o autor e quem pode_gerir().';

-- Conselho fiscal fica de fora do pedido privado de propósito: ele fiscaliza
-- contas, não queixa doméstica. É a única cláusula do app que usa
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

-- ARMADILHA Nº8, de novo — e é a razão de esta migração existir em duas
-- partes e não em uma. `historico_status` é filho de `problemas` e a policy
-- dele só reconferia o CONDOMÍNIO, nunca a visibilidade do pai. Sem repetir
-- a cláusula aqui, o pedido privado some da tela do vizinho e o histórico
-- dele continua legível pela API — exatamente o que aconteceu com os votos
-- da votação restrita.
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

-- A policy de insert não muda: `autor_id = auth.uid()` já impede relatar em
-- nome de outro, e o morador escolhe livremente se o pedido é público.

-- ------------------------------------------------------------
-- 2. SALÃO — a lista é da própria unidade
-- ------------------------------------------------------------
-- O argumento contra fechar esta lista era que ela é o que informa se o dia
-- 20 está livre. Cai por terra assim que o seletor de data bloqueia as datas
-- ocupadas: aí a disponibilidade é entregue pelo CALENDÁRIO, e o morador do
-- 54 não precisa saber quem reservou o dia 21 nem por quê — basta saber que
-- não dá.
--
-- pode_gerir() e não pode_fiscalizar(): quem aprova precisa ver os pedidos;
-- o conselho não tem o que fazer com o motivo da festa do vizinho.
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

-- Com a policy fechada o cliente não consegue mais ler as reservas dos
-- outros pra saber o que desabilitar no calendário. A saída é a mesma de
-- papeis_do_meu_condominio(): uma função que devolve O MÍNIMO — só as datas,
-- sem unidade, sem nome, sem motivo. Abrir a policy de volta resolveria
-- também, e entregaria tudo o que acabamos de esconder.
--
-- Só as APROVADAS bloqueiam. Várias unidades podem disputar a mesma data com
-- pedidos pendentes, e é justamente isso que dá ao síndico a escolha entre
-- dois pedidos — ver os índices parciais no schema.
--
-- ARMADILHA Nº14: security definer sem checar o chamador é vazamento entre
-- condomínios. A cláusula final é o que impede passar um condominio_id
-- qualquer e mapear a agenda do salão de outro prédio.
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

-- Armadilha nº19: função nova via .rpc() só aparece depois que o PostgREST
-- recarrega o cache de schema.
notify pgrst, 'reload schema';
