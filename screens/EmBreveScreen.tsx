import { View, Text, StyleSheet } from 'react-native';

export default function EmBreveScreen({ nome }: { nome: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.texto}>{nome} — em construção</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2EFE6' },
  texto: { color: '#6B665D' },
});
