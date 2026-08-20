import { View, Text, Button, StyleSheet } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export default function PerfilScreen({ session }: { session: Session }) {
  async function sair() {
    await supabase.auth.signOut();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.email}>{session.user.email}</Text>
      <View style={{ marginTop: 24 }}>
        <Button title="Sair" onPress={sair} color="#B6512E" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#F2EFE6' },
  title: { fontSize: 20, fontWeight: '700', color: '#1B4B66', marginBottom: 12 },
  email: { fontSize: 14, color: '#6B665D' },
});
