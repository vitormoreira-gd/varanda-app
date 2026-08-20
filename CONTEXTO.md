# Varanda — Contexto do projeto

Este arquivo existe pra dar contexto rápido a qualquer instância do Claude (ou a você mesmo, futuramente) sobre o que é esse projeto, o que já foi construído, as decisões/armadilhas já resolvidas, o backlog e o plano de negócio. Leia isso antes de mexer em qualquer coisa.

---

# Parte 1 — Contexto técnico

## O que é

App de comunicação para condomínios ("Varanda"), hoje em uso interno de um condomínio específico — sem distribuição em loja, instalação local via Expo Go durante desenvolvimento, e futuramente via `.apk` sideloaded (Android) e possivelmente TestFlight (iOS).

Dois perfis de usuário no mesmo app: **condômino** (padrão) e **síndico** (mesmo usuário, papel extra liberado por RLS/UI condicional — não é um app separado).

## Stack

- **Frontend:** React Native + Expo (SDK 54, "for learning with Expo Go"), TypeScript
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage), projeto na região São Paulo
- **Navegação:** `@react-navigation/native` + `@react-navigation/bottom-tabs`
- **Datas:** `@react-native-community/datetimepicker`
- **Sem localStorage/AsyncStorage exceto** o que o Supabase client usa internamente pra sessão (`@react-native-async-storage/async-storage`)

