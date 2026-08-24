import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { cores, espaco, raio } from '../lib/tema';
import { Seletor } from '../components/ui';
import CabecalhoApp from '../components/CabecalhoApp';
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
  { chave: 'manutencao', label: 'Manutenção' },
  { chave: 'oficial', label: 'Oficial' },
  { chave: 'regras', label: 'Regras' },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

// O conselho fiscal entra aqui só pra olhar: vê quem mora no prédio e o
// andamento das solicitações, sem nenhum botão que escreva. As abas que
// faltam não são escondidas por educação — o RLS recusaria a escrita de
// qualquer jeito, e update recusado por RLS falha calado (armadilha nº4).
const ABAS_CONSELHO: Aba[] = ['condominos', 'manutencao'];

export default function GestaoScreen() {
  const { podeGerir, ehSindico, cargo } = useMeuCondominio();
  const abas = podeGerir ? ABAS : ABAS.filter((a) => ABAS_CONSELHO.includes(a.chave));
  const [aba, setAba] = useState<Aba>(podeGerir ? 'vinculos' : 'condominos');
  const somenteLeitura = !podeGerir;

  const quem = ehSindico ? 'Síndico' : cargo === 'subsindico' ? 'Subsíndico' : 'Conselho fiscal';

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <CabecalhoApp />
      <Text style={styles.legenda}>Gestão · {quem}</Text>

      {somenteLeitura && (
        <View style={styles.faixa}>
          <Text style={styles.faixaTexto}>
            👓 Somente leitura — o conselho acompanha, mas não altera nada
          </Text>
        </View>
      )}

      <Seletor opcoes={abas} valor={aba} aoTrocar={setAba} />

      <View style={{ flex: 1, marginTop: espaco.md }}>
        {aba === 'vinculos' && <VinculosPendentesScreen />}
        {aba === 'condominos' && <CondominosScreen />}
        {aba === 'unidades' && <UnidadesScreen />}
        {aba === 'manutencao' && <ModerarScreen somenteLeitura={somenteLeitura} />}
        {aba === 'oficial' && <OficialCriarScreen />}
        {aba === 'regras' && <RegrasEditarScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legenda: {
    fontSize: 12,
    color: cores.textoFraco,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.md,
    paddingBottom: espaco.sm,
  },
  faixa: {
    marginHorizontal: espaco.lg,
    marginBottom: espaco.md,
    backgroundColor: cores.atencaoFundo,
    borderRadius: raio.sm,
    paddingVertical: espaco.sm,
    paddingHorizontal: espaco.md,
  },
  faixaTexto: { fontSize: 12, color: cores.atencao, fontWeight: '600' },
});
