-- ============================================================
-- SNIPPETS DE TESTE — atalhos pro SQL Editor do Supabase
-- Não é migração: nada aqui precisa rodar num banco novo.
-- O SQL Editor roda como service role e passa por cima do RLS.
-- ============================================================

-- ------------------------------------------------------------
-- VER O ESTADO ATUAL
-- ------------------------------------------------------------
select u.nome, un.bloco, un.numero, v.papel, v.status, c.nome as condominio
from vinculos v
join usuarios u on u.id = v.usuario_id
join unidades un on un.id = v.unidade_id
join condominios c on c.id = un.condominio_id
order by v.status, u.nome;

-- ------------------------------------------------------------
-- APROVAR VÍNCULO (pula a aprovação manual do síndico)
-- Depois de rodar, toque em "Já fui aprovado, verificar" no app.
-- ------------------------------------------------------------
update vinculos set status = 'aprovado' where status = 'pendente';

-- Só uma conta específica:
-- update vinculos
-- set status = 'aprovado'
-- where usuario_id = (select id from auth.users where email = 'teste@exemplo.com');

-- ------------------------------------------------------------
-- PROMOVER A SÍNDICO (pra testar a aba Gestão com outra conta)
-- ------------------------------------------------------------
-- update vinculos
-- set papel = 'sindico', status = 'aprovado'
-- where usuario_id = (select id from auth.users where email = 'teste@exemplo.com');

-- ------------------------------------------------------------
-- CÓDIGOS DE FUNDAÇÃO
-- ------------------------------------------------------------
-- Emitir um novo:
insert into codigos_fundacao (codigo, observacao)
values ('TESTE-001', 'teste local')
on conflict (codigo) do nothing;

-- Reciclar um já usado, pra fundar de novo sem inventar código:
-- update codigos_fundacao set usado_por = null, usado_em = null where codigo = 'TESTE-001';

-- Ver quais foram usados e por quem:
-- select cf.codigo, cf.observacao, u.nome as usado_por, cf.usado_em
-- from codigos_fundacao cf
-- left join usuarios u on u.id = cf.usado_por
-- order by cf.criado_em;

-- ------------------------------------------------------------
-- CONFIRMAR E-MAIL NA MÃO
-- Só precisa pras contas criadas ANTES de desligar o "Confirm email".
-- ------------------------------------------------------------
-- update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- ------------------------------------------------------------
-- APAGAR UM CONDOMÍNIO DE TESTE — DESTRUTIVO
-- O cascade leva unidades, vínculos, posts, sugestões, problemas,
-- avisos, votações e reuniões junto. Confira o nome antes.
-- As contas em auth.users continuam existindo; o perfil em `usuarios`
-- também, então a conta volta pro onboarding como "sem vínculo".
-- ------------------------------------------------------------
-- delete from condominios where nome = 'Condominio de Teste';
