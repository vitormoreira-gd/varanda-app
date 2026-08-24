import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { cores, espaco } from '../lib/tema';
import { Botao, Cartao, Vazio } from '../components/ui';

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
    // Update recusado por RLS devolve zero linhas, não erro (armadilha nº4).
    const { data, error } = await supabase
      .from('vinculos')
      .update({ status: 'aprovado' })
      .eq('id', id)
      .select();

    if (error) {
      Alert.alert('Erro ao aprovar', error.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Não consegui aprovar', 'O banco recusou a alteração.');
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
      contentContainerStyle={{ paddingBottom: espaco.xxl }}
      ListEmptyComponent={
        <Vazio
          icone="✅"
          titulo="Nenhuma solicitação pendente"
          texto="Quem entrar com um código de convite aparece aqui esperando aprovação."
        />
      }
      renderItem={({ item }) => (
        <Cartao>
          <View style={styles.linha}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{item.usuarios?.nome ?? 'Sem nome'}</Text>
              <Text style={styles.meta}>
                {item.unidades
                  ? [item.unidades.bloco, `apto ${item.unidades.numero}`]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Unidade não encontrada'}
                {' · '}
                {item.papel}
              </Text>
            </View>
            <Botao titulo="Aprovar" pequeno onPress={() => aprovar(item.id)} />
          </View>
        </Cartao>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  nome: { fontWeight: '700', fontSize: 14, color: cores.texto },
  meta: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
});
