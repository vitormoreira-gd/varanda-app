# Varanda — Contexto do projeto

Este arquivo existe pra dar contexto rápido a qualquer instância do Claude (ou a você mesmo, futuramente) sobre o que é esse projeto, o que já foi construído, as decisões/armadilhas já resolvidas, o backlog e o plano de negócio. Leia isso antes de mexer em qualquer coisa.

---

# Onde retomar

*Última sessão: 07/09/2026. Bloco escrito no fim da sessão pra próxima instância (ou pro Vitor) não precisar reconstruir estado.*

## Estado

- Branch `main`, com remote desde 07/09/2026: **https://github.com/vitormoreira-gd/varanda-app**, **público**. Criado pelo `gh` (GitHub CLI, instalado na máquina no mesmo dia). O `.env` está no `.gitignore` e nunca foi commitado — só o `.env.example`, com placeholders.
- **As quatro migrações que estavam pendentes foram aplicadas em 07/09/2026**: mural, votos, solicitações e privacidade. Os arquivos foram apagados, como o cabeçalho de cada um mandava. Tudo já estava dobrado em `db/varanda-schema.sql`, que segue sendo a fonte da verdade do banco. **Não há migração pendente.**
- `db/migracao-cargos.sql` e `db/seed-demo.sql` aplicados em 21/08/2026. O seed fica, porque é re-executável e reseta a demonstração — e já nasce com o aviso restrito desfixado, então re-rodá-lo não reintroduz o problema que a migração de mural corrigiu.
- `sugestoes` e `apoios` **continuam de pé no banco**, de propósito: era o que mantinha a migração de solicitações reversível. Apagá-las (`drop table apoios;` e depois `drop table sugestoes;`) é item de backlog, não de pressa.
- App rodando no celular via Expo Go. Nenhum emulador na máquina, e foi decidido continuar assim.
- **O Expo Go da Play Store não serve mais.** Ele só suporta o SDK mais recente — 57 em 07/09/2026 — e o projeto está no 54. O celular roda o APK do **Expo Go 54.0.8**, instalado à mão. Ver armadilha nº27: isso volta a cada SDK novo, e a cura definitiva é o `.apk` do próprio Varanda.
- IP da máquina em 07/09/2026: `exp://192.168.15.7:8081` — era `.6` em agosto. Muda se a rede mudar — conferir com `ipconfig` (o adaptador **Ethernet**, não o "Topaz Loopback", que devolve um IP público da AWS e não serve).

## O objetivo: apresentar a um síndico

O alvo agora é **apresentar** o app a um síndico — ele vê, você conduz, e o feedback é a saída. Não é piloto: ele não vai instalar nem usar com o prédio dele.

Isso reordenou o roadmap:

- **`.apk` / EAS Build saiu do caminho crítico.** Numa apresentação você mostra no seu próprio celular, no Expo Go. Chega a ser bloqueio só no dia em que ele disser "quero levar pro meu prédio". O `app.json` ainda é o template do Expo (o app se chama "varanda-app", sem `android.package`, sem `eas.json`) — é aí que se mexe quando a hora chegar.
- **Recuperação de senha e edição de perfil saíram junto.** Só importam quando existir morador de verdade com conta própria.
- **Revisão de layout subiu e foi feita.** O argumento da apresentação é "a navegação é intuitiva e substitui o WhatsApp"; telas cruas contradiziam o próprio pitch. Antes ela estava adiada pro fim do roadmap — a inversão foi consciente.

## Próximo passo

*Atualizado em 07/09/2026. As migrações foram aplicadas, a Gestão entrou no padrão de sub-abas e o projeto ganhou repositório. **A apresentação está marcada para 08/09/2026.***

### 1. Ensaiar a apresentação inteira no celular

É o único item antes da apresentação, e é a mesma pendência que atravessou três sessões: nada do que entrou em 21/08, 22/08 e 07/09 foi exercitado com gente de verdade. Roteiro logo abaixo.

### 2. Depois da apresentação

O feedback do síndico manda mais que qualquer item do backlog — a segunda passada de layout, em particular, existe justamente pra acontecer depois dele. Se o feedback não reordenar tudo, os candidatos são:

- **Divulgar o resultado de uma votação encerrada.** Hoje o morador vota e nunca fica sabendo do desfecho pelo app; a tela diz que o síndico divulga, e não há caminho pra isso além de publicar um aviso na mão. Colide de frente com "apuração só pro gabinete", e o padrão do projeto sugere a saída: um RPC `resultado_votacao()` que devolva **só a contagem agregada** depois de `data_fim`, sem revelar qual unidade votou o quê — mesma forma de `datas_ocupadas()` e `papeis_do_meu_condominio()`.
- **`db/metricas.sql`** — consultas prontas pro painel do Supabase, pra ter número na conversa de feedback. Custo baixo, e quase tudo que importa já está nas tabelas.
- **O `.apk` do próprio Varanda.** Deixou de ser só conveniência: enquanto o app depender do Expo Go, cada atualização da loja quebra a demonstração (armadilha nº27). Um APK de preview também elimina a dependência do Metro e do Wi-Fi na hora H.
### Roteiro da apresentação

Na ordem em que a demonstração se conta sozinha:

1. Entrar como **Síndico**. Mural povoado, Oficial com aviso fixado + votação aberta + assembleia marcada, Regras versão 2.
2. Gestão → **Vínculos**: a Tereza está esperando aprovação. Aprovar ao vivo.
3. Gestão → **Condôminos**: 67% de adesão, o 103 vazio. É a métrica que o trial vai precisar.
4. Solicitações → **Salão**: aprovar o pedido pendente do 102 na frente dele. Repare que o síndico vê as duas reservas, de unidades diferentes.
5. Solicitações → **Manutenção**: quatro pedidos, e um deles com a etiqueta **"Só na unidade"** — a torneira do 202.
6. Perfil → trocar para **Morador**. O aviso restrito, a votação restrita e a reunião do conselho **somem**. Esse é o momento que vende.
7. Ainda como Morador, Solicitações → **Salão**: sobra só a reserva do 202, e o **+** abre um calendário com as datas ocupadas riscadas. A privacidade não custou a informação — ele continua sabendo o que está livre, só não sabe de quem é.
8. Ainda como Morador, **Manutenção**: a torneira dele continua lá (é dele), e os três pedidos de área comum também.
9. Perfil → trocar para **Conselho fiscal**. Gestão abre em faixa âmbar, sem botão nenhum — e a torneira do 202 **some**, porque conselho fiscal fiscaliza contas, não queixa doméstica.

O ponto que mais importa testar é o do vazamento pelos filhos (armadilha nº8): como Morador, a votação restrita não pode aparecer **nem os votos dela**.

## O que ainda NÃO foi testado no celular

O Vitor disse em 21/08 que já exercitou boa parte da lista anterior (reserva do salão, arquivamento, cancelamento de reunião, badge de dias, lista de condôminos). O que continua sem teste:

1. **Subsíndico, conselho fiscal e canal restrito** — as migrações estão aplicadas, mas o comportamento nunca foi exercitado.
2. **Tudo que entrou em 21/08**: modo demonstração, seed, a passada de layout, a reforma de navegação + Mural, o Oficial em sub-abas, a enquete de votação e a reorganização de Solicitações. Zero minutos de tela.
3. **Tudo que entrou em 22/08**: manutenção privada, salão individual e o calendário próprio. O calendário é o item mais arriscado da lista — é componente novo, escrito à mão, e a grade de mês nunca rodou em aparelho. Conferir especialmente a virada de mês e o dia 1 caindo no dia da semana certo.
4. **Tudo que entrou em 07/09**: a Gestão em sub-abas e o badge de vínculos pendentes. O `npx tsc --noEmit` passa limpo, mas isso não diz se "Manutenção" cabe na barra sem truncar, nem se a bolinha some no instante da aprovação.

