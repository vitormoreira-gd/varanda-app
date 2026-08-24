import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { formatarCompromisso, formatarDataCurta, paraDataISO } from '../lib/datas';
import { cores, espaco, raio } from '../lib/tema';
import { Botao, Campo, Cartao, Chip, Etiqueta, Link, Secao, Seletor, Vazio } from '../components/ui';

/**
 * Marca um item do Oficial como visível só pro gabinete (síndico, subsíndico
 * e conselho fiscal). Quem manda é a policy: `not restrito or
 * pode_fiscalizar(...)`, repetida também em votos e rsvps — os filhos não
 * herdam a visibilidade do pai sozinhos.
 */
function RestritoCheckbox({
  restrito,
  setRestrito,
  oQue,
}: {
  restrito: boolean;
  setRestrito: (v: boolean) => void;
  oQue: string;
}) {
  return (
    <View style={styles.restritoBloco}>
      <Pressable style={styles.checkboxRow} onPress={() => setRestrito(!restrito)}>
        <View style={[styles.checkbox, restrito && styles.checkboxRestrito]}>
          {restrito && <Text style={styles.check}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>🔒 Restrito ao gabinete</Text>
      </Pressable>
      {restrito && (
        <Text style={styles.restritoDica}>
          Só você, o subsíndico e o conselho fiscal veem {oQue}. Os demais moradores não ficam
          sabendo que existe.
        </Text>
      )}
    </View>
  );
}

function Checkbox({
  marcado,
  onPress,
  rotulo,
  desabilitado,
}: {
  marcado: boolean;
  onPress: () => void;
  rotulo: string;
  desabilitado?: boolean;
}) {
  return (
    <Pressable
      style={[styles.checkboxRow, desabilitado && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={desabilitado}
    >
      <View style={[styles.checkbox, marcado && styles.checkboxAtivo]}>
        {marcado && <Text style={styles.check}>✓</Text>}
      </View>
      <Text style={styles.checkboxLabel}>{rotulo}</Text>
    </Pressable>
  );
}

export function CriarAvisoForm() {
  const { condominioId } = useMeuCondominio();
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [fixado, setFixado] = useState(true);
  const [restrito, setRestrito] = useState(false);

  async function enviar() {
    if (!titulo.trim() || !texto.trim() || !condominioId) return;
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('avisos').insert({
      titulo: titulo.trim(),
      texto: texto.trim(),
      fixado,
      restrito,
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
    <Cartao>
      <Campo rotulo="Título" placeholder="Ex: Manutenção do elevador" value={titulo} onChangeText={setTitulo} />
      <Campo
        rotulo="Texto do aviso"
        placeholder="O que os moradores precisam saber"
        value={texto}
        onChangeText={setTexto}
        multiline
        estilo={{ marginTop: espaco.md }}
      />
      <Checkbox
        marcado={fixado}
        onPress={() => setFixado(!fixado)}
        rotulo="📌 Fixar no topo do Oficial"
        desabilitado={restrito}
      />
      {restrito ? (
        <Text style={styles.notaFixar}>
          Aviso restrito não pode ser fixado: o destaque do topo é do prédio inteiro, e a maioria
          nem enxergaria este aviso.
        </Text>
      ) : fixado ? (
        <Text style={styles.notaFixar}>
          Só existe um aviso fixado por vez. Publicar este desafixa o atual.
        </Text>
      ) : null}

      <RestritoCheckbox
        restrito={restrito}
        setRestrito={(v) => {
          setRestrito(v);
          // O banco tem um check impedindo os dois juntos; desmarcar aqui
          // evita o insert falhar com mensagem de constraint.
          if (v) setFixado(false);
        }}
        oQue="este aviso"
      />
      <Botao
        titulo="Publicar aviso"
        onPress={enviar}
        disabled={!titulo.trim() || !texto.trim()}
        estilo={{ marginTop: espaco.md }}
      />
    </Cartao>
  );
}

export function CriarVotacaoForm() {
  const { condominioId } = useMeuCondominio();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [opcoes, setOpcoes] = useState(['Sim', 'Não']);
  const [dias, setDias] = useState('7');
  const [restrito, setRestrito] = useState(false);

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
      restrito,
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
    <Cartao>
      <Campo
        rotulo="Título da votação"
        placeholder="Ex: Trocar o portão da garagem?"
        value={titulo}
        onChangeText={setTitulo}
      />
      <Campo
        rotulo="Descrição / pauta (opcional)"
        placeholder="Contexto pro morador decidir"
        value={descricao}
        onChangeText={setDescricao}
        multiline
        estilo={{ marginTop: espaco.md }}
      />

      <Text style={styles.rotulo}>Opções</Text>
      <View style={{ gap: espaco.sm }}>
        {opcoes.map((op, i) => (
          <Campo
            key={i}
            placeholder={`Opção ${i + 1}`}
            value={op}
            onChangeText={(v) => atualizarOpcao(i, v)}
          />
        ))}
      </View>
      <View style={{ marginTop: espaco.sm, alignSelf: 'flex-start' }}>
        <Link titulo="+ Adicionar opção" onPress={adicionarOpcao} />
      </View>

      <Campo
        rotulo="Encerra em quantos dias?"
        keyboardType="number-pad"
        value={dias}
        onChangeText={setDias}
        estilo={{ marginTop: espaco.md }}
      />

      <RestritoCheckbox restrito={restrito} setRestrito={setRestrito} oQue="esta votação" />
      <Botao titulo="Abrir votação" onPress={enviar} estilo={{ marginTop: espaco.md }} />
    </Cartao>
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
  const [restrito, setRestrito] = useState(false);

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
      restrito,
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
    <Cartao>
      <Campo
        rotulo="Título"
        placeholder="Ex: Assembleia ordinária"
        value={titulo}
        onChangeText={setTitulo}
      />

      <Text style={styles.rotulo}>Data</Text>
      <Pressable style={styles.dataBtn} onPress={() => setMostrarCalendario(true)}>
        <Text style={styles.dataBtnTexto}>{formatarDataCurta(paraDataISO(dataSelecionada))}</Text>
        <Text style={styles.dataBtnDica}>tocar para trocar</Text>
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
        <Botao
          titulo="Concluído"
          variante="secundario"
          pequeno
          onPress={() => setMostrarCalendario(false)}
          estilo={{ marginTop: espaco.sm, alignSelf: 'flex-start' }}
        />
      )}

      <Text style={styles.rotulo}>Horário</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horariosLista}
        contentContainerStyle={{ gap: espaco.sm }}
      >
        {HORARIOS.map((h) => (
          <Chip key={h} titulo={h} ativo={horario === h} onPress={() => setHorario(h)} />
        ))}
      </ScrollView>

      <Campo
        rotulo="Local (opcional)"
        placeholder="Ex: Salão de festas"
        value={local}
        onChangeText={setLocal}
        estilo={{ marginTop: espaco.md }}
      />
      <Campo
        rotulo="Pauta (opcional)"
        placeholder="O que vai ser discutido"
        value={pauta}
        onChangeText={setPauta}
        multiline
        estilo={{ marginTop: espaco.md }}
      />
      <RestritoCheckbox restrito={restrito} setRestrito={setRestrito} oQue="esta reunião" />
      <Botao
        titulo="Agendar reunião"
        onPress={enviar}
        disabled={!titulo.trim()}
        estilo={{ marginTop: espaco.md }}
      />
    </Cartao>
  );
}

type ReuniaoAgendada = {
  id: string;
  titulo: string;
  data_hora: string;
  local: string | null;
  cancelada_em: string | null;
};

/**
 * Reuniões futuras, com cancelamento. O cancelamento é soft (grava
 * `cancelada_em`) porque quem confirmou presença precisa VER que foi
 * cancelada — apagar faria a reunião sumir em silêncio da tela do morador.
 */
export function ProximasReunioes() {
  const { condominioId } = useMeuCondominio();
  const [lista, setLista] = useState<ReuniaoAgendada[]>([]);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    const { data, error } = await supabase
      .from('reunioes')
      .select('id, titulo, data_hora, local, cancelada_em')
      .gte('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: true });

    if (error) {
      Alert.alert('Erro ao carregar reuniões', error.message);
      return;
    }
    setLista(data ?? []);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function confirmarCancelamento(r: ReuniaoAgendada) {
    Alert.alert(
      'Cancelar reunião',
      `"${r.titulo}", marcada para ${formatarCompromisso(r.data_hora)}.\n\nQuer publicar um aviso avisando do cancelamento?`,
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Só cancelar', onPress: () => cancelar(r, false) },
        { text: 'Cancelar e avisar', onPress: () => cancelar(r, true) },
      ]
    );
  }

  async function cancelar(r: ReuniaoAgendada, publicarAviso: boolean) {
    const { data, error } = await supabase
      .from('reunioes')
      .update({ cancelada_em: new Date().toISOString() })
      .eq('id', r.id)
      .select();

    if (error) {
      Alert.alert('Erro ao cancelar', error.message);
      return;
    }
    // Update bloqueado por RLS não devolve erro, devolve zero linhas.
    if (!data || data.length === 0) {
      Alert.alert(
        'Não consegui cancelar',
        'O banco recusou a alteração. Confira se a policy "sindico edita reuniao" existe em reunioes.'
      );
      return;
    }

    if (publicarAviso && condominioId) {
      const { data: userData } = await supabase.auth.getUser();
      const quando = formatarCompromisso(r.data_hora);
      const { error: erroAviso } = await supabase.from('avisos').insert({
        titulo: `Reunião cancelada: ${r.titulo}`,
        texto: `A reunião marcada para ${quando}${r.local ? ` no ${r.local}` : ''} foi cancelada.`,
        condominio_id: condominioId,
        autor_id: userData.user?.id,
        fixado: true,
      });
      if (erroAviso) {
        Alert.alert('Reunião cancelada, mas o aviso falhou', erroAviso.message);
        carregar();
        return;
      }
    }

    carregar();
  }

  return (
    <>
      <Secao titulo="Reuniões agendadas" />
      {lista.length === 0 ? (
        <Vazio icone="📅" titulo="Nenhuma reunião futura agendada" />
      ) : (
        lista.map((r) => {
          const cancelada = !!r.cancelada_em;
          return (
            <Cartao key={r.id} destaque={cancelada ? cores.perigo : undefined}>
              <View style={styles.reuniaoLinha}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reuniaoTitulo, cancelada && styles.riscado]}>
                    {r.titulo}
                  </Text>
                  <Text style={styles.reuniaoMeta}>
                    {formatarCompromisso(r.data_hora)}
                    {r.local ? ` · ${r.local}` : ''}
                  </Text>
                </View>
                {cancelada ? (
                  <Etiqueta texto="cancelada" tom="critico" />
                ) : (
                  <Link titulo="Cancelar" tom="perigo" onPress={() => confirmarCancelamento(r)} />
                )}
              </View>
            </Cartao>
          );
        })
      )}
    </>
  );
}

