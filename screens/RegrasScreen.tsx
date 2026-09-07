import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { formatarDataHora } from '../lib/datas';
import { cores, espaco } from '../lib/tema';
import { Vazio } from '../components/ui';

type RegrasBruto = {
  texto: string;
  versao: number;
  atualizado_em: string;
  usuarios: { nome: string } | { nome: string }[] | null;
};

type Regras = { texto: string; versao: number; atualizado_em: string; autor: string | null };

// Sub-aba "Regras" do Oficial.
//
// Deliberadamente SEM cartão, sombra ou borda: isto é um documento pra ler de
// ponta a ponta, não um item de lista. A estética de card sugere que dá pra
// tocar e algo acontece — e aqui não acontece nada. Por isso a tipografia é
// maior e mais espaçada que a do resto do app.
export default function RegrasScreen() {
  const { condominioId } = useMeuCondominio();
  const [regras, setRegras] = useState<Regras | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!condominioId) return;

    // usuarios!atualizado_por: embed sempre com a coluna explícita, senão o
    // PostgREST reclama de "more than one relationship".
    // .eq('condominio_id'): quem tem vínculo em dois condomínios enxerga as
    // regras dos dois, e aí o maybeSingle() estouraria.
    const { data, error } = await supabase
      .from('regras')
      .select('texto, versao, atualizado_em, usuarios!atualizado_por(nome)')
      .eq('condominio_id', condominioId)
      .maybeSingle();

    if (error) {
      Alert.alert('Erro ao carregar as regras', error.message);
      setCarregando(false);
      return;
    }

    if (!data) {
      setRegras(null);
      setCarregando(false);
      return;
    }

    const bruto = data as unknown as RegrasBruto;
    const autor = Array.isArray(bruto.usuarios) ? bruto.usuarios[0] : bruto.usuarios;
    setRegras({
      texto: bruto.texto,
      versao: bruto.versao,
      atualizado_em: bruto.atualizado_em,
      autor: autor?.nome ?? null,
    });
    setCarregando(false);
  }, [condominioId]);

  // Recarrega ao voltar pra aba: o síndico edita em Gestão e volta pra cá.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  if (carregando) return null;

  if (!regras) {
    return (
      <Vazio
        icone="📖"
        titulo="O síndico ainda não publicou as regras"
        texto="Quando publicar, o regimento inteiro aparece aqui."
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Regimento interno</Text>
      <Text style={styles.meta}>
        versão {regras.versao} · atualizado {formatarDataHora(regras.atualizado_em)}
        {regras.autor ? ` por ${regras.autor}` : ''}
      </Text>

      <View style={styles.regua} />

      <Text style={styles.texto}>{regras.texto}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Documento se le sobre branco. O bege serve de fundo de lista, onde os
  // cartoes brancos saltam dele; aqui nao ha cartao, ha paragrafo.
  container: { flex: 1, backgroundColor: cores.superficie },
  conteudo: { paddingHorizontal: espaco.xl, paddingTop: espaco.lg, paddingBottom: espaco.xxl },
  titulo: { fontSize: 22, fontWeight: '800', color: cores.texto },
  meta: { fontSize: 14, color: cores.textoFraco, marginTop: espaco.xs },
  regua: {
    height: 1,
    backgroundColor: cores.borda,
    marginTop: espaco.lg,
    marginBottom: espaco.lg,
  },
  // Corpo de documento: um pouco maior e bem mais arejado que o texto de
  // card, porque aqui a pessoa lê parágrafos e não varre uma lista.
  texto: { fontSize: 18, color: cores.texto, lineHeight: 30 },
});
