import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SugestoesScreen from './SugestoesScreen';
import ProblemasScreen from './ProblemasScreen';

export default function SolicitacoesScreen() {
  const [aba, setAba] = useState<'sugestoes' | 'problemas'>('sugestoes');

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EFE6' }}>
      <View style={styles.seletor}>
        <Pressable
          style={[styles.opcao, aba === 'sugestoes' && styles.opcaoAtiva]}
          onPress={() => setAba('sugestoes')}
        >
          <Text style={[styles.texto, aba === 'sugestoes' && styles.textoAtivo]}>Sugestões</Text>
        </Pressable>
        <Pressable
          style={[styles.opcao, aba === 'problemas' && styles.opcaoAtiva]}
          onPress={() => setAba('problemas')}
        >
          <Text style={[styles.texto, aba === 'problemas' && styles.textoAtivo]}>Problemas</Text>
        </Pressable>
      </View>

      {aba === 'sugestoes' ? <SugestoesScreen /> : <ProblemasScreen />}
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
  },
  opcao: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  opcaoAtiva: { backgroundColor: '#fff' },
  texto: { fontSize: 13, color: '#6B665D', fontWeight: '600' },
  textoAtivo: { color: '#1B4B66' },
});