Em 07/09 o app chegou a conectar no celular com o Expo Go 54 e ficou pronto pra testar — o resultado do teste não chegou a ser registrado aqui.
## Como subir o ambiente

```
npx expo start
```

Depois de mexer no `.env`, subir com `npx expo start -c` — sem limpar o cache a variável nova não chega no client.

No Expo Go, "Enter URL manually" → `exp://<ip-da-maquina>:8081`. O celular fica no Wi-Fi e o PC no cabo, mesma rede.

**Pegadinha que já custou tempo:** se o Metro não registrar nenhuma requisição do celular, é o firewall do Windows. A rede precisa estar como **Private** e a porta 8081 liberada — em PowerShell como administrador:

```powershell
Set-NetConnectionProfile -InterfaceAlias Ethernet -NetworkCategory Private
New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
```

Pra testar com duas contas sem ficar entrando e saindo, `db/snippets-teste.sql` tem os atalhos: aprovar vínculo, emitir e reciclar código de fundação, promover a síndico. Com o modo demonstração ligado, trocar de papel é mais rápido ainda: Perfil → tocar no papel.

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
├── App.tsx                          — auth gate + CondominioProvider + tab navigator com ícones
│                                        (Oficial · Mural · Solicitações · Gestão). Perfil NÃO é
│                                        aba: abre pelo avatar do cabeçalho
├── db/
│   ├── varanda-schema.sql           — DDL completo, idempotente. FONTE DA VERDADE do banco.
│   ├── seed-demo.sql                — condomínio fictício da apresentação; re-executável
│   └── snippets-teste.sql           — atalhos de SQL pro teste manual (não é migração)
├── components/
│   ├── ui.tsx                       — Botao, Link, Avatar, Cartao, Campo, Chip, Etiqueta,
│   │                                    Seletor, Secao, Vazio, Carregando, EspacoTopo
│   ├── CabecalhoApp.tsx             — cabeçalho fixo das abas: avatar (abre o Perfil em modal),
│   │                                    nome + unidade + cargo, e o menu de três pontinhos
│   ├── Calendario.tsx               — grade de mês com datas indisponíveis riscadas. Existe
│   │                                    porque o DateTimePicker nativo não desabilita dia solto
│   ├── FolhaExpandida.tsx           — folha de meia tela com alcinha, arrastar-para-baixo e
│   │                                    fundo escurecido. Formato único de "abrir um item":
│   │                                    post, aviso, reunião e votação
│   └── AvisoRapido.tsx              — balão de confirmação que some sozinho; provider + hook
├── lib/
│   ├── supabase.ts                  — client Supabase configurado pra RN
│   ├── tema.ts                      — cores, espaco, raio, fonte, sombra (tokens visuais)
│   ├── demo.ts                      — flag EXPO_PUBLIC_DEMO, os 4 perfis e entrarComoDemo()
│   ├── datas.ts                     — formatação de data/hora sem Intl
│   ├── gestos.ts                    — useToqueDuplo(): separa toque simples de duplo
│   └── useMeuCondominio.tsx         — CondominioProvider + useMeuCondominio: situacao do
│                                        onboarding, condominioId/Nome, unidadeId/Rotulo,
│                                        papel, cargo, rotuloConta, fotoUrl,
│                                        ehSindico/podeGerir/podeFiscalizar
├── screens/
│   ├── AuthScreen.tsx                — cadastro/login (só e-mail e senha)
│   ├── EntradaScreen.tsx             — onboarding: perfil → convite ou fundação → espera aprovação
│   ├── MuralScreen.tsx               — feed social (posts)
│   ├── SolicitacoesScreen.tsx        — host com sub-abas Salão/Manutenção e o botão + que
│   │                                    escolhe o tipo e abre o formulário daquele tipo
│   ├── ReservasScreen.tsx            — lista do salão + aprovação do síndico; exporta
│   │                                    FormularioSalao, usado pelo +
│   ├── ManutencaoScreen.tsx          — lista de pedidos de conserto (tabela `problemas`);
│   │                                    exporta FormularioManutencao, usado pelo +
│   ├── OficialScreen.tsx             — visão condômino: regras, avisos, votações (votar), reuniões (RSVP)
│   ├── RegrasScreen.tsx              — card de leitura das regras, renderizado dentro do Oficial
│   ├── RegrasEditarScreen.tsx        — síndico edita as regras (dentro de Gestão)
│   ├── OficialCriarScreen.tsx        — visão síndico: criar aviso/votação/reunião (usado dentro de Gestão)
│   ├── GestaoScreen.tsx              — host síndico em sub-abas: Moradores (Vínculos/Condôminos/
│   │                                     Unidades) · Manutenção · Oficial · Regras
│   ├── UnidadesScreen.tsx            — síndico cadastra unidades em lote e compartilha convites
│   ├── CondominosScreen.tsx          — síndico vê quem entrou, unidade por unidade
│   ├── VinculosPendentesScreen.tsx   — síndico aprova vínculo pendente
│   ├── ModerarScreen.tsx             — fila de manutenção do síndico: status e arquivo
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

Regras do condomínio, **aplicada no Supabase em 20/08/2026** e já dobrada dentro de `varanda-schema.sql`:
- tabela `regras` — uma linha por condomínio, com `condominio_id` como **primary key**: o regimento é um só, e a PK já garante isso sem constraint extra.
- **Só existe policy de select.** Escrever é sempre pelo RPC `salvar_regras`, que grava e publica o aviso na mesma transação. Sem policy de insert/update, não há caminho no app que mude as regras sem o condomínio ficar sabendo — a exigência "aviso automático quando forem alteradas" virou invariante de banco em vez de disciplina de tela.
- Sem tabela de histórico de versões, de propósito: o rastro de cada alteração é o próprio aviso publicado, que já fica no Oficial. `versao` é um contador pro aviso citar.
- Salvar com o texto idêntico ao já publicado devolve a versão atual, não incrementa e **não** dispara aviso — senão o síndico spamaria o prédio ao abrir e fechar a tela.

Cargos (subsíndico e conselho fiscal) e canal restrito, **aplicado em 21/08/2026** e dobrado dentro de `varanda-schema.sql`. É a mudança mais invasiva feita até hoje no banco — 21 policies reescritas:
- tabela `cargos` (`condominio_id`, `usuario_id`, `cargo`, unique no par) e enum `cargo_condominio` com **apenas** `subsindico` e `conselho`. O síndico continua morando em `vinculos.papel`, de propósito: uma fonte de verdade por cargo, sem risco de o banco discordar de si mesmo sobre quem é síndico.
- **Por que tabela separada e não estender o enum:** `vinculos.papel` mistura relação com a unidade (proprietário/inquilino) e cargo no condomínio (síndico) desde o schema original — um síndico que aluga aparece como `sindico` e a informação de que é inquilino se perde. Com `cargos` os dois convivem: dá pra ser inquilino do 302 **e** subsíndico.
- Três funções novas em cima de `eh_sindico()`, que continua existindo: `tem_cargo(condominio, cargos[])`, **`pode_gerir()`** (síndico ou subsíndico — escrita) e **`pode_fiscalizar()`** (os dois mais o conselho — leitura ampliada). As policies de escrita trocaram `eh_sindico()` por `pode_gerir()`.
- **`eh_sindico()` sobrou em exatamente um lugar: as policies da própria tabela `cargos`.** Atribuir cargo é o único poder que o subsíndico não herda, mesmo tendo herdado governança — sem isso ele se promoveria sozinho e não haveria caminho de volta.
- `restrito boolean` em `avisos`, `votacoes` e `reunioes`: o canal do gabinete. A policy de select vira `condominio_id in (...) and (not restrito or pode_fiscalizar(condominio_id))`.
- **Armadilha nova, e a mais importante desta leva:** as policies de `votos`, `rsvps`, `curtidas` e `comentarios` reconferiam só o condomínio do pai, nunca a visibilidade dele. Sem repetir a cláusula de `restrito` dentro delas, o vizinho não veria a votação restrita mas leria os votos dela. Foram reescritas junto — e o mesmo cuidado vale pra qualquer restrição futura (relato confidencial vai cair exatamente aqui).

