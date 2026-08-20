import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);

  async function cadastrar() {
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password: senha });
    setBusy(false);
    if (error) Alert.alert('Erro no cadastro', error.message);
    else Alert.alert('Conta criada', 'Agora faça login.');
  }

  async function entrar() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setBusy(false);
    if (error) Alert.alert('Erro no login', error.message);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>varanda</Text>
      <Text style={styles.label}>E-mail</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="voce@exemplo.com"
      />
      <Text style={styles.label}>Senha</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
        placeholder="mínimo 6 caracteres"
      />
      <View style={styles.row}>
        <Button title="Cadastrar" onPress={cadastrar} disabled={busy} />
        <Button title="Entrar" onPress={entrar} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80, backgroundColor: '#F2EFE6' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 24, color: '#1B4B66' },
  label: { fontSize: 13, color: '#6B665D', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#E4DFD2', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
});
