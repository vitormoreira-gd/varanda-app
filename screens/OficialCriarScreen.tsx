import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';

export function CriarAvisoForm() {
  const { condominioId } = useMeuCondominio();
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [fixado, setFixado] = useState(true);

  async function enviar() {
    if (!titulo.trim() || !texto.trim() || !condominioId) return;
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('avisos').insert({
      titulo: titulo.trim(),
      texto: texto.trim(),
      fixado,
      condominio_id: condominioId,
      autor_id: userData.user?.id,
    });

    if (error) {
      Alert.alert('Erro ao criar aviso', error.message);
      return;
    }
    setTitulo('');
    setTexto('');
    Alert.alert('Aviso publicado');
  }

  return (
    <View style={styles.form}>
      <TextInput style={styles.input} placeholder="Título" value={titulo} onChangeText={setTitulo} />
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        placeholder="Texto do aviso"
        value={texto}
        onChangeText={setTexto}
        multiline
      />
      <Pressable style={styles.checkboxRow} onPress={() => setFixado(!fixado)}>
        <View style={[styles.checkbox, fixado && styles.checkboxAtivo]} />
        <Text style={styles.checkboxLabel}>Fixar no topo do Mural/Oficial</Text>
      </Pressable>
      <Button title="Publicar aviso" onPress={enviar} />
    </View>
  );
}

export function CriarVotacaoForm() {
  const { condominioId } = useMeuCondominio();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [opcoes, setOpcoes] = useState(['Sim', 'Não']);
  const [dias, setDias] = useState('7');

  function atualizarOpcao(i: number, valor: string) {
    const novas = [...opcoes];
    novas[i] = valor;
    setOpcoes(novas);
  }

  function adicionarOpcao() {
    setOpcoes([...opcoes, '']);
  }

  async function enviar() {
    const opcoesValidas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (!titulo.trim() || opcoesValidas.length < 2 || !condominioId) {
      Alert.alert('Preencha o título e pelo menos 2 opções.');
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() + (parseInt(dias, 10) || 7));

    const { error } = await supabase.from('votacoes').insert({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      opcoes: opcoesValidas,
      data_fim: dataFim.toISOString(),
      condominio_id: condominioId,
      autor_id: userData.user?.id,
    });

    if (error) {
      Alert.alert('Erro ao abrir votação', error.message);
      return;
    }
    setTitulo('');
    setDescricao('');
    setOpcoes(['Sim', 'Não']);
    Alert.alert('Votação aberta');
  }

  return (
    <View style={styles.form}>
      <TextInput style={styles.input} placeholder="Título da votação" value={titulo} onChangeText={setTitulo} />
      <TextInput
        style={[styles.input, { minHeight: 60 }]}
        placeholder="Descrição / pauta (opcional)"
        value={descricao}
        onChangeText={setDescricao}
        multiline
      />
      {opcoes.map((op, i) => (
        <TextInput
          key={i}
          style={styles.input}
          placeholder={`Opção ${i + 1}`}
          value={op}
          onChangeText={(v) => atualizarOpcao(i, v)}
        />
      ))}
      <Button title="+ Adicionar opção" onPress={adicionarOpcao} color="#6B665D" />
      <Text style={styles.label}>Encerra em quantos dias?</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={dias}
        onChangeText={setDias}
      />
      <Button title="Abrir votação" onPress={enviar} />
    </View>
  );
}

