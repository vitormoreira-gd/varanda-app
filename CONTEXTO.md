# Varanda — Contexto do projeto

Este arquivo existe pra dar contexto rápido a qualquer instância do Claude (ou a você mesmo, futuramente) sobre o que é esse projeto, o que já foi construído, as decisões/armadilhas já resolvidas, o backlog e o plano de negócio. Leia isso antes de mexer em qualquer coisa.

---

# Onde retomar

*Última sessão: 20/08/2026. Bloco escrito no fim da sessão pra próxima instância (ou pro Vitor) não precisar reconstruir estado.*

## Estado

- **Tudo commitado**, working tree limpo, branch `main`, sem remote (só local).
- **Todas as migrações aplicadas no Supabase e dobradas** dentro de `db/varanda-schema.sql`. Não há migração solta pendente. O `db/` tem só o schema e os snippets de teste.
- App rodando no celular via Expo Go. Nenhum emulador na máquina, e foi decidido continuar assim.

## O que ainda NÃO foi testado no celular

Escrito e com `npx tsc --noEmit` limpo, mas não exercitado com gente de verdade:

1. **Reserva do salão** — o fluxo completo: morador pede, síndico aprova, e um segundo pedido pra mesma data tem que cair na mensagem "Data indisponível" (vinda do erro 23505 dos índices parciais).
2. **Arquivar sugestão/problema**, **cancelar reunião com aviso**, e o badge de **"aberto há X dias"** — implementados e com a migração aplicada, mas sem teste de tela.
3. **Lista de condôminos** — conferir se o resumo do topo bate com a realidade do Aurora.

## Próximo passo

Sobrou da **Fase 3** (ver Parte 4): regras do condomínio · relato confidencial em Problemas · subsíndico e conselho fiscal · troca de vaga de garagem.

Não escolher sozinho: o Vitor quer ser consultado antes de começar uma implementação, com as opções e o custo de cada uma. Depois de escolhido, tocar até o fim sem perguntar de novo.

## Como subir o ambiente

```
npx expo start
```

No Expo Go, "Enter URL manually" → `exp://<ip-da-maquina>:8081`. O celular fica no Wi-Fi e o PC no cabo, mesma rede.

**Pegadinha que já custou tempo:** se o Metro não registrar nenhuma requisição do celular, é o firewall do Windows. A rede precisa estar como **Private** e a porta 8081 liberada — em PowerShell como administrador:

```powershell
Set-NetConnectionProfile -InterfaceAlias Ethernet -NetworkCategory Private
New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
```

Pra testar com duas contas sem ficar entrando e saindo, `db/snippets-teste.sql` tem os atalhos: aprovar vínculo, emitir e reciclar código de fundação, promover a síndico.

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
│   └── snippets-teste.sql           — atalhos de SQL pro teste manual (não é migração)
├── lib/
│   ├── supabase.ts                  — client Supabase configurado pra RN
│   ├── datas.ts                     — formatarDataHora(), sem depender de Intl
│   └── useMeuCondominio.ts          — hook: situacao do onboarding + condominioId, unidadeId, papel
├── screens/
│   ├── AuthScreen.tsx                — cadastro/login (só e-mail e senha)
│   ├── EntradaScreen.tsx             — onboarding: perfil → convite ou fundação → espera aprovação
│   ├── MuralScreen.tsx               — feed social (posts)
│   ├── SolicitacoesScreen.tsx        — host com seletor Sugestões/Problemas/Salão
│   ├── ReservasScreen.tsx            — pedir reserva do salão; síndico aprova/recusa na mesma tela
│   ├── SugestoesScreen.tsx
│   ├── ProblemasScreen.tsx
│   ├── OficialScreen.tsx             — visão condômino: avisos, votações (votar), reuniões (RSVP)
│   ├── OficialCriarScreen.tsx        — visão síndico: criar aviso/votação/reunião (usado dentro de Gestão)
│   ├── GestaoScreen.tsx              — host síndico: Vínculos/Condôminos/Unidades/Sugestões/Problemas/Oficial
│   ├── UnidadesScreen.tsx            — síndico cadastra unidades em lote e compartilha convites
│   ├── CondominosScreen.tsx          — síndico vê quem entrou, unidade por unidade
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

