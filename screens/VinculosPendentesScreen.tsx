import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';

type Vinculo = {
  id: string;
  papel: string;
  unidades: { bloco: string | null; numero: string } | null;
  usuarios: { nome: string } | null;
};

export default function VinculosPendentesScreen() {
  const [lista, setLista] = useState<Vinculo[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('vinculos')
      .select('id, papel, unidades(bloco, numero), usuarios!usuario_id(nome)')
      .eq('status', 'pendente');

    if (error) {
      Alert.alert('Erro ao carregar vínculos', error.message);
      return;
    }
    setLista((data as unknown as Vinculo[]) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function aprovar(id: string) {
    const { error } = await supabase.from('vinculos').update({ status: 'aprovado' }).eq('id', id);
    if (error) {
      Alert.alert('Erro ao aprovar', error.message);
      return;
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
      ListEmptyComponent={<Text style={styles.vazio}>Nenhuma solicitação pendente.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nome}>{item.usuarios?.nome ?? 'Sem nome'}</Text>
            <Text style={styles.meta}>
              {item.unidades ? `Bloco ${item.unidades.bloco ?? '-'}, apto ${item.unidades.numero}` : 'Unidade não encontrada'}
              {' · '}
              {item.papel}
            </Text>
          </View>
          <Pressable style={styles.aprovarBtn} onPress={() => aprovar(item.id)}>
            <Text style={styles.aprovarTexto}>Aprovar</Text>
          </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nome: { fontWeight: '700', fontSize: 14, color: '#211F1B' },
  meta: { fontSize: 12, color: '#6B665D', marginTop: 2 },
  aprovarBtn: { backgroundColor: '#43715B', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 },
  aprovarTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 30 },
});
