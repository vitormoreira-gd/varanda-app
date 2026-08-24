import { useCallback, useEffect, useState } from 'react';
import { Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { formatarDataHora } from '../lib/datas';
import { cores, espaco } from '../lib/tema';
import { Botao, Campo, Cartao, Carregando } from '../components/ui';

// Edição das regras pelo síndico. Salvar passa pelo RPC salvar_regras, que
// grava e publica o aviso na mesma transação — não dá pra mudar as regras
// sem que o condomínio fique sabendo.
export default function RegrasEditarScreen() {
  const { condominioId } = useMeuCondominio();
  const [texto, setTexto] = useState('');
  const [resumo, setResumo] = useState('');
  const [versao, setVersao] = useState<number | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!condominioId) return;

    setCarregando(true);
    // .eq('condominio_id'): sem o filtro, síndico de dois prédios recebe duas
    // linhas e o maybeSingle() vira erro.
    const { data, error } = await supabase
      .from('regras')
      .select('texto, versao, atualizado_em')
      .eq('condominio_id', condominioId)
      .maybeSingle();

    if (error) {
      Alert.alert('Erro ao carregar as regras', error.message);
      setCarregando(false);
      return;
    }

    setTexto(data?.texto ?? '');
    setVersao(data?.versao ?? null);
    setAtualizadoEm(data?.atualizado_em ?? null);
    setCarregando(false);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function confirmar() {
    if (!condominioId) {
      Alert.alert('Não identifiquei seu condomínio', 'Feche e reabra o app e tente de novo.');
      return;
    }
    if (!texto.trim()) {
      Alert.alert('As regras não podem ficar em branco.');
      return;
    }

    Alert.alert(
      versao === null ? 'Publicar as regras?' : 'Publicar nova versão?',
      'Todo mundo do condomínio vai receber um aviso fixado avisando da mudança.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Publicar', onPress: salvar },
      ]
    );
  }

  async function salvar() {
    if (!condominioId) return;
    setSalvando(true);

    const { data, error } = await supabase.rpc('salvar_regras', {
      p_condominio_id: condominioId,
      p_texto: texto.trim(),
      p_resumo: resumo.trim() || null,
    });

    setSalvando(false);

    if (error) {
      Alert.alert('Erro ao publicar as regras', error.message);
      return;
    }

    const novaVersao = data as number;
    // O RPC devolve a versão atual sem incrementar quando o texto é idêntico
    // ao que já está salvo — nesse caso ele não publica aviso nenhum.
    if (versao !== null && novaVersao === versao) {
      Alert.alert('Nada mudou', 'O texto está igual ao que já estava publicado. Nenhum aviso foi enviado.');
      return;
    }

    setResumo('');
    await carregar();
    Alert.alert(
      'Regras publicadas',
      `Versão ${novaVersao} no ar. O aviso já está na aba Oficial de todo mundo.`
    );
  }

  if (carregando) return <Carregando />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: espaco.xxl }}>
      <Cartao>
        <Text style={styles.meta}>
          {versao === null
            ? 'Ainda não há regras publicadas neste condomínio.'
            : `Versão ${versao} · publicada ${formatarDataHora(atualizadoEm ?? '')}`}
        </Text>

        <Campo
          rotulo="Regimento interno"
          placeholder={
            'Regras e regimento interno do condomínio.\n\nEx: horário de silêncio, uso do salão, mudanças, animais, área de lazer...'
          }
          value={texto}
          onChangeText={setTexto}
          multiline
          textAlignVertical="top"
          style={styles.inputGrande}
          estilo={{ marginTop: espaco.md }}
        />

        <Campo
          rotulo="O que mudou (opcional)"
          placeholder="Vira o texto do aviso enviado a todos"
          value={resumo}
          onChangeText={setResumo}
          multiline
          estilo={{ marginTop: espaco.md }}
        />

        <Text style={styles.dica}>
          Sem esse resumo, o aviso sai com um texto padrão dizendo que as regras mudaram. Publicar
          sempre dispara o aviso — não existe caminho no app que altere as regras em silêncio.
        </Text>

        <Botao
          titulo={versao === null ? 'Publicar regras' : 'Publicar nova versão'}
          onPress={confirmar}
          disabled={salvando}
          carregando={salvando}
        />
      </Cartao>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg },
  meta: { fontSize: 12, color: cores.textoFraco },
  inputGrande: { minHeight: 240 },
  dica: {
    fontSize: 11,
    color: cores.textoFraco,
    lineHeight: 16,
    marginTop: espaco.md,
    marginBottom: espaco.lg,
  },
});
