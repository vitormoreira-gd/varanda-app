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

type Post = {
  id: string;
  texto: string;
  criado_em: string;
  usuarios: { nome: string } | null;
  curtidas: { usuario_id: string }[];
};

export default function MuralScreen() {
  const { condominioId, papel, loading: carregandoCondominio, erro: erroCondominio } = useMeuCondominio();
  const [posts, setPosts] = useState<Post[]>([]);
  const [texto, setTexto] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const ehSindico = papel === 'sindico';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const carregarPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('id, texto, criado_em, usuarios!autor_id(nome), curtidas(usuario_id)')
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

    if (!condominioId) {
      Alert.alert('Aviso', 'Não encontrei seu condomínio ainda. Feche e reabra o app.');
      return;
    }

    const { data: userData, error: erroUser } = await supabase.auth.getUser();
    if (erroUser || !userData.user) {
      Alert.alert('Erro', 'Não consegui identificar seu usuário logado.');
      return;
    }

    const { error } = await supabase.from('posts').insert({
      texto: texto.trim(),
      condominio_id: condominioId,
      autor_id: userData.user.id,
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
        Alert.alert(
          'Não consegui descurtir',
          'O banco recusou a remoção. Falta rodar db/patch-politicas-faltantes.sql (policy "descurtir post").'
        );
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

  function confirmarRemocao(post: Post) {
    Alert.alert(
      'Remover post',
      `Remover a publicação de ${post.usuarios?.nome ?? 'um vizinho'}? Isso não pode ser desfeito.`,
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
      Alert.alert(
        'Não consegui remover',
        'O banco recusou a remoção. Confira se a policy "sindico modera posts" já foi aplicada.'
      );
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
        renderItem={({ item }) => {
          const curtido = !!userId && item.curtidas.some((c) => c.usuario_id === userId);
          const total = item.curtidas.length;

          return (
            <View style={styles.card}>
              <View style={styles.cabecalho}>
                <Text style={styles.autor}>{item.usuarios?.nome ?? 'Vizinho'}</Text>
                <Text style={styles.data}>{formatarDataHora(item.criado_em)}</Text>
              </View>
              <Text style={styles.texto}>{item.texto}</Text>

              <View style={styles.rodape}>
                <Pressable onPress={() => toggleCurtida(item)} hitSlop={8}>
                  <Text style={[styles.curtir, curtido && styles.curtirAtivo]}>
                    {curtido ? '♥' : '♡'} {total > 0 ? total : ''}
                  </Text>
                </Pressable>

                {ehSindico && (
                  <Pressable onPress={() => confirmarRemocao(item)} hitSlop={8}>
                    <Text style={styles.remover}>Remover</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
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
  curtir: { fontSize: 15, color: '#6B665D' },
  curtirAtivo: { color: '#B4483C', fontWeight: '700' },
  remover: { fontSize: 12, color: '#B4483C' },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 40 },
});
