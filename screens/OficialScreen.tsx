import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { formatarCompromisso, formatarData } from '../lib/datas';
import { cores, espaco, raio, sombra } from '../lib/tema';
import { Botao, Carregando, Etiqueta, SubAbas, Vazio } from '../components/ui';
import CabecalhoApp from '../components/CabecalhoApp';
import FolhaExpandida from '../components/FolhaExpandida';
import { useAvisoRapido } from '../components/AvisoRapido';
import RegrasScreen from './RegrasScreen';

// Mesmo corte do Mural: card do tamanho de um parágrafo, e o resto na folha
// aberta. Um Oficial em que cada aviso ocupa meia tela não se percorre.
const LIMITE_TEXTO = 220;

const SUB_ABAS = [
  { chave: 'avisos', label: 'Avisos', icone: 'alert-circle-outline' },
  { chave: 'reunioes', label: 'Reuniões', icone: 'calendar-outline' },
  { chave: 'votacoes', label: 'Votações', icone: 'checkbox-outline' },
  { chave: 'regras', label: 'Regras', icone: 'document-text-outline' },
] as const;

type SubAba = (typeof SUB_ABAS)[number]['chave'];

type Aviso = {
  id: string;
  titulo: string;
  texto: string;
  fixado: boolean;
  restrito: boolean;
  criado_em: string;
};
type Votacao = {
  id: string;
  titulo: string;
  descricao: string | null;
  opcoes: string[];
  restrito: boolean;
  data_fim: string;
};
type Reuniao = {
  id: string;
  titulo: string;
  data_hora: string;
  local: string | null;
  pauta: string | null;
  restrito: boolean;
  cancelada_em: string | null;
};

// Forma comum de aviso, reunião e votação. Os três só diferem no que vai nas
// etiquetas e nas ações; unificar evita três cards e três folhas quase iguais
// se afastando com o tempo.
type ItemOficial = {
  id: string;
  destaque?: string;
  etiquetas?: ReactNode;
  titulo: string;
  tituloRiscado?: boolean;
  meta?: string;
  texto: string;
  /** Mostra um trecho do texto já no card fechado. Só o item em destaque
   *  ganha isso: se todo card abrir um parágrafo, a lista vira um paredão e
   *  o destaque deixa de destacar. Os outros ficam em título e data. */
  previa?: boolean;
  /** Aparece no card fechado e no corpo da folha (as opções de votação). */
  acoes?: ReactNode;
  /** Barra fixa no rodapé da folha (confirmar presença). Quando existe, o
   *  corpo da folha não repete `acoes`. */
  rodape?: ReactNode;
};

const SELO_RESTRITO = <Etiqueta texto="🔒 restrito ao gabinete" tom="restrito" />;