Onboarding self-service, **aplicado no Supabase em 20/08/2026** e já dobrado dentro de `varanda-schema.sql`:
- tabela `codigos_fundacao` — RLS ligado e **sem nenhuma policy**, de propósito: ninguém lê nem escreve pela API, o único caminho é o RPC. Impede alguém de listar códigos ainda não usados.
- RPC `fundar_condominio(codigo, nome, endereco, bloco, numero)` — `security definer`, cria condomínio + unidade do síndico + vínculo já aprovado numa transação, e queima o código. Usa `for update` na linha do código pra dois cliques simultâneos não usarem o mesmo código.
- policy `sindico cria unidade` em `unidades` — insert direto resolve, sem RPC, porque aqui o `condominio_id` já existe e `eh_sindico()` já funciona.

**Como emitir um código de fundação** (no SQL Editor, quando fechar um trial):
```sql
insert into codigos_fundacao (codigo, observacao)
values ('VARANDA-2026-ABC', 'Ed. Fulano — trial iniciado 20/08');
```

Arquivamento, cancelamento de reunião e unique de unidade, **aplicados no Supabase em 20/08/2026** e já dobrados dentro de `varanda-schema.sql`:
- `arquivado_em` em `sugestoes` e `problemas` — soft delete; nada é apagado. Não precisou de policy nova: as de update do síndico já cobrem.
- `cancelada_em` e `motivo_cancelamento` em `reunioes`, mais a policy `sindico edita reuniao` (a tabela tinha select e insert, faltava update).
- índice único `unidades_sem_duplicata` — fecha a dívida técnica da duplicata de unidade. É índice de expressão com `coalesce(bloco, '')` porque em unique constraint dois NULLs não conflitam, e sem isso "sem bloco / 101" entraria infinitas vezes. Se um banco novo já tiver duplicata, a criação do índice falha — nesse caso, limpar antes de rodar o schema.

Reserva do salão, **aplicada no Supabase em 20/08/2026** e já dobrada dentro de `varanda-schema.sql`:
- enum `status_reserva` (pendente/aprovada/recusada) e tabela `reservas`.
- Reserva é **por unidade**, não por pessoa — mesma lógica do voto. O insert repete a checagem de unidade usada em `votos`: não basta `usuario_id = auth.uid()`, a unidade tem que ser mesmo do usuário, senão dá pra reservar em nome do vizinho.
- Dois **índices parciais** garantem a regra de conflito no banco, não na tela: `reservas_uma_aprovada_por_data` (só uma aprovada por data e condomínio) e `reservas_um_pedido_por_unidade_data`. Parciais de propósito — vários pedidos *pendentes* na mesma data podem coexistir, e é justamente isso que dá ao síndico a escolha entre dois pedidos.
- Um salão por condomínio. Se um dia houver várias áreas comuns, vira tabela `areas_comuns` + FK; hoje seria complexidade sem demanda.

**Sobre `telefone` e `foto_url` (era decisão em aberto, resolvida em 20/08/2026):** RLS é por linha, não por coluna, então a policy que deixa o vizinho ver seu `nome` libera a linha inteira de `usuarios` — telefone e foto junto. Mas ao implementar a lista de condôminos ficou claro que **nenhuma tela do app lê ou escreve essas duas colunas**: são colunas mortas desde o schema original, e não há telefone nenhum no banco pra vazar. A exposição é teórica.

Fica registrado pra quando deixar de ser: **no dia em que existir cadastro de telefone, mover contato pra tabela separada com policy própria** — a lista de condôminos já está preparada, ela não exibe contato hoje.

## Armadilhas já resolvidas (não repetir)

