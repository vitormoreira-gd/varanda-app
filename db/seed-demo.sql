-- ============================================================
-- SEED DE DEMONSTRAÇÃO — Edifício Alvorada
--
-- Popula um condomínio fictício pra apresentar o app a um síndico. Não é
-- fixture de teste: o conteúdo é o argumento de venda. Um Mural vazio e um
-- Oficial em branco não demonstram nada — quem vê conclui que o app não faz
-- nada, não que ainda não tem dados.
--
-- O PRÉDIO (reescrito em 07/09/2026, pra parecer um app em uso de verdade)
--
--   7 andares, 6 apartamentos por andar = 42 unidades.
--   28 unidades com morador no app (67% de adesão), 14 ainda vazias.
--   32 pessoas, 2 vínculos esperando aprovação.
--
--   É um prédio ANTIGO E SIMPLES: um elevador só, sem piscina e sem
--   portaria 24h — há um zelador que trabalha de dia. As áreas comuns são
--   a garagem (vagas cobertas e descobertas) e um salão de festas modesto.
--   A maior parte dos moradores é idosa, e isso decide o conteúdo: os
--   relatos são corrimão solto, elevador parando desnivelado, piso que
--   escorrega na chuva e interfone que não toca — não academia e coworking.
--
-- PRÉ-REQUISITOS
--
-- 1. `db/varanda-schema.sql` aplicado.
-- 2. As CINCO contas de demonstração criadas à mão no painel do Supabase,
--    em Authentication → Users → Add user, com "Auto Confirm User" LIGADO.
--    Todas com a senha  demo1234  (é a que lib/demo.ts usa):
--
--      sindico@demo.varanda.app
--      subsindico@demo.varanda.app
--      conselho@demo.varanda.app
--      morador@demo.varanda.app
--      pendente@demo.varanda.app
--
--    Só essas cinco existem pra LOGAR. Elas são criadas pelo painel de
--    propósito: o insert manual em auth.users exige acertar o hash da
--    senha e a linha correspondente em auth.identities, e quebra quando o
--    Supabase mexe no schema de auth.
--
-- 3. Rodar este arquivo inteiro no SQL Editor.
--
-- OS OUTROS 27 MORADORES SÃO CONTEÚDO, NÃO LOGINS. Eles existem porque
-- `usuarios.id` tem FK para `auth.users(id)` — sem uma linha lá, não há
-- como um vizinho assinar um post. O seed cria essas linhas por SQL, com
-- senha válida mas SEM registro em auth.identities: dá pra ver o nome
-- deles no Mural, não dá pra entrar com eles. É de propósito — a régua de
-- permissão se demonstra com as cinco contas de cima.
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

create extension if not exists pgcrypto with schema extensions;

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