Trocar o voto, **aplicado em 07/09/2026** e dobrado no schema:
- policy de `update` em `votos`. Voto é **por unidade**, então quem troca não precisa ser quem lançou: qualquer morador aprovado da mesma unidade pode. É o voto do 302, não o do Fulano. O `with check` grava `usuario_id = auth.uid()`, registrando quem trocou por último.
- **Sem policy de delete, de propósito:** dá pra *trocar* o voto, não pra retirá-lo. Retratar-se para "não votei" mudaria o denominador do quórum, e isso é decisão de assembleia, não de tela.
- **Apuração só pro gabinete.** A policy de select liberava o condomínio inteiro: um morador comum lia pela API não só o placar como **qual unidade votou o quê**. O voto nunca foi secreto — a tela é que não mostrava. Agora cada um enxerga o voto da própria unidade (a tela precisa saber o que marcar) e quem `pode_fiscalizar()` enxerga todos. O conselho entra junto de propósito: conferir apuração é o que o cargo existe pra fazer.
- A policy de insert nunca checou o prazo — a tela sempre filtrou por `data_fim`, mas nada impedia votar em votação encerrada direto pela API. Corrigido junto: com insert e update coexistindo, critérios diferentes divergiriam.

Solicitação privada, **aplicada em 07/09/2026** e dobrada no schema:
- `area_comum boolean not null default true` em `problemas`. Default `true` de propósito: a visibilidade pública é o que entrega dedup e pressão (ver *Status atual*), e quem não pensar no assunto publica pro prédio.
- A policy de select de `problemas` virou `condominio_id in (...) and (area_comum or autor_id = auth.uid() or pode_gerir(condominio_id))`, e a de `historico_status` repete a cláusula inteira — armadilha nº8, mesma dos votos da votação restrita.
- **`pode_gerir()` e não `pode_fiscalizar()`**, aqui e nas reservas. É a única exceção do app, e é decisão do Vitor: conselho fiscal fiscaliza contas, não queixa doméstica nem festa de vizinho.
- A policy de select de `reservas` passou a exigir unidade própria ou `pode_gerir()`. Como consequência o cliente perdeu a leitura de que precisava pro calendário, e entrou `datas_ocupadas(condominio, de, ate)` — `security definer`, devolve só as datas das reservas **aprovadas**, com a checagem de chamador da armadilha nº14. As pendentes não bloqueiam: disputa de data é o que dá ao síndico a escolha entre dois pedidos.

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
8. **Filho não herda visibilidade do pai em RLS.** As policies de `votos`, `rsvps`, `curtidas` e `comentarios` são do tipo `pai_id in (select id from pai where condominio_id in (...))` — elas reconferem o *condomínio*, não se você pode ver aquele pai. Toda vez que uma restrição nova entrar no pai (restrito, confidencial, o que for), a mesma cláusula precisa ser repetida nas policies dos filhos, senão o conteúdo vaza pela borda: a votação some da tela e os votos dela continuam legíveis.
9. **`.env` do Expo**: variáveis precisam do prefixo `EXPO_PUBLIC_` pra chegar no client. Mudança no `.env` só é lida reiniciando o servidor (`npx expo start -c`).
10. **`toLocaleDateString`/`toLocaleString('pt-BR')` continuavam espalhados** por `OficialScreen`, `ReservasScreen` e `OficialCriarScreen`, mesmo com `lib/datas.ts` existindo justamente pra evitar `Intl` (o suporte varia no Hermes). Removidos em 21/08 e substituídos por `formatarCompromisso()` e `formatarData()`. Se aparecer um `toLocale*` novo, é regressão.
11. **Trocar a conta logada não recarregava o app.** `AppLogado` continuava montado quando a sessão mudava, e o `useMeuCondominio` de dentro só roda o efeito na montagem — ao sair de síndico pra morador, a aba Gestão seguia aberta com os dados do papel anterior. Resolvido com `key={session.user.id}` no `AppLogado`, que força a remontagem. Só apareceu porque o modo demonstração troca de conta a toda hora; o bug era latente antes disso.
12. **`current_date` e `date_trunc('day', now())` no Supabase respondem em UTC**, porque a TimeZone da sessão é UTC. Marcar uma reunião pras "19h" desse jeito agenda pras 16h de Brasília. Em SQL, converter: `(... at time zone 'America/Sao_Paulo')`. É o primo do `toISOString()` da armadilha nº7, do outro lado da fronteira.
13. **Um morador comum não consegue ler `vinculos` dos vizinhos.** A policy só libera a linha pro próprio dono e pra quem `pode_fiscalizar()`. Como `papel = 'sindico'` mora ali, não havia como o app dizer "fulano é o síndico" pra quem não é do gabinete. Resolvido com o RPC `papeis_do_meu_condominio()`, `security definer`, que devolve **só o rótulo** — abrir a policy de select de `vinculos` pro prédio inteiro resolveria também, mas entregaria unidade e status do vínculo de todo mundo junto. Se aparecer uma pergunta parecida ("quem é X?"), o padrão é esse: função que devolve o mínimo, não policy que abre a tabela.
14. **`security definer` sem checar o chamador é vazamento entre condomínios.** `papeis_do_condominio()` aceita qualquer `condominio_id`; por isso ela não tem `grant` pra `authenticated` e só é alcançável pela `papeis_do_meu_condominio()`, que filtra por `condominios_do_usuario()`. Toda função `security definer` nova precisa da mesma pergunta: *quem pode chamar isso, e com que argumento?*
15. **Cada tela chamando `useMeuCondominio()` era uma consulta por tela.** Ficou insustentável quando o cabeçalho passou a aparecer em todas as abas (duas por aba, e o nome piscando "Carregando..." a cada troca). Virou `CondominioProvider`, montado uma vez por sessão em `App.tsx`. O `key={session.user.id}` continua sendo o que força o recarregamento na troca de conta.
16. **Toque duplo custa um atraso no toque simples.** Se a mesma superfície tem ação de toque simples e de duplo, o simples precisa esperar a janela do duplo fechar (~260ms) — senão o primeiro toque do duplo já disparou a ação simples. `useToqueDuplo` em `lib/gestos.ts` faz isso; onde não há ação simples (post já aberto), o duplo responde na hora. E o timer precisa ser cancelado no unmount, senão dispara sobre um componente que já saiu da árvore.
17. **`PanResponder` lê estado por closure e congela no primeiro valor.** Ele é criado uma vez; qualquer coisa mutável que ele consulte (como "a lista de comentários está no topo?") tem que morar em `useRef`, não em `useState`. Com estado, o gesto de arrastar-para-fechar responderia para sempre ao valor do primeiro render.
18. **Inset inferior não entra na conta de elemento flutuante dentro de tela com barra de abas.** O FAB do Mural estava com `bottom: espaco.lg + insets.bottom` e ficava visivelmente alto: a barra de abas já consome o inset, então somar de novo é contar duas vezes. Vale pra qualquer coisa posicionada em relação ao rodapé de uma tela que vive dentro do tab navigator.
19. **Função nova via `.rpc()` não aparece sem recarregar o cache do PostgREST.** Criar a função no banco não basta: a API responde `could not find the function ... in the schema cache` até ele reiniciar sozinho. O conserto é `notify pgrst, 'reload schema';` no fim da migração — está no fim de `varanda-schema.sql` e de toda migração que crie função exposta.
20. **`PanResponder` puro NÃO consegue arrastar-para-fechar por cima de um `ScrollView` no Android. Não insista.** Foram três tentativas em 21/08/2026: gatilho de 12px, depois 3px (abaixo do slop nativo de ~8px), com `onMoveShouldSetPanResponderCapture` num ancestral. Nenhuma funcionou — o ScrollView do Android intercepta o toque no nível nativo (`onInterceptTouchEvent`), fora do sistema de responder do JS, então o ancestral nunca é consultado. **A única saída real é `react-native-gesture-handler`** (funciona no Expo Go, mas é dependência nova e hoje nem ele nem o `reanimated` estão instalados). Enquanto isso, a FolhaExpandida oferece três saídas que funcionam: tocar no fundo escurecido, tocar na faixa da alcinha, e arrastar a alcinha.
21. **A mesma condição também precisa cobrir "não rola de jeito nenhum".** Checar só `contentOffset.y <= 2` deixa de fora a lista curta demais pra rolar, que nunca emite evento de rolagem. `onContentSizeChange` + `onLayout` respondem antes se a área é *sequer* rolável.
22. **Esconder na tela não é esconder.** Duas vezes nesta sessão o pedido foi "fulano não deve ver X" e a resposta certa não era mexer na tela: o conselho fiscal em `cargos`, e a apuração em `votos`. Nos dois casos a tabela seguia legível pela API e bastava um cliente HTTP pra ler tudo. A pergunta a fazer sempre: *se a pessoa chamasse a API na mão, o que voltaria?*
23. **Restaurar o valor animado antes de desmontar pisca a tela.** O `fechar()` fazia `deslocamento.setValue(0)` e só então chamava `aoFechar()` — a folha reaparecia inteira por um quadro antes de o pai removê-la. Como o componente é remontado do zero na abertura seguinte, não há o que restaurar: basta não mexer no valor.
24. **`\n` dentro de heredoc de shell vira quebra de linha real** e parte a string do TypeScript. Aconteceu duas vezes nesta sessão ao editar arquivo por script. Para texto com `\n`, editar com a ferramenta de edição direta em vez de heredoc.
25. **O `DateTimePicker` nativo não desabilita datas soltas.** Ele só aceita `minimumDate` e `maximumDate` — não há como riscar o dia 20 e deixar o 19 e o 21 clicáveis. Onde o requisito é "mostre o que está ocupado antes de pedir" (reserva do salão), ele não serve, e a saída foi uma grade de mês escrita à mão em `components/Calendario.tsx`. Continua sendo o componente certo pra reunião, onde qualquer dia serve e ainda há hora junto.
26. **`@expo/vector-icons` vem com o `expo` mas não hoistado** — mora em `node_modules/expo/node_modules/`, então `import ... from '@expo/vector-icons'` no código do app não resolve pelo Metro. Precisa de `npx expo install @expo/vector-icons` pra subir de nível. Vale pra qualquer dependência transitiva do Expo que você queira importar direto.
27. **O Expo Go só suporta o SDK mais recente, e a Play Store atualiza sozinha.** Em 07/09/2026 o celular amanheceu com o Expo Go do SDK 57 e recusou o projeto, que está no 54 — na véspera da apresentação. O APK antigo existe e resolve: `https://expo.dev/go?sdkVersion=54&platform=android&device=true` entrega o `Expo-Go-54.0.8.apk` (177 MB, do repositório `expo/expo-go-releases`). Mas **é preciso desinstalar o Expo Go atual antes**: é o mesmo pacote (`host.exp.exponent`) e o Android recusa downgrade com `INSTALL_FAILED_VERSION_DOWNGRADE`. Vale desligar a atualização automática dele também, senão a loja desfaz o conserto. Isso volta a cada SDK novo — a cura definitiva é o `.apk` do próprio Varanda.
28. **Escrever arquivo por script converte CRLF em LF sem avisar.** Parte dos arquivos do projeto está com CRLF; um `write` em Python (ou qualquer redirecionamento de shell) grava LF, e o `git diff` passa a acusar o arquivo inteiro modificado — 1099 linhas num arquivo de 534. O conteúdo fica certo e a revisão fica impossível. Conferir com `git diff --stat` depois de editar por script, e restaurar o final de linha original quando for o caso. É primo da armadilha nº24, do mesmo lado: editar código por script tem pegadinhas que a ferramenta de edição direta não tem.

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
- **Regras do condomínio** (Fase 3): leitura no topo do Oficial (card que expande, com versão e quem atualizou), edição em Gestão › Regras, e o aviso automático garantido pelo RPC. Migração aplicada e exercitada no celular ainda nesta sessão.
- **Subsíndico, conselho fiscal e canal restrito do Oficial** (Fase 3): decisão do Vitor de dar ao subsíndico os quatro blocos de poder, inclusive governança, reservando só a atribuição de cargo ao síndico. Conselho fiscal entra como leitura ampliada — a Gestão dele abre com faixa "somente leitura" e o `ModerarScreen` ganhou `somenteLeitura`, que troca os botões de status por etiqueta. **Migração ainda não aplicada.**

