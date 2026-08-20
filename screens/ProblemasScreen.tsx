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

const CATEGORIAS = ['Hidráulica', 'Elétrica', 'Estrutural', 'Limpeza', 'Segurança'];

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
};
const STATUS_COR: Record<string, { bg: string; cor: string }> = {
  aberto: { bg: '#F7E4DA', cor: '#B6512E' },
  em_andamento: { bg: '#F6E7C8', cor: '#C98A1F' },
  resolvido: { bg: '#DEE9E1', cor: '#43715B' },
};

type Problema = {
  id: string;
  titulo: string;
  categoria: string;
  local: string;
  descricao: string;
  status: string;
};

export default function ProblemasScreen() {
  const { condominioId } = useMeuCondominio();
  const [userId, setUserId] = useState<string | null>(null);
  const [lista, setLista] = useState<Problema[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('problemas')
      .select('id, titulo, categoria, local, descricao, status')
      .order('criado_em', { ascending: false });

    if (error) {
      Alert.alert('Erro ao carregar problemas', error.message);
      return;
    }
    setLista(data ?? []);
  }, []);

  useEffect(() => {
    if (condominioId) carregar();
  }, [condominioId, carregar]);

  async function enviar() {
    if (!titulo.trim() || !local.trim() || !descricao.trim() || !condominioId || !userId) return;

    const { error } = await supabase.from('problemas').insert({
      titulo: titulo.trim(),
      local: local.trim(),
      descricao: descricao.trim(),
      categoria,
      condominio_id: condominioId,
      autor_id: userId,
    });

    if (error) {
      Alert.alert('Erro ao relatar problema', error.message);
      return;
    }

    setTitulo('');
    setLocal('');
    setDescricao('');
    setMostrarForm(false);
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
        <Button title="+ Relatar problema" onPress={() => setMostrarForm(true)} />
      ) : (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Título (ex: Vazamento no hall)"
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
            style={styles.input}
            placeholder="Local (ex: Bloco B, 6º andar)"
            value={local}
            onChangeText={setLocal}
          />
          <TextInput
            style={[styles.input, { minHeight: 70 }]}
            placeholder="O que está acontecendo?"
            value={descricao}
            onChangeText={setDescricao}
            multiline
          />
          <View style={styles.row}>
            <Button title="Cancelar" onPress={() => setMostrarForm(false)} color="#6B665D" />
            <Button title="Relatar" onPress={enviar} />
          </View>
        </View>
      )}

      <FlatList
        style={{ marginTop: 12 }}
        data={lista}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhum problema relatado ainda.</Text>}
        renderItem={({ item }) => {
          const cor = STATUS_COR[item.status] ?? STATUS_COR.aberto;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titulo}>{item.titulo}</Text>
                  <Text style={styles.meta}>{item.categoria} · {item.local}</Text>
                </View>
                <View style={[styles.status, { backgroundColor: cor.bg }]}>
                  <Text style={[styles.statusTexto, { color: cor.cor }]}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.descricao}>{item.descricao}</Text>
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
  titulo: { fontWeight: '700', fontSize: 15, color: '#211F1B' },
  meta: { fontSize: 12, color: '#6B665D', marginTop: 2 },
  status: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 },
  statusTexto: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  descricao: { fontSize: 13, color: '#6B665D', marginTop: 8, lineHeight: 19 },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 30 },
});