-- ------------------------------------------------------------
-- Cria (ou reaproveita) a conta de um morador fictício e o perfil dele.
-- O search_path cobre `extensions` e `public` porque o pgcrypto pode estar
-- num ou noutro dependendo da idade do projeto Supabase.
-- ------------------------------------------------------------
create or replace function demo_conta(p_email text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $fn$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      p_email, crypt('demo1234', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );
  end if;

  insert into usuarios (id, nome) values (v_id, p_nome)
    on conflict (id) do update set nome = excluded.nome;

  return v_id;
end
$fn$;

create or replace function demo_uid(p_email text)
returns uuid
language sql
stable
as $fn$
  select id from auth.users where email = p_email;
$fn$;

create or replace function demo_unidade(p_cond uuid, p_numero text)
returns uuid
language sql
stable
as $fn$
  select id from unidades where condominio_id = p_cond and numero = p_numero;
$fn$;

do $$
declare
  v_cond uuid;
  v_andar int;
  v_ap int;
  v_faltando text;

  -- As cinco contas que LOGAM. O resto do prédio é conteúdo.
  helena  uuid;  -- síndica, 101
  rogerio uuid;  -- subsíndico, 102
  marina  uuid;  -- conselho fiscal, 201
  caio    uuid;  -- morador comum, 202
  tereza  uuid;  -- vínculo ainda pendente, 203

  -- conteúdo referenciado depois
  p_elevador uuid; p_farol uuid; p_encanador uuid; p_ajuda uuid;
  p_corrimao uuid; p_bolo uuid; p_gato uuid; p_agua uuid;
  pb_corrimao uuid; pb_elevador uuid; pb_lampada uuid; pb_infiltracao uuid;
  pb_interfone uuid; pb_portao uuid; pb_piso uuid; pb_bomba uuid;
  pb_torneira uuid; pb_mofo uuid;
  vot_corrimao uuid; vot_elevador uuid;
  reu_assembleia uuid; reu_conselho uuid;
  av_corrimao uuid; av_assembleia uuid; av_restrito uuid;
begin
  -- ---------- 1. localizar as contas de login ----------
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
      'Conta % nao existe em auth.users. Crie as cinco contas de demonstracao no painel (Authentication / Add user, Auto Confirm ligado, senha demo1234) antes de rodar este seed.',
      v_faltando;
  end if;

  -- ---------- 2. zerar a demonstração anterior ----------
  -- Cascata a partir de condominios derruba unidades, vínculos, posts,
  -- problemas, avisos, votações, reuniões, reservas, regras e cargos. As
  -- linhas de `usuarios` e de `auth.users` sobrevivem e são reaproveitadas.
  delete from condominios where nome = 'Edifício Alvorada';

  -- ---------- 3. perfis ----------
  insert into usuarios (id, nome) values
    (helena,  'Helena Prado'),
    (rogerio, 'Rogério Antunes'),
    (marina,  'Marina Belchior'),
    (caio,    'Caio Nogueira'),
    (tereza,  'Tereza Lins')
  on conflict (id) do update set nome = excluded.nome;

  -- Os vizinhos. Nomes de gente que morou a vida inteira no mesmo prédio: é
  -- o que dá verossimilhança à demonstração, e o que faz o síndico
  -- reconhecer o próprio condomínio na tela.
  perform demo_conta('waldemar@demo.varanda.app',  'Waldemar Siqueira');
  perform demo_conta('nair@demo.varanda.app',      'Nair Bittencourt');
  perform demo_conta('otavio@demo.varanda.app',    'Otávio Rezende');
  perform demo_conta('zilda@demo.varanda.app',     'Zilda Rezende');
  perform demo_conta('dalva@demo.varanda.app',     'Dalva Municelli');
  perform demo_conta('benedito@demo.varanda.app',  'Benedito Alencar');
  perform demo_conta('terezinha@demo.varanda.app', 'Terezinha Fagundes');
  perform demo_conta('elio@demo.varanda.app',      'Élio Sampaio');
  perform demo_conta('cleusa@demo.varanda.app',    'Cleusa Marcondes');
  perform demo_conta('wilson@demo.varanda.app',    'Wilson Braga');
  perform demo_conta('irene@demo.varanda.app',     'Irene Braga');
  perform demo_conta('sonia@demo.varanda.app',     'Sônia Vasques');
  perform demo_conta('jorge@demo.varanda.app',     'Jorge Lemos');
  perform demo_conta('neusa@demo.varanda.app',     'Neusa Portilho');
  perform demo_conta('ademir@demo.varanda.app',    'Ademir Fontanella');
  perform demo_conta('lourdes@demo.varanda.app',   'Lourdes Cavalheiro');
  perform demo_conta('ivo@demo.varanda.app',       'Ivo Bergamini');
  perform demo_conta('vera@demo.varanda.app',      'Vera Lúcia Andrade');
  perform demo_conta('sebastiao@demo.varanda.app', 'Sebastião Quirino');
  perform demo_conta('alzira@demo.varanda.app',    'Alzira Nepomuceno');
  perform demo_conta('decio@demo.varanda.app',     'Décio Malaquias');
  perform demo_conta('guiomar@demo.varanda.app',   'Guiomar Tostes');
  perform demo_conta('antenor@demo.varanda.app',   'Antenor Vilela');
  perform demo_conta('iracema@demo.varanda.app',   'Iracema Bonfim');
  perform demo_conta('celio@demo.varanda.app',     'Célio Damasceno');
  perform demo_conta('marlene@demo.varanda.app',   'Marlene Damasceno');
  perform demo_conta('rafael@demo.varanda.app',    'Rafael Quirino');

  -- ---------- 4. condomínio e as 42 unidades ----------
  insert into condominios (nome, endereco)
  values ('Edifício Alvorada', 'Rua das Acácias, 240')
  returning id into v_cond;

  for v_andar in 1..7 loop
    for v_ap in 1..6 loop
      insert into unidades (condominio_id, numero)
      values (v_cond, (v_andar * 100 + v_ap)::text);
    end loop;
  end loop;

  -- ---------- 5. vínculos ----------
  -- 28 das 42 unidades ocupadas = 67% de adesão. As 14 vazias existem de
  -- propósito: pro síndico, "quem ainda não entrou" é a informação mais
  -- útil da lista de condôminos, e é a métrica que o trial vai precisar.
  --
  -- Dois vínculos ficam PENDENTES, pra aba Vínculos ter o que aprovar ao
  -- vivo e o badge da barra de sub-abas mostrar número.
  insert into vinculos (usuario_id, unidade_id, papel, status, criado_em) values
    (helena,  demo_unidade(v_cond, '101'), 'sindico',      'aprovado', now() - interval '3 years'),
    (rogerio, demo_unidade(v_cond, '102'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (marina,  demo_unidade(v_cond, '201'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (caio,    demo_unidade(v_cond, '202'), 'inquilino',    'aprovado', now() - interval '8 months'),

    (demo_uid('waldemar@demo.varanda.app'),  demo_unidade(v_cond, '104'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('nair@demo.varanda.app'),      demo_unidade(v_cond, '106'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('otavio@demo.varanda.app'),    demo_unidade(v_cond, '204'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('zilda@demo.varanda.app'),     demo_unidade(v_cond, '204'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('dalva@demo.varanda.app'),     demo_unidade(v_cond, '205'), 'inquilino',    'aprovado', now() - interval '14 months'),
    (demo_uid('benedito@demo.varanda.app'),  demo_unidade(v_cond, '301'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('terezinha@demo.varanda.app'), demo_unidade(v_cond, '302'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('elio@demo.varanda.app'),      demo_unidade(v_cond, '303'), 'proprietario', 'aprovado', now() - interval '19 months'),
    (demo_uid('cleusa@demo.varanda.app'),    demo_unidade(v_cond, '305'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('wilson@demo.varanda.app'),    demo_unidade(v_cond, '306'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('irene@demo.varanda.app'),     demo_unidade(v_cond, '306'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('sonia@demo.varanda.app'),     demo_unidade(v_cond, '401'), 'proprietario', 'aprovado', now() - interval '17 months'),
    (demo_uid('jorge@demo.varanda.app'),     demo_unidade(v_cond, '402'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('neusa@demo.varanda.app'),     demo_unidade(v_cond, '404'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('ademir@demo.varanda.app'),    demo_unidade(v_cond, '405'), 'inquilino',    'aprovado', now() - interval '5 months'),
    (demo_uid('lourdes@demo.varanda.app'),   demo_unidade(v_cond, '501'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('ivo@demo.varanda.app'),       demo_unidade(v_cond, '502'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('vera@demo.varanda.app'),      demo_unidade(v_cond, '503'), 'proprietario', 'aprovado', now() - interval '15 months'),
    (demo_uid('sebastiao@demo.varanda.app'), demo_unidade(v_cond, '505'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('alzira@demo.varanda.app'),    demo_unidade(v_cond, '601'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('decio@demo.varanda.app'),     demo_unidade(v_cond, '602'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('guiomar@demo.varanda.app'),   demo_unidade(v_cond, '604'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('antenor@demo.varanda.app'),   demo_unidade(v_cond, '701'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('iracema@demo.varanda.app'),   demo_unidade(v_cond, '703'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('celio@demo.varanda.app'),     demo_unidade(v_cond, '705'), 'proprietario', 'aprovado', now() - interval '2 years'),
    (demo_uid('marlene@demo.varanda.app'),   demo_unidade(v_cond, '705'), 'proprietario', 'aprovado', now() - interval '2 years'),

    -- Os dois pendentes. A Tereza é a do roteiro: aprovar na frente do síndico.
    (tereza,                                 demo_unidade(v_cond, '203'), 'proprietario', 'pendente', now() - interval '2 days'),
    (demo_uid('rafael@demo.varanda.app'),    demo_unidade(v_cond, '105'), 'inquilino',    'pendente', now() - interval '5 hours');

  -- ---------- 6. cargos ----------
  -- O conselho fiscal do prédio tem dois nomes. A Marina é a conta que loga;
  -- o Benedito existe pra lista não parecer feita de uma pessoa só.
  insert into cargos (condominio_id, usuario_id, cargo, atribuido_por, criado_em) values
    (v_cond, rogerio,                                'subsindico', helena, now() - interval '11 months'),
    (v_cond, marina,                                 'conselho',   helena, now() - interval '11 months'),
    (v_cond, demo_uid('benedito@demo.varanda.app'),  'conselho',   helena, now() - interval '11 months');

  -- ---------- 7. regras ----------
  -- Escritas em dollar-quote pra não precisar de E'\n': o texto tem quebras
  -- de linha de verdade, e é assim que ele chega na tela de Regras.
  insert into regras (condominio_id, texto, versao, atualizado_por, atualizado_em)
  values (
    v_cond,
$regimento$REGIMENTO INTERNO — EDIFÍCIO ALVORADA

1. SILÊNCIO
Das 22h às 8h nos dias de semana e das 22h às 10h aos domingos e feriados. Obras e reformas só de segunda a sexta, das 9h às 17h. Prédio antigo tem laje fina: furadeira e martelo incomodam o andar inteiro, não só o vizinho de baixo.

2. ELEVADOR
Temos um elevador só. Em dia de mudança ou de entrega grande, avise o zelador antes para que ele acompanhe e proteja a cabine. Quem precisar de prioridade por dificuldade de locomoção tem preferência — é regra, não gentileza.

3. SALÃO DE FESTAS
Reserva pelo app, com no mínimo 3 dias de antecedência. Uma reserva por unidade a cada 30 dias. A chave fica com o zelador e é retirada no dia. Limpeza por conta de quem reservou. O salão é pequeno: comporta bem umas 25 pessoas.

4. GARAGEM
Cada unidade tem uma vaga demarcada — algumas cobertas, outras descobertas. A distribuição foi sorteada em assembleia e é rotativa a cada dois anos. Não há vaga para visitante: quem receber visita de carro precisa combinar com um vizinho que tenha vaga livre.

5. ÁREAS COMUNS
Hall, escadas e corredores não podem ser usados como depósito, nem que seja temporariamente. Capacho e vaso de planta na porta são permitidos desde que não atrapalhem a passagem — a escada é a rota de saída quando o elevador para.

6. ANIMAIS
Permitidos. Nas áreas comuns, sempre na guia e acompanhados. O tutor recolhe os dejetos.

7. MUDANÇAS
Avisar o zelador com 48h de antecedência. Só de segunda a sábado, das 8h às 18h.

8. ZELADORIA
O zelador atende de segunda a sexta, das 7h às 17h, e sábado até meio-dia. Não temos portaria 24 horas. Fora desse horário, use o app: o síndico e o subsíndico acompanham por aqui, e fica registrado.

9. LIXO
Recicláveis nas lixeiras azuis do subsolo. Descarte de móveis e eletrodomésticos é responsabilidade do morador — não deixe na garagem esperando alguém levar.$regimento$,
    2,
    helena,
    now() - interval '26 days'
  );

  -- ---------- 8. mural ----------
  -- O tom é o do prédio: gente que se conhece há vinte anos, muita gente
  -- idosa, e as conversas que existem de verdade num grupo de condomínio —
  -- achados e perdidos, indicação de profissional, carona, e alguém pedindo
  -- ajuda pra usar o próprio app. Esse último é de propósito: numa
  -- apresentação, ele mostra que o app espera usuário não-técnico.

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, helena,
$post$Pessoal, a manutenção anual do elevador ficou marcada para quinta-feira. Ele fica parado das 8h às 17h.

Quem tiver consulta, exame ou qualquer compromisso que não dê pra remarcar, me avise hoje ou amanhã que eu tento negociar o horário com a empresa. Moradores dos andares mais altos têm prioridade.$post$,
    now() - interval '2 days')
  returning id into p_elevador;

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, demo_uid('nair@demo.varanda.app'),
    'Achei um molho de chaves no patamar do 2º andar, com um chaveiro de coelhinho. Está comigo no 106. Toquem a campainha à vontade, fico em casa o dia todo.',
    now() - interval '1 day 4 hours')
  returning id into p_gato;

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, demo_uid('waldemar@demo.varanda.app'),
    'Alguém tem indicação de encanador de confiança? O do ano passado não atende mais o telefone. Prefiro alguém que já tenha trabalhado aqui no prédio e conheça o encanamento antigo.',
    now() - interval '3 days')
  returning id into p_encanador;

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, demo_uid('terezinha@demo.varanda.app'),
    'Boa tarde. Estou tentando confirmar presença na assembleia mas não achei onde clica. Alguém pode me explicar? Já procurei em tudo quanto é canto.',
    now() - interval '20 hours')
  returning id into p_ajuda;

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, caio,
    'O Corsa cinza da vaga 22 está com o farol aceso desde as 7h da manhã. Não sei de quem é. Se alguém souber, avisa antes que descarregue a bateria.',
    now() - interval '9 hours')
  returning id into p_farol;

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, demo_uid('lourdes@demo.varanda.app'),
$post$Corrimão dos dois lados da escada

Já falei isso na última assembleia mas quero deixar registrado aqui também. Hoje só tem corrimão de um lado. Quem desce apoiando na direita — e é a maioria de nós — desce sem apoio nenhum.

Não é luxo, é evitar quebrar o fêmur. Sei de dois casos de queda em escada só na minha família.$post$,
    now() - interval '12 days')
  returning id into p_corrimao;

  insert into posts (condominio_id, autor_id, texto, criado_em)
  values (v_cond, demo_uid('alzira@demo.varanda.app'),
    'Vou fazer bolo de fubá com erva-doce no sábado de manhã, como todo mês. Quem quiser encomendar é só me avisar até sexta. R$ 25 a forma inteira. 601.',
    now() - interval '2 days 6 hours')
  returning id into p_bolo;

  insert into posts (condominio_id, autor_id, texto, criado_em) values
    (v_cond, demo_uid('cleusa@demo.varanda.app'),
     'O gatinho rajado que aparece na garagem tem dono? Ele está comendo aqui em casa faz umas duas semanas. Se ninguém reclamar dele até o fim do mês, eu adoto de vez.',
     now() - interval '4 days'),

    (v_cond, rogerio,
     'Consegui um orçamento bom de dedetização pra quem quiser rachar. Fica bem mais barato fechando umas 6 unidades juntas. Quem tiver interesse me chama no 102 ou responde aqui.',
     now() - interval '5 days'),

    (v_cond, demo_uid('iracema@demo.varanda.app'),
     'Vou ao mercado na quarta de manhã, de carro. Tem lugar pra mais duas pessoas. Quem quiser carona é só falar comigo, 703.',
     now() - interval '1 day 8 hours'),

    (v_cond, demo_uid('decio@demo.varanda.app'),
     'Pessoal do 502, sem querer incomodar: a furadeira começou às 7h da manhã de domingo. Sei que reforma é necessária, mas o regimento fala em segunda a sexta. Um combinado resolve.',
     now() - interval '6 days'),

    (v_cond, demo_uid('antenor@demo.varanda.app'),
     'A caixa de correspondência do 7º andar está com a fechadura arrebentada de novo. Já é a terceira vez no ano. Alguém mais está com carta sumindo?',
     now() - interval '8 days'),

    (v_cond, marina,
     'Lembrete: a assembleia é quinta, 19h, no salão. Dá pra confirmar presença pela aba Oficial aqui no app — assim já sabemos se teremos quórum e ninguém sobe escada à toa.',
     now() - interval '5 hours');

  -- Curtidas espalhadas. O post do elevador e o do corrimão são os que mais
  -- mobilizam, e é isso que a demonstração precisa mostrar: assunto que
  -- afeta todo mundo junta gente.
  insert into curtidas (post_id, usuario_id) values
    (p_elevador, rogerio), (p_elevador, marina), (p_elevador, caio),
    (p_elevador, demo_uid('nair@demo.varanda.app')),
    (p_elevador, demo_uid('waldemar@demo.varanda.app')),
    (p_elevador, demo_uid('alzira@demo.varanda.app')),
    (p_elevador, demo_uid('antenor@demo.varanda.app')),
    (p_elevador, demo_uid('iracema@demo.varanda.app')),
    (p_elevador, demo_uid('celio@demo.varanda.app')),

    (p_corrimao, helena), (p_corrimao, marina),
    (p_corrimao, demo_uid('nair@demo.varanda.app')),
    (p_corrimao, demo_uid('waldemar@demo.varanda.app')),
    (p_corrimao, demo_uid('terezinha@demo.varanda.app')),
    (p_corrimao, demo_uid('guiomar@demo.varanda.app')),
    (p_corrimao, demo_uid('alzira@demo.varanda.app')),
    (p_corrimao, demo_uid('antenor@demo.varanda.app')),

    (p_bolo, caio), (p_bolo, marina), (p_bolo, demo_uid('cleusa@demo.varanda.app')),
    (p_bolo, demo_uid('vera@demo.varanda.app')),

    (p_gato, demo_uid('cleusa@demo.varanda.app')), (p_gato, helena),
    (p_farol, rogerio),
    (p_encanador, demo_uid('neusa@demo.varanda.app'));

  insert into comentarios (post_id, autor_id, texto, criado_em) values
    (p_elevador, demo_uid('nair@demo.varanda.app'),
     'Helena, eu tenho fisioterapia quinta de manhã. Moro no 106, dá pra descer a pé, mas subir eu não consigo mais.',
     now() - interval '1 day 22 hours'),
    (p_elevador, helena,
     'Anotado, dona Nair. Vou pedir pra começarem pela tarde. Se não der, eu aviso a senhora até amanhã.',
     now() - interval '1 day 20 hours'),
    (p_elevador, demo_uid('antenor@demo.varanda.app'),
     'Sétimo andar aqui. Vou aproveitar e passar o dia na casa da minha filha.',
     now() - interval '1 day 14 hours'),

    (p_ajuda, marina,
     'Dona Terezinha, é na aba Oficial, ali embaixo. A senhora toca em Reuniões, abre a assembleia e aparece um botão verde escrito Confirmar presença no rodapé.',
     now() - interval '18 hours'),
    (p_ajuda, demo_uid('terezinha@demo.varanda.app'),
     'Consegui! Muito obrigada, Marina. Era mais fácil do que eu estava imaginando.',
     now() - interval '16 hours'),

    (p_encanador, demo_uid('neusa@demo.varanda.app'),
     'Seu Waldemar, o Nilton que fez o meu banheiro é muito bom e cobra justo. Ele já trabalhou no 401 e no 305. Passo o telefone.',
     now() - interval '2 days 20 hours'),
    (p_encanador, demo_uid('waldemar@demo.varanda.app'),
     'Obrigado, Neusa. Pode mandar.',
     now() - interval '2 days 18 hours'),

    (p_corrimao, helena,
     'Dona Lourdes, isso vai virar votação esta semana. Já pedi dois orçamentos.',
     now() - interval '10 days'),
    (p_corrimao, demo_uid('guiomar@demo.varanda.app'),
     'Assino embaixo. Eu desço de lado segurando na parede.',
     now() - interval '11 days'),

    (p_farol, demo_uid('ivo@demo.varanda.app'),
     'É do meu genro, está aqui em casa. Já avisei, ele desceu correndo. Obrigado!',
     now() - interval '8 hours'),

    (p_bolo, demo_uid('vera@demo.varanda.app'),
     'Quero uma. Pode deixar na portaria não, que não tem — deixa comigo mesmo que eu busco.',
     now() - interval '2 days 2 hours');

  -- ---------- 9. manutenção ----------
  -- Prédio antigo com moradores idosos relata coisa diferente de prédio
  -- novo: corrimão solto, elevador parando fora do nível, piso que escorrega
  -- na chuva. Os três primeiros cobrem as três faixas do "aberto há X dias"
  -- — vermelho (7+ dias parado), âmbar (3 a 6) e resolvido — porque é a
  -- feature que responde à queixa nº1 contra síndico.
  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, demo_uid('lourdes@demo.varanda.app'),
    'Corrimão solto na escada entre o 3º e o 4º', 'Segurança', 'Escada, entre o 3º e o 4º andar',
    'O corrimão balança quando a gente apoia o peso. Está preso só na parte de cima. Já quase me desequilibrei descendo. Enquanto não conserta, estou descendo pelo lado da parede.',
    'aberto', now() - interval '9 days')
  returning id into pb_corrimao;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, demo_uid('nair@demo.varanda.app'),
    'Elevador para desnivelado com o piso', 'Elevador', 'Elevador social',
    'Ele para uns quatro dedos acima do piso do andar, principalmente no térreo. Vira um degrau que ninguém espera. Já vi duas pessoas tropeçarem saindo, e uma delas era com sacola de compras na mão.',
    'em_andamento', now() - interval '12 days')
  returning id into pb_elevador;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, demo_uid('guiomar@demo.varanda.app'),
    'Lâmpada queimada no corredor do 6º', 'Elétrica', 'Corredor, 6º andar',
    'O corredor inteiro ficou escuro. Quem sai do elevador não enxerga a fechadura pra acertar a chave.',
    'resolvido', now() - interval '19 days')
  returning id into pb_lampada;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, caio,
    'Infiltração na laje da garagem', 'Estrutural', 'Subsolo, sobre a vaga 14',
    'Pinga em cima da vaga 14 sempre que chove forte. A mancha no concreto cresceu bastante nas últimas semanas e já está escorrendo pela coluna.',
    'aberto', now() - interval '5 days')
  returning id into pb_infiltracao;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, demo_uid('jorge@demo.varanda.app'),
    'Interfone do 402 não toca', 'Elétrica', 'Apto 402 e portão social',
    'Toca lá embaixo mas não chama aqui em cima. Já perdi duas entregas de farmácia porque não ouvi. Tem uns três meses assim.',
    'em_andamento', now() - interval '16 days')
  returning id into pb_interfone;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, demo_uid('waldemar@demo.varanda.app'),
    'Portão da garagem fecha rápido demais', 'Segurança', 'Entrada da garagem',
    'O tempo entre abrir e começar a fechar diminuiu. Quem entra devagar, como eu, pega o portão descendo. Já bateu no para-choque do carro do 305.',
    'aberto', now() - interval '4 days')
  returning id into pb_portao;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, demo_uid('terezinha@demo.varanda.app'),
    'Piso da entrada escorrega quando chove', 'Segurança', 'Hall de entrada',
    'Aquele piso liso perto da porta fica uma pista de gelo em dia de chuva. Um tapete antiderrapante resolveria. A dona Zilda escorregou ali no mês passado e por sorte segurou na parede.',
    'em_andamento', now() - interval '21 days')
  returning id into pb_piso;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao, status, criado_em)
  values (v_cond, demo_uid('decio@demo.varanda.app'),
    'Bomba d''água faz barulho de madrugada', 'Hidráulica', 'Casa de bombas, subsolo',
    'Começou a fazer um estrondo quando liga, por volta das 4h. Quem mora na coluna do 02 escuta na cama.',
    'resolvido', now() - interval '34 days')
  returning id into pb_bomba;

  -- Os dois PRIVADOS. São o que faz a régua de permissão aparecer na
  -- demonstração:
  --   Síndico e Subsíndico veem, com a etiqueta "Só na unidade".
  --   Conselho fiscal NÃO vê — ele fiscaliza contas, não queixa doméstica.
  --   O autor vê, porque é dele.
  -- O primeiro é do Caio, que é a conta "Morador" — é ele que você abre na
  -- apresentação pra mostrar que continua enxergando o próprio pedido.
  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao,
                         status, area_comum, criado_em)
  values (v_cond, caio,
    'Torneira da cozinha pingando sem parar', 'Hidráulica', 'Cozinha, apto 202',
    'Pinga a noite inteira e já apareceu mancha embaixo da pia. Queria saber se é do encanamento do prédio antes de chamar alguém por conta.',
    'aberto', false, now() - interval '2 days')
  returning id into pb_torneira;

  insert into problemas (condominio_id, autor_id, titulo, categoria, local, descricao,
                         status, area_comum, criado_em)
  values (v_cond, demo_uid('guiomar@demo.varanda.app'),
    'Mancha de mofo na parede do quarto', 'Estrutural', 'Quarto, apto 604',
    'Apareceu uma mancha escura no canto da parede que dá pra fachada. Não sei se é da chuva batendo por fora ou se é cano. Não quero abrir a parede à toa.',
    'em_andamento', false, now() - interval '13 days')
  returning id into pb_mofo;

  -- pb_corrimao e pb_infiltracao nunca foram movimentados de propósito: um
  -- fica "aberto há 9 dias" (vermelho) e o outro "há 5" (âmbar).
  insert into historico_status (problema_id, status, autor_id, criado_em) values
    (pb_elevador,  'em_andamento', helena,  now() - interval '5 days'),
    (pb_lampada,   'em_andamento', rogerio, now() - interval '18 days'),
    (pb_lampada,   'resolvido',    rogerio, now() - interval '17 days'),
    (pb_interfone, 'em_andamento', helena,  now() - interval '6 days'),
    (pb_piso,      'em_andamento', helena,  now() - interval '2 days'),
    (pb_bomba,     'em_andamento', helena,  now() - interval '32 days'),
    (pb_bomba,     'resolvido',    helena,  now() - interval '28 days'),
    (pb_mofo,      'em_andamento', rogerio, now() - interval '9 days');

  -- ---------- 10. avisos ----------
  insert into avisos (condominio_id, autor_id, titulo, texto, fixado, restrito, criado_em) values
    (v_cond, helena,
     'Manutenção do elevador — quinta, das 8h às 17h',
     'A manutenção anual é obrigatória e não dá pra adiar de novo. O elevador fica parado quinta-feira o dia todo. Quem tiver compromisso de saúde nesse dia, me avise que eu tento negociar o horário com a empresa. Moradores dos andares altos e com dificuldade de locomoção têm prioridade.',
     true, false, now() - interval '2 days'),

    (v_cond, helena,
     'Rateio da manutenção do elevador',
     'A manutenção corretiva aprovada na última assembleia sai por R$ 7.560, rateados em R$ 180 por unidade. Entra no boleto do mês que vem, discriminado em separado. O orçamento completo fica com o conselho fiscal, é só pedir.',
     false, false, now() - interval '10 days'),

    (v_cond, helena,
     'Limpeza da caixa d''água — terça de manhã',
     'A limpeza semestral da caixa está marcada para terça, das 8h ao meio-dia. A água fica cortada nesse período. Encham as garrafas na véspera, principalmente quem toma remédio de horário.',
     false, false, now() - interval '15 days'),

    (v_cond, helena,
     'Regras do condomínio atualizadas',
     'Incluímos o prazo mínimo de 3 dias para reserva do salão, a prioridade no elevador para quem tem dificuldade de locomoção, e o horário de atendimento da zeladoria. A versão 2 já está no topo desta aba.',
     false, false, now() - interval '26 days');

  -- ---------- 10b. os avisos que CARREGAM reunião e votação ----------
  -- Desde 07/09/2026 o aviso é o container: a votação e a assembleia moram
  -- dentro do card dele. Estes três existem pra demonstração mostrar isso.

  insert into avisos (condominio_id, autor_id, titulo, texto, fixado, restrito, criado_em)
  values (v_cond, helena,
    'Vamos instalar corrimão nos dois lados da escada',
    'A dona Lourdes levantou isso no mural e tem razão: hoje só há apoio de um lado, e a escada é a única saída quando o elevador para. Levantei orçamento em alumínio: R$ 4.100, o que dá duas parcelas de R$ 49 por unidade. Abaixo, a votação. Quem preferir discutir pessoalmente, a assembleia de quinta tem isso na pauta.',
    false, false, now() - interval '4 days')
  returning id into av_corrimao;

  insert into avisos (condominio_id, autor_id, titulo, texto, fixado, restrito, criado_em)
  values (v_cond, helena,
    'Assembleia ordinária — quinta, 19h, no salão',
    'Pauta: prestação de contas do trimestre, resultado da votação do corrimão, contrato de manutenção do elevador, rateio da infiltração da garagem e assuntos gerais. Confirme presença aqui embaixo — assim eu já sei se teremos quórum e ninguém sobe escada à toa.',
    false, false, now() - interval '9 days')
  returning id into av_assembleia;

  -- O aviso restrito, e o que mais importa na apresentação: ele carrega uma
  -- votação E uma reunião. Quando você troca para Morador, o card inteiro
  -- some -- aviso, votação e reunião de uma vez -- e é a prova de que a
  -- permissão é do banco e não da tela. `fixado` obrigatoriamente false: há
  -- uma check constraint impedindo restrito e fixado na mesma linha.
  insert into avisos (condominio_id, autor_id, titulo, texto, fixado, restrito, criado_em)
  values (v_cond, helena,
    'Propostas de manutenção do elevador — analisar antes da assembleia',
    'Chegaram três propostas para o contrato anual do elevador. A Ascende é a mais barata mas cobra visita avulsa fora do contrato; as outras duas incluem chamado ilimitado, com diferença de R$ 220/mês entre elas. Vamos fechar posição antes de levar à assembleia.',
    false, true, now() - interval '1 day')
  returning id into av_restrito;

  -- ---------- 11. votações ----------
  insert into votacoes (condominio_id, autor_id, titulo, descricao, opcoes, restrito, data_inicio, data_fim, aviso_id)
  values (v_cond, helena,
    'Instalar corrimão nos dois lados da escada?',
    'Orçamento de R$ 4.100 em alumínio, rateado em duas parcelas de R$ 49 por unidade. Foi pedido em assembleia e voltou no Mural. A escada é a única saída quando o elevador para, e hoje só tem apoio de um lado.',
    array['Sim, aprovo', 'Não', 'Quero discutir na assembleia'],
    false, now() - interval '4 days', now() + interval '3 days', av_corrimao)
  returning id into vot_corrimao;

  -- A votação restrita, e o teste que mais importa: o morador comum não pode
  -- ver nem ela nem os votos dela. As policies de `votos` repetem a cláusula
  -- de restrito de propósito — filho não herda visibilidade do pai em RLS.
  insert into votacoes (condominio_id, autor_id, titulo, descricao, opcoes, restrito, data_inicio, data_fim, aviso_id)
  values (v_cond, helena,
    'Qual proposta de elevador levar à assembleia?',
    'Posição do gabinete antes de apresentar as três propostas ao prédio.',
    array['Ascende (mais barata)', 'Elevatec (chamado ilimitado)', 'Renovar com a atual'],
    true, now() - interval '1 day', now() + interval '4 days', av_restrito)
  returning id into vot_elevador;

  -- Voto é por unidade, não por pessoa. 17 das 28 unidades já votaram: é
  -- número suficiente pra barra de proporção contar uma história, e baixo
  -- o bastante pra fazer sentido a votação ainda estar aberta.
  insert into votos (votacao_id, unidade_id, usuario_id, opcao, criado_em) values
    (vot_corrimao, demo_unidade(v_cond, '101'), helena,                                 'Sim, aprovo', now() - interval '4 days'),
    (vot_corrimao, demo_unidade(v_cond, '102'), rogerio,                                'Sim, aprovo', now() - interval '4 days'),
    (vot_corrimao, demo_unidade(v_cond, '201'), marina,                                 'Sim, aprovo', now() - interval '3 days'),
    (vot_corrimao, demo_unidade(v_cond, '104'), demo_uid('waldemar@demo.varanda.app'),  'Sim, aprovo', now() - interval '3 days'),
    (vot_corrimao, demo_unidade(v_cond, '106'), demo_uid('nair@demo.varanda.app'),      'Sim, aprovo', now() - interval '3 days'),
    (vot_corrimao, demo_unidade(v_cond, '204'), demo_uid('zilda@demo.varanda.app'),     'Sim, aprovo', now() - interval '3 days'),
    (vot_corrimao, demo_unidade(v_cond, '301'), demo_uid('benedito@demo.varanda.app'),  'Sim, aprovo', now() - interval '2 days'),
    (vot_corrimao, demo_unidade(v_cond, '302'), demo_uid('terezinha@demo.varanda.app'), 'Sim, aprovo', now() - interval '2 days'),
    (vot_corrimao, demo_unidade(v_cond, '501'), demo_uid('lourdes@demo.varanda.app'),   'Sim, aprovo', now() - interval '2 days'),
    (vot_corrimao, demo_unidade(v_cond, '601'), demo_uid('alzira@demo.varanda.app'),    'Sim, aprovo', now() - interval '2 days'),
    (vot_corrimao, demo_unidade(v_cond, '604'), demo_uid('guiomar@demo.varanda.app'),   'Sim, aprovo', now() - interval '1 day'),
    (vot_corrimao, demo_unidade(v_cond, '701'), demo_uid('antenor@demo.varanda.app'),   'Sim, aprovo', now() - interval '1 day'),
    (vot_corrimao, demo_unidade(v_cond, '703'), demo_uid('iracema@demo.varanda.app'),   'Sim, aprovo', now() - interval '1 day'),
    (vot_corrimao, demo_unidade(v_cond, '502'), demo_uid('ivo@demo.varanda.app'),       'Quero discutir na assembleia', now() - interval '2 days'),
    (vot_corrimao, demo_unidade(v_cond, '405'), demo_uid('ademir@demo.varanda.app'),    'Quero discutir na assembleia', now() - interval '1 day'),
    (vot_corrimao, demo_unidade(v_cond, '602'), demo_uid('decio@demo.varanda.app'),     'Não', now() - interval '2 days'),
    (vot_corrimao, demo_unidade(v_cond, '303'), demo_uid('elio@demo.varanda.app'),      'Não', now() - interval '20 hours'),

    (vot_elevador, demo_unidade(v_cond, '101'), helena,  'Elevatec (chamado ilimitado)', now() - interval '20 hours'),
    (vot_elevador, demo_unidade(v_cond, '201'), marina,  'Elevatec (chamado ilimitado)', now() - interval '16 hours'),
    (vot_elevador, demo_unidade(v_cond, '301'), demo_uid('benedito@demo.varanda.app'), 'Renovar com a atual', now() - interval '14 hours');

  -- ---------- 12. reuniões ----------
  insert into reunioes (condominio_id, autor_id, titulo, data_hora, local, pauta, restrito, criado_em, aviso_id)
  values (v_cond, helena, 'Assembleia ordinária',
    hora_local(4, '19:00'),
    'Salão de festas',
    'Prestação de contas do trimestre · resultado da votação do corrimão · contrato de manutenção do elevador · rateio da infiltração da garagem · assuntos gerais.',
    false, now() - interval '9 days', av_assembleia)
  returning id into reu_assembleia;

  insert into reunioes (condominio_id, autor_id, titulo, data_hora, local, pauta, restrito, criado_em, aviso_id)
  values (v_cond, helena, 'Conselho: fechar posição sobre o elevador',
    hora_local(2, '20:00'),
    'Salão de festas',
    'Comparar as três propostas e escolher qual levar à assembleia.',
    true, now() - interval '1 day', av_restrito)
  returning id into reu_conselho;

  -- Esta fica SEM aviso, de propósito: reunião avulsa continua existindo, e
  -- é o que prova que as linhas antigas não sumiram do feed.
  insert into reunioes (condominio_id, autor_id, titulo, data_hora, local, pauta, restrito, criado_em) values
    (v_cond, helena, 'Conversa sobre a pintura da fachada',
     hora_local(11, '19:30'),
     'Salão de festas', 'Orçamentos de pintura e prazo de execução.',
     false, now() - interval '14 days');

  -- Cancelamento é soft de propósito: quem confirmou presença precisa VER
  -- que foi cancelada. Apagar faria a reunião sumir em silêncio.
  update reunioes
  set cancelada_em = now() - interval '3 days',
      motivo_cancelamento = 'Adiada até sair o resultado da manutenção do elevador.'
  where condominio_id = v_cond
    and titulo = 'Conversa sobre a pintura da fachada';

  insert into rsvps (reuniao_id, usuario_id, confirmado) values
    (reu_assembleia, rogerio, true),
    (reu_assembleia, marina,  true),
    (reu_assembleia, demo_uid('lourdes@demo.varanda.app'),  true),
    (reu_assembleia, demo_uid('waldemar@demo.varanda.app'), true),
    (reu_assembleia, demo_uid('nair@demo.varanda.app'),     true),
    (reu_assembleia, demo_uid('benedito@demo.varanda.app'), true),
    (reu_assembleia, demo_uid('terezinha@demo.varanda.app'),true),
    (reu_assembleia, demo_uid('decio@demo.varanda.app'),    true),
    (reu_assembleia, demo_uid('antenor@demo.varanda.app'),  true);

  -- ---------- 13. reservas do salão ----------
  -- As três aprovadas viram data riscada no calendário do formulário; a do
  -- 102 é a que você aprova ao vivo, na frente do síndico. Pendente não
  -- bloqueia data de propósito: duas unidades disputando o mesmo dia é
  -- exatamente o que dá ao síndico uma escolha para fazer.
  insert into reservas (condominio_id, unidade_id, usuario_id, data, observacao, status, criado_em) values
    (v_cond, demo_unidade(v_cond, '106'), demo_uid('nair@demo.varanda.app'),
     data_local(9),  '80 anos da minha mãe. Almoço de família, umas 20 pessoas.', 'aprovada', now() - interval '12 days'),
    (v_cond, demo_unidade(v_cond, '503'), demo_uid('vera@demo.varanda.app'),
     data_local(23), 'Batizado do meu neto', 'aprovada', now() - interval '6 days'),
    -- A reserva do 202 e a do Caio, que e a conta "Morador". Ela existe pra
    -- que o passo do roteiro em que voce troca de papel mostre uma lista com
    -- UMA reserva -- a dele -- em vez de uma lista vazia. Lista vazia provaria
    -- a privacidade e esconderia a funcionalidade no mesmo gesto.
    (v_cond, demo_unidade(v_cond, '202'), caio,
     data_local(6),  'Aniversario da minha filha', 'aprovada', now() - interval '9 days'),
    (v_cond, demo_unidade(v_cond, '102'), rogerio,
     data_local(16), 'Almoço de família', 'pendente', now() - interval '1 day'),
    (v_cond, demo_unidade(v_cond, '705'), demo_uid('celio@demo.varanda.app'),
     data_local(30), 'Reunião da associação de aposentados do bairro', 'pendente', now() - interval '6 hours');

  raise notice 'Seed aplicado. Edificio Alvorada: 42 unidades, 28 ocupadas (67%%), 32 pessoas, 2 vinculos pendentes, 3 avisos com reuniao/votacao dentro.';
end $$;

-- Os auxiliares existem só durante o seed. Deixá-los no banco criaria
-- superfície que nenhuma policy cobre — `demo_conta` é security definer e
-- escreve em auth.users.
drop function if exists demo_conta(text, text);
drop function if exists demo_uid(text);
drop function if exists demo_unidade(uuid, text);
drop function if exists hora_local(int, text);
drop function if exists data_local(int);
