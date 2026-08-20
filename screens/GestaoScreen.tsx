import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import VinculosPendentesScreen from './VinculosPendentesScreen';
import UnidadesScreen from './UnidadesScreen';
import CondominosScreen from './CondominosScreen';
import ModerarScreen from './ModerarScreen';
import OficialCriarScreen from './OficialCriarScreen';
import RegrasEditarScreen from './RegrasEditarScreen';

const ABAS = [
  { chave: 'vinculos', label: 'Vínculos' },
  { chave: 'condominos', label: 'Condôminos' },
  { chave: 'unidades', label: 'Unidades' },
  { chave: 'sugestoes', label: 'Sugestões' },
  { chave: 'problemas', label: 'Problemas' },
  { chave: 'oficial', label: 'Oficial' },
  { chave: 'regras', label: 'Regras' },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

export default function GestaoScreen() {
  const [aba, setAba] = useState<Aba>('vinculos');

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

      {aba === 'vinculos' && <VinculosPendentesScreen />}
      {aba === 'condominos' && <CondominosScreen />}
      {aba === 'unidades' && <UnidadesScreen />}
      {aba === 'sugestoes' && <ModerarScreen tipo="sugestoes" />}
      {aba === 'problemas' && <ModerarScreen tipo="problemas" />}
      {aba === 'oficial' && <OficialCriarScreen />}
      {aba === 'regras' && <RegrasEditarScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  seletor: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 60,
    marginHorizontal: 16,
    backgroundColor: '#E4DFD2',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  opcao: { flexGrow: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', minWidth: '45%' },
  opcaoAtiva: { backgroundColor: '#fff' },
  texto: { fontSize: 13, color: '#6B665D', fontWeight: '600' },
  textoAtivo: { color: '#1B4B66' },
});