**Sessão de 21/08/2026 — modo demonstração e passada de layout.** O objetivo do momento deixou de ser "piloto" e virou "apresentação" (ver *Onde retomar*). O que entrou:

- **Modo demonstração** (`lib/demo.ts`, flag `EXPO_PUBLIC_DEMO=1`): atalhos de "entrar como Síndico / Subsíndico / Conselho / Morador" na tela de login, e um seletor de papel dentro do Perfil pra alternar em dois toques durante a conversa. As contas são **reais** e o login é o `signInWithPassword` normal, de propósito: o que o morador comum não vê, não vê porque o RLS recusou. Se fosse estado falso no client, seria só UI escondendo botão — e é justamente a diferença que vale demonstrar. O flag é assado no build, então uma build sem ele não tem como mostrar os atalhos.
- **`db/seed-demo.sql`**: o Edifício Alvorada, com 6 unidades, 4 moradores, 1 vínculo pendente, mural com comentários e curtidas, 3 sugestões, 3 problemas cobrindo as três cores do badge de SLA, 4 avisos (um restrito), 2 votações (uma restrita, com voto já lançado), 3 reuniões (uma restrita, uma cancelada), 2 reservas (uma pendente pra aprovar ao vivo) e o regimento em versão 2. **O conteúdo é texto de venda, não fixture** — "post de teste 1" destruiria a demonstração. Todas as datas são relativas a `now()`, senão o seed envelhece e o "aberto há X dias" mente.
- **Passada de layout**: `lib/tema.ts` com os tokens (a paleta já existia espalhada em 15 arquivos, e já divergia — "perigo" era `#B6512E` em umas telas e `#B4483C` em outras) e `components/ui.tsx` com as peças compartilhadas. O ganho maior foi trocar o `Button` do React Native, que não aceita estilo e renderiza azul e em caixa alta no Android, ignorando a paleta inteira. Também: `paddingTop: 60` chumbado virou safe-area de verdade, a barra de abas ganhou ícones, e todo estado vazio ganhou ícone e uma frase que diz o que fazer.
- `screens/EmBreveScreen.tsx` apagado — nenhuma tela importava.

