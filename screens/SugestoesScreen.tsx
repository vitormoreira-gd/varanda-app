import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';

const CATEGORIAS = ['Área comum', 'Segurança', 'Financeiro', 'Sustentabilidade', 'Outro'];

const STATUS_LABEL: Record<string, string> = {
  analise: 'Em análise',
  aprovada: 'Aprovada',
  implementada: 'Implementada',
};
const STATUS_COR: Record<string, { bg: string; cor: string }> = {
  analise: { bg: '#F6E7C8', cor: '#C98A1F' },
  aprovada: { bg: '#DEE9E1', cor: '#43715B' },
  implementada: { bg: '#43715B', cor: '#fff' },
};

type Sugestao = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  status: string;
  apoios: { count: number }[];
};

export default function SugestoesScreen() {
  const { condominioId } = useMeuCondominio();
  const [lista, setLista] = useState<Sugestao[]>([]);
  const [meusApoios, setMeusApoios] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('sugestoes')
      .select('id, titulo, descricao, categoria, status, apoios(count)')
      .order('criado_em', { ascending: false });

    if (error) {
      Alert.alert('Erro ao carregar sugestões', error.message);
      return;
    }
    setLista((data as unknown as Sugestao[]) ?? []);

    if (userId) {
      const { data: apoiosData } = await supabase
        .from('apoios')
        .select('sugestao_id')
        .eq('usuario_id', userId);
      setMeusApoios(new Set((apoiosData ?? []).map((a) => a.sugestao_id)));
    }
  }, [userId]);

  useEffect(() => {
    if (condominioId && userId) carregar();
  }, [condominioId, userId, carregar]);

  async function enviar() {
    if (!titulo.trim() || !descricao.trim() || !condominioId || !userId) return;

    const { error } = await supabase.from('sugestoes').insert({
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      categoria,
      condominio_id: condominioId,
      autor_id: userId,
    });

    if (error) {
      Alert.alert('Erro ao enviar sugestão', error.message);
      return;
    }

    setTitulo('');
    setDescricao('');
    setMostrarForm(false);
    carregar();
  }

  async function toggleApoio(sugestaoId: string) {
    if (!userId) return;
    const jaApoiou = meusApoios.has(sugestaoId);

    if (jaApoiou) {
      await supabase
        .from('apoios')
        .delete()
        .eq('sugestao_id', sugestaoId)
        .eq('usuario_id', userId);
    } else {
      await supabase.from('apoios').insert({ sugestao_id: sugestaoId, usuario_id: userId });
    }
    carregar();
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      {!mostrarForm ? (
        <Button title="+ Nova sugestão" onPress={() => setMostrarForm(true)} />
      ) : (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Título"
            value={titulo}
            onChangeText={setTitulo}
          />
          <View style={styles.chips}>
            {CATEGORIAS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategoria(c)}
                style={[styles.chip, categoria === c && styles.chipAtivo]}
              >
                <Text style={[styles.chipTexto, categoria === c && styles.chipTextoAtivo]}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, { minHeight: 70 }]}
            placeholder="Descreva sua ideia..."
            value={descricao}
            onChangeText={setDescricao}
            multiline
          />
          <View style={styles.row}>
            <Button title="Cancelar" onPress={() => setMostrarForm(false)} color="#6B665D" />
            <Button title="Enviar" onPress={enviar} />
          </View>
        </View>
      )}

      <FlatList
        style={{ marginTop: 12 }}
        data={lista}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma sugestão ainda.</Text>}
        renderItem={({ item }) => {
          const cor = STATUS_COR[item.status] ?? STATUS_COR.analise;
          const apoiado = meusApoios.has(item.id);
          const totalApoios = item.apoios?.[0]?.count ?? 0;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.titulo}>{item.titulo}</Text>
                <View style={[styles.status, { backgroundColor: cor.bg }]}>
                  <Text style={[styles.statusTexto, { color: cor.cor }]}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.descricao}>{item.descricao}</Text>
              <View style={styles.apoioRow}>
                <Text style={styles.apoiosCount}>{totalApoios} apoios</Text>
                <Pressable
                  onPress={() => toggleApoio(item.id)}
                  style={[styles.apoiarBtn, apoiado && styles.apoiarBtnAtivo]}
                >
                  <Text style={[styles.apoiarTexto, apoiado && styles.apoiarTextoAtivo]}>
                    {apoiado ? 'Apoiado ✓' : 'Apoiar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE6', padding: 16 },
  form: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 10, gap: 8 },
  input: { borderWidth: 1, borderColor: '#E4DFD2', borderRadius: 10, padding: 10, backgroundColor: '#F2EFE6' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#E4DFD2', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipAtivo: { backgroundColor: '#1B4B66', borderColor: '#1B4B66' },
  chipTexto: { fontSize: 12, color: '#6B665D' },
  chipTextoAtivo: { color: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E4DFD2' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  titulo: { fontWeight: '700', fontSize: 15, flex: 1, color: '#211F1B' },
  status: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 },
  statusTexto: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  descricao: { fontSize: 13, color: '#6B665D', marginTop: 6, lineHeight: 19 },
  apoioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  apoiosCount: { fontSize: 12, color: '#6B665D' },
  apoiarBtn: { borderWidth: 1.5, borderColor: '#43715B', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  apoiarBtnAtivo: { backgroundColor: '#43715B' },
  apoiarTexto: { fontSize: 12, color: '#43715B', fontWeight: '600' },
  apoiarTextoAtivo: { color: '#fff' },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 30 },
});