1. **PostgREST "more than one relationship was found"**: ao fazer embed de `usuarios` a partir de outra tabela (ex: `posts`), especificar a coluna explicitamente: `usuarios!autor_id(nome)` em vez de `usuarios(nome)`. Vai acontecer de novo em qualquer novo join com `usuarios`.
2. **RLS e enum ambíguo em função PL/pgSQL**: se uma função usa `returns table (coluna_x ...)`, o Postgres cria uma variável interna com esse nome que pode colidir com uma coluna de tabela de mesmo nome dentro do corpo da função. Nomear as colunas de retorno de forma única (ex: `id_unidade` em vez de `unidade_id`) evita.
3. **Falha silenciosa é o inimigo nº1**: todo `supabase.from(...).select/insert/update` deve checar `error` e mostrar via `Alert.alert`. Vários bugs de "não fez nada" eram erro real sendo engolido sem feedback.
4. **RLS que bloqueia `delete` não devolve erro** — devolve 0 linhas afetadas. Um `Alert.alert` em cima do `error` (armadilha nº3) não pega isso: o caminho é `.delete()...select()` e checar se a lista voltou vazia. Foi assim que "desmarcar presença" passou meses parecendo implementado. Vale o mesmo raciocínio pra `update` bloqueado.
5. **Select em `vinculos` devolve o condomínio inteiro pra síndico** — a policy "sindico ve vinculos do condominio" soma-se à de "vê os próprios". Então `from('vinculos').select(...)` sem `.eq('usuario_id', ...)` traz os vínculos de todos os moradores quando quem pergunta é síndico. Com `.maybeSingle()` isso vira erro de "mais de uma linha" no momento em que o segundo morador é aprovado — o app do síndico quebrava inteiro. Sempre filtrar por `usuario_id` quando a pergunta é "qual é o MEU vínculo".
6. **PowerShell bloqueando `npx`**: usar `cmd` em vez de PowerShell, ou `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` como admin.
7. **`toISOString()` em coluna `date`**: converte pra UTC, então à noite no Brasil (UTC-3) a data pula pro dia seguinte — uma reserva pedida dia 20 às 22h viraria dia 21. Usar `paraDataISO()` de `lib/datas.ts`, que monta `YYYY-MM-DD` a partir dos componentes locais. Mesmo cuidado ao ler: `formatarDataCurta()` não passa por `Date` com fuso.
8. **`.env` do Expo**: variáveis precisam do prefixo `EXPO_PUBLIC_` pra chegar no client. Mudança no `.env` só é lida reiniciando o servidor (`npx expo start -c`).

## Status atual

*Sessão de 20/08/2026 — tudo commitado, migrações aplicadas, e o app rodando no celular via Expo Go. O fluxo de onboarding foi exercitado ponta a ponta pela primeira vez.*

Nota de ambiente: o Expo Go só conecta se a rede do PC estiver como **Private** no Windows e houver regra de firewall liberando a porta 8081 — sem isso o Metro não registra nem a tentativa. Aconteceu nesta sessão e custou tempo.

Corrigido nesta sessão:
- **Votação estava quebrada** — `useMeuCondominio` nunca retornou `unidadeId` (o `OficialScreen` destruturava e recebia `undefined`), então nenhum voto passava e o histórico "já votei" nunca carregava. Contradizia o "MVP completo e testado" abaixo; provavelmente quebrou num refactor posterior ao teste.
- Feed com data/hora, curtidas e moderação (ver backlog).
- `delete` de RSVP agora detecta bloqueio de RLS em vez de falhar calado.
- Quatro policies que faltavam no banco, aplicadas e dobradas no schema (ver Parte 1).

- **Onboarding self-service** construído (ver backlog). Ao escrever, descobri que o fluxo de entrada não existia: `vincular_por_codigo` não era chamada em lugar nenhum do app, e nada criava a linha em `usuarios` — os perfis existentes devem ter sido inseridos à mão no painel. O CONTEXTO dizia que esse fluxo tinha sido testado; não tinha.
- **Bug latente grave corrigido no hook**: `.maybeSingle()` em `vinculos` sem filtro de `usuario_id` (ver armadilha nº5). O app do síndico ia quebrar assim que o segundo morador fosse aprovado.

