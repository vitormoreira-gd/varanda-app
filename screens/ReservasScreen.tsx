import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { hojeISO, paraDataISO, formatarDataCurta } from '../lib/datas';
import { cores, espaco } from '../lib/tema';
import { Botao, Campo, Carregando, Cartao, Etiqueta, Link, Tom, Vazio } from '../components/ui';
import Calendario from '../components/Calendario';
import { useAvisoRapido } from '../components/AvisoRapido';

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};
const STATUS_TOM: Record<string, Tom> = {
  pendente: 'atencao',
  aprovada: 'ok',
  recusada: 'critico',
};

type Reserva = {
  id: string;
  data: string;
  status: string;
  observacao: string | null;
  usuario_id: string;
  unidades: { bloco: string | null; numero: string } | null;
  usuarios: { nome: string } | null;
};

export default function ReservasScreen({ atualizacao }: { atualizacao?: number }) {
  const { condominioId, podeGerir } = useMeuCondominio();
  const { mostrar } = useAvisoRapido();
  const [userId, setUserId] = useState<string | null>(null);
  const [lista, setLista] = useState<Reserva[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [decidindo, setDecidindo] = useState<string | null>(null);

  const ehSindico = podeGerir;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // A consulta continua sem filtro de unidade: quem filtra é a policy. Pro
  // morador voltam só as reservas da própria unidade; pra quem gere, todas.
  // Fazer o filtro aqui também seria repetir a regra em dois lugares, e é o
  // banco que manda — a lista fechou porque o calendário passou a entregar a
  // disponibilidade, não porque a tela deixou de exibir.
  const carregar = useCallback(async () => {
    if (!condominioId) return;

    const { data, error } = await supabase
      .from('reservas')
      .select(
        'id, data, status, observacao, usuario_id, unidades!unidade_id(bloco, numero), usuarios!usuario_id(nome)'
      )
      .gte('data', hojeISO())
      .order('data', { ascending: true });

    if (error) {
      Alert.alert('Erro ao carregar reservas', error.message);
      return;
    }
    setLista((data as unknown as Reserva[]) ?? []);
  }, [condominioId]);

  // `atualizacao` é incrementado pelo host quando o botão + cria uma reserva.
  useEffect(() => {
    carregar();
  }, [carregar, atualizacao]);

  async function decidir(reserva: Reserva, aprovar: boolean) {
    setDecidindo(reserva.id);
    const { data, error } = await supabase
      .from('reservas')
      .update({ status: aprovar ? 'aprovada' : 'recusada' })
      .eq('id', reserva.id)
      .select();
    setDecidindo(null);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Já tem reserva nessa data', 'Outro pedido para o mesmo dia já foi aprovado.');
        carregar();
        return;
      }
      Alert.alert('Erro ao decidir', error.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Não consegui', 'O banco recusou a alteração. Confira se você é síndico.');
      return;
    }
    mostrar(aprovar ? 'Reserva aprovada' : 'Reserva recusada');
    carregar();
  }

  function confirmarCancelamento(reserva: Reserva) {
    Alert.alert('Cancelar pedido', `Cancelar sua reserva de ${formatarDataCurta(reserva.data)}?`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar pedido', style: 'destructive', onPress: () => cancelar(reserva) },
    ]);
  }

  async function cancelar(reserva: Reserva) {
    const { data, error } = await supabase
      .from('reservas')
      .delete()
      .eq('id', reserva.id)
      .select();

    if (error) {
      Alert.alert('Erro ao cancelar', error.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Não consegui cancelar', 'O banco recusou a remoção.');
      return;
    }
    mostrar('Pedido cancelado');
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
      contentContainerStyle={{ paddingBottom: 96 }}
      ListEmptyComponent={
        <Vazio
          icone="🎉"
          titulo={ehSindico ? 'Salão livre daqui pra frente' : 'Você não tem reserva marcada'}
          texto={
            ehSindico
              ? 'Nenhum pedido em aberto para as próximas datas.'
              : 'Toque no + para pedir uma data. O calendário mostra o que ainda está livre.'
          }
        />
      }
      renderItem={({ item }) => {
        const minha = item.usuario_id === userId;
        const unidade = item.unidades
          ? `${item.unidades.bloco ? `${item.unidades.bloco} ` : ''}${item.unidades.numero}`
          : '';

        return (
          <Cartao>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.data}>{formatarDataCurta(item.data)}</Text>
                <Text style={styles.quem}>
                  {item.usuarios?.nome ?? 'Vizinho'}
                  {unidade ? ` · ${unidade}` : ''}
                  {minha ? ' · você' : ''}
                </Text>
                {item.observacao ? (
                  <Text style={styles.observacao}>{item.observacao}</Text>
                ) : null}
              </View>
              <Etiqueta
                texto={STATUS_LABEL[item.status] ?? item.status}
                tom={STATUS_TOM[item.status] ?? 'neutro'}
              />
            </View>

            {ehSindico && item.status === 'pendente' && (
              <View style={styles.acoes}>
                <Botao
                  titulo="Aprovar"
                  pequeno
                  carregando={decidindo === item.id}
                  onPress={() => decidir(item, true)}
                  estilo={{ flex: 1 }}
                />
                <Botao
                  titulo="Recusar"
                  variante="perigo"
                  pequeno
                  disabled={decidindo === item.id}
                  onPress={() => decidir(item, false)}
                  estilo={{ flex: 1 }}
                />
              </View>
            )}

            {minha && item.status !== 'recusada' && (
              <View style={{ marginTop: espaco.md, alignSelf: 'flex-start' }}>
                <Link
                  titulo="Cancelar meu pedido"
                  tom="perigo"
                  onPress={() => confirmarCancelamento(item)}
                />
              </View>
            )}
          </Cartao>
        );
      }}
    />
  );
}

