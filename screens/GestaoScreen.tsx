import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useMeuCondominio } from '../lib/useMeuCondominio';
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

// O conselho fiscal entra aqui só pra olhar: vê quem mora no prédio e o
// andamento das solicitações, sem nenhum botão que escreva. As abas que
// faltam não são escondidas por educação — o RLS recusaria a escrita de
// qualquer jeito, e update recusado por RLS falha calado (armadilha nº4).
const ABAS_CONSELHO: Aba[] = ['condominos', 'sugestoes', 'problemas'];

export default function GestaoScreen() {
  const { podeGerir } = useMeuCondominio();
  const abas = podeGerir ? ABAS : ABAS.filter((a) => ABAS_CONSELHO.includes(a.chave));
  const [aba, setAba] = useState<Aba>(podeGerir ? 'vinculos' : 'condominos');
  const somenteLeitura = !podeGerir;

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EFE6' }}>
      {somenteLeitura && (
        <Text style={styles.avisoLeitura}>
          Conselho fiscal · somente leitura
        </Text>
      )}
      <View style={[styles.seletor, somenteLeitura && styles.seletorComAviso]}>
        {abas.map((a) => (
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
      {aba === 'sugestoes' && <ModerarScreen tipo="sugestoes" somenteLeitura={somenteLeitura} />}
      {aba === 'problemas' && <ModerarScreen tipo="problemas" somenteLeitura={somenteLeitura} />}
      {aba === 'oficial' && <OficialCriarScreen />}
      {aba === 'regras' && <RegrasEditarScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  avisoLeitura: {
    marginTop: 56,
    marginHorizontal: 16,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#C98A1F',
  },
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
  seletorComAviso: { marginTop: 10 },
  opcao: { flexGrow: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', minWidth: '45%' },
  opcaoAtiva: { backgroundColor: '#fff' },
  texto: { fontSize: 13, color: '#6B665D', fontWeight: '600' },
  textoAtivo: { color: '#1B4B66' },
});