Chaves da API: usar sempre as novas (`sb_publishable_...` / `sb_secret_...`), não as legacy `anon`/`service_role` (Supabase está descontinuando as legacy até fim de 2026). A publishable key vai no `.env` como `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Estrutura de pastas

```
varanda-app/
├── App.tsx                          — auth gate + tab navigator (mostra aba Gestão só se papel === 'sindico')
├── db/
│   ├── varanda-schema.sql           — DDL completo, idempotente. FONTE DA VERDADE do banco.
├── lib/
│   ├── supabase.ts                  — client Supabase configurado pra RN
│   ├── datas.ts                     — formatarDataHora(), sem depender de Intl
│   └── useMeuCondominio.ts          — hook: retorna condominioId, unidadeId, papel do usuário logado
├── screens/
│   ├── AuthScreen.tsx                — cadastro/login
│   ├── MuralScreen.tsx               — feed social (posts)
│   ├── SolicitacoesScreen.tsx        — host com seletor Sugestões/Problemas
│   ├── SugestoesScreen.tsx
│   ├── ProblemasScreen.tsx
│   ├── OficialScreen.tsx             — visão condômino: avisos, votações (votar), reuniões (RSVP)
│   ├── OficialCriarScreen.tsx        — visão síndico: criar aviso/votação/reunião (usado dentro de Gestão)
│   ├── GestaoScreen.tsx              — host síndico: Vínculos/Sugestões/Problemas/Oficial
│   ├── VinculosPendentesScreen.tsx   — síndico aprova vínculo pendente
│   ├── ModerarScreen.tsx             — síndico muda status de sugestão/problema
│   └── PerfilScreen.tsx
```

## Schema (Supabase / Postgres)

Ver `db/varanda-schema.sql` pra DDL completo (idempotente — pode rodar de novo sem erro). Esse arquivo é a fonte da verdade: já incorpora os dois patches que antes viviam soltos (checagem de unidade no voto, e `vincular_por_codigo`). Resumo das entidades:

`condominios` → `unidades` (com `codigo_convite` único gerado automaticamente) → `vinculos` (usuario_id + unidade_id, com `papel`: proprietario/inquilino/sindico, e `status`: pendente/aprovado) → `usuarios` (perfil 1:1 com `auth.users`).

Conteúdo: `posts`/`curtidas`/`comentarios` (Mural), `sugestoes`/`apoios` (status: analise/aprovada/implementada), `problemas`/`historico_status` (status: aberto/em_andamento/resolvido), `avisos`, `votacoes`/`votos` (**voto é por unidade, não por pessoa** — constraint única `(votacao_id, unidade_id)`), `reunioes`/`rsvps`.

Multi-tenancy: isolamento entre condomínios via RLS, toda tabela filtrada por `condominio_id` (direto ou via join). Duas funções `security definer` auxiliares: `condominios_do_usuario()` e `eh_sindico(condominio_id)`, usadas dentro das policies.

Quatro policies que faltavam foram descobertas ao ler o schema e **aplicadas no Supabase em 20/08/2026**, já dobradas dentro de `varanda-schema.sql`:
1. `delete` em `curtidas` — sem ela, curtir só funciona de ida.
2. `delete` em `rsvps` — sem ela, "desmarcar presença" nunca removeu nada.
3. `delete` em `apoios` — mesma coisa pra retirar apoio de sugestão.
4. `select` em `usuarios` pra vizinhos do mesmo condomínio (via nova função `usuarios_do_meu_condominio()`) — antes cada usuário só enxergava o próprio perfil, então o embed `usuarios!autor_id(nome)` do Mural voltava null e todo post aparecia como "Vizinho".

**Decisão em aberto (item 4):** RLS é por linha, não por coluna. Liberar a linha de `usuarios` pro vizinho libera `telefone` e `foto_url` junto com `nome` — a UI mostrar só o nome não protege, quem chamar a API direto vê tudo. Isso conflita com o item de backlog "lista de condôminos visível só pro síndico (nome, unidade, papel, **contato**)". Se contato tiver que ser restrito, o caminho é mover telefone pra uma tabela separada com policy própria.

## Armadilhas já resolvidas (não repetir)

1. **PostgREST "more than one relationship was found"**: ao fazer embed de `usuarios` a partir de outra tabela (ex: `posts`), especificar a coluna explicitamente: `usuarios!autor_id(nome)` em vez de `usuarios(nome)`. Vai acontecer de novo em qualquer novo join com `usuarios`.
2. **RLS e enum ambíguo em função PL/pgSQL**: se uma função usa `returns table (coluna_x ...)`, o Postgres cria uma variável interna com esse nome que pode colidir com uma coluna de tabela de mesmo nome dentro do corpo da função. Nomear as colunas de retorno de forma única (ex: `id_unidade` em vez de `unidade_id`) evita.
3. **Falha silenciosa é o inimigo nº1**: todo `supabase.from(...).select/insert/update` deve checar `error` e mostrar via `Alert.alert`. Vários bugs de "não fez nada" eram erro real sendo engolido sem feedback.
4. **RLS que bloqueia `delete` não devolve erro** — devolve 0 linhas afetadas. Um `Alert.alert` em cima do `error` (armadilha nº3) não pega isso: o caminho é `.delete()...select()` e checar se a lista voltou vazia. Foi assim que "desmarcar presença" passou meses parecendo implementado. Vale o mesmo raciocínio pra `update` bloqueado.
5. **PowerShell bloqueando `npx`**: usar `cmd` em vez de PowerShell, ou `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` como admin.
6. **`.env` do Expo**: variáveis precisam do prefixo `EXPO_PUBLIC_` pra chegar no client. Mudança no `.env` só é lida reiniciando o servidor (`npx expo start -c`).

## Status atual

*Sessão de 20/08/2026 — nada foi testado em device nesta sessão, só `npx tsc --noEmit` limpo. Nada commitado ainda: `lib/`, `screens/`, `db/` e este arquivo seguem untracked sobre o "Initial commit".*

Corrigido nesta sessão:
- **Votação estava quebrada** — `useMeuCondominio` nunca retornou `unidadeId` (o `OficialScreen` destruturava e recebia `undefined`), então nenhum voto passava e o histórico "já votei" nunca carregava. Contradizia o "MVP completo e testado" abaixo; provavelmente quebrou num refactor posterior ao teste.
- Feed com data/hora, curtidas e moderação (ver backlog).
- `delete` de RSVP agora detecta bloqueio de RLS em vez de falhar calado.
- Quatro policies que faltavam no banco, aplicadas e dobradas no schema (ver Parte 1).

Aberto: `apoios` agora aceita `delete`, mas nenhuma tela usa — retirar apoio de uma sugestão continua sem botão em `SugestoesScreen`.

MVP funcionalmente completo e testado (antes desta sessão): cadastro → vínculo por código de convite → aprovação pelo síndico → Mural, Sugestões (com apoio), Problemas (com histórico de status), Oficial (avisos fixados, votação por unidade, reunião com RSVP e seletor de data/hora nativo) → Gestão do síndico pra tudo isso.

## Preferências do dono do projeto

Vitor — dev de jogos mobile (Unity/C#), sem familiaridade prévia com Supabase/React Native/backend web antes deste projeto, mas aprendeu rápido ao longo da conversa e já pode ser tratado com mais autonomia técnica do que no início. Prefere diagnóstico direto e código corrigido exato em vez de explicação longa. Comunicação em português; nomes de variáveis, tabelas e commits em português também, seguindo o padrão já usado no schema e no código.

---

# Parte 2 — Backlog

*Última atualização: 20/08/2026*

## Backlog — itens levantados pelo dono do projeto

### Mural
- [x] Curtir mensagens do feed — toggle otimista no card, contador vem do embed `curtidas(usuario_id)`
- [x] Mostrar dia/horário de cada mensagem no feed — `lib/datas.ts` + cabeçalho do card no Mural
- [x] Moderação do feed — botão "Remover" no card, visível só pra `papel === 'sindico'`, com confirmação. Remove post; remoção de comentário fica pra quando o feed tiver comentários na UI.
- [ ] Respostas a mensagens no feed, estilo thread (responder um post específico, não só comentar solto)

### Reuniões
- [x] Permitir desmarcar presença — o código já fazia o `delete` desde sempre, mas faltava a policy no banco, então nunca removeu nada. Policy aplicada em 20/08/2026
- [ ] Síndico poder cancelar reunião, com opção de já mandar um aviso junto avisando o cancelamento

### Reserva de salão
- [ ] Gestão e pedido de reserva do salão, com calendário já mostrando datas bloqueadas (não deixar pedir data já reservada)

### Regras do condomínio
- [ ] Regras editáveis pelo síndico, com aviso automático disparado quando forem alteradas

### Gestão (síndico)
- [ ] Arquivar sugestões/problemas (tirar da lista ativa sem apagar)
- [ ] Ter acesso a itens arquivados
- [ ] Lista de condôminos do condomínio, visível só pro síndico (nome, unidade, papel, contato) — ver decisão em aberto sobre `telefone` na Parte 1
- Analytics → movido pra Parte 3, virou pré-requisito do modelo de negócio, não feature de Gestão

### Onboarding self-service — PRÓXIMO ITEM

Levantado em 20/08/2026. Não existia no backlog antes; é o gargalo real entre "app do meu prédio" e "produto".

Hoje criar um condomínio novo exige entrar no painel do Supabase e inserir linha por linha: `condominios`, cada `unidade`, e o vínculo do primeiro síndico com `papel = 'sindico'` e `status = 'aprovado'` na mão. Nenhuma tela do app cobre isso, e não dá pra pedir isso a um síndico.

O nó técnico: o primeiro síndico é um paradoxo igual ao do `vincular_por_codigo` — `eh_sindico()` exige um vínculo aprovado que ainda não existe, e não pode ser o próprio usuário que se declara síndico (senão qualquer um vira síndico de qualquer condomínio). Provavelmente resolve com RPC `security definer` + algum código/convite emitido fora do app.

- [ ] Criar condomínio + primeiro síndico (fluxo e quem tem permissão de disparar)
- [ ] Cadastro de unidades em lote (bloco/número em massa, não uma a uma)
- [ ] Distribuição dos códigos de convite pros moradores (hoje o `codigo_convite` é gerado mas não tem como o síndico ver ou compartilhar)

### Vagas de garagem
- [ ] Solicitação de troca de vaga entre condôminos (pedir, aceitar/recusar, histórico de trocas)

### Papéis
- [ ] Função de subsíndico — permissões parciais de síndico
- [ ] Função de conselho fiscal — outro nível de acesso intermediário

### Infraestrutura
- [ ] Push notifications (avisos, votação aberta, reunião marcada, resposta no feed etc. chegando como notificação, não só ao abrir o app)

### UX geral
- [ ] Revisão de layout — depois que o funcional estiver mais maduro, passar um olho na experiência visual como um todo

## Sugestões baseadas em apps concorrentes (Condomob, uCondo, CondomínioApp, Superlógica, Lello)

Não são recomendação de implementar tudo — são ideias pra avaliar quando fizer sentido pro seu condomínio.

| Feature | Por que pode valer | Inspirado em |
|---|---|---|
| **Controle de encomendas** — porteiro/síndico registra "chegou uma encomenda pra você", morador recebe notificação e confirma retirada | Reduz o "pacote sumiu" e a fila na portaria | Condomob |
| **Pré-liberação de visitantes** — morador cadastra visitante/prestador esperado, portaria libera mais rápido | Fica mais pesado (depende de integração com portaria), mas é a feature mais citada em avaliação de usuário | uCondo |
| **Documentos do condomínio** — atas de assembleia, convenção, regimento interno, prestação de contas, num repositório simples | Baixo esforço de construir (essencialmente upload + lista), alto valor percebido | Superlógica, Condomob |
| **Avaliação de prestador de serviço** — depois que um problema é marcado "resolvido", pedir uma nota rápida de 1 a 5 | Dado interessante pro síndico decidir quem recontratar; encaixa bem no fluxo de Problemas que já existe | Éleme (inspiração, não cópia direta) |
| **Galeria de fotos do condomínio** — eventos, obras, antes/depois de reformas | Feature leve, reforço de comunidade | Superlógica |

## Pesquisa: maiores reclamações reais de quem mora em condomínio

| Reclamação real | O que os dados mostram | O que isso sugere pro app |
|---|---|---|
| Falta de transparência na prestação de contas | Levantamento da AABIC aponta que 21% das reclamações em assembleias em 2024 eram sobre falta de clareza nas contas — a queixa nº1 com número concreto | **Novo:** seção financeira simples — balancete mensal publicado como um tipo de "aviso" estruturado, com anexo de documento |
| WhatsApp é o canal mais usado, mas informal e sem valor comprobatório | Grupos de WhatsApp resolvem o dia a dia, mas juridicamente não substituem um canal oficial do condomínio | Já endereçado — Varanda como canal oficial documentado (Mural + Oficial) |
| Síndico que não responde / demora a resolver | A orientação padrão pra quem sofre isso é "documente manualmente cada tentativa de contato" — sinal de que falta rastreamento automático | Já parcialmente endereçado via histórico de status em Problemas. **Novo:** indicador de prazo/SLA — ex: "aberto há 5 dias sem atualização" |
| Baixa participação/quórum em assembleias, decisão concentrada em poucos | Votação remota é citada como um dos fatores mais eficazes pra aumentar participação | Já endereçado — votação por unidade dentro do app. **Novo:** lembrete automático antes do prazo da votação encerrar (depende de push notifications) |
| Moradores alegam falta de tempo de revisar pauta/contas antes de votar | É comum reclamação de "não tive tempo de ver antes de votar" | **Novo:** permitir anexar documento/pauta na votação, com antecedência mínima antes de poder encerrar |
| Portaria bagunçada, encomendas perdidas | Citado como um dos motivos mais recorrentes de atrito no dia a dia | Já no backlog como sugestão de mercado — controle de encomendas |
| Conflitos de vizinhança (barulho, uso de área comum) expostos publicamente | Reclamações desse tipo hoje são registradas em livro de ocorrências físico, não expostas aos outros moradores | **Novo:** opção de relato confidencial (visível só ao síndico) em Problemas, separado dos relatos de infraestrutura que fazem sentido serem públicos |

### Novos itens de backlog gerados por essa pesquisa
- [ ] Seção financeira / prestação de contas simplificada (balancete como aviso estruturado + anexo)
- [ ] Indicador de tempo em aberto nos Problemas (SLA visual: "aberto há X dias")
- [ ] Lembrete automático antes do prazo de uma votação encerrar
- [ ] Anexar documento/pauta a uma votação
- [ ] Relato confidencial (só síndico vê) como opção alternativa ao relato público em Problemas

## Como priorizar quando voltarmos

1. **Rápido de fazer, alto impacto:** desmarcar presença, dia/horário no feed, curtir posts, moderação básica do feed (remover post) — ajustes pequenos em telas que já existem
2. **Médio esforço:** cancelar reunião com aviso, arquivar sugestões/problemas, lista de condôminos, regras do condomínio + aviso automático, respostas em thread no feed
3. **Maior esforço (schema novo + telas novas, ou serviço externo):** subsíndico/conselho, reserva de salão com calendário de bloqueios, controle de encomendas, push notifications (exige configurar FCM/Expo Notifications)
4. **Avaliar depois, mais dependente de operação real do condomínio:** pré-liberação de visitantes, documentos, avaliação de prestador, seção financeira/prestação de contas

---

# Parte 3 — Plano de negócio

*Rascunho para avaliação futura — versão inicial, sem validação de campo. Gerado a partir de conversa exploratória em 20/08/2026.*

## 1. Proposta de valor

App de comunicação para condomínios, posicionado como substituto do grupo de WhatsApp: avisos, ocorrências, autorizações de portaria, reservas de área comum, centralizando o que hoje é informal e disperso.

**Concorrente real não é outro software — é o grupo de WhatsApp grátis.** Isso define toda a estratégia: o produto precisa vencer por hábito e conveniência, não por lista de features.

## 2. Modelo de cobrança

- **R$ 5,00 por condômino/mês**, cobrado do condomínio (não do morador individualmente).
- Condomínio médio de 100 unidades → R$ 500/mês.
- Comparado ao mercado (sistemas de gestão condominial no Brasil vão de R$ 49 a R$ 2.000/mês), o preço está competitivo — principalmente por cobrir só comunicação, não gestão financeira/fiscal completa.

## 3. Estimativa de receita (cenários)

| Condomínios ativos | Receita mensal (base 100 un./condomínio) |
|---|---|
| 10 | R$ 5.000 |
| 50 | R$ 25.000 |
| 200 | R$ 100.000 |

*Números ilustrativos — dependem de retenção real e não consideram churn.*

## 4. Estrutura de custos

| Item | Peso | Observação |
|---|---|---|
| Infra/hosting | Baixo | Escala bem, provavelmente < R$0,50/unidade/mês |
| Pagamento/cobrança | Médio | Taxa de gateway (2–4%) + risco de inadimplência do condomínio |
| Suporte/onboarding | **Alto** | Síndico não é usuário técnico; exige treinamento e suporte humano — não escala como software puro |
| Comercial/vendas | **Alto** | Ciclo de venda longo; decisão passa por assembleia |

**Principal gargalo do negócio: custo de suporte e vendas, não infraestrutura.**

## 5. Principal barreira identificada

Gasto novo em condomínio geralmente exige **aprovação em assembleia**, o que trava ou atrasa a conversão mesmo quando o síndico está convencido individualmente.

## 6. Estratégia de trial (modelo definido na conversa)

**Trial condicional de engajamento:**
1. 3 meses grátis para todo condomínio que entrar.
2. Se houver adesão medida por critério objetivo (ex: % de moradores cadastrados, nº de avisos publicados, % de abertura do app), estende para 6 meses.
3. Ao fim do período estendido, oferece plano pago completo ao síndico.

**Por que funciona:**
- Contorna a barreira da assembleia no primeiro contato (síndico testa sem precisar aprovar gasto).
- Cria hábito e custo de troca durante o período grátis — moradores migram do WhatsApp, e isso é o que retém de fato.
- Segmenta esforço comercial: quem engaja recebe mais investimento seu, quem não engaja sai do funil mais cedo.

**Pontos em aberto a definir antes de rodar:**
- Critério de adesão precisa ser objetivo, mensurável e **comunicado ao síndico desde o início** (não decidido depois, para não parecer mudança de regra).
- Definir o que fazer com quem não atinge o critério em 3 meses — cortar direto vs. investigar causa (ex: falta de divulgação interna) antes de descartar.
- Antecipar a conversa de aprovação formal: provocar o síndico a levar a proposta à assembleia **no mês 5**, não esperar o trial acabar (senão perde o momentum).

## 7. Riscos principais

- Baixa disposição a pagar por algo que já existe "de graça" (grupo de WhatsApp).
- Ciclo de decisão lento (dependência de assembleia).
- Custo de suporte pode não escalar tão bem quanto a receita, especialmente em fase inicial com poucos condomínios.
- Inadimplência do condomínio (histórico comum no setor).

## 8. Pré-requisitos técnicos do modelo de negócio

Não são features de produto — são o que precisa existir pro modelo da seção 6 ser executável.

- [ ] **Analytics de engajamento** (movido do backlog de Gestão em 20/08/2026). O trial condicional depende de medir adesão por critério objetivo — % de moradores cadastrados, nº de avisos publicados, frequência de abertura do app. Hoje não existe nada disso instrumentado, então não há como decidir quem qualifica pra estender de 3 pra 6 meses. Serve duplamente: métrica de decisão comercial e feature de valor pro síndico.
- [ ] **Onboarding self-service** (ver Parte 2). Cada condomínio novo hoje custa trabalho manual seu no painel do Supabase — o que faz o custo de aquisição crescer linearmente e inviabiliza o "3 meses grátis pra todo condomínio que entrar" em qualquer volume.
- [ ] **Definir o critério de adesão** em número, antes do primeiro piloto — e comunicar ao síndico na entrada (seção 6 já aponta isso como ponto em aberto).

Nota: a parte mais difícil de virar produto — multi-tenancy com isolamento por RLS — **já está pronta** desde o começo. O schema nunca foi single-tenant.

## 9. Próximos passos sugeridos (para validação, não para decidir agora)

- Testar apetite de compra com síndicos/imobiliárias reais antes de investir em desenvolvimento completo.
- Definir e testar o critério de engajamento do trial com um grupo piloto pequeno.
- Avaliar modelo alternativo (freemium: base grátis para síndico, upsell pago em features específicas) como comparação ao modelo atual de cobrança direta.