// ---------- FORMULÁRIO ----------

export function FormularioSalao({ aoConcluir }: { aoConcluir: () => void }) {
  const { condominioId, unidadeId } = useMeuCondominio();
  const { mostrar } = useAvisoRapido();
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [indisponiveis, setIndisponiveis] = useState<ReadonlySet<string>>(new Set());
  const [carregandoDatas, setCarregandoDatas] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // As datas bloqueadas vêm de duas origens porque os dois índices parciais
  // do banco são dois: `reservas_uma_aprovada_por_data` (o salão já está
  // reservado, por qualquer unidade) e `reservas_um_pedido_por_unidade_data`
  // (esta unidade já pediu esta data). Os dois estouram o mesmo 23505, então
  // se só um deles fosse desenhado o morador continuaria batendo no erro.
  //
  // A primeira precisa do RPC: desde que a lista do salão passou a mostrar só
  // as reservas da própria unidade, o cliente não consegue mais ler as dos
  // outros. `datas_ocupadas` devolve só as datas — sem unidade, sem nome, sem
  // motivo — que é exatamente o que o calendário precisa e nada além.
  useEffect(() => {
    if (!condominioId) return;
    let ativo = true;

    (async () => {
      const de = hojeISO();
      const ate = paraDataISO(new Date(new Date().getFullYear(), new Date().getMonth() + 8, 1));

      const [ocupadas, minhas] = await Promise.all([
        supabase.rpc('datas_ocupadas', {
          p_condominio_id: condominioId,
          p_de: de,
          p_ate: ate,
        }),
        // Sem unidade não há segundo índice pra respeitar — e mandar string
        // vazia como uuid derruba a consulta com "invalid input syntax".
        unidadeId
          ? supabase.from('reservas').select('data, status').eq('unidade_id', unidadeId).gte('data', de)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!ativo) return;

      if (ocupadas.error) {
        Alert.alert('Erro ao consultar a agenda do salão', ocupadas.error.message);
        setCarregandoDatas(false);
        return;
      }
      if (minhas.error) {
        Alert.alert('Erro ao consultar seus pedidos', minhas.error.message);
        setCarregandoDatas(false);
        return;
      }

      const bloqueadas = new Set<string>(
        ((ocupadas.data as unknown as string[]) ?? []).filter(Boolean)
      );
      for (const r of (minhas.data as { data: string; status: string }[]) ?? []) {
        // Recusada não bloqueia: é justamente a data que dá pra pedir de novo.
        if (r.status !== 'recusada') bloqueadas.add(r.data);
      }

      setIndisponiveis(bloqueadas);
      setCarregandoDatas(false);
    })();

    return () => {
      ativo = false;
    };
  }, [condominioId, unidadeId]);

  async function enviar() {
    if (!condominioId || !unidadeId || !userId) {
      Alert.alert('Aviso', 'Não identifiquei sua unidade ainda. Feche e reabra o app.');
      return;
    }
    if (!data) return;

    setEnviando(true);
    const { error } = await supabase.from('reservas').insert({
      condominio_id: condominioId,
      unidade_id: unidadeId,
      usuario_id: userId,
      data,
      observacao: observacao.trim() || null,
    });
    setEnviando(false);

    if (error) {
      // 23505 = unique_violation. O calendário já desenha as duas regras que
      // batem aqui, então isto virou rede de segurança: alguém aprovou um
      // pedido para esta data entre a abertura do formulário e o envio.
      if (error.code === '23505') {
        Alert.alert(
          'Data indisponível',
          'Alguém garantiu essa data enquanto você preenchia. Escolha outra.'
        );
        setIndisponiveis((atual) => new Set(atual).add(data));
        setData(null);
        return;
      }
      Alert.alert('Erro ao pedir reserva', error.message);
      return;
    }

    mostrar('Pedido enviado ao síndico');
    aoConcluir();
  }

  return (
    <View>
      <Text style={styles.rotulo}>Escolha a data</Text>

      {carregandoDatas ? (
        <Carregando texto="Consultando a agenda do salão..." />
      ) : (
        <Calendario valor={data} aoEscolher={setData} indisponiveis={indisponiveis} />
      )}

      <Text style={styles.aviso}>
        Datas riscadas já estão reservadas ou já foram pedidas pela sua unidade.
      </Text>

      <Campo
        rotulo="Motivo (opcional)"
        placeholder="Aniversário, reunião de família..."
        value={observacao}
        onChangeText={setObservacao}
        estilo={{ marginTop: espaco.lg }}
      />

      <Text style={styles.aviso}>
        O síndico precisa aprovar. Você acompanha o status na lista do Salão.
      </Text>

      <Botao
        titulo={data ? `Pedir ${formatarDataCurta(data)}` : 'Escolha uma data'}
        onPress={enviar}
        disabled={!data || enviando}
        carregando={enviando}
        estilo={{ marginTop: espaco.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg },
  rotulo: {
    fontSize: 12,
    fontWeight: '600',
    color: cores.textoFraco,
    marginBottom: espaco.xs,
  },
  aviso: {
    fontSize: 11,
    color: cores.textoFraco,
    lineHeight: 16,
    marginTop: espaco.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: espaco.sm,
  },
  data: { fontSize: 15, fontWeight: '700', color: cores.texto },
  quem: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
  observacao: { fontSize: 13, color: cores.textoFraco, marginTop: espaco.sm },
  acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md },
});
