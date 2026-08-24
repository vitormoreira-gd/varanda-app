import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, Pressable, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio, Cargo } from '../lib/useMeuCondominio';
import { cores, espaco, raio } from '../lib/tema';
import { Cartao, Etiqueta, Vazio } from '../components/ui';

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

  const adesao = linhas.length > 0 ? Math.round((ocupadas / linhas.length) * 100) : 0;

  return (
    <FlatList
      style={styles.container}
      data={linhas}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: espaco.xxl }}
      ListHeaderComponent={
        <Cartao>
          {/* Adesão é a métrica que o trial condicional vai precisar medir.
              Aqui ela ainda é calculada na tela, não guardada em lugar nenhum. */}
          <View style={styles.numeros}>
            <Numero valor={`${adesao}%`} rotulo="de adesão" destaque />
            <Numero valor={String(totalMoradores)} rotulo={totalMoradores === 1 ? 'morador' : 'moradores'} />
            <Numero valor={`${ocupadas}/${linhas.length}`} rotulo="unidades" />
          </View>

          {pendentes > 0 && (
            <View style={styles.pendentes}>
              <Etiqueta
                texto={`${pendentes} aguardando aprovação`}
                tom="atencao"
              />
            </View>
          )}

          {ehSindico && (
            <Text style={styles.dica}>Toque num morador para dar ou tirar um cargo.</Text>
          )}
        </Cartao>
      }
      ListEmptyComponent={
        <Vazio
          icone="🏢"
          titulo="Nenhuma unidade cadastrada"
          texto="Cadastre os apartamentos na aba Unidades para começar a convidar moradores."
        />
      }
      renderItem={({ item }) => (
        <Cartao>
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
                  style={({ pressed }) => [styles.morador, pressed && ehSindico && styles.pressionado]}
                  onPress={() => abrirCargo(m)}
                  disabled={!ehSindico}
                >
                  <Text style={styles.nome} numberOfLines={1}>
                    {m.usuarios?.nome ?? 'Sem nome'}
                  </Text>
                  <Text style={styles.papel}>{PAPEL_LABEL[m.papel] ?? m.papel}</Text>
                  {cargo && <Etiqueta texto={CARGO_LABEL[cargo]} tom="info" />}
                  {m.status === 'pendente' && <Etiqueta texto="pendente" tom="atencao" />}
                </Pressable>
              );
            })
          )}
        </Cartao>
      )}
    />
  );
}

function Numero({
  valor,
  rotulo,
  destaque,
}: {
  valor: string;
  rotulo: string;
  destaque?: boolean;
}) {
  return (
    <View style={styles.numero}>
      <Text style={[styles.numeroValor, destaque && styles.numeroDestaque]}>{valor}</Text>
      <Text style={styles.numeroRotulo}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg },
  numeros: { flexDirection: 'row', gap: espaco.lg },
  numero: { flex: 1 },
  numeroValor: { fontSize: 20, fontWeight: '800', color: cores.texto },
  numeroDestaque: { color: cores.primaria, fontSize: 24 },
  numeroRotulo: { fontSize: 11, color: cores.textoFraco, marginTop: 2 },
  pendentes: { marginTop: espaco.md },
  dica: { fontSize: 11, color: cores.primaria, marginTop: espaco.md },
  unidade: { fontSize: 14, fontWeight: '800', color: cores.texto, marginBottom: espaco.sm },
  ninguem: { fontSize: 12, color: cores.perigo },
  morador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    paddingVertical: espaco.xs,
    borderRadius: raio.sm,
  },
  pressionado: { backgroundColor: cores.superficieAlt },
  nome: { fontSize: 13, color: cores.texto, fontWeight: '600', flexShrink: 1 },
  papel: { fontSize: 11, color: cores.textoFraco },
});