**Reforma de navegação e do Mural (21/08/2026, ainda na mesma sessão).** Pedido do Vitor depois de ver a primeira versão no celular:

- **Abas na ordem Oficial · Mural · Solicitações · Gestão**, e **Perfil deixou de ser aba**. Agora todas as abas compartilham o `CabecalhoApp`: avatar à esquerda (toque abre o Perfil como modal de tela cheia), nome com unidade e cargo embaixo ("Helena Prado · 101 · Síndico"), e o menu de três pontinhos à direita com Conta, Privacidade, Preferências e Notificações marcados *em breve*, mais Sair funcionando. Não há stack navigator no projeto e o Perfil abrir como `Modal` evitou adicionar uma dependência de navegação só pra isso.
- **Mural reescrito no formato WhatsApp/Facebook**: sem caixa de escrever no topo (o topo é pra ler), um **+** flutuante no canto inferior que abre o pop-up de publicação; card com corte em 220 caracteres e "Ler mais"; horário na mesma linha do nome, à direita; **cargo do autor embaixo do nome**; curtida virou **joinha**, e os botões de interação viraram uma barra dividida ao meio, com ícone, rótulo e 48px de altura.
- **Post aberto vira modal com o post ancorado no topo e os comentários rolando embaixo** — tocar no post ancorado recolhe. A âncora tem teto de 55% da tela e rola por dentro: sem isso um post comprido empurraria os comentários pra fora e ninguém saberia que existem.
- **Conselho fiscal deixou de ser público.** A tabela `cargos` nasceu legível pelo condomínio inteiro, com o argumento de que "cargo oculto gera desconfiança em assembleia". Decisão do Vitor: o morador precisa saber a quem recorrer — síndico e subsíndico — e o conselho não é isso. Mudou a policy junto com a função, senão esconder na função seria teatro (a tabela seguiria legível pela API).
- **Ideia descartada no meio do caminho:** título no post. Chegou a virar coluna `posts.titulo` na migração e o Vitor cortou em seguida — post de mural é recado curto, título só adiciona atrito na hora de escrever.

**Segunda rodada de ajustes (21/08/2026), depois do Vitor ver as telas no celular:**

- **Mural — gestos.** O post aberto ganhou uma setinha (∨) no topo: tocar fecha, e **arrastar pra baixo fecha progressivamente**, acompanhando o dedo. Tocar no texto do post deixou de fechar — só a setinha fecha, pra dar pra reler sem o card sumir embaixo do dedo. Um **swipe pra baixo na área dos comentários** também fecha, mas só quando a lista já está no topo (senão rolar comentário fecharia o post). **Duplo toque curte**, no feed e no post aberto. O botão **+** estava alto demais: o inset inferior estava sendo somado por cima da barra de abas, que já o consome.
- **Oficial virou sub-abas** — Avisos · Reuniões · Votações · Regras, numa segunda barra encostada por cima da barra de abas do app, com Avisos como padrão. As seções deixaram de ser títulos empilhados num scroll longo e viraram destinos.
- **Cards do Oficial expandem**: mesmo corte de 220 caracteres do Mural, "Ler mais", e a mesma setinha (∨) pra fechar. Fechado, tocar em qualquer lugar abre; aberto, só a setinha fecha. Ações (votar, confirmar presença) ficam sempre visíveis, abertas ou não — escondê-las atrás da expansão custaria um toque a mais no que é o objetivo da tela.
- **Duas regras novas de destaque, garantidas no banco:** um aviso fixado por vez (gatilho) e aviso restrito não pode ser fixado (check constraint). Viraram invariante e não disciplina de tela porque **três** caminhos diferentes criam aviso fixado — o formulário do síndico, o RPC `salvar_regras` quando o regimento muda, e o cancelamento de reunião. Garantir na UI seria lembrar nos três e esquecer no quarto. Borda esquerda roxa nos restritos, na mesma cor da etiqueta.
- **Regras deixou de ser card.** É documento pra ler de ponta a ponta, então saiu a estética clicável (sombra, borda, "Ler tudo") e entrou tipografia de leitura: 16px com entrelinha 26.
- **Foto de perfil ficou no backlog e fora do roadmap**, por decisão explícita do Vitor. O `Avatar` já lê `usuarios.foto_url`; falta upload.

**Terceira rodada (21/08/2026) — fechar tinha que ser fácil.** O Vitor testou e o arrasto pra fechar não pegava, e a área da setinha exigia mira. O conserto virou um componente só, `components/FolhaExpandida.tsx`, usado pelo Mural e pelo Oficial:

- **Faixa de fechar de ponta a ponta** no topo, com alcinha e setinha: o alvo é a faixa inteira, não o ícone.
- **Três saídas** pro mesmo gesto: tocar na faixa, arrastar a faixa, ou arrastar pra baixo na área de conteúdo quando ela está no topo da rolagem.
- **O bug do swipe**: a decisão olhava só `contentOffset.y`, e lista curta demais pra rolar nunca emite evento de rolagem. Agora `onContentSizeChange` + `onLayout` dizem se a área é sequer rolável — e quando não é, o arrasto vale sempre.
- **Avisos, reuniões e votações abrem em tela cheia**, no mesmo formato do post do Mural, com tipografia de leitura (título 22, corpo 17/27) em vez da de lista. A expansão em cartão, feita na rodada anterior, foi substituída.
- Os três tipos do Oficial passaram a compartilhar uma forma comum (`ItemOficial`), com um card fechado e uma folha aberta só — antes seriam três cards e três folhas quase iguais se afastando com o tempo.
- **O arrasto de conteúdo é aplicado pelo chamador, não pela folha.** No Mural o texto do post ancorado rola por conta própria, e ali o gesto pra baixo tem que rolar, não fechar.

**Quarta rodada (21/08/2026) — a folha virou meia tela.** Três correções e uma mudança de forma:

- **O swipe nunca funcionou por corrida de gesto**, não por threshold. O `ScrollView` do Android reivindica o toque a ~8px de deslocamento e o gatilho estava em 12px: quando ele era avaliado, a lista já tinha o gesto. Baixado pra 3px. Diagnóstico feito por leitura — **não verificado em aparelho**.
- **Piscada de um quadro ao fechar**: o `fechar()` restaurava o valor animado antes de chamar `aoFechar()`, e a folha reaparecia inteira antes de sumir. Como ela é remontada do zero na abertura seguinte, bastou não restaurar.
- **Folha ocupa ~58% da tela**, ancorada embaixo, com cantos arredondados e fundo escurecido em cima. A alcinha passou a ficar no meio da tela, ao alcance do polegar sem reposicionar a mão — e o fundo escurecido virou uma quarta saída, com metade da tela de alvo.
- Saíram a setinha e a faixa bege do topo: com meia tela, a alcinha sozinha já diz o que fazer, e o respiro de status bar deixou de existir.

**Quinta rodada (21/08/2026) — confirmar presença.**

