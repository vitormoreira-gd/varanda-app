import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { Situacao } from '../lib/useMeuCondominio';

/**
 * Onboarding: leva o usuário recém-cadastrado até ter um vínculo aprovado.
 * Três estados, na ordem em que acontecem:
 *   sem_perfil  → falta a linha em `usuarios` (nome)
 *   sem_vinculo → escolhe entrar num condomínio ou fundar um
 *   pendente    → já pediu vínculo, aguarda o síndico aprovar
 */
export default function EntradaScreen({
  situacao,
  aoConcluir,
}: {
  situacao: Situacao;
  aoConcluir: () => void;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.titulo}>varanda</Text>

      {situacao === 'sem_perfil' && <Perfil aoConcluir={aoConcluir} />}
      {situacao === 'sem_vinculo' && <EscolhaDeEntrada aoConcluir={aoConcluir} />}
      {situacao === 'pendente' && <Pendente aoConcluir={aoConcluir} />}

      <Pressable style={styles.sair} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.sairTexto}>Sair da conta</Text>
      </Pressable>
    </ScrollView>
  );
}

function Perfil({ aoConcluir }: { aoConcluir: () => void }) {
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      Alert.alert('Falta o nome', 'Seus vizinhos vão te identificar por ele no mural.');
      return;
    }
    setBusy(true);

    const { data: userData, error: erroUser } = await supabase.auth.getUser();
    if (erroUser || !userData.user) {
      setBusy(false);
      Alert.alert('Erro', 'Não consegui identificar seu usuário logado.');
      return;
    }

    const { error } = await supabase
      .from('usuarios')
      .insert({ id: userData.user.id, nome: nome.trim() });

    setBusy(false);
    if (error) {
      Alert.alert('Erro ao salvar perfil', error.message);
      return;
    }
    aoConcluir();
  }

  return (
    <View style={styles.bloco}>
      <Text style={styles.subtitulo}>Como você se chama?</Text>
      <Text style={styles.ajuda}>É o nome que aparece nas suas mensagens no mural.</Text>
      <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Nome e sobrenome" />
      <Button title="Continuar" onPress={salvar} disabled={busy} />
    </View>
  );
}

function EscolhaDeEntrada({ aoConcluir }: { aoConcluir: () => void }) {
  const [modo, setModo] = useState<'morador' | 'fundar'>('morador');

  return (
    <View>
      <View style={styles.seletor}>
        <Pressable
          style={[styles.opcao, modo === 'morador' && styles.opcaoAtiva]}
          onPress={() => setModo('morador')}
        >
          <Text style={[styles.opcaoTexto, modo === 'morador' && styles.opcaoTextoAtivo]}>
            Sou morador
          </Text>
        </Pressable>
        <Pressable
          style={[styles.opcao, modo === 'fundar' && styles.opcaoAtiva]}
          onPress={() => setModo('fundar')}
        >
          <Text style={[styles.opcaoTexto, modo === 'fundar' && styles.opcaoTextoAtivo]}>
            Vou fundar
          </Text>
        </Pressable>
      </View>

      {modo === 'morador' ? <Convite aoConcluir={aoConcluir} /> : <Fundar aoConcluir={aoConcluir} />}
    </View>
  );
}

function Convite({ aoConcluir }: { aoConcluir: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);

  async function vincular() {
    if (!codigo.trim()) return;
    setBusy(true);

    const { error } = await supabase.rpc('vincular_por_codigo', {
      p_codigo: codigo.trim(),
    });

    setBusy(false);
    if (error) {
      Alert.alert('Não consegui vincular', error.message);
      return;
    }
    Alert.alert(
      'Pedido enviado',
      'O síndico precisa aprovar seu vínculo. Assim que aprovar, o app libera.'
    );
    aoConcluir();
  }

  return (
    <View style={styles.bloco}>
      <Text style={styles.subtitulo}>Código de convite</Text>
      <Text style={styles.ajuda}>
        O síndico envia um código por unidade. Depois de usar, ele ainda precisa aprovar seu pedido.
      </Text>
      <TextInput
        style={styles.input}
        value={codigo}
        onChangeText={setCodigo}
        autoCapitalize="none"
        placeholder="ex: a1b2c3d4"
      />
      <Button title="Entrar no condomínio" onPress={vincular} disabled={busy} />
    </View>
  );
}

