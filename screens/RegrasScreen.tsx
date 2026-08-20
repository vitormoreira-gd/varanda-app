import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { formatarDataHora } from '../lib/datas';

type RegrasBruto = {
  texto: string;
  versao: number;
  atualizado_em: string;
  usuarios: { nome: string } | { nome: string }[] | null;
};

type Regras = { texto: string; versao: number; atualizado_em: string; autor: string | null };

// Bloco de leitura das regras. Vive dentro da OficialScreen (não é uma aba
// própria) porque regimento é documento oficial, e uma aba só pra um texto
// que muda uma vez por ano não paga o espaço na barra.
export default function RegrasScreen() {
  const { condominioId } = useMeuCondominio();
  const [regras, setRegras] = useState<Regras | null>(null);
  const [aberto, setAberto] = useState(false);
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
      <>
        <Text style={styles.secao}>Regras do condomínio</Text>
        <Text style={styles.vazio}>O síndico ainda não publicou as regras.</Text>
      </>
    );
  }

  return (
    <>
      <Text style={styles.secao}>Regras do condomínio</Text>
      <View style={styles.card}>
        <Text style={styles.meta}>
          versão {regras.versao} · atualizado {formatarDataHora(regras.atualizado_em)}
          {regras.autor ? ` por ${regras.autor}` : ''}
        </Text>
        <Text style={styles.texto} numberOfLines={aberto ? undefined : 5}>
          {regras.texto}
        </Text>
        <Pressable onPress={() => setAberto(!aberto)} hitSlop={8}>
          <Text style={styles.link}>{aberto ? 'Recolher' : 'Ler tudo'}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  secao: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B665D', marginTop: 20, marginBottom: 8, fontWeight: '600' },
  vazio: { color: '#6B665D', fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E4DFD2' },
  meta: { fontSize: 12, color: '#6B665D' },
  texto: { fontSize: 13, color: '#211F1B', marginTop: 8, lineHeight: 20 },
  link: { fontSize: 12, color: '#1B4B66', fontWeight: '600', marginTop: 10 },
});
