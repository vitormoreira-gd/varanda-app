// Fila de manutenção do síndico: mudar status e arquivar.
//
// Era genérica sobre `tipo: 'sugestoes' | 'problemas'`. Sugestões saiu do app
// em 21/08/2026 (virou post no Mural), então sobrou um tipo só — e com ele a
// generalização, que agora só atrapalhava a leitura.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { cores, espaco } from '../lib/tema';
import { Cartao, Chip, Etiqueta, Link, Seletor, Tom, Vazio } from '../components/ui';
import { useAvisoRapido } from '../components/AvisoRapido';

const STATUS = ['aberto', 'em_andamento', 'resolvido'];

const LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
};

const TOM: Record<string, Tom> = {
  aberto: 'critico',
  em_andamento: 'atencao',
  resolvido: 'ok',
};

const FILTROS = [
  { chave: 'ativas', label: 'Ativas' },
  { chave: 'arquivadas', label: 'Arquivadas' },
] as const;

type Filtro = (typeof FILTROS)[number]['chave'];

type Pedido = {
  id: string;
  titulo: string;
  categoria: string | null;
  local: string | null;
  status: string;
  area_comum: boolean;
  arquivado_em: string | null;
};

export default function ModerarScreen({ somenteLeitura = false }: { somenteLeitura?: boolean }) {
  const { mostrar } = useAvisoRapido();
  const [lista, setLista] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('ativas');
  const [refreshing, setRefreshing] = useState(false);
  const verArquivados = filtro === 'arquivadas';

  const carregar = useCallback(async () => {
    let query = supabase
      .from('problemas')
      .select('id, titulo, categoria, local, status, area_comum, arquivado_em');
    query = verArquivados
      ? query.not('arquivado_em', 'is', null)
      : query.is('arquivado_em', null);

    const { data, error } = await query.order('criado_em', { ascending: false });

    if (error) {
      Alert.alert('Erro ao carregar', error.message);
      return;
    }
    setLista((data as unknown as Pedido[]) ?? []);
  }, [verArquivados]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarStatus(id: string, novoStatus: string) {
    const { error } = await supabase.from('problemas').update({ status: novoStatus }).eq('id', id);
    if (error) {
      Alert.alert('Erro ao atualizar status', error.message);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { error: erroHistorico } = await supabase.from('historico_status').insert({
      problema_id: id,
      status: novoStatus,
      autor_id: userData.user?.id,
    });
    // O histórico alimenta o "aberto há X dias" na tela do morador; se ele
    // falha calado, o contador congela e ninguém entende por quê.
    if (erroHistorico) {
      Alert.alert('Status mudou, mas o histórico falhou', erroHistorico.message);
      carregar();
      return;
    }

    mostrar(`Marcado como ${LABEL[novoStatus].toLowerCase()}`);
    carregar();
  }

  async function alternarArquivo(id: string, arquivado: boolean) {
    const { data, error } = await supabase
      .from('problemas')
      .update({ arquivado_em: arquivado ? null : new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      Alert.alert(arquivado ? 'Erro ao desarquivar' : 'Erro ao arquivar', error.message);
      return;
    }
    // Update bloqueado por RLS não devolve erro, devolve zero linhas.
    if (!data || data.length === 0) {
      Alert.alert(
        'Não consegui',
        'O banco recusou a alteração. Confira se você é síndico deste condomínio.'
      );
      return;
    }
    mostrar(arquivado ? 'Desarquivado' : 'Arquivado');
    carregar();
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Seletor opcoes={FILTROS} valor={filtro} aoTrocar={setFiltro} />

      <FlatList
        style={{ marginTop: espaco.md }}
        data={lista}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: espaco.xxl, paddingHorizontal: espaco.lg }}
        ListEmptyComponent={
          <Vazio
            icone={verArquivados ? '🗄️' : '🔧'}
            titulo={verArquivados ? 'Nada arquivado ainda' : 'Nenhum pedido ativo no momento'}
            texto={
              verArquivados
                ? 'O que é arquivado sai da vista dos moradores, mas nunca é apagado.'
                : undefined
            }
          />
        }
        renderItem={({ item }) => {
          const arquivado = !!item.arquivado_em;
          return (
            <Cartao>
              <Text style={styles.titulo}>{item.titulo}</Text>
              <Text style={styles.meta}>
                {[item.categoria, item.local].filter(Boolean).join(' · ')}
              </Text>

              {/* Sem isto o síndico responderia no Mural achando que o
                  prédio já sabe. Ninguém sabe: só ele e o autor veem. */}
              {!item.area_comum && (
                <View style={styles.privado}>
                  <Etiqueta texto="Só na unidade" tom="info" />
                </View>
              )}

              {/* Sem permissão de escrita o status vira etiqueta, não botão:
                  o RLS recusaria o update e a recusa não gera erro visível. */}
              {somenteLeitura ? (
                <View style={{ marginTop: espaco.md }}>
                  <Etiqueta
                    texto={LABEL[item.status] ?? item.status}
                    tom={TOM[item.status] ?? 'neutro'}
                  />
                </View>
              ) : (
                <>
                  <Text style={styles.rotulo}>Mudar status para</Text>
                  <View style={styles.opcoes}>
                    {STATUS.map((s) => (
                      <Chip
                        key={s}
                        titulo={LABEL[s]}
                        ativo={item.status === s}
                        onPress={() => mudarStatus(item.id, s)}
                      />
                    ))}
                  </View>
                  <View style={{ marginTop: espaco.md, alignSelf: 'flex-start' }}>
                    <Link
                      titulo={arquivado ? 'Desarquivar' : 'Arquivar'}
                      tom={arquivado ? 'primaria' : 'perigo'}
                      onPress={() => alternarArquivo(item.id, arquivado)}
                    />
                  </View>
                </>
              )}
            </Cartao>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  titulo: { fontWeight: '700', fontSize: 17, color: cores.texto },
  meta: { fontSize: 14, color: cores.textoFraco, marginTop: 2 },
  privado: { marginTop: espaco.sm, alignSelf: 'flex-start' },
  rotulo: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: cores.textoFraco,
    marginTop: espaco.md,
    marginBottom: espaco.sm,
  },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
});
