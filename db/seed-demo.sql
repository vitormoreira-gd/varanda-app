-- ============================================================
-- SEED DE DEMONSTRAÇÃO — Edifício Alvorada
--
-- Popula um condomínio fictício pra apresentar o app a um síndico. Não é
-- fixture de teste: o conteúdo é o argumento de venda. Um Mural vazio e um
-- Oficial em branco não demonstram nada — quem vê conclui que o app não faz
-- nada, não que ainda não tem dados.
--
-- PRÉ-REQUISITOS
--
-- 1. `db/varanda-schema.sql` aplicado (inclui a migração de cargos).
-- 2. As CINCO contas abaixo criadas à mão no painel do Supabase, em
--    Authentication → Users → Add user, com "Auto Confirm User" LIGADO.
--    Todas com a senha  demo1234  (é a que lib/demo.ts usa):
--
--      sindico@demo.varanda.app
--      subsindico@demo.varanda.app
--      conselho@demo.varanda.app
--      morador@demo.varanda.app
--      pendente@demo.varanda.app
--
--    Criar pelo painel em vez de inserir em auth.users por SQL é de
--    propósito: o insert manual exige acertar o hash da senha na mão e
--    quebra quando o Supabase mexe no schema de auth.
--
-- 3. Rodar este arquivo inteiro no SQL Editor.
--
-- É RE-EXECUTÁVEL. Roda de novo e a demonstração volta ao estado inicial —
-- o `delete` do começo derruba o condomínio e tudo pendurado nele em
-- cascata. Útil depois de uma apresentação em que você mexeu nos dados.
--
-- Não toca no condomínio real: tudo aqui está preso a um condominio_id
-- próprio, e o RLS já isola um do outro.
--
-- As datas são todas RELATIVAS a `now()`. Datas fixas envelheceriam entre
-- escrever o seed e apresentar, e o badge "aberto há X dias" mostraria
-- número errado justo na feature que prova acompanhamento.
-- ============================================================

-- ------------------------------------------------------------
-- Auxiliares de fuso. A TimeZone da sessão no Supabase é UTC, então
-- `date_trunc('day', now())` e `current_date` respondem em UTC: pedir
-- "19h" sem converter agendaria a assembleia para as 16h de Brasília.
-- ------------------------------------------------------------
create or replace function data_local(p_dias int default 0)
returns date
language sql
stable
as $fn$
  select ((now() at time zone 'America/Sao_Paulo')::date + p_dias);
$fn$;

create or replace function hora_local(p_dias int, p_hora text)
returns timestamptz
language sql
stable
as $fn$
  select ((data_local(p_dias) + p_hora::time) at time zone 'America/Sao_Paulo');
$fn$;

do $$
declare
  v_cond   uuid;
  -- unidades
  u101 uuid; u102 uuid; u103 uuid; u201 uuid; u202 uuid; u203 uuid;
  -- pessoas
  helena  uuid;  -- síndica
  rogerio uuid;  -- subsíndico
  marina  uuid;  -- conselho fiscal
  caio    uuid;  -- morador comum
  tereza  uuid;  -- vínculo ainda pendente de aprovação
  -- conteúdo referenciado depois
  p1 uuid; p2 uuid; p4 uuid; p5 uuid; p6 uuid;
  pb1 uuid; pb2 uuid; pb3 uuid; pb4 uuid;
  vot_publica uuid; vot_restrita uuid;
  reu_assembleia uuid;

  v_faltando text;