- **O delay não era da rede, era do refetch.** O `toggleRsvp` gravava e então chamava `carregar()`, que refaz **cinco** consultas (avisos, votações, votos, reuniões, rsvps) só pra descobrir um booleano que o app já sabia. Agora ele atualiza o `Set` local e devolve se deu certo.
- **Estado de "salvando"** no botão, porque a gravação ainda passa pela rede: sem ele o botão fica inerte entre o toque e a resposta, e a pessoa toca de novo.
- **Botão de presença virou barra de ponta a ponta no rodapé da folha**, na mesma posição do campo de comentário do Mural — onde o polegar já está. No card da lista continua a versão compacta.
- **`components/AvisoRapido.tsx`**: balão de confirmação que aparece, some sozinho em 2,6s, não bloqueia nada (`pointerEvents="none"`) e é antecipado por qualquer toque. O "qualquer toque" vem de um farejador — um `onStartShouldSetResponderCapture` que devolve `false`, sendo consultado em todo toque sem interceptar nenhum.
- **Há dois providers de AvisoRapido, de propósito.** Modal do React Native é uma janela nativa separada: um balão montado na árvore principal fica *atrás* de qualquer folha aberta. A FolhaExpandida monta o próprio, e o `useAvisoRapido` resolve pelo mais próximo — quem dispara de dentro da folha mostra na folha, quem dispara do card mostra na tela.
- **O swipe-para-fechar sobre lista continua não funcionando** e foi aceito assim pelo Vitor. Ver armadilha nº20: não é ajustável por threshold, precisa de `react-native-gesture-handler`.

**Sexta rodada (21/08/2026) — votação no formato de enquete.**

- **Dá pra trocar o voto** enquanto a votação está aberta. Precisou de policy nova: `votos` só tinha select e insert, então trocar era impossível pela API, não só pela tela.
- **Opções no formato do WhatsApp**: marcador circular à esquerda, contagem à direita, barra de proporção embaixo. O resultado fica visível *enquanto* se vota — é o que faz a pessoa voltar na votação em vez de esquecer que votou.
- Para isso o app passou a ler **todos** os votos visíveis, não só os da própria unidade. Uma consulta no lugar de duas, e o RLS já limita o que aparece: votação restrita não vem pra quem não é do gabinete, e os votos dela também não.
- Mesmo tratamento do RSVP: estado de salvando por opção, atualização local em vez de refetch, e balão de "Voto registrado" / "Voto alterado".
- O texto "Depois de votar não dá pra trocar" saiu de cena, junto com a regra.

**Sétima rodada (21/08/2026) — morador não vê apuração.** O pedido parecia de tela e era de banco: a policy de select de `votos` liberava o condomínio inteiro desde sempre, então um morador comum lia pela API não só o placar como **qual unidade votou o quê**. O voto nunca tinha sido secreto; a tela é que não mostrava.

Agora cada um lê o voto da própria unidade — a tela precisa disso pra saber o que marcar — e quem `pode_fiscalizar()` lê todos. Na interface, sem apuração some a contagem e some a barra: barra vazia pareceria "zero votos", que é informação, e justamente a que não pode aparecer.

**Oitava rodada (21/08/2026) — Solicitações reorganizada, e Sugestões saiu do app.**

Decisão do Vitor, e a mais estrutural desta sessão. O raciocínio: **"solicitação" carrega um contrato** — eu peço, alguém decide, tem um estado. Sugestão não tem isso: é proposta em busca de adesão, e adesão o Mural já resolve melhor, com curtida, comentário e o prédio inteiro vendo.

- **Sugestões deixou de existir.** As ativas viraram posts (`db/migracao-solicitacoes.sql`); as arquivadas ficaram onde estavam, porque o síndico as tirou de circulação de propósito e o Mural não tem arquivo. Apoios viraram curtidas — as duas tabelas são pares `(item, usuário)`. A categoria se perdeu: era lista fixa imposta pelo app, não algo que o morador escreveu.
- **Problemas ficou, virou "Manutenção".** Eu discordei da remoção dele e o Vitor concordou: relatar um vazamento é *pedir um conserto*, não conversar. Tem estado, prazo e alguém do outro lado. Some junto se fosse embora: o badge "aberto há X dias" (que é a resposta do app à queixa nº1 contra síndico), o histórico de status, a fila do síndico e o arquivamento. **A tabela continua se chamando `problemas`** — renomear arrastaria policies, a FK de `historico_status` e o seed, sem ganho.
- **Solicitações = Salão · Manutenção**, em sub-abas no formato do Oficial, e mais dois tipos anunciados como *em breve* (troca de vaga, alteração de dados).
- **A criação saiu das listas e virou um botão +**, como no Mural: escolhe o tipo, preenche o formulário daquele tipo, envia. Isso devolveu o topo de cada lista pro conteúdo — o Salão gastava um card inteiro de formulário. Os "em breve" moram na folha do +, não como sub-abas vazias: o momento em que a pessoa pergunta "o que dá pra pedir?" é exatamente ao tocar no +.
- `ModerarScreen` deixou de ser genérico sobre `tipo` — com um tipo só, a generalização só atrapalhava a leitura.

**Fica registrado o que se perdeu**, porque a decisão foi consciente: o relato confidencial em Problemas (item da Fase 3, vindo de pesquisa sobre conflito de vizinhança exposto publicamente) continua possível, já que Manutenção sobreviveu. Mas sugestão com status formal — "em análise / aprovada / implementada" — não existe mais: um post não tem desfecho registrado.

**Sessão de 22/08/2026 — solicitação privada.** Os dois itens que a sessão anterior deixou decididos e por escrever. São a mesma ideia aplicada a duas telas: *nem todo pedido é assunto do prédio*.

- **Manutenção ganhou "área comum" vs. "minha unidade"**, coluna `area_comum` com default `true`. O default não é preguiça: a visibilidade pública é o que entrega **dedup** (três vizinhos relatando o mesmo portão sem saber uns dos outros geram três chamados e a sensação de que ninguém liga) e **pressão** (o badge "aberto há X dias" só cobra porque o prédio vê o número). O privado é a exceção — a torneira do próprio banheiro, que nunca precisou de plateia.
- **O interruptor virou a primeira pergunta do formulário**, não a última. O alcance muda o jeito de descrever o resto: quem vai relatar a torneira da própria suíte não deveria escrever "Bloco B, 6º andar" no campo Onde. Os placeholders acompanham a escolha.
- **Conselho fiscal fica de fora do pedido privado**, por decisão do Vitor: ele fiscaliza contas, não queixa doméstica. É a única cláusula do app que usa `pode_gerir()` onde `pode_fiscalizar()` pareceria a escolha natural.
- **A armadilha nº8 mordeu como previsto.** `historico_status` é filho de `problemas` e a policy dele só reconferia o condomínio. Sem repetir a cláusula de `area_comum` lá, o pedido privado sumiria da tela e o histórico dele continuaria legível pela API. Foi reescrita junto, na mesma migração.
- **De brinde, isso entrega o relato confidencial da Fase 3.** Era item de roadmap vindo de pesquisa sobre conflito de vizinhança exposto publicamente; sobrou só o rótulo, e nem ele — "minha unidade" diz melhor o que é.

