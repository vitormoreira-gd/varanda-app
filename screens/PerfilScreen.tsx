import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { cores, espaco, raio } from '../lib/tema';
import { Avatar, Botao, Cartao, Etiqueta, Secao } from '../components/ui';
import { MODO_DEMO, PERFIS_DEMO, PerfilDemo, entrarComoDemo } from '../lib/demo';

// Aberto como modal a partir do avatar no cabeçalho, não mais como aba.
export default function PerfilScreen({ aoFechar }: { aoFechar: () => void }) {
  const { nome, fotoUrl, unidadeRotulo, rotuloConta, condominioNome, ehSindico, cargo } =
    useMeuCondominio();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function trocarPara(perfil: PerfilDemo) {
    setTrocando(true);
    const erro = await entrarComoDemo(perfil);
    setTrocando(false);
    if (erro) {
      Alert.alert(`Não consegui entrar como ${perfil.rotulo}`, erro);
      return;
    }
    // A troca de sessão remonta o app inteiro (o `key` no AppLogado), então
    // fechar aqui evita o modal sobreviver por cima da árvore nova.
    aoFechar();
  }

  function confirmarSaida() {
    Alert.alert('Sair da conta', 'Você vai precisar entrar de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topo, { paddingTop: insets.top + espaco.sm }]}>
        <Text style={styles.topoTitulo}>Perfil</Text>
        <Pressable
          onPress={aoFechar}
          hitSlop={12}
          style={({ pressed }) => pressed && { opacity: 0.5 }}
        >
          <Ionicons name="close" size={26} color={cores.textoFraco} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.conteudo}>
        <Cartao>
          <View style={styles.identidade}>
            <Avatar nome={nome} fotoUrl={fotoUrl} tamanho={60} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{nome ?? 'Sem nome'}</Text>
              {email ? <Text style={styles.email}>{email}</Text> : null}
              {condominioNome ? <Text style={styles.condominio}>{condominioNome}</Text> : null}
            </View>
          </View>

          <View style={styles.etiquetas}>
            {unidadeRotulo ? <Etiqueta texto={unidadeRotulo} tom="info" /> : null}
            <Etiqueta texto={rotuloConta} tom={cargo === 'conselho' ? 'atencao' : 'info'} />
            {ehSindico && <Etiqueta texto="pode tudo" tom="neutro" />}
          </View>
        </Cartao>

        {MODO_DEMO && (
          <>
            <Secao titulo="Trocar de papel" />
            <Text style={styles.dica}>
              Só aparece no modo demonstração. Cada papel é uma conta de verdade — o que some da
              tela some porque o banco recusou, não porque o app escondeu.
            </Text>
            <View style={styles.lista}>
              {PERFIS_DEMO.map((p) => {
                const ativo = p.email === email;
                return (
                  <Pressable
                    key={p.chave}
                    onPress={() => trocarPara(p)}
                    disabled={ativo || trocando}
                    style={({ pressed }) => [
                      styles.papel,
                      ativo && styles.papelAtivo,
                      pressed && !ativo && { opacity: 0.7 },
                      trocando && { opacity: 0.4 },
                    ]}
                  >
                    <Text style={styles.papelIcone}>{p.icone}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.papelRotulo}>{p.rotulo}</Text>
                      <Text style={styles.papelResumo}>{p.resumo}</Text>
                    </View>
                    {ativo ? <Text style={styles.aqui}>você está aqui</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Botao
          titulo="Sair da conta"
          variante="perigo"
          onPress={confirmarSaida}
          estilo={{ marginTop: espaco.xl }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.md,
    backgroundColor: cores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  topoTitulo: { fontSize: 22, fontWeight: '800', color: cores.primaria },
  conteudo: { padding: espaco.lg, paddingBottom: espaco.xxl },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: espaco.lg },
  nome: { fontSize: 20, fontWeight: '800', color: cores.texto },
  email: { fontSize: 15, color: cores.textoFraco, marginTop: 2 },
  condominio: { fontSize: 14, color: cores.textoFraco, marginTop: 2 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginTop: espaco.lg },
  dica: { fontSize: 14, color: cores.textoFraco, lineHeight: 21, marginBottom: espaco.md },
  lista: { gap: espaco.sm },
  papel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.sm,
    padding: espaco.md,
  },
  papelAtivo: { borderColor: cores.primaria, backgroundColor: cores.primariaFundo },
  papelIcone: { fontSize: 22 },
  papelRotulo: { fontSize: 16, fontWeight: '700', color: cores.texto },
  papelResumo: { fontSize: 14, color: cores.textoFraco, marginTop: 1 },
  aqui: { fontSize: 12, fontWeight: '700', color: cores.primaria, textTransform: 'uppercase' },
});
