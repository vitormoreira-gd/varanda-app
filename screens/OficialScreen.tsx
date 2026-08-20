import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';

type Aviso = { id: string; titulo: string; texto: string; fixado: boolean; criado_em: string };
type Votacao = { id: string; titulo: string; descricao: string | null; opcoes: string[]; data_fim: string };
type Reuniao = { id: string; titulo: string; data_hora: string; local: string | null; pauta: string | null };

export default function OficialScreen() {
  const { unidadeId, loading: carregandoVinculo, erro: erroVinculo } = useMeuCondominio();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [votacoes, setVotacoes] = useState<Votacao[]>([]);
  const [meusVotos, setMeusVotos] = useState<Record<string, string>>({});
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [meusRsvps, setMeusRsvps] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const carregar = useCallback(async () => {
    const { data: avisosData, error: erroAvisos } = await supabase
      .from('avisos')
      .select('id, titulo, texto, fixado, criado_em')
      .order('fixado', { ascending: false })
      .order('criado_em', { ascending: false });
    if (erroAvisos) Alert.alert('Erro ao carregar avisos', erroAvisos.message);
    setAvisos(avisosData ?? []);

    const { data: votacoesData, error: erroVotacoes } = await supabase
      .from('votacoes')
      .select('id, titulo, descricao, opcoes, data_fim')
      .gt('data_fim', new Date().toISOString())
      .order('data_fim', { ascending: true });
    if (erroVotacoes) Alert.alert('Erro ao carregar votações', erroVotacoes.message);
    setVotacoes(votacoesData ?? []);

    if (unidadeId) {
      const { data: votosData, error: erroVotos } = await supabase
        .from('votos')
        .select('votacao_id, opcao')
        .eq('unidade_id', unidadeId);
      if (erroVotos) Alert.alert('Erro ao carregar seus votos', erroVotos.message);
      const mapa: Record<string, string> = {};
      (votosData ?? []).forEach((v) => (mapa[v.votacao_id] = v.opcao));
      setMeusVotos(mapa);
    }

    const { data: reunioesData, error: erroReunioes } = await supabase
      .from('reunioes')
      .select('id, titulo, data_hora, local, pauta')
      .order('data_hora', { ascending: true });
    if (erroReunioes) Alert.alert('Erro ao carregar reuniões', erroReunioes.message);
    setReunioes(reunioesData ?? []);

    if (userId) {
      const { data: rsvpsData, error: erroRsvps } = await supabase
        .from('rsvps')
        .select('reuniao_id')
        .eq('usuario_id', userId);
      if (erroRsvps) Alert.alert('Erro ao carregar confirmações', erroRsvps.message);
      setMeusRsvps(new Set((rsvpsData ?? []).map((r) => r.reuniao_id)));
    }
  }, [unidadeId, userId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (erroVinculo) Alert.alert('Erro ao identificar sua unidade', erroVinculo);
  }, [erroVinculo]);

  async function votar(votacaoId: string, opcao: string) {
    if (!unidadeId || !userId) {
      Alert.alert(
        'Não foi possível votar',
        'Não identifiquei sua unidade ainda. Feche e reabra o app e tente de novo.'
      );
      return;
    }
    const { error } = await supabase
      .from('votos')
      .insert({ votacao_id: votacaoId, unidade_id: unidadeId, usuario_id: userId, opcao });

    if (error) {
      Alert.alert('Erro ao votar', error.message);
      return;
    }
    carregar();
  }

  async function toggleRsvp(reuniaoId: string) {
    if (!userId) return;
    const confirmado = meusRsvps.has(reuniaoId);

    if (confirmado) {
      // .select() devolve as linhas removidas: RLS que bloqueia delete não
      // gera erro, gera lista vazia. Sem isso a falha é silenciosa.
      const { data, error } = await supabase
        .from('rsvps')
        .delete()
        .eq('reuniao_id', reuniaoId)
        .eq('usuario_id', userId)
        .select();

      if (error) {
        Alert.alert('Erro ao desmarcar presença', error.message);
        return;
      }
      if (!data || data.length === 0) {
        Alert.alert(
          'Não consegui desmarcar',
          'O banco recusou a remoção. Falta rodar db/patch-politicas-faltantes.sql (policy "desmarcar presenca").'
        );
        return;
      }
    } else {
      const { error } = await supabase
        .from('rsvps')
        .insert({ reuniao_id: reuniaoId, usuario_id: userId });

      if (error) {
        Alert.alert('Erro ao confirmar presença', error.message);
        return;
      }
    }
    carregar();
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  if (carregandoVinculo) {
    return (
      <View style={styles.center}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.secao}>Avisos</Text>
      {avisos.length === 0 && <Text style={styles.vazio}>Nenhum aviso no momento.</Text>}
      {avisos.map((a) => (
        <View key={a.id} style={[styles.card, a.fixado && styles.cardFixado]}>
          {a.fixado && <Text style={styles.tagFixado}>📌 fixado pelo síndico</Text>}
          <Text style={styles.titulo}>{a.titulo}</Text>
          <Text style={styles.texto}>{a.texto}</Text>
        </View>
      ))}

      <Text style={styles.secao}>Votações ativas</Text>
      {votacoes.length === 0 && <Text style={styles.vazio}>Nenhuma votação em andamento.</Text>}
      {votacoes.map((v) => {
        const meuVoto = meusVotos[v.id];
        return (
          <View key={v.id} style={styles.card}>
            <Text style={styles.titulo}>{v.titulo}</Text>
            {v.descricao && <Text style={styles.texto}>{v.descricao}</Text>}
            <Text style={styles.meta}>Encerra em {new Date(v.data_fim).toLocaleDateString('pt-BR')}</Text>
            <View style={styles.opcoes}>
              {v.opcoes.map((op) => (
                <Pressable
                  key={op}
                  disabled={!!meuVoto}
                  onPress={() => votar(v.id, op)}
                  style={[styles.opcao, meuVoto === op && styles.opcaoAtiva]}
                >
                  <Text style={[styles.opcaoTexto, meuVoto === op && styles.opcaoTextoAtiva]}>{op}</Text>
                </Pressable>
              ))}
            </View>
            {meuVoto && <Text style={styles.votado}>Seu voto: {meuVoto}</Text>}
          </View>
        );
      })}

      <Text style={styles.secao}>Reuniões</Text>
      {reunioes.length === 0 && <Text style={styles.vazio}>Nenhuma reunião agendada.</Text>}
      {reunioes.map((r) => {
        const confirmado = meusRsvps.has(r.id);
        const passada = new Date(r.data_hora) < new Date();
        return (
          <View key={r.id} style={styles.card}>
            <Text style={styles.titulo}>{r.titulo}</Text>
            <Text style={styles.meta}>
              {new Date(r.data_hora).toLocaleString('pt-BR')} {r.local ? `· ${r.local}` : ''}
              {passada ? ' · (já passou)' : ''}
            </Text>
            {r.pauta && <Text style={styles.texto}>{r.pauta}</Text>}
            <Pressable
              onPress={() => toggleRsvp(r.id)}
              style={[styles.rsvpBtn, confirmado && styles.rsvpBtnAtivo]}
            >
              <Text style={[styles.rsvpTexto, confirmado && styles.rsvpTextoAtivo]}>
                {confirmado ? 'Presença confirmada ✓' : 'Confirmar presença'}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE6', paddingHorizontal: 16, paddingTop: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  secao: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B665D', marginTop: 20, marginBottom: 8, fontWeight: '600' },
  vazio: { color: '#6B665D', fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E4DFD2' },
  cardFixado: { borderLeftWidth: 4, borderLeftColor: '#C98A1F' },
  tagFixado: { fontSize: 10, color: '#C98A1F', textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  titulo: { fontWeight: '700', fontSize: 15, color: '#211F1B' },
  texto: { fontSize: 13, color: '#6B665D', marginTop: 6, lineHeight: 19 },
  meta: { fontSize: 12, color: '#6B665D', marginTop: 4 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  opcao: { borderWidth: 1, borderColor: '#E4DFD2', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  opcaoAtiva: { backgroundColor: '#1B4B66', borderColor: '#1B4B66' },
  opcaoTexto: { fontSize: 12, color: '#6B665D' },
  opcaoTextoAtiva: { color: '#fff', fontWeight: '600' },
  votado: { fontSize: 12, color: '#43715B', marginTop: 8, fontWeight: '600' },
  rsvpBtn: { borderWidth: 1.5, borderColor: '#1B4B66', borderRadius: 20, paddingVertical: 7, alignItems: 'center', marginTop: 10 },
  rsvpBtnAtivo: { backgroundColor: '#1B4B66' },
  rsvpTexto: { fontSize: 12, color: '#1B4B66', fontWeight: '600' },
  rsvpTextoAtivo: { color: '#fff' },
});