- **A lista do Salão passou a mostrar só as reservas da própria unidade.** Síndico e subsíndico veem todas. Eu tinha argumentado que reserva não podia ser privada, porque a lista pública é o que informa se o dia 20 está livre; o Vitor derrubou o argumento: se as datas ocupadas vierem desabilitadas no seletor, a disponibilidade é entregue pelo **calendário**, não pela lista.
- **`datas_ocupadas(condominio, de, ate)`**, `security definer`, devolve **só as datas** — sem unidade, sem nome, sem motivo. Com a policy fechada o cliente não consegue mais ler as reservas dos outros pra saber o que bloquear, e abrir a policy de volta entregaria tudo o que acabou de ser escondido. Mesmo padrão de `papeis_do_meu_condominio`, e mesma checagem de chamador da armadilha nº14. Só as **aprovadas** bloqueiam: pendentes concorrentes na mesma data são o que dá ao síndico a escolha entre dois pedidos.
- **O seletor de data virou `components/Calendario.tsx`, escrito à mão.** O `DateTimePicker` nativo só aceita `minimumDate`/`maximumDate` — não existe como riscar um dia solto no meio do mês (armadilha nº25). `react-native-calendars` faria de fábrica, e foi descartado: o projeto já recusou dependência nova em situação parecida, e grade de mês é aritmética de calendário, não física de gesto. São ~60 linhas de lógica. **É o item mais arriscado da sessão** — componente novo que nunca rodou em aparelho.
- **O calendário bloqueia as duas regras, não uma.** Os índices parciais do banco são dois: salão já reservado (qualquer unidade) e esta unidade já pediu esta data. Os dois estouram o mesmo 23505, então desenhar só um deixaria o morador batendo no erro do outro. Recusada não bloqueia — é justamente a data que dá pra pedir de novo.
- O tratamento de 23505 ficou como **rede de segurança**, para o caso de alguém aprovar a data entre abrir o formulário e enviar. A mensagem mudou de acordo: "alguém garantiu essa data enquanto você preenchia".
- **Isso mata a decisão que estava pendente sobre o motivo da reserva:** sem lista pública não há o que esconder, e `observacao` não precisa sair pra tabela separada.
- O seed ganhou um **quarto pedido de manutenção, privado**, do Caio (a conta "Morador"). É o que faz a régua aparecer na demonstração: síndico e subsíndico veem com etiqueta, o autor vê, o **conselho fiscal não vê**.

**Sessão de 07/09/2026 — véspera da apresentação.** Sessão de arrumação, não de feature nova. A apresentação ficou marcada para 08/09.

- **As quatro migrações pendentes foram aplicadas** e os arquivos apagados. O banco finalmente está no ponto que `db/varanda-schema.sql` descreve — era a dívida que atravessou duas sessões, e sem ela os passos 4, 5, 7 e 8 do roteiro dariam erro na cara: o formulário de Manutenção gravava numa coluna inexistente e o do Salão chamava uma função inexistente.
- **Repositório no GitHub**, público: https://github.com/vitormoreira-gd/varanda-app. O `gh` foi instalado na máquina pra isso. Fica registrado, porque foi decisão consciente do Vitor: público expõe o `CONTEXTO.md` inteiro, plano de negócio, preço de R$ 5/condômino e estratégia de trial junto. O `.env` nunca foi commitado; a senha de demonstração (`demo1234`) está no código, mas sozinha não abre nada — a URL do projeto Supabase e a chave só existem no `.env` local. **No dia em que sair um `.apk`, a chave vai assada no build e esse par vira credencial funcional.**
- **Gestão entrou no padrão de sub-abas**, e era a última aba fora dele — usava o `Seletor` de pílulas rolando na horizontal, no topo. Os seis destinos não cabiam na barra de baixo (com seis itens sobra ~60dp cada, e "Condôminos" e "Manutenção" truncariam), então os três que respondem à mesma pergunta — quem mora aqui — viraram painéis dentro de **Moradores**, e a barra ficou com quatro, igual ao Oficial. Nenhuma das três telas foi reescrita; só mudaram de casa. Pro conselho fiscal sobram duas sub-abas, e o seletor interno some, porque uma pílula sozinha não é escolha.
- **Badge de vínculos pendentes** sobre o ícone de Moradores. Quem conta é o próprio `VinculosPendentesScreen`, que já fazia a consulta: devolve o número por callback em vez de o host repetir a pergunta ao banco. O efeito é que a bolinha some no instante em que o síndico aprova alguém — que é exatamente o passo 2 do roteiro, feito ao vivo. O callback mora num `useRef` e não nas dependências do `carregar`, senão um pai que passasse arrow inline poria o efeito em laço.
- **Duas ideias descartadas no caminho:** pôr as seis sub-abas de uma vez (trunca rótulo) e fundir Vínculos com Condôminos numa tela só com filtro pendentes/aprovados. A segunda é melhor de produto — são a mesma pergunta em dois estados — e foi recusada por ser reescrita de duas telas na véspera. Continua valendo como ideia.
- **O Expo Go da loja parou de servir** no meio do teste (armadilha nº27). Consertado instalando o APK do Expo Go 54 à mão.

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

### Sugestões — DESCONTINUADO em 21/08/2026
Virou post no Mural. Ver *Status atual*. O que existia:
- [x] Retirar apoio — o `toggleApoio` já fazia o delete desde sempre, mas faltava a policy; agora funciona e detecta bloqueio de RLS

### Reuniões
- [x] Permitir desmarcar presença — o código já fazia o `delete` desde sempre, mas faltava a policy no banco, então nunca removeu nada. Policy aplicada em 20/08/2026
- [x] Síndico poder cancelar reunião, com opção de mandar aviso junto — cancelamento é **soft** (`cancelada_em`), porque quem confirmou presença precisa ver que foi cancelada; apagar faria a reunião sumir em silêncio

### Reserva de salão
- [x] Gestão e pedido de reserva do salão — aba "Salão" dentro de Solicitações. O bloqueio de data conflitante é garantido por índice parcial no banco. Síndico aprova/recusa na mesma tela, sem aba própria em Gestão
- [x] Reserva é da unidade, não do prédio — a lista mostra só as reservas da própria unidade; síndico e subsíndico veem todas
- [x] Calendário com as datas ocupadas riscadas, alimentado por `datas_ocupadas()` — o morador deixa de descobrir o conflito só depois de enviar. `components/Calendario.tsx`, escrito à mão porque o DateTimePicker nativo não desabilita dia solto

### Regras do condomínio
- [x] Regras editáveis pelo síndico, com aviso automático disparado quando forem alteradas — o aviso não é uma etapa da tela, é parte da transação do RPC `salvar_regras`; a tabela nem tem policy de escrita. O síndico pode escrever um resumo do que mudou, que vira o texto do aviso; sem resumo sai um texto padrão

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
- [x] `unique (condominio_id, bloco, numero)` — índice `unidades_sem_duplicata`, aplicado em 20/08/2026. A checagem deixou de ser só no client

### Vagas de garagem
- [ ] Solicitação de troca de vaga entre condôminos (pedir, aceitar/recusar, histórico de trocas) — já anunciado como *em breve* na folha do + em Solicitações
- [ ] Alteração de dados cadastrais — mesmo caso, também já anunciado como *em breve*

### Papéis
- [x] Função de subsíndico — decisão de 20/08/2026: herda os **quatro** blocos (moderação, solicitações, comunicação oficial e governança). Na prática é síndico com um freio só: não atribui cargo. Foi escolha consciente do Vitor depois de eu apontar que isso apaga boa parte da diferença entre os dois
- [x] Função de conselho fiscal — criado como **leitura ampliada**: vê a lista de condôminos e o andamento das solicitações, sem escrever nada. Registrado que hoje ele não tem o que fiscalizar de fato — o cargo existe pra vigiar contas, e prestação de contas é Fase 4. Quando ela chegar, é aqui que o cargo ganha função de verdade
- [x] Canal restrito ao gabinete — aviso, votação e reunião com flag `restrito`, visíveis só a quem `pode_fiscalizar()`. Pedido do Vitor no meio da implementação de cargos

