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

export default function ModerarScreen({
  tipo,
  somenteLeitura = false,
}: {
  tipo: 'sugestoes' | 'problemas';
  somenteLeitura?: boolean;
}) {
  const [lista, setLista] = useState<any[]>([]);
  const [verArquivados, setVerArquivados] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const opcoes = tipo === 'sugestoes' ? SUGESTAO_STATUS : PROBLEMA_STATUS;
  const labels = tipo === 'sugestoes' ? SUGESTAO_LABEL : PROBLEMA_LABEL;

  const carregar = useCallback(async () => {
    const colunas =
      tipo === 'sugestoes'
        ? 'id, titulo, descricao, status, arquivado_em'
        : 'id, titulo, categoria, local, status, arquivado_em';

    let query = supabase.from(tipo).select(colunas);
    query = verArquivados
      ? query.not('arquivado_em', 'is', null)
      : query.is('arquivado_em', null);

    const { data, error } = await query.order('criado_em', { ascending: false });

    if (error) {
      Alert.alert('Erro ao carregar', error.message);
      return;
    }
    setLista(data ?? []);
  }, [tipo, verArquivados]);

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
      const { error: erroHistorico } = await supabase.from('historico_status').insert({
        problema_id: id,
        status: novoStatus,
        autor_id: userData.user?.id,
      });
      // O histórico alimenta o "aberto há X dias" na tela do morador; se ele
      // falha calado, o contador congela e ninguém entende por quê.
      if (erroHistorico) Alert.alert('Status mudou, mas o histórico falhou', erroHistorico.message);
    }

    carregar();
  }

  async function alternarArquivo(id: string, arquivado: boolean) {
    const { data, error } = await supabase
      .from(tipo)
      .update({ arquivado_em: arquivado ? null : new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      Alert.alert(arquivado ? 'Erro ao desarquivar' : 'Erro ao arquivar', error.message);
      return;
    }
    // Update bloqueado por RLS não devolve erro, devolve zero linhas.
    if (!data || data.length === 0) {
      Alert.alert('Não consegui', 'O banco recusou a alteração. Confira se você é síndico deste condomínio.');
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
    <View style={styles.container}>
      <View style={styles.filtro}>
        {[false, true].map((arquivado) => (
          <Pressable
            key={String(arquivado)}
            onPress={() => setVerArquivados(arquivado)}
            style={[styles.filtroOpcao, verArquivados === arquivado && styles.filtroOpcaoAtiva]}
          >
            <Text
              style={[styles.filtroTexto, verArquivados === arquivado && styles.filtroTextoAtivo]}
            >
              {arquivado ? 'Arquivadas' : 'Ativas'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.vazio}>
            {verArquivados ? 'Nada arquivado ainda.' : 'Nada por aqui ainda.'}
          </Text>
        }
        renderItem={({ item }) => {
          const arquivado = !!item.arquivado_em;
          return (
            <View style={styles.card}>
              <Text style={styles.titulo}>{item.titulo}</Text>
              {tipo === 'problemas' && (
                <Text style={styles.meta}>
                  {item.categoria} · {item.local}
                </Text>
              )}
              {tipo === 'sugestoes' && <Text style={styles.descricao}>{item.descricao}</Text>}

              {/* Sem permissão de escrita o status vira etiqueta, não botão:
                  o RLS recusaria o update e a recusa não gera erro visível. */}
              {somenteLeitura ? (
                <View style={styles.opcoes}>
                  <View style={[styles.opcao, styles.opcaoAtiva]}>
                    <Text style={[styles.opcaoTexto, styles.opcaoTextoAtiva]}>
                      {labels[item.status]}
                    </Text>
                  </View>
                </View>
              ) : (
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
              )}

              {!somenteLeitura && (
                <Pressable onPress={() => alternarArquivo(item.id, arquivado)} hitSlop={6}>
                  <Text style={styles.arquivar}>{arquivado ? 'Desarquivar' : 'Arquivar'}</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE6', paddingHorizontal: 16, paddingTop: 12 },
  filtro: {
    flexDirection: 'row',
    backgroundColor: '#E4DFD2',
    borderRadius: 12,
    padding: 3,
    gap: 3,
    marginBottom: 12,
  },
  filtroOpcao: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  filtroOpcaoAtiva: { backgroundColor: '#fff' },
  filtroTexto: { fontSize: 12, color: '#6B665D', fontWeight: '600' },
  filtroTextoAtivo: { color: '#1B4B66' },
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
  opcao: {
    borderWidth: 1,
    borderColor: '#E4DFD2',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  opcaoAtiva: { backgroundColor: '#1B4B66', borderColor: '#1B4B66' },
  opcaoTexto: { fontSize: 12, color: '#6B665D' },
  opcaoTextoAtiva: { color: '#fff', fontWeight: '600' },
  arquivar: { fontSize: 12, color: '#B6512E', marginTop: 12 },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 30 },
});
