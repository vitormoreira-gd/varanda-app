import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';

const PAPEL_LABEL: Record<string, string> = {
  proprietario: 'proprietário',
  inquilino: 'inquilino',
  sindico: 'síndico',
};

type Unidade = { id: string; bloco: string | null; numero: string };

type Morador = {
  usuario_id: string;
  unidade_id: string;
  papel: string;
  status: string;
  usuarios: { nome: string } | null;
};

type LinhaUnidade = Unidade & { moradores: Morador[] };

/**
 * Quem está dentro do app, unidade por unidade. As unidades vazias aparecem
 * de propósito: pro síndico, "quem ainda não entrou" é a informação mais útil
 * da tela — é a lista de quem precisa receber o convite de novo.
 */
export default function CondominosScreen() {
  const { condominioId } = useMeuCondominio();
  const [linhas, setLinhas] = useState<LinhaUnidade[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    if (!condominioId) return;

    const { data: unidades, error: erroUnidades } = await supabase
      .from('unidades')
      .select('id, bloco, numero')
      .eq('condominio_id', condominioId);

    if (erroUnidades) {
      Alert.alert('Erro ao carregar unidades', erroUnidades.message);
      return;
    }

    // A policy "sindico ve vinculos do condominio" devolve os vínculos de
    // todo o condomínio — aqui isso é exatamente o que queremos.
    const { data: vinculos, error: erroVinculos } = await supabase
      .from('vinculos')
      .select('usuario_id, unidade_id, papel, status, usuarios!usuario_id(nome)');

    if (erroVinculos) {
      Alert.alert('Erro ao carregar moradores', erroVinculos.message);
      return;
    }

    const moradores = (vinculos ?? []) as unknown as Morador[];
    const porUnidade: Record<string, Morador[]> = {};
    moradores.forEach((m) => {
      (porUnidade[m.unidade_id] ??= []).push(m);
    });

    const lista: LinhaUnidade[] = (unidades ?? []).map((u) => ({
      ...u,
      moradores: porUnidade[u.id] ?? [],
    }));

    lista.sort((a, b) => {
      const bloco = (a.bloco ?? '').localeCompare(b.bloco ?? '');
      if (bloco !== 0) return bloco;
      const na = parseInt(a.numero, 10);
      const nb = parseInt(b.numero, 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      return a.numero.localeCompare(b.numero);
    });

    setLinhas(lista);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  const totalMoradores = linhas.reduce(
    (soma, l) => soma + l.moradores.filter((m) => m.status === 'aprovado').length,
    0
  );
  const ocupadas = linhas.filter((l) =>
    l.moradores.some((m) => m.status === 'aprovado')
  ).length;
  const pendentes = linhas.reduce(
    (soma, l) => soma + l.moradores.filter((m) => m.status === 'pendente').length,
    0
  );

  return (
    <FlatList
      style={styles.container}
      data={linhas}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={styles.resumo}>
          <Text style={styles.resumoNumero}>
            {totalMoradores} morador{totalMoradores === 1 ? '' : 'es'}
          </Text>
          <Text style={styles.resumoTexto}>
            {ocupadas} de {linhas.length} unidade{linhas.length === 1 ? '' : 's'} com alguém no app
            {pendentes > 0 ? ` · ${pendentes} aguardando aprovação` : ''}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.vazio}>
          Nenhuma unidade cadastrada ainda. Cadastre as unidades na aba Unidades.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.unidade}>
            {item.bloco ? `${item.bloco} · ` : ''}
            {item.numero}
          </Text>

          {item.moradores.length === 0 ? (
            <Text style={styles.ninguem}>ninguém entrou ainda</Text>
          ) : (
            item.moradores.map((m) => (
              <View key={m.usuario_id} style={styles.morador}>
                <Text style={styles.nome}>{m.usuarios?.nome ?? 'Sem nome'}</Text>
                <Text style={styles.papel}>{PAPEL_LABEL[m.papel] ?? m.papel}</Text>
                {m.status === 'pendente' && <Text style={styles.pendente}>pendente</Text>}
              </View>
            ))
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE6', paddingHorizontal: 16, paddingTop: 12 },
  resumo: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFD2',
    padding: 14,
    marginBottom: 12,
  },
  resumoNumero: { fontSize: 20, fontWeight: '800', color: '#1B4B66' },
  resumoTexto: { fontSize: 12, color: '#6B665D', marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFD2',
    padding: 14,
    marginBottom: 8,
  },
  unidade: { fontSize: 14, fontWeight: '700', color: '#211F1B', marginBottom: 6 },
  ninguem: { fontSize: 12, color: '#B6512E' },
  morador: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  nome: { fontSize: 13, color: '#211F1B', flexShrink: 1 },
  papel: { fontSize: 11, color: '#6B665D' },
  pendente: {
    fontSize: 10,
    color: '#C98A1F',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 30 },
});