function Fundar({ aoConcluir }: { aoConcluir: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [nomeCondominio, setNomeCondominio] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bloco, setBloco] = useState('');
  const [numero, setNumero] = useState('');
  const [busy, setBusy] = useState(false);

  async function fundar() {
    if (!codigo.trim() || !nomeCondominio.trim() || !numero.trim()) {
      Alert.alert('Faltam dados', 'Código de fundação, nome do condomínio e sua unidade são obrigatórios.');
      return;
    }
    setBusy(true);

    const { error } = await supabase.rpc('fundar_condominio', {
      p_codigo: codigo.trim(),
      p_nome_condominio: nomeCondominio.trim(),
      p_endereco: endereco.trim(),
      p_bloco: bloco.trim(),
      p_numero: numero.trim(),
    });

    setBusy(false);
    if (error) {
      Alert.alert('Não consegui fundar o condomínio', error.message);
      return;
    }
    Alert.alert(
      'Condomínio criado',
      'Você já é o síndico. O próximo passo é cadastrar as unidades, na aba Gestão.'
    );
    aoConcluir();
  }

  return (
    <View style={styles.bloco}>
      <Text style={styles.subtitulo}>Fundar um condomínio</Text>
      <Text style={styles.ajuda}>
        Precisa de um código de fundação. Quem usa o código vira o síndico do condomínio criado.
      </Text>

      <Text style={styles.label}>Código de fundação</Text>
      <TextInput
        style={styles.input}
        value={codigo}
        onChangeText={setCodigo}
        autoCapitalize="characters"
        placeholder="ex: VARANDA-2026-ABC"
      />

      <Text style={styles.label}>Nome do condomínio</Text>
      <TextInput
        style={styles.input}
        value={nomeCondominio}
        onChangeText={setNomeCondominio}
        placeholder="ex: Edifício Varanda"
      />

      <Text style={styles.label}>Endereço (opcional)</Text>
      <TextInput style={styles.input} value={endereco} onChangeText={setEndereco} placeholder="Rua, número" />

      <Text style={styles.label}>Sua unidade</Text>
      <View style={styles.linha}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={bloco}
          onChangeText={setBloco}
          placeholder="Bloco (opcional)"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={numero}
          onChangeText={setNumero}
          placeholder="Número"
        />
      </View>

      <Button title="Criar condomínio" onPress={fundar} disabled={busy} />
    </View>
  );
}

function Pendente({ aoConcluir }: { aoConcluir: () => void }) {
  return (
    <View style={styles.bloco}>
      <Text style={styles.subtitulo}>Aguardando aprovação</Text>
      <Text style={styles.ajuda}>
        Seu pedido de vínculo chegou pro síndico. Enquanto ele não aprovar, o app fica bloqueado.
      </Text>
      <Button title="Já fui aprovado, verificar" onPress={aoConcluir} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE6', padding: 20, paddingTop: 70 },
  titulo: { fontSize: 24, fontWeight: '800', color: '#1B4B66', marginBottom: 20 },
  bloco: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFD2',
    padding: 16,
    gap: 8,
  },
  subtitulo: { fontSize: 16, fontWeight: '700', color: '#1B4B66' },
  ajuda: { fontSize: 13, color: '#6B665D', marginBottom: 4 },
  label: { fontSize: 12, color: '#6B665D', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E4DFD2',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  linha: { flexDirection: 'row', gap: 8 },
  seletor: {
    flexDirection: 'row',
    backgroundColor: '#E4DFD2',
    borderRadius: 12,
    padding: 3,
    gap: 3,
    marginBottom: 12,
  },
  opcao: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  opcaoAtiva: { backgroundColor: '#fff' },
  opcaoTexto: { fontSize: 13, color: '#6B665D', fontWeight: '600' },
  opcaoTextoAtivo: { color: '#1B4B66' },
  sair: { marginTop: 24, alignItems: 'center' },
  sairTexto: { color: '#B6512E', fontSize: 13 },
});