- **Comentários no Mural** (Fase 1 do roadmap): card expande, lista comentários, campo pra escrever, síndico remove comentário. Primeira vez que a tabela `comentarios` é usada.
- Push notifications e analytics **adiados por decisão** de 20/08/2026 — ver Parte 4.
- **Reserva do salão** (primeiro item da Fase 3): pedido por unidade, aprovação do síndico na mesma tela, conflito de data resolvido no banco por índice parcial.
- **Lista de condôminos** (fecha a Fase 2 do roadmap): quem entrou, unidade por unidade, com resumo de adesão no topo — % de unidades ocupadas é o embrião da métrica que o trial vai precisar.
- **Tempo em aberto nos Problemas, arquivar solicitações e cancelar reunião** — migração aplicada e dobrada no schema.

Ambiente: decidido em 20/08/2026 continuar testando **só no celular**. Não há SDK Android na máquina (os quatro Unity instalados estão sem o módulo AndroidPlayer), e emulador custaria ~10 GB. Expo Web foi descartado porque `react-native-web` não implementa `Alert`, e este app usa `Alert.alert` para todo feedback de erro e toda confirmação destrutiva — testar lá esconderia justamente a classe de bug mais comum aqui. O emulador só passa a valer quando a dor for testar síndico e morador lado a lado.

MVP funcionalmente completo e testado (antes desta sessão): cadastro → vínculo por código de convite → aprovação pelo síndico → Mural, Sugestões (com apoio), Problemas (com histórico de status), Oficial (avisos fixados, votação por unidade, reunião com RSVP e seletor de data/hora nativo) → Gestão do síndico pra tudo isso.

## Preferências do dono do projeto

