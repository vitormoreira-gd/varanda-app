import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Situacao } from '../lib/useMeuCondominio';
import { cores, espaco } from '../lib/tema';
import { Botao, Campo, Cartao, EspacoTopo, Seletor } from '../components/ui';

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
  const PASSOS: Record<Situacao, number> = {
    sem_perfil: 1,
    sem_vinculo: 2,
    pendente: 3,
    aprovado: 3,
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <EspacoTopo extra={espaco.xl} />

      <Text style={styles.marca}>varanda</Text>
      <Text style={styles.passo}>Passo {PASSOS[situacao]} de 3</Text>

      <View style={{ marginTop: espaco.xl }}>
        {situacao === 'sem_perfil' && <Perfil aoConcluir={aoConcluir} />}
        {situacao === 'sem_vinculo' && <EscolhaDeEntrada aoConcluir={aoConcluir} />}
        {situacao === 'pendente' && <Pendente aoConcluir={aoConcluir} />}
      </View>

      <Botao
        titulo="Sair da conta"
        variante="fantasma"
        onPress={() => supabase.auth.signOut()}
        estilo={{ marginTop: espaco.xl }}
      />
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
    <Cartao>
      <Text style={styles.subtitulo}>Como você se chama?</Text>
      <Text style={styles.ajuda}>É o nome que aparece nas suas mensagens no mural.</Text>
      <Campo
        value={nome}
        onChangeText={setNome}
        placeholder="Nome e sobrenome"
        estilo={{ marginTop: espaco.md }}
      />
      <Botao
        titulo="Continuar"
        onPress={salvar}
        disabled={busy}
        carregando={busy}
        estilo={{ marginTop: espaco.lg }}
      />
    </Cartao>
  );
}

const MODOS = [
  { chave: 'morador', label: 'Sou morador' },
  { chave: 'fundar', label: 'Vou fundar' },
] as const;

type Modo = (typeof MODOS)[number]['chave'];

function EscolhaDeEntrada({ aoConcluir }: { aoConcluir: () => void }) {
  const [modo, setModo] = useState<Modo>('morador');

  return (
    <View style={{ gap: espaco.md }}>
      <Seletor opcoes={MODOS} valor={modo} aoTrocar={setModo} />
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
    <Cartao>
      <Text style={styles.subtitulo}>Código de convite</Text>
      <Text style={styles.ajuda}>
        O síndico envia um código por unidade. Depois de usar, ele ainda precisa aprovar seu pedido.
      </Text>
      <Campo
        value={codigo}
        onChangeText={setCodigo}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="ex: a1b2c3d4"
        estilo={{ marginTop: espaco.md }}
      />
      <Botao
        titulo="Entrar no condomínio"
        onPress={vincular}
        disabled={busy || !codigo.trim()}
        carregando={busy}
        estilo={{ marginTop: espaco.lg }}
      />
    </Cartao>
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
    <Cartao>
      <Text style={styles.subtitulo}>Fundar um condomínio</Text>
      <Text style={styles.ajuda}>
        Precisa de um código de fundação. Quem usa o código vira o síndico do condomínio criado.
      </Text>

      <Campo
        rotulo="Código de fundação"
        value={codigo}
        onChangeText={setCodigo}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ex: VARANDA-2026-ABC"
        estilo={{ marginTop: espaco.md }}
      />
      <Campo
        rotulo="Nome do condomínio"
        value={nomeCondominio}
        onChangeText={setNomeCondominio}
        placeholder="ex: Edifício Varanda"
        estilo={{ marginTop: espaco.md }}
      />
      <Campo
        rotulo="Endereço (opcional)"
        value={endereco}
        onChangeText={setEndereco}
        placeholder="Rua, número"
        estilo={{ marginTop: espaco.md }}
      />

      <Text style={styles.rotulo}>Sua unidade</Text>
      <View style={styles.linha}>
        <Campo
          value={bloco}
          onChangeText={setBloco}
          placeholder="Bloco (opcional)"
          estilo={{ flex: 1 }}
        />
        <Campo value={numero} onChangeText={setNumero} placeholder="Número" estilo={{ flex: 1 }} />
      </View>

      <Botao
        titulo="Criar condomínio"
        onPress={fundar}
        disabled={busy}
        carregando={busy}
        estilo={{ marginTop: espaco.lg }}
      />
    </Cartao>
  );
}

function Pendente({ aoConcluir }: { aoConcluir: () => void }) {
  return (
    <Cartao>
      <Text style={styles.subtitulo}>⏳ Aguardando aprovação</Text>
      <Text style={styles.ajuda}>
        Seu pedido de vínculo chegou pro síndico. Enquanto ele não aprovar, o app fica bloqueado.
      </Text>
      <Botao
        titulo="Já fui aprovado, verificar"
        variante="secundario"
        onPress={aoConcluir}
        estilo={{ marginTop: espaco.lg }}
      />
    </Cartao>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: espaco.xl, paddingBottom: espaco.xxl },
  marca: { fontSize: 28, fontWeight: '800', color: cores.primaria, letterSpacing: -0.5 },
  passo: { fontSize: 12, color: cores.textoFraco, marginTop: espaco.xs },
  subtitulo: { fontSize: 16, fontWeight: '700', color: cores.texto },
  ajuda: { fontSize: 13, color: cores.textoFraco, marginTop: espaco.xs, lineHeight: 19 },
  rotulo: {
    fontSize: 12,
    fontWeight: '600',
    color: cores.textoFraco,
    marginTop: espaco.md,
    marginBottom: espaco.xs,
  },
  linha: { flexDirection: 'row', gap: espaco.sm },
});
