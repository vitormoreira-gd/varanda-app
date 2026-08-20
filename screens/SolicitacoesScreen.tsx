import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SugestoesScreen from './SugestoesScreen';
import ProblemasScreen from './ProblemasScreen';
import ReservasScreen from './ReservasScreen';

const ABAS = [
  { chave: 'sugestoes', label: 'Sugestões' },
  { chave: 'problemas', label: 'Problemas' },
  { chave: 'reservas', label: 'Salão' },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

export default function SolicitacoesScreen() {
  const [aba, setAba] = useState<Aba>('sugestoes');

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EFE6' }}>
      <View style={styles.seletor}>
        {ABAS.map((a) => (
          <Pressable
            key={a.chave}
            style={[styles.opcao, aba === a.chave && styles.opcaoAtiva]}
            onPress={() => setAba(a.chave)}
          >
            <Text style={[styles.texto, aba === a.chave && styles.textoAtivo]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {aba === 'sugestoes' && <SugestoesScreen />}
      {aba === 'problemas' && <ProblemasScreen />}
      {aba === 'reservas' && <ReservasScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  seletor: {
    flexDirection: 'row',
    marginTop: 60,
    marginHorizontal: 16,
    backgroundColor: '#E4DFD2',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  opcao: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  opcaoAtiva: { backgroundColor: '#fff' },
  texto: { fontSize: 13, color: '#6B665D', fontWeight: '600' },
  textoAtivo: { color: '#1B4B66' },
});
