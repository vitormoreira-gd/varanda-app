import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { formatarDataHora } from '../lib/datas';
import { cores, espaco, raio, sombra } from '../lib/tema';
import { useToqueDuplo } from '../lib/gestos';
import { Avatar, Botao, Campo, Carregando, Vazio } from '../components/ui';
import CabecalhoApp from '../components/CabecalhoApp';
import FolhaExpandida from '../components/FolhaExpandida';

// Quantos caracteres o card mostra antes de cortar. Acima disso entra o
// "Ler mais", que é o mesmo gesto de abrir o post: um feed em que todo post
// tem a altura de um parágrafo é muito mais fácil de percorrer.
const LIMITE_TEXTO = 220;

type Comentario = {
  id: string;
  texto: string;
  criado_em: string;
  autor_id: string;
  usuarios: { nome: string } | null;
};

type Post = {
  id: string;
  texto: string;
  criado_em: string;
  autor_id: string;
  usuarios: { nome: string } | null;
  curtidas: { usuario_id: string }[];
  comentarios: Comentario[];
};

/** usuario_id -> "Síndico" | "Subsíndico". Quem não é nenhum dos dois não entra. */
type Papeis = Record<string, string>;

export default function MuralScreen() {
  const {
    condominioId,
    podeGerir,
    loading: carregandoCondominio,
    erro: erroCondominio,
  } = useMeuCondominio();

  const [posts, setPosts] = useState<Post[]>([]);
  const [papeis, setPapeis] = useState<Papeis>({});
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [compondo, setCompondo] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const carregarPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(
        'id, texto, criado_em, autor_id, usuarios!autor_id(nome), curtidas(usuario_id), ' +
          'comentarios(id, texto, criado_em, autor_id, usuarios!autor_id(nome))'
      )
      .order('criado_em', { ascending: false });

    if (error) {
      Alert.alert('Erro ao carregar posts', error.message);
      return;
    }
    if (data) setPosts(data as unknown as Post[]);
  }, []);

  // Quem é síndico vive em `vinculos.papel`, que um morador comum não pode
  // ler. Por isso vem de um RPC security definer, que devolve só o rótulo —
  // sem unidade nem status de vínculo de ninguém.
  const carregarPapeis = useCallback(async () => {
    if (!condominioId) return;
    const { data, error } = await supabase.rpc('papeis_do_meu_condominio', {
      p_condominio_id: condominioId,
    });

    if (error) {
      // PGRST202 = o PostgREST nao conhece a funcao. Quase sempre e a
      // migracao que falta, ou o cache de schema dele que nao recarregou —
      // a mensagem crua ("could not find the function ... in the schema
      // cache") nao diz o que fazer.
      const naoExiste = error.code === 'PGRST202' || error.message.includes('schema cache');
      Alert.alert(
        naoExiste ? 'Falta aplicar uma migração' : 'Erro ao carregar cargos',
        naoExiste
          ? 'A função papeis_do_meu_condominio não existe no banco. Rode db/migracao-mural.sql no SQL Editor do Supabase — o fim dela já dispara o reload do cache do PostgREST.\n\nSem isso o Mural funciona, mas não marca quem é síndico.'
          : error.message
      );
      return;
    }
    const mapa: Papeis = {};
    (data ?? []).forEach((p: { id_usuario: string; rotulo: string }) => {
      mapa[p.id_usuario] = p.rotulo;
    });
    setPapeis(mapa);
  }, [condominioId]);

  useEffect(() => {
    if (condominioId) {
      carregarPosts();
      carregarPapeis();
    }
  }, [condominioId, carregarPosts, carregarPapeis]);

  useEffect(() => {
    if (erroCondominio) Alert.alert('Erro ao identificar condomínio', erroCondominio);
  }, [erroCondominio]);

  async function publicar(texto: string) {
    if (!condominioId || !userId) {
      Alert.alert('Aviso', 'Não encontrei seu condomínio ainda. Feche e reabra o app.');
      return false;
    }

    const { error } = await supabase.from('posts').insert({
      texto: texto.trim(),
      condominio_id: condominioId,
      autor_id: userId,
    });

    if (error) {
      Alert.alert('Erro ao publicar', error.message);
      return false;
    }
    await carregarPosts();
    return true;
  }

  async function toggleCurtida(post: Post) {
    if (!userId) {
      Alert.alert('Aviso', 'Não identifiquei seu usuário ainda. Feche e reabra o app.');
      return;
    }
    const curtido = post.curtidas.some((c) => c.usuario_id === userId);

    if (curtido) {
      // .select() devolve as linhas removidas: se RLS bloquear o delete,
      // não vem erro, vem lista vazia. Sem isso a falha é silenciosa.
      const { data, error } = await supabase
        .from('curtidas')
        .delete()
        .eq('post_id', post.id)
        .eq('usuario_id', userId)
        .select();

      if (error) {
        Alert.alert('Erro ao descurtir', error.message);
        return;
      }
      if (!data || data.length === 0) {
        Alert.alert('Não consegui descurtir', 'O banco recusou a remoção da curtida.');
        return;
      }
      atualizarCurtidasLocal(post.id, (lista) => lista.filter((c) => c.usuario_id !== userId));
    } else {
      const { error } = await supabase
        .from('curtidas')
        .insert({ post_id: post.id, usuario_id: userId });

      if (error) {
        Alert.alert('Erro ao curtir', error.message);
        return;
      }
      atualizarCurtidasLocal(post.id, (lista) => [...lista, { usuario_id: userId }]);
    }
  }

  function atualizarCurtidasLocal(
    postId: string,
    transformar: (lista: { usuario_id: string }[]) => { usuario_id: string }[]
  ) {
    setPosts((atuais) =>
      atuais.map((p) => (p.id === postId ? { ...p, curtidas: transformar(p.curtidas) } : p))
    );
  }

  async function comentar(postId: string, texto: string) {
    if (!texto.trim() || !userId) return;

    const { error } = await supabase
      .from('comentarios')
      .insert({ post_id: postId, autor_id: userId, texto: texto.trim() });

    if (error) {
      Alert.alert('Erro ao comentar', error.message);
      return;
    }
    await carregarPosts();
  }

  async function removerComentario(comentarioId: string) {
    const { data, error } = await supabase
      .from('comentarios')
      .delete()
      .eq('id', comentarioId)
      .select();

    if (error) {
      Alert.alert('Erro ao remover comentário', error.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Não consegui remover', 'O banco recusou a remoção do comentário.');
      return;
    }
    carregarPosts();
  }

  function confirmarRemocao(post: Post) {
    Alert.alert(
      'Remover post',
      `Remover a publicação de ${post.usuarios?.nome ?? 'um vizinho'}? Os comentários vão junto e isso não pode ser desfeito.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => removerPost(post) },
      ]
    );
  }

  async function removerPost(post: Post) {
    const { data, error } = await supabase.from('posts').delete().eq('id', post.id).select();

    if (error) {
      Alert.alert('Erro ao remover', error.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Não consegui remover', 'O banco recusou a remoção do post.');
      return;
    }
    setExpandidoId((atual) => (atual === post.id ? null : atual));
    setPosts((atuais) => atuais.filter((p) => p.id !== post.id));
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([carregarPosts(), carregarPapeis()]);
    setRefreshing(false);
  }

  if (carregandoCondominio) return <Carregando />;

  // Derivado da lista, e não guardado em estado próprio: assim o post aberto
  // já reflete o comentário recém-enviado depois do recarregamento.
  const postExpandido = posts.find((p) => p.id === expandidoId) ?? null;

  return (
    <View style={styles.container}>
      <CabecalhoApp />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          <Vazio
            icone="💬"
            titulo="Nada por aqui ainda"
            texto="Toque no + para puxar assunto com os vizinhos."
          />
        }
        renderItem={({ item }) => (
          <CardPost
            post={item}
            userId={userId}
            papel={papeis[item.autor_id]}
            podeGerir={podeGerir}
            aoAbrir={() => setExpandidoId(item.id)}
            aoCurtir={() => toggleCurtida(item)}
            aoRemover={() => confirmarRemocao(item)}
          />
        )}
      />

      {/* Botão de escrever: canto inferior, encostado na barra de abas. Sai
          do topo do feed de propósito — o topo é pra ler, não pra escrever.
          A folga até a barra é a mesma da lateral; o inset inferior NÃO entra
          na conta, porque a própria barra de abas já o consumiu. */}
      <Pressable
        onPress={() => setCompondo(true)}
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Ionicons name="add" size={30} color={cores.textoClaro} />
      </Pressable>

      <ModalNovoPost
        visivel={compondo}
        aoFechar={() => setCompondo(false)}
        aoPublicar={publicar}
      />

      <ModalPostExpandido
        post={postExpandido}
        userId={userId}
        papeis={papeis}
        podeGerir={podeGerir}
        aoFechar={() => setExpandidoId(null)}
        aoCurtir={() => postExpandido && toggleCurtida(postExpandido)}
        aoComentar={(texto) => comentar(postExpandido!.id, texto)}
        aoRemoverComentario={removerComentario}
      />
    </View>
  );
}

// ---------- CABEÇALHO DO AUTOR ----------
// Nome e horário na MESMA linha, cargo embaixo do nome. O cargo é o ponto:
// um morador que entrou ontem precisa reconhecer o síndico sem perguntar.

function LinhaAutor({
  nome,
  papel,
  quando,
  tamanhoAvatar = 42,
  acao,
}: {
  nome: string;
  papel?: string;
  quando: string;
  tamanhoAvatar?: number;
  acao?: React.ReactNode;
}) {
  return (
    <View style={styles.autorLinha}>
      <Avatar nome={nome} tamanho={tamanhoAvatar} />
      <View style={{ flex: 1 }}>
        <View style={styles.autorTopo}>
          <Text style={styles.autorNome} numberOfLines={1}>
            {nome}
          </Text>
          <Text style={styles.autorHora}>{formatarDataHora(quando)}</Text>
          {acao}
        </View>
        {papel ? <Text style={styles.autorPapel}>{papel}</Text> : null}
      </View>
    </View>
  );
}

// ---------- CARD DO FEED ----------

function CardPost({
  post,
  userId,
  papel,
  podeGerir,
  aoAbrir,
  aoCurtir,
  aoRemover,
}: {
  post: Post;
  userId: string | null;
  papel?: string;
  podeGerir: boolean;
  aoAbrir: () => void;
  aoCurtir: () => void;
  aoRemover: () => void;
}) {
  const curtido = !!userId && post.curtidas.some((c) => c.usuario_id === userId);
  const totalCurtidas = post.curtidas.length;
  const totalComentarios = post.comentarios.length;
  const nome = post.usuarios?.nome ?? 'Vizinho';

  const longo = post.texto.length > LIMITE_TEXTO;
  const visivel = longo ? post.texto.slice(0, LIMITE_TEXTO).trimEnd() + '…' : post.texto;

  // Toque simples abre; duplo curte. O simples espera a janela do duplo
  // fechar, senao o primeiro toque de um duplo ja teria aberto o post.
  const aoTocar = useToqueDuplo(aoAbrir, aoCurtir);

  return (
    <View style={styles.card}>
      <Pressable onPress={aoTocar} style={styles.cardCorpo}>
        <LinhaAutor
          nome={nome}
          papel={papel}
          quando={post.criado_em}
          acao={
            podeGerir ? (
              <Pressable onPress={aoRemover} hitSlop={10} style={{ marginLeft: espaco.sm }}>
                <Ionicons name="trash-outline" size={17} color={cores.textoFraco} />
              </Pressable>
            ) : undefined
          }
        />

        <Text style={styles.texto}>{visivel}</Text>
        {longo && <Text style={styles.lerMais}>Ler mais</Text>}

        {(totalCurtidas > 0 || totalComentarios > 0) && (
          <View style={styles.resumo}>
            {totalCurtidas > 0 && (
              <Text style={styles.resumoTexto}>
                👍 {totalCurtidas}
              </Text>
            )}
            {totalComentarios > 0 && (
              <Text style={styles.resumoTexto}>
                {totalComentarios} {totalComentarios === 1 ? 'comentário' : 'comentários'}
              </Text>
            )}
          </View>
        )}
      </Pressable>

      <View style={styles.barraAcoes}>
        <BotaoAcao
          icone={curtido ? 'thumbs-up' : 'thumbs-up-outline'}
          rotulo="Curtir"
          ativo={curtido}
          onPress={aoCurtir}
        />
        <View style={styles.separadorVertical} />
        <BotaoAcao icone="chatbubble-outline" rotulo="Comentar" onPress={aoAbrir} />
      </View>
    </View>
  );
}

/** Alvo de toque grande e rotulado, no lugar dos ícones minúsculos de antes. */
function BotaoAcao({
  icone,
  rotulo,
  ativo,
  onPress,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  ativo?: boolean;
  onPress: () => void;
}) {
  const cor = ativo ? cores.primaria : cores.textoFraco;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.acao, pressed && { backgroundColor: cores.superficieAlt }]}
    >
      <Ionicons name={icone} size={20} color={cor} />
      <Text style={[styles.acaoTexto, { color: cor }, ativo && { fontWeight: '800' }]}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

// ---------- POST ABERTO ----------
// O post fica ancorado no topo e só os comentários rolam. Tocar no post
// ancorado fecha — é o mesmo gesto que abriu, na mesma superfície.

function ModalPostExpandido({
  post,
  userId,
  papeis,
  podeGerir,
  aoFechar,
  aoCurtir,
  aoComentar,
  aoRemoverComentario,
}: {
  post: Post | null;
  userId: string | null;
  papeis: Papeis;
  podeGerir: boolean;
  aoFechar: () => void;
  aoCurtir: () => void;
  aoComentar: (texto: string) => Promise<void>;
  aoRemoverComentario: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [rascunho, setRascunho] = useState('');
  const [enviando, setEnviando] = useState(false);

  const postId = post?.id;

  // O componente continua montado depois de fechar (só devolve null), então
  // sem isto o rascunho de um post reapareceria ao abrir outro.
  useEffect(() => {
    setRascunho('');
  }, [postId]);

  // Toque simples no texto não faz nada, de propósito: fechar é pela faixa do
  // topo. O duplo curte, igual ao feed.
  const aoTocarTexto = useToqueDuplo(undefined, aoCurtir);

  if (!post) return null;

  const curtido = !!userId && post.curtidas.some((c) => c.usuario_id === userId);
  const comentarios = [...post.comentarios].sort((a, b) => a.criado_em.localeCompare(b.criado_em));

  async function enviar() {
    if (!rascunho.trim()) return;
    setEnviando(true);
    await aoComentar(rascunho);
    setEnviando(false);
    setRascunho('');
  }

  return (
    <FolhaExpandida
      aoFechar={aoFechar}
      rodape={
        <View style={[styles.composerComentario, { paddingBottom: insets.bottom + espaco.md }]}>
          <Campo
            placeholder="Escreva um comentário..."
            value={rascunho}
            onChangeText={setRascunho}
            estilo={{ flex: 1 }}
          />
          <Pressable
            onPress={enviar}
            disabled={enviando || !rascunho.trim()}
            style={({ pressed }) => [
              styles.enviar,
              (!rascunho.trim() || enviando) && { opacity: 0.35 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="send" size={18} color={cores.textoClaro} />
          </Pressable>
        </View>
      }
    >
      {({ propsRolagem, arrasto }) => (
        <>
          {/* Post ancorado: fica parado enquanto os comentários rolam. O
              arrasto de fechar NÃO é aplicado aqui — o texto tem rolagem
              própria, e ali o gesto pra baixo precisa rolar, não fechar. */}
          <View style={styles.ancora}>
            <LinhaAutor
              nome={post.usuarios?.nome ?? 'Vizinho'}
              papel={papeis[post.autor_id]}
              quando={post.criado_em}
            />

            <Pressable onPress={aoTocarTexto} style={styles.ancoraTexto}>
              <ScrollView nestedScrollEnabled>
                <Text style={styles.textoAberto}>{post.texto}</Text>
              </ScrollView>
            </Pressable>

            <View style={styles.barraAcoes}>
              <BotaoAcao
                icone={curtido ? 'thumbs-up' : 'thumbs-up-outline'}
                rotulo={post.curtidas.length > 0 ? `Curtir · ${post.curtidas.length}` : 'Curtir'}
                ativo={curtido}
                onPress={aoCurtir}
              />
            </View>
          </View>

          <View style={{ flex: 1 }} {...arrasto}>
            <FlatList
              {...propsRolagem}
              data={comentarios}
              keyExtractor={(c) => c.id}
              contentContainerStyle={styles.listaComentarios}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Vazio
                  icone="🗨️"
                  titulo="Nenhum comentário ainda"
                  texto="Seja o primeiro a responder."
                />
              }
              renderItem={({ item }) => (
                <View style={styles.comentario}>
                  <LinhaAutor
                    nome={item.usuarios?.nome ?? 'Vizinho'}
                    papel={papeis[item.autor_id]}
                    quando={item.criado_em}
                    tamanhoAvatar={32}
                    acao={
                      podeGerir ? (
                        <Pressable
                          onPress={() => aoRemoverComentario(item.id)}
                          hitSlop={10}
                          style={{ marginLeft: espaco.sm }}
                        >
                          <Ionicons name="trash-outline" size={15} color={cores.textoFraco} />
                        </Pressable>
                      ) : undefined
                    }
                  />
                  <Text style={styles.comentarioTexto}>{item.texto}</Text>
                </View>
              )}
            />
          </View>
        </>
      )}
    </FolhaExpandida>
  );
}

// ---------- NOVO POST ----------

function ModalNovoPost({
  visivel,
  aoFechar,
  aoPublicar,
}: {
  visivel: boolean;
  aoFechar: () => void;
  aoPublicar: (texto: string) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    const ok = await aoPublicar(texto);
    setEnviando(false);
    if (ok) {
      setTexto('');
      aoFechar();
    }
  }

  function fechar() {
    if (texto.trim()) {
      Alert.alert('Descartar publicação?', 'O que você escreveu será perdido.', [
        { text: 'Continuar escrevendo', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            setTexto('');
            aoFechar();
          },
        },
      ]);
      return;
    }
    aoFechar();
  }

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={fechar}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.topoModal, { paddingTop: insets.top + espaco.sm }]}>
          <Pressable onPress={fechar} hitSlop={12}>
            <Ionicons name="close" size={26} color={cores.textoFraco} />
          </Pressable>
          <Text style={styles.topoModalTitulo}>Nova publicação</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.corpoModal}>
          <Campo
            placeholder="Compartilhe algo com seus vizinhos..."
            value={texto}
            onChangeText={setTexto}
            multiline
            autoFocus
            style={styles.campoPost}
          />
          <Botao
            titulo="Publicar"
            onPress={enviar}
            disabled={!texto.trim() || enviando}
            carregando={enviando}
            estilo={{ marginTop: espaco.lg }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.md, paddingBottom: 96 },

  card: {
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    marginBottom: espaco.md,
    borderWidth: 1,
    borderColor: cores.borda,
    overflow: 'hidden',
    ...sombra,
  },
  cardCorpo: { padding: espaco.lg, paddingBottom: espaco.md },

  autorLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  autorTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  autorNome: { flex: 1, fontSize: 15, fontWeight: '800', color: cores.texto },
  autorHora: { fontSize: 11, color: cores.textoFraco },
  // O rótulo de cargo é a única coisa colorida do cabeçalho do card: precisa
  // saltar sem competir com o nome.
  autorPapel: {
    fontSize: 11,
    fontWeight: '700',
    color: cores.primaria,
    marginTop: 1,
  },

  texto: { fontSize: 15, color: cores.texto, lineHeight: 22, marginTop: espaco.md },
  lerMais: { fontSize: 13, color: cores.primaria, fontWeight: '700', marginTop: espaco.xs },

  resumo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: espaco.md,
  },
  resumoTexto: { fontSize: 12, color: cores.textoFraco },

  barraAcoes: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  separadorVertical: { width: 1, backgroundColor: cores.borda },
  acao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
    paddingVertical: espaco.md,
    minHeight: 48,
  },
  acaoTexto: { fontSize: 14, fontWeight: '700' },

  fab: {
    position: 'absolute',
    right: espaco.lg,
    bottom: espaco.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    ...sombra,
    elevation: 6,
  },

  ancora: {
    // Teto pra âncora, agora medido dentro da folha (que já é ~58% da tela):
    // acima disso o post engoliria os comentários e o campo de escrever.
    maxHeight: '45%',
    backgroundColor: cores.superficie,
    paddingHorizontal: espaco.lg,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  ancoraTexto: { flexGrow: 0, flexShrink: 1 },
  // Post aberto e pra LER: corpo maior e mais arejado que o do feed,
  // que existe pra ser varrido.
  textoAberto: {
    fontSize: 17,
    color: cores.texto,
    lineHeight: 27,
    marginTop: espaco.md,
    marginBottom: espaco.md,
  },
  listaComentarios: { padding: espaco.md, paddingBottom: espaco.xl },
  comentario: {
    backgroundColor: cores.superficie,
    borderRadius: raio.sm,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.md,
    marginBottom: espaco.sm,
  },
  comentarioTexto: {
    fontSize: 14,
    color: cores.texto,
    lineHeight: 20,
    marginTop: espaco.sm,
  },

  composerComentario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.md,
    paddingTop: espaco.md,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  enviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topoModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.md,
    backgroundColor: cores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  topoModalTitulo: { fontSize: 16, fontWeight: '800', color: cores.texto },
  corpoModal: { padding: espaco.lg, flex: 1 },
  campoPost: { minHeight: 160, fontSize: 16, lineHeight: 23 },
});
