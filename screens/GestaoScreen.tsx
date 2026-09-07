import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { cores, espaco, raio } from '../lib/tema';
import { Seletor, SubAbas } from '../components/ui';
import CabecalhoApp from '../components/CabecalhoApp';
import VinculosPendentesScreen from './VinculosPendentesScreen';
import UnidadesScreen from './UnidadesScreen';
import CondominosScreen from './CondominosScreen';
import ModerarScreen from './ModerarScreen';
import OficialCriarScreen from './OficialCriarScreen';
import RegrasEditarScreen from './RegrasEditarScreen';

// Gestão passou a usar a barra de sub-abas de baixo, como Oficial e
// Solicitações. Era a única aba fora do padrão: usava o `Seletor` de pílulas
// rolando na horizontal, no topo.
//
// Os seis destinos não cabiam na barra — com seis itens sobra ~60dp pra cada
// um, e "Condôminos" e "Manutenção" truncariam. Três deles respondem à mesma
// pergunta ("quem mora aqui"), então viraram painéis dentro de "Moradores" e
// a barra ficou com quatro, igual ao Oficial.
const SUB_ABAS = [
  { chave: 'moradores', label: 'Moradores', icone: 'people-outline' },
  { chave: 'manutencao', label: 'Manutenção', icone: 'construct-outline' },
  { chave: 'oficial', label: 'Oficial', icone: 'megaphone-outline' },
  { chave: 'regras', label: 'Regras', icone: 'document-text-outline' },
] as const;

type SubAba = (typeof SUB_ABAS)[number]['chave'];

const PAINEIS = [
  { chave: 'vinculos', label: 'Vínculos' },
  { chave: 'condominos', label: 'Condôminos' },
  { chave: 'unidades', label: 'Unidades' },
] as const;

type Painel = (typeof PAINEIS)[number]['chave'];

// O conselho fiscal entra aqui só pra olhar: vê quem mora no prédio e o
// andamento das solicitações, sem nenhum botão que escreva. O que falta não
// é escondido por educação — o RLS recusaria a escrita de qualquer jeito, e
// update recusado por RLS falha calado (armadilha nº4).
const SUB_ABAS_CONSELHO: SubAba[] = ['moradores', 'manutencao'];
const PAINEIS_CONSELHO: Painel[] = ['condominos'];

export default function GestaoScreen() {
  const { podeGerir, ehSindico, cargo } = useMeuCondominio();
  const somenteLeitura = !podeGerir;

  const subAbas = podeGerir
    ? SUB_ABAS
    : SUB_ABAS.filter((a) => SUB_ABAS_CONSELHO.includes(a.chave));
  const paineis = podeGerir
    ? PAINEIS
    : PAINEIS.filter((p) => PAINEIS_CONSELHO.includes(p.chave));

  const [sub, setSub] = useState<SubAba>('moradores');
  const [painel, setPainel] = useState<Painel>(podeGerir ? 'vinculos' : 'condominos');
  const [pendentes, setPendentes] = useState(0);

  // Contagem inicial do badge. Depois dela quem manda é o próprio
  // VinculosPendentesScreen, que devolve o número a cada carregamento — é o
  // que faz a bolinha sumir no instante em que o síndico aprova alguém.
  //
  // Erro aqui não vira Alert de propósito: a armadilha nº3 fala de ação que
  // parece não ter feito nada, e badge é decoração. Um alerta no meio da
  // apresentação seria pior que a bolinha faltando.
  const contarPendentes = useCallback(async () => {
    if (!podeGerir) return;
    const { count } = await supabase
      .from('vinculos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente');
    setPendentes(count ?? 0);
  }, [podeGerir]);

  useEffect(() => {
    contarPendentes();
  }, [contarPendentes]);

  // O badge só vale pra quem pode aprovar. Pro conselho fiscal seria cobrança
  // de uma tarefa que ele não tem como cumprir.
  const abasComBadge = subAbas.map((a) =>
    a.chave === 'moradores' && podeGerir && pendentes > 0 ? { ...a, badge: pendentes } : a
  );

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

      {/* Os painéis de Moradores só aparecem quando há mais de um: pro conselho
          fiscal sobra Condôminos, e uma pílula sozinha não é escolha. */}
      {sub === 'moradores' && paineis.length > 1 && (
        <Seletor opcoes={paineis} valor={painel} aoTrocar={setPainel} />
      )}

      <View style={{ flex: 1, marginTop: espaco.md }}>
        {sub === 'moradores' && painel === 'vinculos' && (
          <VinculosPendentesScreen aoContar={setPendentes} />
        )}
        {sub === 'moradores' && painel === 'condominos' && <CondominosScreen />}
        {sub === 'moradores' && painel === 'unidades' && <UnidadesScreen />}
        {sub === 'manutencao' && <ModerarScreen somenteLeitura={somenteLeitura} />}
        {sub === 'oficial' && <OficialCriarScreen />}
        {sub === 'regras' && <RegrasEditarScreen />}
      </View>

      <SubAbas opcoes={abasComBadge} valor={sub} aoTrocar={setSub} />
    </View>
  );
}

const styles = StyleSheet.create({
  legenda: {
    fontSize: 14,
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
  faixaTexto: { fontSize: 14, color: cores.atencao, fontWeight: '600' },
});
