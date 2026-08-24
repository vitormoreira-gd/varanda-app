-- ============================================================
-- MIGRAÇÃO — Trocar o voto, e apuração só para o gabinete
-- Rodar uma vez no SQL Editor do Supabase. Já está dobrada dentro de
-- varanda-schema.sql; depois de aplicada, este arquivo pode ser apagado.
--
-- Não mexe em dados: só reescreve duas policies.
-- ============================================================

-- Voto continua sendo POR UNIDADE, não por pessoa: a constraint única é
-- (votacao_id, unidade_id) desde o schema original. A consequência aqui é que
-- quem troca o voto não precisa ser quem o lançou — qualquer morador aprovado
-- da mesma unidade pode. É o voto do 302, não o voto do Fulano. O `with
-- check` grava `usuario_id = auth.uid()`, então fica registrado quem trocou
-- por último.

drop policy if exists "trocar voto" on votos;
create policy "trocar voto" on votos
  for update
  using (
    unidade_id in (
      select unidade_id from vinculos
      where usuario_id = auth.uid() and status = 'aprovado'
    )
    and votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
        and data_fim > now()
    )
  )
  with check (
    usuario_id = auth.uid()
    and unidade_id in (
      select unidade_id from vinculos
      where usuario_id = auth.uid() and status = 'aprovado'
    )
    and votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
        and data_fim > now()
    )
  );

-- Aproveitando: a policy de insert nunca checou o prazo. A tela sempre
-- filtrou por `data_fim > now()`, mas nada impedia registrar voto numa
-- votação encerrada direto pela API — e agora que existe update, deixar a
-- diferença de critério entre as duas seria pedir para divergirem.
drop policy if exists "registrar voto" on votos;
create policy "registrar voto" on votos
  for insert with check (
    usuario_id = auth.uid()
    and unidade_id in (
      select unidade_id from vinculos
      where usuario_id = auth.uid() and status = 'aprovado'
    )
    and votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
        and data_fim > now()
    )
  );

-- Não há policy de delete de propósito: dá pra TROCAR o voto, não pra
-- retirá-lo. Uma unidade que votou fica com voto registrado até o prazo
-- fechar — retratar-se para "não votei" mudaria o denominador do quórum, e
-- isso é decisão de assembleia, não de tela.

-- ---------- APURAÇÃO SÓ PARA O GABINETE ----------
-- Até aqui, a policy de select de `votos` liberava o condomínio inteiro: um
-- morador comum conseguia ler, direto pela API, não só o placar como QUAL
-- UNIDADE votou o quê. O voto nunca foi secreto — a tela só não mostrava.
--
-- Agora cada um enxerga o voto da própria unidade (a tela precisa saber o que
-- marcar) e quem fiscaliza enxerga todos, que é a visão de apuração.
--
-- O conselho fiscal entra junto com síndico e subsíndico via pode_fiscalizar:
-- conferir apuração é exatamente o que o cargo existe pra fazer.
drop policy if exists "ver votos do meu condominio" on votos;
create policy "ver votos do meu condominio" on votos
  for select using (
    votacao_id in (
      select id from votacoes
      where condominio_id in (select condominios_do_usuario())
        and (not restrito or pode_fiscalizar(condominio_id))
    )
    and (
      unidade_id in (
        select unidade_id from vinculos
        where usuario_id = auth.uid() and status = 'aprovado'
      )
      or pode_fiscalizar((select v.condominio_id from votacoes v where v.id = votacao_id))
    )
  );