const ABAS = [
  { chave: 'aviso', label: 'Aviso' },
  { chave: 'votacao', label: 'Votação' },
  { chave: 'reuniao', label: 'Reunião' },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

export default function OficialCriarScreen() {
  const [aba, setAba] = useState<Aba>('aviso');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: espaco.xxl }}>
      <Seletor opcoes={ABAS} valor={aba} aoTrocar={setAba} />

      <View style={styles.corpo}>
        {aba === 'aviso' && <CriarAvisoForm />}
        {aba === 'votacao' && <CriarVotacaoForm />}
        {aba === 'reuniao' && (
          <>
            <CriarReuniaoForm />
            <ProximasReunioes />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  corpo: { paddingHorizontal: espaco.lg, marginTop: espaco.md },
  rotulo: {
    fontSize: 12,
    fontWeight: '600',
    color: cores.textoFraco,
    marginTop: espaco.md,
    marginBottom: espaco.xs,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    marginTop: espaco.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  checkboxRestrito: { backgroundColor: cores.restrito, borderColor: cores.restrito },
  check: { color: cores.textoClaro, fontSize: 12, fontWeight: '800' },
  checkboxLabel: { fontSize: 13, color: cores.texto, fontWeight: '600' },
  restritoBloco: { marginTop: espaco.xs },
  notaFixar: {
    fontSize: 11,
    color: cores.textoFraco,
    lineHeight: 16,
    marginTop: espaco.xs,
    marginLeft: 28,
  },
  restritoDica: {
    fontSize: 11,
    color: cores.restrito,
    lineHeight: 16,
    marginTop: espaco.sm,
    backgroundColor: cores.restritoFundo,
    borderRadius: raio.sm,
    padding: espaco.md,
  },
  dataBtn: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.sm,
    paddingVertical: espaco.md,
    paddingHorizontal: espaco.md,
    backgroundColor: cores.superficieAlt,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataBtnTexto: { color: cores.primaria, fontWeight: '700', fontSize: 15 },
  dataBtnDica: { color: cores.textoFraco, fontSize: 11 },
  horariosLista: { flexGrow: 0 },
  reuniaoLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  reuniaoTitulo: { fontSize: 14, fontWeight: '700', color: cores.texto },
  reuniaoMeta: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
  riscado: { textDecorationLine: 'line-through', color: cores.textoFraco },
});
