import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';

const SUGESTAO_STATUS = ['analise', 'aprovada', 'implementada'];
const SUGESTAO_LABEL: Record<string, string> = {
  analise: 'Em análise',
  aprovada: 'Aprovada',
  implementada: 'Implementada',
};

const PROBLEMA_STATUS = ['aberto', 'em_andamento', 'resolvido'];
const PROBLEMA_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
};

export default function ModerarScreen({ tipo }: { tipo: 'sugestoes' | 'problemas' }) {
  const [lista, setLista] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const opcoes = tipo === 'sugestoes' ? SUGESTAO_STATUS : PROBLEMA_STATUS;
  const labels = tipo === 'sugestoes' ? SUGESTAO_LABEL : PROBLEMA_LABEL;

  const carregar = useCallback(async () => {
    const colunas =
      tipo === 'sugestoes'
        ? 'id, titulo, descricao, status'
        : 'id, titulo, categoria, local, status';

    const { data, error } = await supabase
      .from(tipo)
      .select(colunas)
      .order('criado_em', { ascending: false });

    if (error) {
      Alert.alert('Erro ao carregar', error.message);
      return;
    }
    setLista(data ?? []);
  }, [tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarStatus(id: string, novoStatus: string) {
    const { error } = await supabase.from(tipo).update({ status: novoStatus }).eq('id', id);
    if (error) {
      Alert.alert('Erro ao atualizar status', error.message);
      return;
    }

    if (tipo === 'problemas') {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('historico_status').insert({
        problema_id: id,
        status: novoStatus,
        autor_id: userData.user?.id,
      });
    }

    carregar();
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  return (
    <FlatList
      style={styles.container}
      data={lista}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 40, paddingTop: 12 }}
      ListEmptyComponent={<Text style={styles.vazio}>Nada por aqui ainda.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.titulo}>{item.titulo}</Text>
          {tipo === 'problemas' && (
            <Text style={styles.meta}>{item.categoria} · {item.local}</Text>
          )}
          {tipo === 'sugestoes' && <Text style={styles.descricao}>{item.descricao}</Text>}

          <View style={styles.opcoes}>
            {opcoes.map((s) => (
              <Pressable
                key={s}
                onPress={() => mudarStatus(item.id, s)}
                style={[styles.opcao, item.status === s && styles.opcaoAtiva]}
              >
                <Text style={[styles.opcaoTexto, item.status === s && styles.opcaoTextoAtiva]}>
                  {labels[s]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE6', paddingHorizontal: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E4DFD2',
  },
  titulo: { fontWeight: '700', fontSize: 15, color: '#211F1B' },
  meta: { fontSize: 12, color: '#6B665D', marginTop: 2 },
  descricao: { fontSize: 13, color: '#6B665D', marginTop: 4 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  opcao: { borderWidth: 1, borderColor: '#E4DFD2', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  opcaoAtiva: { backgroundColor: '#1B4B66', borderColor: '#1B4B66' },
  opcaoTexto: { fontSize: 12, color: '#6B665D' },
  opcaoTextoAtiva: { color: '#fff', fontWeight: '600' },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 30 },
});
