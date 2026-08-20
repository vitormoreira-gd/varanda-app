import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { formatarDataHora } from '../lib/datas';

type Comentario = {
  id: string;
  texto: string;
  criado_em: string;
  usuarios: { nome: string } | null;
};

type Post = {
  id: string;
  texto: string;
  criado_em: string;
  usuarios: { nome: string } | null;
  curtidas: { usuario_id: string }[];
  comentarios: Comentario[];
};

export default function MuralScreen() {
  const { condominioId, papel, loading: carregandoCondominio, erro: erroCondominio } = useMeuCondominio();
  const [posts, setPosts] = useState<Post[]>([]);
  const [texto, setTexto] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const ehSindico = papel === 'sindico';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const carregarPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(
        'id, texto, criado_em, usuarios!autor_id(nome), curtidas(usuario_id), ' +
          'comentarios(id, texto, criado_em, usuarios!autor_id(nome))'
      )
      .order('criado_em', { ascending: false });

    if (error) {
      Alert.alert('Erro ao carregar posts', error.message);
      return;
    }
    if (data) setPosts(data as unknown as Post[]);
  }, []);

  useEffect(() => {
    if (condominioId) carregarPosts();
  }, [condominioId, carregarPosts]);

  useEffect(() => {
    if (erroCondominio) Alert.alert('Erro ao identificar condomínio', erroCondominio);
  }, [erroCondominio]);

  async function publicar() {
    if (!texto.trim()) return;

    if (!condominioId || !userId) {
      Alert.alert('Aviso', 'Não encontrei seu condomínio ainda. Feche e reabra o app.');
      return;
    }

    const { error } = await supabase.from('posts').insert({
      texto: texto.trim(),
      condominio_id: condominioId,
      autor_id: userId,
    });

    if (error) {
      Alert.alert('Erro ao publicar', error.message);
      return;
    }

    setTexto('');
    carregarPosts();
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

  function toggleExpandido(postId: string) {
    setExpandidos((atuais) => {
      const novo = new Set(atuais);
      if (novo.has(postId)) novo.delete(postId);
      else novo.add(postId);
      return novo;
    });
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
    setPosts((atuais) => atuais.filter((p) => p.id !== post.id));
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregarPosts();
    setRefreshing(false);
  }

  if (carregandoCondominio) {
    return (
      <View style={styles.center}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.novoPost}>
        <TextInput
          style={styles.input}
          placeholder="Compartilhe algo com seus vizinhos..."
          value={texto}
          onChangeText={setTexto}
          multiline
        />
        <Button title="Publicar" onPress={publicar} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nada por aqui ainda. Que tal ser o primeiro a postar?</Text>
        }
        renderItem={({ item }) => (
          <CardPost
            post={item}
            userId={userId}
            ehSindico={ehSindico}
            expandido={expandidos.has(item.id)}
            aoExpandir={() => toggleExpandido(item.id)}
            aoCurtir={() => toggleCurtida(item)}
            aoRemover={() => confirmarRemocao(item)}
            aoComentar={(texto) => comentar(item.id, texto)}
            aoRemoverComentario={removerComentario}
          />
        )}
      />
    </View>
  );
}

function CardPost({
  post,
  userId,
  ehSindico,
  expandido,
  aoExpandir,
  aoCurtir,
  aoRemover,
  aoComentar,
  aoRemoverComentario,
}: {
  post: Post;
  userId: string | null;
  ehSindico: boolean;
  expandido: boolean;
  aoExpandir: () => void;
  aoCurtir: () => void;
  aoRemover: () => void;
  aoComentar: (texto: string) => Promise<void>;
  aoRemoverComentario: (id: string) => void;
}) {
  const [rascunho, setRascunho] = useState('');
  const [enviando, setEnviando] = useState(false);

  const curtido = !!userId && post.curtidas.some((c) => c.usuario_id === userId);
  const totalCurtidas = post.curtidas.length;
  const comentarios = [...post.comentarios].sort((a, b) => a.criado_em.localeCompare(b.criado_em));

  async function enviar() {
    setEnviando(true);
    await aoComentar(rascunho);
    setEnviando(false);
    setRascunho('');
  }

  return (
    <View style={styles.card}>
      <View style={styles.cabecalho}>
        <Text style={styles.autor}>{post.usuarios?.nome ?? 'Vizinho'}</Text>
        <Text style={styles.data}>{formatarDataHora(post.criado_em)}</Text>
      </View>
      <Text style={styles.texto}>{post.texto}</Text>

      <View style={styles.rodape}>
        <View style={styles.acoes}>
          <Pressable onPress={aoCurtir} hitSlop={8}>
            <Text style={[styles.acao, curtido && styles.curtirAtivo]}>
              {curtido ? '♥' : '♡'} {totalCurtidas > 0 ? totalCurtidas : ''}
            </Text>
          </Pressable>

          <Pressable onPress={aoExpandir} hitSlop={8}>
            <Text style={styles.acao}>
              {comentarios.length === 0
                ? 'Comentar'
                : `${comentarios.length} comentário${comentarios.length > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </View>

        {ehSindico && (
          <Pressable onPress={aoRemover} hitSlop={8}>
            <Text style={styles.remover}>Remover</Text>
          </Pressable>
        )}
      </View>

      {expandido && (
        <View style={styles.comentarios}>
          {comentarios.map((c) => (
            <View key={c.id} style={styles.comentario}>
              <View style={styles.cabecalho}>
                <Text style={styles.comentarioAutor}>{c.usuarios?.nome ?? 'Vizinho'}</Text>
                <Text style={styles.data}>{formatarDataHora(c.criado_em)}</Text>
              </View>
              <Text style={styles.comentarioTexto}>{c.texto}</Text>
              {ehSindico && (
                <Pressable onPress={() => aoRemoverComentario(c.id)} hitSlop={6}>
                  <Text style={styles.removerComentario}>remover</Text>
                </Pressable>
              )}
            </View>
          ))}

          <View style={styles.novoComentario}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Escreva um comentário..."
              value={rascunho}
              onChangeText={setRascunho}
              multiline
            />
            <Button title="Enviar" onPress={enviar} disabled={enviando || !rascunho.trim()} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE6', padding: 16, paddingTop: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  novoPost: { marginBottom: 16, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E4DFD2',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
    minHeight: 50,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E4DFD2',
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
    gap: 8,
  },
  autor: { fontWeight: '700', color: '#1B4B66', fontSize: 13, flexShrink: 1 },
  data: { color: '#6B665D', fontSize: 11 },
  texto: { fontSize: 14, color: '#211F1B' },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  acao: { fontSize: 13, color: '#6B665D' },
  curtirAtivo: { color: '#B4483C', fontWeight: '700' },
  remover: { fontSize: 12, color: '#B4483C' },
  comentarios: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4DFD2',
    gap: 10,
  },
  comentario: {
    backgroundColor: '#F7F5EF',
    borderRadius: 10,
    padding: 10,
  },
  comentarioAutor: { fontWeight: '600', color: '#1B4B66', fontSize: 12, flexShrink: 1 },
  comentarioTexto: { fontSize: 13, color: '#211F1B' },
  removerComentario: { fontSize: 11, color: '#B4483C', marginTop: 6 },
  novoComentario: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 40 },
});