Vitor — dev de jogos mobile (Unity/C#), sem familiaridade prévia com Supabase/React Native/backend web antes deste projeto, mas aprendeu rápido ao longo da conversa e já pode ser tratado com mais autonomia técnica do que no início. Prefere diagnóstico direto e código corrigido exato em vez de explicação longa. **Quer ser consultado antes de começar uma implementação** — apresentar as opções com o custo de cada uma e esperar a escolha, em vez de sair codando o que parecer melhor. Depois de escolhido, tocar até o fim sem perguntar de novo. Comunicação em português; nomes de variáveis, tabelas e commits em português também, seguindo o padrão já usado no schema e no código.

---

# Parte 2 — Backlog

*Última atualização: 20/08/2026*

## Backlog — itens levantados pelo dono do projeto

### Mural
- [x] Curtir mensagens do feed — toggle otimista no card, contador vem do embed `curtidas(usuario_id)`
- [x] Mostrar dia/horário de cada mensagem no feed — `lib/datas.ts` + cabeçalho do card no Mural
- [x] Moderação do feed — botão "Remover" no card, visível só pra `papel === 'sindico'`, com confirmação. Remove post; remoção de comentário fica pra quando o feed tiver comentários na UI.
- [x] Comentários no feed — card expande com a lista de comentários e campo pra escrever; síndico remove comentário individual. A tabela `comentarios` existia desde o schema original sem nenhuma tela usando
- ~~Respostas em thread~~ **descartado em 20/08/2026** — a estrutura plana de comentários resolve. Aninhar comentário dentro de comentário adiciona coluna nova, recursão na UI e confusão pro morador, sem ganho real numa conversa de condomínio

### Sugestões
- [x] Retirar apoio — o `toggleApoio` já fazia o delete desde sempre, mas faltava a policy; agora funciona e detecta bloqueio de RLS

### Reuniões
- [x] Permitir desmarcar presença — o código já fazia o `delete` desde sempre, mas faltava a policy no banco, então nunca removeu nada. Policy aplicada em 20/08/2026
- [x] Síndico poder cancelar reunião, com opção de mandar aviso junto — cancelamento é **soft** (`cancelada_em`), porque quem confirmou presença precisa ver que foi cancelada; apagar faria a reunião sumir em silêncio

### Reserva de salão
- [x] Gestão e pedido de reserva do salão — aba "Salão" dentro de Solicitações. O bloqueio de data conflitante é garantido por índice parcial no banco, e o app traduz o erro 23505 numa mensagem que o morador entende. Síndico aprova/recusa na mesma tela, sem aba própria em Gestão

### Regras do condomínio
- [ ] Regras editáveis pelo síndico, com aviso automático disparado quando forem alteradas

### Gestão (síndico)
- [x] Arquivar sugestões/problemas — filtro Ativas/Arquivadas na tela de moderação, com arquivar e desarquivar
- [x] Ter acesso a itens arquivados — mesmo filtro
- [x] Lista de condôminos, visível só pro síndico — aba Condôminos, agrupada por unidade, com nome, papel e status do vínculo. **Sem contato**, porque o app não coleta telefone (ver Parte 1). Mostra as unidades vazias de propósito: pro síndico, "quem ainda não entrou" é a informação mais útil
- Analytics → movido pra Parte 3, virou pré-requisito do modelo de negócio, não feature de Gestão

### Onboarding self-service — FEITO

Levantado em 20/08/2026. Não existia no backlog antes; é o gargalo real entre "app do meu prédio" e "produto".

Hoje criar um condomínio novo exige entrar no painel do Supabase e inserir linha por linha: `condominios`, cada `unidade`, e o vínculo do primeiro síndico com `papel = 'sindico'` e `status = 'aprovado'` na mão. Nenhuma tela do app cobre isso, e não dá pra pedir isso a um síndico.

O nó técnico: o primeiro síndico é um paradoxo igual ao do `vincular_por_codigo` — `eh_sindico()` exige um vínculo aprovado que ainda não existe, e não pode ser o próprio usuário que se declara síndico (senão qualquer um vira síndico de qualquer condomínio). Provavelmente resolve com RPC `security definer` + algum código/convite emitido fora do app.

**Decisão tomada (20/08/2026):** código de fundação emitido por você fora do app. Descartadas: autoatendimento total (qualquer um vira síndico de qualquer prédio) e fila de aprovação manual (trava o onboarding no pico de interesse do síndico). O código casa com o ciclo de venda com toque humano do plano e vira o gate natural do trial.

- [x] Criar condomínio + primeiro síndico — RPC `fundar_condominio`, aba "Vou fundar" na EntradaScreen
- [x] Cadastro de unidades em lote — `UnidadesScreen`, aceita intervalo (`101-110`), lista (`11, 12, 21`) e mistura; ignora as que já existem
- [x] Distribuição dos códigos de convite — lista de unidades com código e botão de compartilhar (Share nativo), mostrando quantos moradores já entraram em cada uma
- [x] Perfil e vínculo por convite — a `EntradaScreen` cria a linha em `usuarios` e chama `vincular_por_codigo`, que existia no banco mas nenhuma tela usava
- [ ] Sem unique em `(condominio_id, bloco, numero)`: a checagem de duplicata é só no client. Dois síndicos do mesmo prédio criando unidades ao mesmo tempo duplicam

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
- [x] Indicador de tempo em aberto nos Problemas — conta da **última mudança de status**, não da abertura: é o "aberto há 5 dias sem atualização" que a pesquisa apontou. Âmbar a partir de 3 dias, vermelho a partir de 7; resolvido mostra em quanto tempo foi
- [ ] Lembrete automático antes do prazo de uma votação encerrar
- [ ] Anexar documento/pauta a uma votação
- [ ] Relato confidencial (só síndico vê) como opção alternativa ao relato público em Problemas

## Como priorizar

Ver **Parte 4 — Roadmap**. A lista de esforço que ficava aqui foi absorvida por ele.

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

---

# Parte 4 — Roadmap

*Montado em 20/08/2026 e reordenado no mesmo dia, depois da decisão de adiar push notifications e tudo que for burocrático. O critério agora é: primeiro o que o morador sente abrindo o app, depois o que o síndico precisa pra tocar, depois o que justifica cobrar, e por último o que só importa quando for vender pra fora.*

## Onde estamos

MVP completo e em uso num condomínio real. Um condomínio novo entra sozinho, sem ninguém abrir o painel do Supabase. A pergunta que manda agora não é "o que falta pra vender", é **"por que alguém abriria isso em vez do grupo do WhatsApp"**.

## Fase 1 — Conversa (próxima)

**Meta:** o Mural virar lugar de conversa, não quadro de avisos. Hoje dá pra publicar e curtir, e a interação morre aí.

| Item | Por quê agora |
|---|---|
| ~~**Comentários no feed**~~ FEITO | A tabela `comentarios` existia desde o schema original, com policies de insert e delete, e nenhuma tela jamais usou. Sem comentário não há conversa; sem conversa o Mural perde do WhatsApp por definição. |
| ~~Respostas em thread~~ DESCARTADO | Decisão de 20/08/2026: a estrutura plana já resolve. Comentário dentro de comentário não paga o custo numa conversa de prédio. |
| ~~Moderação de comentário (síndico)~~ FEITO | Saiu junto dos comentários: link "remover" em cada comentário, visível só pro síndico. |
| ~~Retirar apoio de sugestão~~ FEITO | O código já fazia o delete; faltava a policy, que veio no patch de 20/08. Só precisou de endurecimento contra falha silenciosa. |
| ~~"Aberto há X dias" nos Problemas~~ FEITO | Conta da última mudança de status, não da abertura. Âmbar em 3 dias, vermelho em 7. |
| Revisão de layout | **Adiado por decisão de 20/08/2026 para o fim do roadmap** — fazer a passada visual depois que as telas pararem de mudar, senão retrabalho. |

## Fase 2 — Dia a dia do síndico

**Meta:** o síndico tocar o condomínio sem pedir socorro nem abrir o painel do Supabase.

- ~~Cancelar reunião, com aviso automático junto~~ **FEITO**
- ~~Arquivar sugestões/problemas + acesso ao arquivo~~ **FEITO**
- ~~Lista de condôminos~~ **FEITO** — a decisão sobre `telefone` caiu junto: as colunas são mortas, não há o que proteger hoje
- ~~`unique (condominio_id, bloco, numero)`~~ **FEITO** (índice `unidades_sem_duplicata`, na migração pendente)

## Fase 3 — Gestão do condomínio

**Meta:** fazer o que o WhatsApp não faz. É o que justifica cobrar, quando chegar a hora de cobrar.

- ~~Reserva de salão~~ **FEITO**
- Regras do condomínio editáveis, com aviso automático quando mudarem
- Subsíndico e conselho fiscal (permissões intermediárias)
- Troca de vaga de garagem entre condôminos
- Relato confidencial em Problemas (visível só ao síndico), separado do relato público

## Fase 4 — Só quando for pra fora

**Meta:** nada aqui vale antes de existir um segundo condomínio real. São itens de escala e de venda, não de produto.

- **Push notifications** — adiado por decisão de 20/08/2026. Continua sendo o maior item de retenção do backlog, mas exige *development build* (não roda no Expo Go desde o SDK 53), o que quebra o fluxo de teste atual. Bom saber: é o **mesmo** trabalho de infra que gera o `.apk` sideloaded pra distribuição — quando for encarar, resolve os dois de uma vez.
- **Analytics de engajamento** — gate do trial condicional descrito na Parte 3. Sem ele não dá pra decidir quem estende de 3 pra 6 meses. Enquanto houver um condomínio só, dá pra olhar no painel do Supabase na mão.
- Prestação de contas simplificada — a reclamação nº1 com número concreto (21%, AABIC)
- Documentos do condomínio (atas, convenção, regimento)
- Anexar pauta/documento a uma votação + lembrete antes do prazo (depende de push)
- Controle de encomendas
- Avaliação de prestador depois de um problema resolvido
- Pré-liberação de visitantes (depende de portaria, que não é sua)
- Galeria de fotos

## Trilha paralela — negócio

Não depende de código, mas está **parada por decisão** enquanto o foco é produto:

- Definir o critério de adesão do trial em número, antes do primeiro piloto externo
- Testar apetite de compra com síndicos e imobiliárias reais
- Comparar o modelo atual (R$ 5/condômino) com um freemium, como controle

## O que deliberadamente não está no topo

- **Regras do condomínio** — valor percebido alto, mas é conteúdo estático que muda uma vez por ano
- **Pré-liberação de visitantes** — a feature mais elogiada em review de concorrente, e a mais cara: depende de operação de portaria
- **Gestão financeira completa** — fora de escopo por posicionamento. O plano define o Varanda como app de comunicação; competir com Superlógica em boleto e fiscal é outro produto