// Gera os horários de 06:00 até 23:30, de 30 em 30 minutos
const HORARIOS = (() => {
  const lista: string[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      lista.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return lista;
})();

export function CriarReuniaoForm() {
  const { condominioId } = useMeuCondominio();
  const [titulo, setTitulo] = useState('');
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [horario, setHorario] = useState('19:00');
  const [local, setLocal] = useState('');
  const [pauta, setPauta] = useState('');

  function onChangeData(event: DateTimePickerEvent, selecionada?: Date) {
    if (Platform.OS === 'android') setMostrarCalendario(false);
    if (event.type === 'dismissed') return;
    if (selecionada) setDataSelecionada(selecionada);
  }

  async function enviar() {
    if (!titulo.trim() || !condominioId) return;

    const [h, min] = horario.split(':').map(Number);
    const dataHora = new Date(dataSelecionada);
    dataHora.setHours(h, min, 0, 0);

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('reunioes').insert({
      titulo: titulo.trim(),
      data_hora: dataHora.toISOString(),
      local: local.trim() || null,
      pauta: pauta.trim() || null,
      condominio_id: condominioId,
      autor_id: userData.user?.id,
    });

    if (error) {
      Alert.alert('Erro ao agendar reunião', error.message);
      return;
    }
    setTitulo('');
    setLocal('');
    setPauta('');
    Alert.alert('Reunião agendada');
  }

  return (
    <View style={styles.form}>
      <TextInput style={styles.input} placeholder="Título" value={titulo} onChangeText={setTitulo} />

      <Text style={styles.label}>Data</Text>
      <Pressable style={styles.dataBtn} onPress={() => setMostrarCalendario(true)}>
        <Text style={styles.dataBtnTexto}>
          {dataSelecionada.toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'long',
          })}
        </Text>
      </Pressable>

      {mostrarCalendario && (
        <DateTimePicker
          value={dataSelecionada}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
          onChange={onChangeData}
        />
      )}
      {Platform.OS === 'ios' && mostrarCalendario && (
        <Button title="Concluído" onPress={() => setMostrarCalendario(false)} />
      )}

      <Text style={styles.label}>Horário</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horariosLista}>
        {HORARIOS.map((h) => (
          <Pressable
            key={h}
            onPress={() => setHorario(h)}
            style={[styles.horarioChip, horario === h && styles.horarioChipAtivo]}
          >
            <Text style={[styles.horarioTexto, horario === h && styles.horarioTextoAtivo]}>{h}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput style={styles.input} placeholder="Local (opcional)" value={local} onChangeText={setLocal} />
      <TextInput
        style={[styles.input, { minHeight: 60 }]}
        placeholder="Pauta (opcional)"
        value={pauta}
        onChangeText={setPauta}
        multiline
      />
      <Button title="Agendar reunião" onPress={enviar} />
    </View>
  );
}

export default function OficialCriarScreen() {
  const [aba, setAba] = useState<'aviso' | 'votacao' | 'reuniao'>('aviso');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.seletor}>
        {(['aviso', 'votacao', 'reuniao'] as const).map((a) => (
          <Pressable key={a} style={[styles.opcaoAba, aba === a && styles.opcaoAbaAtiva]} onPress={() => setAba(a)}>
            <Text style={[styles.opcaoAbaTexto, aba === a && styles.opcaoAbaTextoAtiva]}>
              {a === 'aviso' ? 'Aviso' : a === 'votacao' ? 'Votação' : 'Reunião'}
            </Text>
          </Pressable>
        ))}
      </View>

      {aba === 'aviso' && <CriarAvisoForm />}
      {aba === 'votacao' && <CriarVotacaoForm />}
      {aba === 'reuniao' && <CriarReuniaoForm />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE6', paddingHorizontal: 16 },
  seletor: { flexDirection: 'row', marginTop: 12, marginBottom: 12, backgroundColor: '#E4DFD2', borderRadius: 12, padding: 3 },
  opcaoAba: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  opcaoAbaAtiva: { backgroundColor: '#fff' },
  opcaoAbaTexto: { fontSize: 13, color: '#6B665D', fontWeight: '600' },
  opcaoAbaTextoAtiva: { color: '#1B4B66' },
  form: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 8 },
  input: { borderWidth: 1, borderColor: '#E4DFD2', borderRadius: 10, padding: 10, backgroundColor: '#F2EFE6' },
  label: { fontSize: 12, color: '#6B665D', marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#E4DFD2' },
  checkboxAtivo: { backgroundColor: '#1B4B66', borderColor: '#1B4B66' },
  checkboxLabel: { fontSize: 13, color: '#211F1B' },
  dataBtn: {
    borderWidth: 1,
    borderColor: '#E4DFD2',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F2EFE6',
    alignItems: 'center',
  },
  dataBtnTexto: { color: '#1B4B66', fontWeight: '600', fontSize: 14, textTransform: 'capitalize' },
  horariosLista: { flexGrow: 0, marginVertical: 4 },
  horarioChip: {
    borderWidth: 1,
    borderColor: '#E4DFD2',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginRight: 6,
  },
  horarioChipAtivo: { backgroundColor: '#1B4B66', borderColor: '#1B4B66' },
  horarioTexto: { fontSize: 13, color: '#6B665D' },
  horarioTextoAtiva: { color: '#fff', fontWeight: '600' },
  horarioTextoAtivo: { color: '#fff', fontWeight: '600' },
});
