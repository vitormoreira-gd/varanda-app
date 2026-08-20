import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { paraDataISO, formatarDataCurta } from '../lib/datas';

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};
const STATUS_COR: Record<string, { bg: string; cor: string }> = {
  pendente: { bg: '#F6E7C8', cor: '#C98A1F' },
  aprovada: { bg: '#DEE9E1', cor: '#43715B' },
  recusada: { bg: '#F7E4DA', cor: '#B6512E' },
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

export default function ReservasScreen() {
  const { condominioId, unidadeId, papel } = useMeuCondominio();
  const [userId, setUserId] = useState<string | null>(null);
  const [lista, setLista] = useState<Reserva[]>([]);
  const [dataEscolhida, setDataEscolhida] = useState<Date>(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const ehSindico = papel === 'sindico';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const carregar = useCallback(async () => {
    if (!condominioId) return;

    const { data, error } = await supabase
      .from('reservas')
      .select(
        'id, data, status, observacao, usuario_id, unidades!unidade_id(bloco, numero), usuarios!usuario_id(nome)'
      )
      .gte('data', paraDataISO(new Date()))
      .order('data', { ascending: true });

    if (error) {
      Alert.alert('Erro ao carregar reservas', error.message);
      return;
    }
    setLista((data as unknown as Reserva[]) ?? []);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function onChangeData(event: DateTimePickerEvent, selecionada?: Date) {
    if (Platform.OS === 'android') setMostrarCalendario(false);
    if (event.type === 'dismissed') return;
    if (selecionada) setDataEscolhida(selecionada);
  }

  async function pedirReserva() {
    if (!condominioId || !unidadeId || !userId) {
      Alert.alert('Aviso', 'Não identifiquei sua unidade ainda. Feche e reabra o app.');
      return;
    }

    const data = paraDataISO(dataEscolhida);
    setBusy(true);
    const { error } = await supabase.from('reservas').insert({
      condominio_id: condominioId,
      unidade_id: unidadeId,
      usuario_id: userId,
      data,
      observacao: observacao.trim() || null,
    });
    setBusy(false);

    if (error) {
      // 23505 = unique_violation. Os dois índices parciais que impedem
      // conflito de data batem aqui, e a mensagem crua do Postgres não
      // ajudaria em nada o morador.
      if (error.code === '23505') {
        Alert.alert(
          'Data indisponível',
          'Ou o salão já está reservado nessa data, ou sua unidade já tem um pedido pendente pra ela.'
        );
        return;
      }
      Alert.alert('Erro ao pedir reserva', error.message);
      return;
    }

    setObservacao('');
    Alert.alert('Pedido enviado', 'O síndico precisa aprovar. Você vê o status nesta tela.');
    carregar();
  }

  async function decidir(reserva: Reserva, aprovar: boolean) {
    const { data, error } = await supabase
      .from('reservas')
      .update({ status: aprovar ? 'aprovada' : 'recusada' })
      .eq('id', reserva.id)
      .select();

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
    carregar();
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.subtitulo}>Reservar o salão</Text>

        <Pressable style={styles.dataBtn} onPress={() => setMostrarCalendario(true)}>
          <Text style={styles.dataBtnTexto}>
            {dataEscolhida.toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
              month: 'long',
            })}
          </Text>
        </Pressable>

        {mostrarCalendario && (
          <DateTimePicker
            value={dataEscolhida}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            onChange={onChangeData}
          />
        )}
        {Platform.OS === 'ios' && mostrarCalendario && (
          <Button title="Concluído" onPress={() => setMostrarCalendario(false)} />
        )}

        <TextInput
          style={styles.input}
          placeholder="Motivo (opcional): aniversário, reunião..."
          value={observacao}
          onChangeText={setObservacao}
        />
        <Button title="Pedir reserva" onPress={pedirReserva} disabled={busy} />
      </View>

      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={<Text style={styles.secao}>Próximas datas</Text>}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhuma reserva pedida daqui pra frente.</Text>
        }
        renderItem={({ item }) => {
          const cor = STATUS_COR[item.status] ?? STATUS_COR.pendente;
          const minha = item.usuario_id === userId;
          const unidade = item.unidades
            ? `${item.unidades.bloco ? `${item.unidades.bloco} ` : ''}${item.unidades.numero}`
            : '';

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.data}>{formatarDataCurta(item.data)}</Text>
                  <Text style={styles.quem}>
                    {item.usuarios?.nome ?? 'Vizinho'}
                    {unidade ? ` · ${unidade}` : ''}
                    {minha ? ' · você' : ''}
                  </Text>
                  {item.observacao && <Text style={styles.observacao}>{item.observacao}</Text>}
                </View>
                <View style={[styles.status, { backgroundColor: cor.bg }]}>
                  <Text style={[styles.statusTexto, { color: cor.cor }]}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>

              {ehSindico && item.status === 'pendente' && (
                <View style={styles.acoes}>
                  <Pressable onPress={() => decidir(item, true)} hitSlop={6}>
                    <Text style={styles.aprovar}>Aprovar</Text>
                  </Pressable>
                  <Pressable onPress={() => decidir(item, false)} hitSlop={6}>
                    <Text style={styles.recusar}>Recusar</Text>
                  </Pressable>
                </View>
              )}

              {minha && item.status !== 'recusada' && (
                <Pressable onPress={() => confirmarCancelamento(item)} hitSlop={6}>
                  <Text style={styles.cancelar}>Cancelar meu pedido</Text>
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
  container: { flex: 1, padding: 16 },
  form: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFD2',
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  subtitulo: { fontSize: 14, fontWeight: '700', color: '#1B4B66' },
  dataBtn: {
    borderWidth: 1,
    borderColor: '#E4DFD2',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F2EFE6',
    alignItems: 'center',
  },
  dataBtnTexto: { color: '#1B4B66', fontWeight: '600', fontSize: 14, textTransform: 'capitalize' },
  input: {
    borderWidth: 1,
    borderColor: '#E4DFD2',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#F2EFE6',
  },
  secao: { fontSize: 13, fontWeight: '700', color: '#1B4B66', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFD2',
    padding: 14,
    marginBottom: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  data: { fontSize: 15, fontWeight: '700', color: '#211F1B', textTransform: 'capitalize' },
  quem: { fontSize: 12, color: '#6B665D', marginTop: 2 },
  observacao: { fontSize: 13, color: '#6B665D', marginTop: 6 },
  status: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 },
  statusTexto: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  acoes: { flexDirection: 'row', gap: 18, marginTop: 12 },
  aprovar: { fontSize: 13, color: '#43715B', fontWeight: '700' },
  recusar: { fontSize: 13, color: '#B6512E', fontWeight: '700' },
  cancelar: { fontSize: 12, color: '#B6512E', marginTop: 10 },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 30 },
});
