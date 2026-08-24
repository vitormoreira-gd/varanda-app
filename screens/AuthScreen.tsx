import { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { supabase } from '../lib/supabase';
import { cores, espaco, raio } from '../lib/tema';
import { Botao, Campo, EspacoTopo } from '../components/ui';
import { MODO_DEMO, PERFIS_DEMO, PerfilDemo, entrarComoDemo } from '../lib/demo';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);

  async function cadastrar() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    setBusy(false);

    if (error) {
      Alert.alert('Erro no cadastro', error.message);
      return;
    }
    // Com "Confirm email" desligado no Supabase, o signUp já devolve sessão e o
    // app entra sozinho no onboarding — não tem o que avisar. Com a confirmação
    // ligada, vem sessão nula e o usuário precisa mesmo passar pelo e-mail.
    if (!data.session) {
      Alert.alert('Confirme seu e-mail', 'Enviamos um link de confirmação. Depois é só entrar.');
    }
  }

  async function entrar() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setBusy(false);
    if (error) Alert.alert('Erro no login', error.message);
  }

  async function entrarDemo(perfil: PerfilDemo) {
    setBusy(true);
    const erro = await entrarComoDemo(perfil);
    setBusy(false);
    if (erro) {
      Alert.alert(
        `Não consegui entrar como ${perfil.rotulo}`,
        `${erro}\n\nA conta ${perfil.email} existe no Supabase? Veja db/seed-demo.sql.`
      );
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <EspacoTopo extra={espaco.xxl} />

      <Text style={styles.marca}>varanda</Text>
      <Text style={styles.tagline}>O canal oficial do seu condomínio</Text>

      {MODO_DEMO && (
        <View style={styles.demo}>
          <Text style={styles.demoTitulo}>Demonstração</Text>
          <Text style={styles.demoTexto}>
            Entre como cada papel pra ver o mesmo condomínio por olhos diferentes.
          </Text>
          <View style={styles.demoLista}>
            {PERFIS_DEMO.map((p) => (
              <Pressable
                key={p.chave}
                onPress={() => entrarDemo(p)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.demoBotao,
                  pressed && { opacity: 0.7 },
                  busy && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.demoIcone}>{p.icone}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoRotulo}>{p.rotulo}</Text>
                  <Text style={styles.demoResumo}>{p.resumo}</Text>
                </View>
                <Text style={styles.demoSeta}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {MODO_DEMO && <Text style={styles.divisor}>ou entre com sua conta</Text>}

      <Campo
        rotulo="E-mail"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="voce@exemplo.com"
        estilo={{ marginTop: espaco.lg }}
      />
      <Campo
        rotulo="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
        placeholder="mínimo 6 caracteres"
        estilo={{ marginTop: espaco.md }}
      />

      <Botao
        titulo="Entrar"
        onPress={entrar}
        disabled={busy}
        estilo={{ marginTop: espaco.xl }}
      />
      <Botao
        titulo="Criar conta"
        variante="secundario"
        onPress={cadastrar}
        disabled={busy}
        estilo={{ marginTop: espaco.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, paddingBottom: espaco.xxl },
  marca: { fontSize: 32, fontWeight: '800', color: cores.primaria, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: cores.textoFraco, marginTop: espaco.xs },

  demo: {
    marginTop: espaco.xxl,
    backgroundColor: cores.primariaFundo,
    borderRadius: raio.md,
    padding: espaco.lg,
  },
  demoTitulo: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: cores.primaria,
  },
  demoTexto: { fontSize: 13, color: cores.textoFraco, marginTop: espaco.xs, lineHeight: 18 },
  demoLista: { marginTop: espaco.md, gap: espaco.sm },
  demoBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    backgroundColor: cores.superficie,
    borderRadius: raio.sm,
    paddingVertical: espaco.md,
    paddingHorizontal: espaco.md,
  },
  demoIcone: { fontSize: 20 },
  demoRotulo: { fontSize: 14, fontWeight: '700', color: cores.texto },
  demoResumo: { fontSize: 12, color: cores.textoFraco, marginTop: 1 },
  demoSeta: { fontSize: 22, color: cores.textoFraco },

  divisor: {
    textAlign: 'center',
    fontSize: 12,
    color: cores.textoFraco,
    marginTop: espaco.xl,
  },
});