export default function OficialScreen() {
  const { unidadeId, podeFiscalizar, loading: carregandoVinculo, erro: erroVinculo } =
    useMeuCondominio();

  const [sub, setSub] = useState<SubAba>('avisos');
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [votacoes, setVotacoes] = useState<Votacao[]>([]);
  const [meusVotos, setMeusVotos] = useState<Record<string, string>>({});
  // votacao_id -> opcao -> quantos votos. Alimenta as barras da enquete.
  const [contagem, setContagem] = useState<Record<string, Record<string, number>>>({});
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [meusRsvps, setMeusRsvps] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  function trocarSub(chave: SubAba) {
    setAbertoId(null);
    setSub(chave);
  }

  const carregar = useCallback(async () => {
    const { data: avisosData, error: erroAvisos } = await supabase
      .from('avisos')
      .select('id, titulo, texto, fixado, restrito, criado_em')
      .order('fixado', { ascending: false })
      .order('criado_em', { ascending: false });
    if (erroAvisos) Alert.alert('Erro ao carregar avisos', erroAvisos.message);
    setAvisos(avisosData ?? []);

    const { data: votacoesData, error: erroVotacoes } = await supabase
      .from('votacoes')
      .select('id, titulo, descricao, opcoes, restrito, data_fim')
      .gt('data_fim', new Date().toISOString())
      .order('data_fim', { ascending: true });
    if (erroVotacoes) Alert.alert('Erro ao carregar votações', erroVotacoes.message);
    setVotacoes(votacoesData ?? []);

    // Pede todos os votos, mas quem decide o que volta é o RLS: morador
    // comum recebe só o da própria unidade, e quem fiscaliza recebe todos.
    // Por isso a contagem montada aqui só é exibida a quem pode apurar —
    // pro morador ela conteria apenas o voto dele e seria mentira.
    const { data: votosData, error: erroVotos } = await supabase
      .from('votos')
      .select('votacao_id, opcao, unidade_id');
    if (erroVotos) Alert.alert('Erro ao carregar votos', erroVotos.message);

    const meus: Record<string, string> = {};
    const totais: Record<string, Record<string, number>> = {};
    (votosData ?? []).forEach((v) => {
      const porOpcao = (totais[v.votacao_id] ??= {});
      porOpcao[v.opcao] = (porOpcao[v.opcao] ?? 0) + 1;
      if (unidadeId && v.unidade_id === unidadeId) meus[v.votacao_id] = v.opcao;
    });
    setMeusVotos(meus);
    setContagem(totais);

    const { data: reunioesData, error: erroReunioes } = await supabase
      .from('reunioes')
      .select('id, titulo, data_hora, local, pauta, restrito, cancelada_em')
      .order('data_hora', { ascending: true });
    if (erroReunioes) Alert.alert('Erro ao carregar reuniões', erroReunioes.message);
    setReunioes(reunioesData ?? []);

    if (userId) {
      const { data: rsvpsData, error: erroRsvps } = await supabase
        .from('rsvps')
        .select('reuniao_id')
        .eq('usuario_id', userId);
      if (erroRsvps) Alert.alert('Erro ao carregar confirmações', erroRsvps.message);
      setMeusRsvps(new Set((rsvpsData ?? []).map((r) => r.reuniao_id)));
    }
  }, [unidadeId, userId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (erroVinculo) Alert.alert('Erro ao identificar sua unidade', erroVinculo);
  }, [erroVinculo]);

  // Primeiro voto insere; a partir do segundo, troca. Como em `toggleRsvp`,
  // atualiza o estado local em vez de rechamar `carregar()` — o refetch
  // inteiro só pra mexer num contador é o que fazia o botão parecer travado.
  async function votar(votacaoId: string, opcao: string): Promise<boolean> {
    if (!unidadeId || !userId) {
      Alert.alert(
        'Não foi possível votar',
        'Não identifiquei sua unidade ainda. Feche e reabra o app e tente de novo.'
      );
      return false;
    }

    const anterior = meusVotos[votacaoId] ?? null;
    if (anterior === opcao) return false;

    if (anterior) {
      // Update recusado por RLS devolve zero linhas, não erro (armadilha nº4).
      const { data, error } = await supabase
        .from('votos')
        .update({ opcao, usuario_id: userId })
        .eq('votacao_id', votacaoId)
        .eq('unidade_id', unidadeId)
        .select();

      if (error) {
        Alert.alert('Erro ao trocar o voto', error.message);
        return false;
      }
      if (!data || data.length === 0) {
        Alert.alert(
          'Não consegui trocar o voto',
          'O banco recusou a alteração. Ou falta rodar db/migracao-votos.sql, ou o prazo desta votação já encerrou.'
        );
        return false;
      }
    } else {
      const { error } = await supabase
        .from('votos')
        .insert({ votacao_id: votacaoId, unidade_id: unidadeId, usuario_id: userId, opcao });

      if (error) {
        Alert.alert('Erro ao votar', error.message);
        return false;
      }
    }

    setMeusVotos((atuais) => ({ ...atuais, [votacaoId]: opcao }));
    setContagem((atuais) => {
      const porOpcao = { ...(atuais[votacaoId] ?? {}) };
      if (anterior) porOpcao[anterior] = Math.max(0, (porOpcao[anterior] ?? 1) - 1);
      porOpcao[opcao] = (porOpcao[opcao] ?? 0) + 1;
      return { ...atuais, [votacaoId]: porOpcao };
    });
    return true;
  }

  // Devolve se deu certo, e atualiza o conjunto local em vez de rechamar
  // `carregar()`. O refetch antigo disparava QUATRO consultas (avisos,
  // votações, votos, reuniões, rsvps) só pra saber de um booleano — era daí
  // que vinha a demora entre tocar e o botão mudar.
  async function toggleRsvp(reuniaoId: string): Promise<boolean> {
    if (!userId) return false;
    const confirmado = meusRsvps.has(reuniaoId);

    if (confirmado) {
      // .select() devolve as linhas removidas: RLS que bloqueia delete não
      // gera erro, gera lista vazia. Sem isso a falha é silenciosa.
      const { data, error } = await supabase
        .from('rsvps')
        .delete()
        .eq('reuniao_id', reuniaoId)
        .eq('usuario_id', userId)
        .select();

      if (error) {
        Alert.alert('Erro ao desmarcar presença', error.message);
        return false;
      }
      if (!data || data.length === 0) {
        Alert.alert(
          'Não consegui desmarcar',
          'O banco recusou a remoção da confirmação. Confira se a policy "desmarcar presenca" existe em rsvps.'
        );
        return false;
      }
    } else {
      const { error } = await supabase
        .from('rsvps')
        .insert({ reuniao_id: reuniaoId, usuario_id: userId });

      if (error) {
        Alert.alert('Erro ao confirmar presença', error.message);
        return false;
      }
    }

    setMeusRsvps((atuais) => {
      const novo = new Set(atuais);
      if (confirmado) novo.delete(reuniaoId);
      else novo.add(reuniaoId);
      return novo;
    });
    return true;
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  if (carregandoVinculo) return <Carregando />;

  const itens: ItemOficial[] =
    sub === 'avisos'
      ? avisos.map((a) => ({
          id: a.id,
          // Restrito manda na cor da borda; fixado é sempre público, porque
          // restrito e fixado não coexistem (check constraint no banco).
          destaque: a.restrito ? cores.restrito : a.fixado ? cores.atencao : undefined,
          etiquetas: (
            <>
              {a.restrito && SELO_RESTRITO}
              {a.fixado && <Etiqueta texto="📌 fixado" tom="atencao" />}
            </>
          ),
          titulo: a.titulo,
          meta: formatarData(a.criado_em),
          texto: a.texto,
          // Um aviso por vez em evidência: o fixado. O resto se lê ao tocar.
          previa: a.fixado,
        }))
      : sub === 'reunioes'
        ? reunioes.map((r) => {
            const confirmado = meusRsvps.has(r.id);
            const passada = new Date(r.data_hora) < new Date();
            const cancelada = !!r.cancelada_em;
            return {
              id: r.id,
              destaque: r.restrito ? cores.restrito : cancelada ? cores.perigo : undefined,
              etiquetas: (
                <>
                  {r.restrito && SELO_RESTRITO}
                  {cancelada && <Etiqueta texto="cancelada" tom="critico" />}
                  {!cancelada && passada && <Etiqueta texto="já passou" tom="neutro" />}
                </>
              ),
              titulo: r.titulo,
              tituloRiscado: cancelada,
              meta: `${formatarCompromisso(r.data_hora)}${r.local ? ` · ${r.local}` : ''}`,
              texto: r.pauta ?? '',
              acoes:
                !cancelada && !passada ? (
                  <BotaoPresenca
                    confirmado={confirmado}
                    aoAlternar={() => toggleRsvp(r.id)}
                    compacto
                  />
                ) : undefined,
              rodape:
                !cancelada && !passada ? (
                  <BotaoPresenca confirmado={confirmado} aoAlternar={() => toggleRsvp(r.id)} />
                ) : undefined,
            };
          })
        : sub === 'votacoes'
          ? votacoes.map((v) => {
              const meuVoto = meusVotos[v.id];
              return {
                id: v.id,
                destaque: v.restrito ? cores.restrito : undefined,
                etiquetas: v.restrito ? SELO_RESTRITO : null,
                titulo: v.titulo,
                meta: `Encerra em ${formatarData(v.data_fim)}`,
                texto: v.descricao ?? '',
                acoes: (
                  <BlocoVotacao
                    opcoes={v.opcoes}
                    meuVoto={meuVoto ?? null}
                    contagem={contagem[v.id] ?? {}}
                    mostrarApuracao={podeFiscalizar}
                    aoVotar={(op) => votar(v.id, op)}
                  />
                ),
              };
            })
          : [];

  const VAZIOS: Record<Exclude<SubAba, 'regras'>, ReactNode> = {
    avisos: <Vazio icone="📣" titulo="Nenhum aviso no momento" />,
    reunioes: <Vazio icone="📅" titulo="Nenhuma reunião agendada" />,
    votacoes: (
      <Vazio
        icone="🗳️"
        titulo="Nenhuma votação em andamento"
        texto="Cada apartamento vota uma vez, direto pelo app."
      />
    ),
  };

  const aberto = itens.find((i) => i.id === abertoId) ?? null;

  return (
    <View style={styles.container}>
      <CabecalhoApp />

      <View style={{ flex: 1 }}>
        {sub === 'regras' ? (
          <RegrasScreen />
        ) : (
          <ScrollView
            contentContainerStyle={styles.rolagem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {itens.length === 0
              ? VAZIOS[sub]
              : itens.map((i) => (
                  <CartaoResumo key={i.id} item={i} aoAbrir={() => setAbertoId(i.id)} />
                ))}
          </ScrollView>
        )}
      </View>

      <SubAbas opcoes={SUB_ABAS} valor={sub} aoTrocar={trocarSub} />

      {aberto && <FolhaItem item={aberto} aoFechar={() => setAbertoId(null)} />}
    </View>
  );
}

// ---------- CARD FECHADO ----------
// Tocar em qualquer lugar abre a folha. As ações (votar, confirmar presença)
// ficam visíveis já aqui: escondê-las atrás da expansão custaria um toque a
// mais justamente no que é o objetivo da tela.

function CartaoResumo({ item, aoAbrir }: { item: ItemOficial; aoAbrir: () => void }) {
  const comPrevia = !!item.previa && !!item.texto;
  const longo = comPrevia && item.texto.length > LIMITE_TEXTO;
  const visivel = longo ? item.texto.slice(0, LIMITE_TEXTO).trimEnd() + '…' : item.texto;
  // Sem trecho de texto, o card perde a pista de que há mais coisa dentro.
  // A seta devolve isso — e é a única pista de que tocar leva a algum lugar.
  const temMais = !comPrevia && !!item.texto;

  return (
    <View
      style={[
        styles.card,
        item.destaque ? { borderLeftWidth: 4, borderLeftColor: item.destaque } : null,
      ]}
    >
      <Pressable onPress={aoAbrir}>
        {item.etiquetas ? <View style={styles.etiquetas}>{item.etiquetas}</View> : null}
        <View style={styles.tituloLinha}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.titulo, item.tituloRiscado && styles.riscado]}>
              {item.titulo}
            </Text>
            {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
          </View>
          {temMais && (
            <Ionicons name="chevron-forward" size={22} color={cores.textoFraco} />
          )}
        </View>
        {comPrevia ? <Text style={styles.texto}>{visivel}</Text> : null}
        {longo && <Text style={styles.lerMais}>Ler mais</Text>}
      </Pressable>

      {item.acoes ? <View style={styles.acoes}>{item.acoes}</View> : null}
    </View>
  );
}

// ---------- FOLHA ABERTA ----------
// Mesmo formato do post do Mural: tela cheia, faixa de fechar de ponta a
// ponta no topo, e tipografia de leitura em vez de tipografia de lista.

function FolhaItem({ item, aoFechar }: { item: ItemOficial; aoFechar: () => void }) {
  return (
    <FolhaExpandida aoFechar={aoFechar} rodape={item.rodape}>
      {({ propsRolagem, arrasto }) => (
        <View style={{ flex: 1 }} {...arrasto}>
          <ScrollView {...propsRolagem} contentContainerStyle={styles.folhaConteudo}>
            {item.etiquetas ? <View style={styles.etiquetas}>{item.etiquetas}</View> : null}

            <Text style={[styles.folhaTitulo, item.tituloRiscado && styles.riscado]}>
              {item.titulo}
            </Text>
            {item.meta ? <Text style={styles.folhaMeta}>{item.meta}</Text> : null}

            {item.texto ? (
              <>
                <View style={styles.regua} />
                <Text style={styles.folhaTexto}>{item.texto}</Text>
              </>
            ) : null}

            {/* Com rodapé fixo, repetir a mesma ação no corpo só duplicaria. */}
            {item.acoes && !item.rodape ? (
              <View style={styles.folhaAcoes}>{item.acoes}</View>
            ) : null}
          </ScrollView>
        </View>
      )}
    </FolhaExpandida>
  );
}

// ---------- ENQUETE ----------
//
// No formato de enquete do WhatsApp: cada opção é uma linha com marcador à
// esquerda, contagem à direita e uma barra de proporção embaixo. O resultado
// fica visível enquanto se vota, que é o que faz a pessoa voltar na votação.
//
// Trocar o voto é só tocar em outra opção. Não existe desmarcar: uma unidade
// que votou fica com voto até o prazo fechar (ver db/migracao-votos.sql).

function BlocoVotacao({
  opcoes,
  meuVoto,
  contagem,
  mostrarApuracao,
  aoVotar,
}: {
  opcoes: string[];
  meuVoto: string | null;
  contagem: Record<string, number>;
  /** Morador comum não vê placar. O banco também não entrega — a contagem
   *  que chega até ele traz só o voto da própria unidade. */
  mostrarApuracao: boolean;
  aoVotar: (opcao: string) => Promise<boolean>;
}) {
  const { mostrar } = useAvisoRapido();
  const [salvando, setSalvando] = useState<string | null>(null);

  const total = opcoes.reduce((soma, op) => soma + (contagem[op] ?? 0), 0);

  async function escolher(opcao: string) {
    if (salvando || meuVoto === opcao) return;
    const trocando = !!meuVoto;
    setSalvando(opcao);
    const ok = await aoVotar(opcao);
    setSalvando(null);
    if (ok) mostrar(trocando ? 'Voto alterado' : 'Voto registrado');
  }

  return (
    <View>
      <View style={{ gap: espaco.sm }}>
        {opcoes.map((op) => (
          <OpcaoVoto
            key={op}
            texto={op}
            votos={contagem[op] ?? 0}
            total={total}
            escolhida={meuVoto === op}
            salvando={salvando === op}
            mostrarApuracao={mostrarApuracao}
            aoTocar={() => escolher(op)}
          />
        ))}
      </View>

      <Text style={styles.rodapeVoto}>
        {mostrarApuracao
          ? `${total === 0 ? 'Nenhum voto ainda' : total === 1 ? '1 voto' : `${total} votos`} · `
          : ''}
        {meuVoto ? 'toque em outra opção para trocar o seu' : 'um voto por unidade'}
      </Text>

      {mostrarApuracao ? (
        <Text style={styles.notaApuracao}>
          🔒 A apuração aparece só pra síndico, subsíndico e conselho fiscal.
        </Text>
      ) : (
        <Text style={styles.notaApuracao}>
          O resultado é divulgado pelo síndico quando a votação encerrar.
        </Text>
      )}
    </View>
  );
}

function OpcaoVoto({
  texto,
  votos,
  total,
  escolhida,
  salvando,
  mostrarApuracao,
  aoTocar,
}: {
  texto: string;
  votos: number;
  total: number;
  escolhida: boolean;
  salvando: boolean;
  mostrarApuracao: boolean;
  aoTocar: () => void;
}) {
  const proporcao = total > 0 ? votos / total : 0;

  return (
    <Pressable
      onPress={aoTocar}
      disabled={salvando}
      style={({ pressed }) => [styles.opcao, pressed && { opacity: 0.65 }]}
    >
      <View style={[styles.marcador, escolhida && styles.marcadorAtivo]}>
        {escolhida && <Text style={styles.marcadorCheque}>✓</Text>}
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.opcaoTopo}>
          <Text style={[styles.opcaoTexto, escolhida && styles.opcaoTextoAtiva]}>{texto}</Text>
          {salvando ? (
            <ActivityIndicator size="small" color={cores.primaria} />
          ) : mostrarApuracao ? (
            <Text style={[styles.opcaoContagem, escolhida && styles.opcaoContagemAtiva]}>
              {votos}
            </Text>
          ) : null}
        </View>

        {/* Sem apuração não há barra: uma barra vazia pareceria "zero votos",
            que é uma informação — e justamente a que não pode aparecer. */}
        {mostrarApuracao && (
          <View style={styles.trilho}>
            <View
              style={[
                styles.preenchimento,
                // Percentual em string é o que o RN aceita pra largura relativa.
                { width: `${Math.round(proporcao * 100)}%` },
                escolhida && styles.preenchimentoAtivo,
              ]}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ---------- CONFIRMAR PRESENÇA ----------
//
// Duas formas do mesmo botão: compacta no card da lista, e uma barra de ponta
// a ponta no rodapé da folha — mesma posição do campo de comentário do Mural,
// que é onde o polegar já está.
//
// O estado de "salvando" existe porque a gravação passa pela rede: sem ele o
// botão fica inerte entre o toque e a resposta, e a pessoa toca de novo.
//
// `useAvisoRapido` resolve pelo provider mais próximo: renderizado dentro da
// folha, o balão aparece na folha; renderizado no card, aparece na tela.

function BotaoPresenca({
  confirmado,
  aoAlternar,
  compacto,
}: {
  confirmado: boolean;
  aoAlternar: () => Promise<boolean>;
  compacto?: boolean;
}) {
  const { mostrar } = useAvisoRapido();
  const insets = useSafeAreaInsets();
  const [salvando, setSalvando] = useState(false);

  async function acionar() {
    if (salvando) return;
    setSalvando(true);
    const ok = await aoAlternar();
    setSalvando(false);
    if (ok) mostrar(confirmado ? 'Presença desmarcada' : 'Presença confirmada');
  }

  if (compacto) {
    return (
      <Botao
        titulo={confirmado ? 'Presença confirmada ✓' : 'Confirmar presença'}
        variante={confirmado ? 'primario' : 'secundario'}
        pequeno
        carregando={salvando}
        onPress={acionar}
        estilo={{ alignSelf: 'flex-start' }}
      />
    );
  }

  return (
    <Pressable
      onPress={acionar}
      disabled={salvando}
      style={({ pressed }) => [
        styles.rodapeBotao,
        { paddingBottom: insets.bottom + espaco.lg },
        confirmado && styles.rodapeConfirmado,
        pressed && { opacity: 0.85 },
      ]}
    >
      {salvando ? (
        <ActivityIndicator color={confirmado ? cores.textoClaro : cores.primaria} />
      ) : (
        <Text style={[styles.rodapeTexto, confirmado && styles.rodapeTextoConfirmado]}>
          {confirmado ? '✓  Presença confirmada' : 'Confirmar presença'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  rolagem: { padding: espaco.md, paddingBottom: espaco.xl },

  card: {
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    padding: espaco.lg,
    marginBottom: espaco.md,
    borderWidth: 1,
    borderColor: cores.borda,
    ...sombra,
  },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginBottom: espaco.sm },
  tituloLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  titulo: { fontWeight: '700', fontSize: 17, color: cores.texto },
  riscado: { textDecorationLine: 'line-through', color: cores.textoFraco },
  meta: { fontSize: 14, color: cores.textoFraco, marginTop: espaco.xs },
  texto: { fontSize: 16, color: cores.textoFraco, marginTop: espaco.sm, lineHeight: 24 },
  lerMais: { fontSize: 15, color: cores.primaria, fontWeight: '700', marginTop: espaco.xs },
  acoes: { marginTop: espaco.md },

  // Aberto é pra ler, não pra varrer: título maior, corpo em 17/27, e mais
  // respiro nas laterais.
  folhaConteudo: {
    paddingHorizontal: espaco.xl,
    paddingTop: espaco.lg,
    paddingBottom: espaco.xxl,
  },
  folhaTitulo: { fontSize: 25, fontWeight: '800', color: cores.texto, lineHeight: 33 },
  folhaMeta: { fontSize: 15, color: cores.textoFraco, marginTop: espaco.sm },
  regua: {
    height: 1,
    backgroundColor: cores.borda,
    marginTop: espaco.lg,
    marginBottom: espaco.lg,
  },
  folhaTexto: { fontSize: 19, color: cores.texto, lineHeight: 31 },
  folhaAcoes: { marginTop: espaco.xl },

  rodapeVoto: { fontSize: 14, color: cores.textoFraco, marginTop: espaco.md },

  opcao: { flexDirection: 'row', alignItems: 'center', gap: espaco.md, paddingVertical: espaco.xs },
  marcador: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcadorAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  marcadorCheque: { color: cores.textoClaro, fontSize: 15, fontWeight: '900' },
  opcaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
    marginBottom: 6,
    minHeight: 20,
  },
  opcaoTexto: { flex: 1, fontSize: 16, color: cores.texto },
  notaApuracao: { fontSize: 13, color: cores.textoFraco, marginTop: espaco.xs, lineHeight: 18 },
  opcaoTextoAtiva: { fontWeight: '700' },
  opcaoContagem: { fontSize: 15, color: cores.textoFraco, fontWeight: '600' },
  opcaoContagemAtiva: { color: cores.primaria, fontWeight: '800' },
  trilho: { height: 6, borderRadius: 3, backgroundColor: cores.borda, overflow: 'hidden' },
  preenchimento: { height: '100%', borderRadius: 3, backgroundColor: cores.textoFraco },
  preenchimentoAtivo: { backgroundColor: cores.primaria },

  // Barra de ponta a ponta, sem margem lateral e sem cantos: ela É o rodapé
  // da folha, na mesma posição do campo de comentário do Mural.
  rodapeBotao: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: espaco.lg,
    minHeight: 62,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  rodapeConfirmado: { backgroundColor: cores.primaria, borderTopColor: cores.primaria },
  rodapeTexto: { fontSize: 18, fontWeight: '800', color: cores.primaria },
  rodapeTextoConfirmado: { color: cores.textoClaro },
});
