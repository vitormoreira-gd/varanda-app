import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Pressable, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio, Cargo } from '../lib/useMeuCondominio';

const PAPEL_LABEL: Record<string, string> = {
  proprietario: 'proprietário',
  inquilino: 'inquilino',
  sindico: 'síndico',
};

const CARGO_LABEL: Record<Cargo, string> = {
  subsindico: 'subsíndico',
  conselho: 'conselho fiscal',
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
  const { condominioId, ehSindico } = useMeuCondominio();
  const [linhas, setLinhas] = useState<LinhaUnidade[]>([]);
  const [cargos, setCargos] = useState<Record<string, Cargo>>({});
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

    const { data: cargosData, error: erroCargos } = await supabase
      .from('cargos')
      .select('usuario_id, cargo')
      .eq('condominio_id', condominioId);

    if (erroCargos) {
      Alert.alert('Erro ao carregar cargos', erroCargos.message);
      return;
    }

    const mapa: Record<string, Cargo> = {};
    (cargosData ?? []).forEach((c) => (mapa[c.usuario_id] = c.cargo as Cargo));
    setCargos(mapa);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  // Atribuir cargo é o único poder que o subsíndico NÃO herda, mesmo tendo
  // herdado governança: sem isso ele se promoveria sozinho e não haveria
  // caminho de volta. Por isso aqui a checagem é ehSindico, não podeGerir —
  // e a policy do banco diz a mesma coisa.
  function abrirCargo(m: Morador) {
    if (!ehSindico) return;

    if (m.papel === 'sindico') {
      Alert.alert('Já é síndico', 'O síndico não recebe cargo — ele já tem tudo.');
      return;
    }
    if (m.status !== 'aprovado') {
      Alert.alert('Vínculo pendente', 'Aprove o vínculo desta pessoa antes de dar um cargo a ela.');
      return;
    }

    const atual = cargos[m.usuario_id] ?? null;
    const nome = m.usuarios?.nome ?? 'Este morador';
    const explicacao =
      'O subsíndico faz tudo que o síndico faz, menos dar cargo. O conselho fiscal só lê.';

    const botoes: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (atual) {
      const outro: Cargo = atual === 'subsindico' ? 'conselho' : 'subsindico';
      botoes.push({
        text: 'Tornar ' + CARGO_LABEL[outro],
        onPress: () => definirCargo(m.usuario_id, outro),
      });
      botoes.push({
        text: 'Remover cargo',
        style: 'destructive',
        onPress: () => definirCargo(m.usuario_id, null),
      });
    } else {
      botoes.push({ text: 'Subsíndico', onPress: () => definirCargo(m.usuario_id, 'subsindico') });
      botoes.push({ text: 'Conselho fiscal', onPress: () => definirCargo(m.usuario_id, 'conselho') });
    }
    botoes.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert(
      nome,
      atual ? 'Hoje é ' + CARGO_LABEL[atual] + '. ' + explicacao : explicacao,
      botoes
    );
  }

  async function definirCargo(usuarioId: string, cargo: Cargo | null) {
    if (!condominioId) return;

    if (cargo === null) {
      // Delete bloqueado por RLS devolve zero linhas, não erro (armadilha nº4).
      const { data, error } = await supabase
        .from('cargos')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('condominio_id', condominioId)
        .select();

      if (error) {
        Alert.alert('Erro ao remover cargo', error.message);
        return;
      }
      if (!data || data.length === 0) {
        Alert.alert('Não consegui remover', 'O banco recusou. Só o síndico mexe em cargos.');
        return;
      }
    } else {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('cargos')
        .upsert(
          {
            condominio_id: condominioId,
            usuario_id: usuarioId,
            cargo,
            atribuido_por: userData.user?.id,
          },
          { onConflict: 'condominio_id,usuario_id' }
        )
        .select();

      if (error) {
        Alert.alert('Erro ao definir cargo', error.message);
        return;
      }
      if (!data || data.length === 0) {
        Alert.alert('Não consegui', 'O banco recusou. Só o síndico mexe em cargos.');
        return;
      }
    }
    carregar();
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
          {ehSindico && (
            <Text style={styles.resumoDica}>Toque num morador para dar ou tirar um cargo.</Text>
          )}
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
            item.moradores.map((m) => {
              const cargo = cargos[m.usuario_id];
              return (
                <Pressable
                  key={m.usuario_id}
                  style={styles.morador}
                  onPress={() => abrirCargo(m)}
                  disabled={!ehSindico}
                >
                  <Text style={styles.nome}>{m.usuarios?.nome ?? 'Sem nome'}</Text>
                  <Text style={styles.papel}>{PAPEL_LABEL[m.papel] ?? m.papel}</Text>
                  {cargo && <Text style={styles.cargo}>{CARGO_LABEL[cargo]}</Text>}
                  {m.status === 'pendente' && <Text style={styles.pendente}>pendente</Text>}
                </Pressable>
              );
            })
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
  resumoDica: { fontSize: 11, color: '#1B4B66', marginTop: 6 },
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
  cargo: { fontSize: 10, color: '#1B4B66', fontWeight: '700', textTransform: 'uppercase' },
  pendente: {
    fontSize: 10,
    color: '#C98A1F',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 30 },
});
