import { useCallback, useEffect, useRef, useState } from 'react';
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

// `aoContar` existe pro badge da barra de sub-abas em Gestao: quem ja faz a
// consulta e esta tela, entao ela devolve o numero em vez de o host repetir a
// mesma pergunta ao banco. Vive num ref, e nao nas dependencias do
// `carregar`, porque um pai que passasse uma arrow inline recriaria o
// callback a cada render e o efeito entraria em laco.
export default function VinculosPendentesScreen({
  aoContar,
}: {
  aoContar?: (quantidade: number) => void;
}) {
  const [lista, setLista] = useState<Vinculo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const aoContarRef = useRef(aoContar);
  aoContarRef.current = aoContar;

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('vinculos')
      .select('id, papel, unidades(bloco, numero), usuarios!usuario_id(nome)')
      .eq('status', 'pendente');

    if (error) {
      Alert.alert('Erro ao carregar vínculos', error.message);
      return;
    }
    const pendentes = (data as unknown as Vinculo[]) ?? [];
    setLista(pendentes);
    aoContarRef.current?.(pendentes.length);
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