### Infraestrutura
- [x] Repositório no GitHub — `vitormoreira-gd/varanda-app`, público, criado em 07/09/2026
- [ ] README do repositório — hoje quem abre cai direto na lista de arquivos; o `CONTEXTO.md` faz o trabalho, mas é documento interno e inclui o plano de negócio
- [ ] Push notifications (avisos, votação aberta, reunião marcada, resposta no feed etc. chegando como notificação, não só ao abrir o app)

### UX geral
- [x] Revisão de layout — feita em 21/08/2026, antecipada de propósito porque o argumento da apresentação é a navegação. Tokens em `lib/tema.ts`, peças em `components/ui.tsx`, `Button` do RN eliminado, safe-area no lugar de `paddingTop` chumbado, ícones na barra de abas, estados vazios com ícone e frase de ação
- [ ] Segunda passada de layout **depois** do feedback do síndico — a primeira foi feita às cegas, sem ninguém de fora ter usado

### Navegação e Mural
- [x] Ordem das abas Oficial · Mural · Solicitações · Gestão, com Perfil fora da barra
- [x] Cabeçalho com avatar, nome, unidade, cargo e menu de três pontinhos
- [ ] Itens do menu de três pontinhos: Conta, Privacidade, Preferências, Notificações — hoje são rótulos "em breve"
- [x] Mural em formato de rede social: + flutuante, pop-up de publicação, "Ler mais", joinha, botões grandes, post ancorado com comentários rolando
- [x] Cargo do autor embaixo do nome no Mural (RPC `papeis_do_meu_condominio`)
- [ ] **Foto de perfil de verdade.** `usuarios.foto_url` existe no schema desde o começo e nenhuma tela jamais gravou nela; o `Avatar` já lê a coluna, mas na prática todo mundo cai nas iniciais. Falta upload (Supabase Storage) e a tela pra escolher
- [x] Setinha de fechar com arrasto no post expandido, duplo toque pra curtir, botão + alinhado à barra de abas
- [x] Oficial em sub-abas (Avisos · Reuniões · Votações · Regras), um fixado por vez, restrito não fixa e com borda roxa, Regras como documento
- [x] Abrir item em folha de meia tela com alcinha e fundo escurecido, compartilhada entre Mural e Oficial
- [x] Confirmar presença: barra no rodapé da folha, estado de salvando, balão de confirmação que some sozinho
- [x] Trocar o voto numa votação aberta, com as opções no formato de enquete do WhatsApp (marcador, contagem e barra de proporção)
- [x] Apuração visível só pra síndico, subsíndico e conselho fiscal — fechado no RLS, não só na tela
- [ ] Divulgar o resultado quando a votação encerrar. Hoje o morador vota e nunca fica sabendo do desfecho pelo app; a tela diz que o síndico divulga, mas não há caminho pra isso além de publicar um aviso na mão
- [ ] Retirar o voto (voltar a "não votei") — deixado de fora de propósito: mexe no denominador do quórum
- [ ] Arrastar-para-fechar por cima de lista rolável — depende de `react-native-gesture-handler`; as outras três saídas cobrem enquanto isso
- [x] Solicitações reorganizada: Sugestões fora do app, Problemas virou Manutenção, sub-abas no formato do Oficial e criação pelo +
- [ ] Apagar `sugestoes` e `apoios` do banco, depois de conferir a migração no celular
- [x] Gestão no padrão de sub-abas — barra de baixo com Moradores · Manutenção · Oficial · Regras, e Vínculos/Condôminos/Unidades como painéis dentro de Moradores. Era a última aba fora do padrão
- [x] Badge de vínculos pendentes sobre o ícone de Moradores, alimentado pela própria tela de vínculos
- [ ] Fundir Vínculos e Condôminos numa tela só com filtro pendentes/aprovados — são a mesma pergunta em dois estados. Recusado em 07/09 por ser reescrita de duas telas na véspera da apresentação
- [ ] Outras mudanças na aba Gestão — ainda não detalhadas

### Apresentação
- [x] Modo demonstração — atalhos de papel na tela de login e seletor no Perfil, atrás do flag `EXPO_PUBLIC_DEMO`
- [x] Seed de demonstração — `db/seed-demo.sql`, re-executável
- [ ] Ensaiar a apresentação ponta a ponta no celular (roteiro em *Onde retomar*)
- [ ] `db/metricas.sql` — consultas prontas pro painel do Supabase, pra ter número na conversa de feedback. Não precisa de instrumentação: quase tudo que importa já está nas tabelas. O que **não** dá pra responder sem instrumentar é "com que frequência abrem o app"

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
- [x] Relato confidencial (só síndico vê) como opção alternativa ao relato público em Problemas — virou o interruptor "área comum / minha unidade" em Manutenção. O rótulo "confidencial" foi descartado: "minha unidade" diz melhor o que é, e não sugere denúncia

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
| ~~Revisão de layout~~ FEITO | Adiada em 20/08 pro fim do roadmap e **antecipada em 21/08**, quando o objetivo virou apresentar o app a um síndico defendendo que a navegação é intuitiva. Adiar contradiria o próprio pitch. |

## Fase 2 — Dia a dia do síndico

**Meta:** o síndico tocar o condomínio sem pedir socorro nem abrir o painel do Supabase.

- ~~Cancelar reunião, com aviso automático junto~~ **FEITO**
- ~~Arquivar sugestões/problemas + acesso ao arquivo~~ **FEITO**
- ~~Lista de condôminos~~ **FEITO** — a decisão sobre `telefone` caiu junto: as colunas são mortas, não há o que proteger hoje
- ~~`unique (condominio_id, bloco, numero)`~~ **FEITO** (índice `unidades_sem_duplicata`, aplicado em 20/08/2026)

## Fase 3 — Gestão do condomínio

**Meta:** fazer o que o WhatsApp não faz. É o que justifica cobrar, quando chegar a hora de cobrar.

- ~~Reserva de salão~~ **FEITO**
- ~~Regras do condomínio editáveis, com aviso automático quando mudarem~~ **FEITO**
- ~~Subsíndico e conselho fiscal (permissões intermediárias)~~ **FEITO** — junto com o canal restrito do Oficial
- ~~Relato confidencial em Problemas (visível só ao síndico), separado do relato público~~ **FEITO** em 22/08/2026, como "área comum vs. minha unidade" em Manutenção
- Troca de vaga de garagem entre condôminos — **último item aberto da Fase 3**

## Fase 4 — Só quando for pra fora

**Meta:** nada aqui vale antes de existir um segundo condomínio real. São itens de escala e de venda, não de produto.

- **Push notifications** — adiado por decisão de 20/08/2026. Continua sendo o maior item de retenção do backlog, e a resposta honesta à pergunta "por que abrir isso em vez do WhatsApp" enquanto ele não existir é: *não abriria* — o WhatsApp avisa, o Varanda espera você lembrar dele. Exige *development build* (não roda no Expo Go desde o SDK 53), o que quebra o fluxo de teste atual.
- **`.apk` / EAS Build** — separado do push, ao contrário do que este roadmap dizia antes. Gerar um `.apk` **não** quebra o Expo Go: dá pra continuar desenvolvendo no Expo Go e buildar um `.apk` quando precisar entregar. O que quebraria o Expo Go é adicionar `expo-notifications`. São duas decisões, não uma. Pré-requisitos do `.apk`: `app.json` de verdade (hoje o app se chama "varanda-app", sem `android.package`) e um `eas.json` com perfil de APK.
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

- **Pré-liberação de visitantes** — a feature mais elogiada em review de concorrente, e a mais cara: depende de operação de portaria
- **Gestão financeira completa** — fora de escopo por posicionamento. O plano define o Varanda como app de comunicação; competir com Superlógica em boleto e fiscal é outro produto