begin
  -- ---------- 1. localizar as contas ----------
  select id into helena  from auth.users where email = 'sindico@demo.varanda.app';
  select id into rogerio from auth.users where email = 'subsindico@demo.varanda.app';
  select id into marina  from auth.users where email = 'conselho@demo.varanda.app';
  select id into caio    from auth.users where email = 'morador@demo.varanda.app';
  select id into tereza  from auth.users where email = 'pendente@demo.varanda.app';

  -- Falhar com o e-mail que falta na mensagem, e não com "null value in
  -- column usuario_id" trinta linhas adiante.
  v_faltando := coalesce(
    case when helena  is null then 'sindico@demo.varanda.app'    end,
    case when rogerio is null then 'subsindico@demo.varanda.app' end,
    case when marina  is null then 'conselho@demo.varanda.app'   end,
    case when caio    is null then 'morador@demo.varanda.app'    end,
    case when tereza  is null then 'pendente@demo.varanda.app'   end
  );
  if v_faltando is not null then
    raise exception
      'Conta % não existe em auth.users. Crie as cinco contas de demonstração no painel (Authentication → Add user, Auto Confirm ligado, senha demo1234) antes de rodar este seed.',
      v_faltando;
  end if;

  -- ---------- 2. zerar a demonstração anterior ----------
  -- Cascata a partir de condominios derruba unidades, vínculos, posts,
  -- sugestões, problemas, avisos, votações, reuniões, reservas, regras e
  -- cargos. As linhas de `usuarios` sobrevivem e são reaproveitadas.
  delete from condominios where nome = 'Edifício Alvorada';

  -- ---------- 3. perfis ----------
  insert into usuarios (id, nome) values
    (helena,  'Helena Prado'),
    (rogerio, 'Rogério Antunes'),
    (marina,  'Marina Belchior'),
    (caio,    'Caio Nogueira'),
    (tereza,  'Tereza Lins')
  on conflict (id) do update set nome = excluded.nome;

  -- ---------- 4. condomínio e unidades ----------
  insert into condominios (nome, endereco)
  values ('Edifício Alvorada', 'Rua das Acácias, 240')
  returning id into v_cond;

  insert into unidades (condominio_id, numero) values (v_cond, '101') returning id into u101;
  insert into unidades (condominio_id, numero) values (v_cond, '102') returning id into u102;
  insert into unidades (condominio_id, numero) values (v_cond, '103') returning id into u103;
  insert into unidades (condominio_id, numero) values (v_cond, '201') returning id into u201;
  insert into unidades (condominio_id, numero) values (v_cond, '202') returning id into u202;
  insert into unidades (condominio_id, numero) values (v_cond, '203') returning id into u203;

  -- ---------- 5. vínculos ----------
  -- O 103 fica vazio de propósito: pro síndico, "quem ainda não entrou" é a
  -- informação mais útil da lista de condôminos. E a Tereza fica pendente
  -- pra aba Vínculos ter o que aprovar durante a apresentação.
  insert into vinculos (usuario_id, unidade_id, papel, status, criado_em) values
    (helena,  u101, 'sindico',      'aprovado', now() - interval '40 days'),
    (rogerio, u102, 'proprietario', 'aprovado', now() - interval '35 days'),
    (marina,  u201, 'proprietario', 'aprovado', now() - interval '31 days'),
    (caio,    u202, 'inquilino',    'aprovado', now() - interval '12 days'),
    (tereza,  u203, 'proprietario', 'pendente', now() - interval '2 days');

  -- ---------- 6. cargos ----------
  insert into cargos (condominio_id, usuario_id, cargo, atribuido_por, criado_em) values
    (v_cond, rogerio, 'subsindico', helena, now() - interval '30 days'),
    (v_cond, marina,  'conselho',   helena, now() - interval '30 days');

  -- ---------- 7. regras ----------
  insert into regras (condominio_id, texto, versao, atualizado_por, atualizado_em)
  values (
    v_cond,
    'REGIMENTO INTERNO — EDIFÍCIO ALVORADA' || E'\n\n' ||
    '1. SILÊNCIO' || E'\n' ||
    'Das 22h às 8h nos dias de semana e das 22h às 10h aos domingos e feriados. Obras e reformas só de segunda a sexta, das 9h às 17h.' || E'\n\n' ||
    '2. SALÃO DE FESTAS' || E'\n' ||
    'Reserva pelo app, com no mínimo 3 dias de antecedência. Uma reserva por unidade a cada 30 dias. A entrega da chave e a devolução são conferidas pela portaria. Limpeza por conta de quem reservou.' || E'\n\n' ||
    '3. ÁREAS COMUNS' || E'\n' ||
    'Hall, escadas e corredores não podem ser usados como depósito, nem que seja temporariamente. Bicicletas ficam no bicicletário.' || E'\n\n' ||
    '4. ANIMAIS' || E'\n' ||
    'Permitidos. Nas áreas comuns, sempre na guia e acompanhados. O tutor recolhe os dejetos.' || E'\n\n' ||
    '5. MUDANÇAS' || E'\n' ||
    'Agendar com a portaria com 48h de antecedência. Só de segunda a sábado, das 8h às 18h.' || E'\n\n' ||
    '6. GARAGEM' || E'\n' ||
    'Cada unidade tem uma vaga demarcada. Visitantes usam as vagas rotativas junto à entrada, por no máximo 4 horas.' || E'\n\n' ||
    '7. LIXO' || E'\n' ||
    'Recicláveis nas lixeiras azuis do subsolo. Descarte de móveis e eletrodomésticos é responsabilidade do morador.',
    2,
    helena,
    now() - interval '22 days'
  );

  -- ---------- 8. mural ----------
  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, helena,
    'Pessoal, a obra do portão da garagem começa na segunda e deve levar uns 4 dias. Nesse período a entrada de veículos vai ser pelo portão de serviço. Desculpem o transtorno.',
    now() - interval '3 days')
  returning id into p1;

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, caio,
    'Alguém sabe de quem é o Fiat prata da vaga 12? Está com o farol aceso desde cedo. Avisei a portaria também.',
    now() - interval '2 days')
  returning id into p2;

  insert into posts (condominio_id, autor_id, texto, criado_em) values
    (v_cond, marina,
     'Achei um par de óculos de grau na escada entre o 1º e o 2º andar. Está comigo no 201, é só bater lá.',
     now() - interval '30 hours');

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, rogerio,
    'Consegui um orçamento bom de dedetização pra quem quiser rachar. Fica bem mais barato se fecharmos umas 4 unidades juntas. Me chamem no 102.',
    now() - interval '20 hours')
  returning id into p4;

  insert into posts (condominio_id, autor_id, texto, criado_em) values
    (v_cond, helena,
     'Lembrete: a assembleia é quinta, 19h, no salão. Dá pra confirmar presença pela aba Oficial aqui do app — assim eu já sei se teremos quórum.',
     now() - interval '3 hours');

  insert into curtidas (post_id, usuario_id) values
    (p1, rogerio), (p1, marina), (p1, caio),
    (p2, marina),
    (p4, helena), (p4, caio);

  insert into comentarios (post_id, autor_id, texto, criado_em) values
    (p1, caio,
     'Valeu pelo aviso. O portão de serviço comporta carro grande?',
     now() - interval '2 days 20 hours'),
    (p1, helena,
     'Comporta sim, Caio. Só é mais apertado na manobra, então vale ir devagar.',
     now() - interval '2 days 18 hours'),
    (p2, rogerio,
     'É do pessoal do 103, que ainda não entrou aqui no app. Já avisei pessoalmente.',
     now() - interval '1 day 22 hours'),
    (p4, caio,
     'Tenho interesse. Manda o valor por unidade quando puder.',
     now() - interval '16 hours');

  -- ---------- 9. (sugestões saíram do app) ----------
  -- Sugestão deixou de ser um tipo próprio em 21/08/2026: virou post do
  -- Mural, porque proposta em busca de adesão é exatamente o que curtida e
  -- comentário resolvem. Os três posts abaixo ocupam o lugar das três
  -- sugestões que este seed criava antes.

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, caio,
    'Bicicletário coberto na garagem' || E'\n\n' ||
    'Hoje quem tem bicicleta deixa presa na grade do subsolo, tomando chuva quando venta. Dava pra instalar um suporte coberto no canto que está sobrando, perto da vaga 20. O que vocês acham?',
    now() - interval '9 days')
  returning id into p5;

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, marina,
    'Trocar as lâmpadas do hall por LED' || E'\n\n' ||
    'As do hall e da escada ficam acesas praticamente o dia inteiro. A troca se paga em menos de um ano na conta de luz. Já levantei orçamento com dois fornecedores.',
    now() - interval '20 days')
  returning id into p6;

  insert into posts (condominio_id, autor_id, texto, criado_em) values
    (v_cond, rogerio,
     'Câmera na entrada de serviço — instalada!' || E'\n\n' ||
     'A entrada de serviço era o único ponto sem câmera. Foi aprovado na assembleia passada e o instalador vem na quinta.',
     now() - interval '45 days');

  insert into curtidas (post_id, usuario_id) values
    (p5, caio), (p5, marina), (p5, rogerio),
    (p6, marina), (p6, helena);

  -- ---------- 10. problemas ----------
  -- Os três primeiros cobrem as três faixas do "aberto há X dias": vermelho
  -- (7+ dias parado), âmbar (3 a 6) e resolvido. É a feature que responde à
  -- queixa nº1 contra síndico, então convém que apareça nas três cores.
  -- O quarto é privado — ver o comentário mais abaixo.
  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, caio, 'Infiltração no teto da garagem', 'Estrutural', 'Subsolo, perto da vaga 14',
    'Está pingando bem em cima da vaga 14 sempre que chove. A mancha no concreto cresceu bastante nas últimas semanas.',
    'aberto', now() - interval '9 days')
  returning id into pb1;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, marina, 'Portão social não trava sozinho', 'Segurança', 'Entrada principal',
    'A mola está fraca e o portão fica encostado sem travar. Já vi ele aberto duas vezes de madrugada.',
    'em_andamento', now() - interval '11 days')
  returning id into pb2;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, rogerio, 'Lâmpada queimada na escada do 2º', 'Elétrica', 'Escada, 2º andar',
    'O trecho entre o 1º e o 2º ficou totalmente escuro.',
    'resolvido', now() - interval '17 days')
  returning id into pb3;

  -- O quarto é PRIVADO, e é o que faz a régua de permissão aparecer na
  -- demonstração. Autor é o Caio, que é a conta "Morador":
  --   Síndico e Subsíndico veem, com a etiqueta "Só na unidade".
  --   Conselho fiscal NÃO vê — ele fiscaliza contas, não queixa doméstica.
  --   Morador vê, porque é dele.
  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao,
                         status, area_comum, criado_em)
  values (v_cond, caio, 'Torneira da cozinha pingando sem parar', 'Hidráulica', 'Cozinha, apto 202',
    'Pinga a noite inteira e já apareceu mancha embaixo da pia. Queria saber se é do encanamento do prédio antes de chamar alguém por conta.',
    'aberto', false, now() - interval '2 days')
  returning id into pb4;

  insert into historico_status (problema_id, status, autor_id, criado_em) values
    -- pb1 nunca foi movimentado: fica "aberto há 9 dias", em vermelho.
    (pb2, 'em_andamento', helena, now() - interval '4 days'),
    (pb3, 'em_andamento', helena, now() - interval '16 days'),
    (pb3, 'resolvido',    helena, now() - interval '15 days');

  -- ---------- 11. avisos ----------
  insert into avisos (condominio_id, autor_id, titulo, texto, fixado, restrito, criado_em) values
    (v_cond, helena,
     'Obra no portão da garagem — segunda a quinta',
     'A troca do motor do portão começa segunda-feira. Durante a obra, a entrada de veículos será pelo portão de serviço, das 6h às 22h. Fora desse horário, use o interfone da portaria.',
     true, false, now() - interval '3 days'),

    (v_cond, helena,
     'Taxa extra de manutenção do elevador',
     'A manutenção corretiva do elevador social foi aprovada na última assembleia. A parcela única de R$ 180 por unidade entra no boleto do mês que vem, discriminada em separado.',
     false, false, now() - interval '8 days'),

    (v_cond, helena,
     'Regras do condomínio atualizadas',
     'Incluímos o prazo mínimo de 3 dias para reserva do salão e o horário de mudanças aos sábados. A versão 2 já está no topo desta aba.',
     false, false, now() - interval '22 days'),

    -- O aviso restrito. Na apresentação, é o que some quando você entra
    -- como Morador — a prova de que a permissão é do banco, não da tela.
    -- `fixado` obrigatoriamente false: há uma check constraint impedindo
    -- restrito e fixado na mesma linha.
    (v_cond, helena,
     'Propostas de limpeza — analisar antes da assembleia',
     'Chegaram três propostas para o contrato de limpeza. A Prisma é a mais barata mas não cobre a garagem; as outras duas cobrem tudo, com diferença de R$ 400/mês entre elas. Vamos fechar posição antes de levar à assembleia.',
     false, true, now() - interval '1 day');

  -- ---------- 12. votações ----------
  insert into votacoes (condominio_id, autor_id, titulo, descricao, opcoes, restrito, data_inicio, data_fim)
  values (v_cond, helena,
    'Instalar o bicicletário coberto?',
    'Orçamento de R$ 3.200, rateado em duas parcelas. Ocupa o canto ocioso do subsolo, sem tirar vaga de ninguém.',
    array['Sim, aprovo', 'Não', 'Quero discutir na assembleia'],
    false, now() - interval '2 days', now() + interval '5 days')
  returning id into vot_publica;

  -- A votação restrita, e o teste que mais importa: o morador comum não pode
  -- ver nem ela nem os votos dela. As policies de `votos` repetem a cláusula
  -- de restrito de propósito — filho não herda visibilidade do pai em RLS.
  insert into votacoes (condominio_id, autor_id, titulo, descricao, opcoes, restrito, data_inicio, data_fim)
  values (v_cond, helena,
    'Contratar a Prisma ou renovar com a atual?',
    'Posição do gabinete antes de levar as três propostas à assembleia.',
    array['Prisma', 'Renovar a atual', 'Abrir nova concorrência'],
    true, now() - interval '1 day', now() + interval '3 days')
  returning id into vot_restrita;

  insert into votos (votacao_id, unidade_id, usuario_id, opcao, criado_em) values
    (vot_publica,  u101, helena,  'Sim, aprovo', now() - interval '2 days'),
    (vot_publica,  u201, marina,  'Sim, aprovo', now() - interval '1 day'),
    (vot_publica,  u102, rogerio, 'Quero discutir na assembleia', now() - interval '10 hours'),
    (vot_restrita, u101, helena,  'Renovar a atual', now() - interval '20 hours');

  -- ---------- 13. reuniões ----------
  insert into reunioes (condominio_id, autor_id, titulo, data_hora, local, pauta, restrito, criado_em)
  values (v_cond, helena, 'Assembleia ordinária',
    hora_local(4, '19:00'),
    'Salão de festas',
    'Prestação de contas do trimestre · resultado da votação do bicicletário · contrato de limpeza · assuntos gerais.',
    false, now() - interval '6 days')
  returning id into reu_assembleia;

  insert into reunioes (condominio_id, autor_id, titulo, data_hora, local, pauta, restrito, criado_em) values
    (v_cond, helena, 'Conselho: fechar posição sobre a limpeza',
     hora_local(2, '20:00'),
     'Portaria',
     'Comparar as três propostas e escolher qual levar à assembleia.',
     true, now() - interval '1 day'),

    (v_cond, helena, 'Conversa sobre a pintura da fachada',
     hora_local(9, '19:30'),
     'Salão de festas', 'Orçamentos de pintura.',
     false, now() - interval '10 days');

  -- Cancelamento é soft de propósito: quem confirmou presença precisa VER
  -- que foi cancelada. Apagar faria a reunião sumir em silêncio.
  update reunioes
  set cancelada_em = now() - interval '2 days',
      motivo_cancelamento = 'Adiada até sair o resultado da obra do portão.'
  where condominio_id = v_cond
    and titulo = 'Conversa sobre a pintura da fachada';

  insert into rsvps (reuniao_id, usuario_id, confirmado) values
    (reu_assembleia, marina,  true),
    (reu_assembleia, rogerio, true);

  -- ---------- 14. reservas do salão ----------
  insert into reservas (condominio_id, unidade_id, usuario_id, data, observacao, status, criado_em) values
    (v_cond, u202, caio,
     (data_local(10)), 'Aniversário de 8 anos da minha filha', 'aprovada', now() - interval '5 days'),
    -- Esta fica pendente pra você aprovar ao vivo, na frente do síndico.
    (v_cond, u102, rogerio,
     (data_local(18)), 'Almoço de família', 'pendente', now() - interval '1 day');

  raise notice 'Seed de demonstração aplicado. Condomínio "Edifício Alvorada" com 6 unidades, 4 moradores e 1 vínculo pendente.';
end $$;

drop function if exists hora_local(int, text);
drop function if exists data_local(int);
