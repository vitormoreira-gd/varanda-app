// Solicitações: tudo que é PEDIDO — eu peço, o síndico decide, tem estado.
//
// Reorganizada em 21/08/2026. Antes a aba misturava três coisas com naturezas
// diferentes: Sugestões (proposta em busca de adesão), Problemas (relato) e
// Salão (reserva). "Solicitação" carrega um contrato que sugestão não tem, e
// adesão o Mural já faz melhor — então Sugestões saiu do app e virou post.
// Problemas ficou, virou "Manutenção", porque relatar um vazamento é pedir um
// conserto: tem estado, prazo e alguém do outro lado pra responder.
//
// A criação saiu das listas e virou um botão + só, como no Mural: escolhe o
// tipo, preenche o formulário daquele tipo, envia. Isso devolve o topo de
// cada lista pro conteúdo e dá um lugar natural pra anunciar o que vem por aí.

import { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { cores, espaco, raio, sombra } from '../lib/tema';
import { SubAbas } from '../components/ui';
import CabecalhoApp from '../components/CabecalhoApp';
import ManutencaoScreen, { FormularioManutencao } from './ManutencaoScreen';
import ReservasScreen, { FormularioSalao } from './ReservasScreen';

const SUB_ABAS = [
  { chave: 'salao', label: 'Salão', icone: 'calendar-outline' },
  { chave: 'manutencao', label: 'Manutenção', icone: 'construct-outline' },
] as const;

type SubAba = (typeof SUB_ABAS)[number]['chave'];

type Tipo = {
  chave: SubAba | 'vaga' | 'dados';
  rotulo: string;
  resumo: string;
  icone: keyof typeof Ionicons.glyphMap;
  emBreve?: boolean;
};

// Os "em breve" moram aqui, e não como sub-abas vazias: o momento em que a
// pessoa pergunta "o que dá pra pedir?" é exatamente ao tocar no +. Uma aba
// que não faz nada só ocupa espaço na barra.
const TIPOS: Tipo[] = [
  {
    chave: 'salao',
    rotulo: 'Salão de festas',
    resumo: 'Reservar uma data',
    icone: 'calendar-outline',
  },
  {
    chave: 'manutencao',
    rotulo: 'Manutenção',
    resumo: 'Algo quebrado ou precisando de reparo',
    icone: 'construct-outline',
  },
  {
    chave: 'vaga',
    rotulo: 'Troca de vaga',
    resumo: 'Trocar de vaga na garagem com outro morador',
    icone: 'car-outline',
    emBreve: true,
  },
  {
    chave: 'dados',
    rotulo: 'Alteração de dados',
    resumo: 'Corrigir nome, unidade ou contato',
    icone: 'person-outline',
    emBreve: true,
  },
];

// A legenda do Salão depende do papel porque a lista depende: desde 22/08 o
// morador vê só as reservas da própria unidade — a disponibilidade das outras
// datas é entregue pelo calendário do formulário, não pela lista.
const LEGENDAS: Record<SubAba, { morador: string; gestor: string }> = {
  salao: {
    morador: 'As reservas da sua unidade. Toque no + para ver as datas livres',
    gestor: 'Todas as reservas do salão, para aprovar ou recusar',
  },
  manutencao: {
    morador: 'O que está quebrado, e o que já foi feito',
    gestor: 'O que está quebrado, e o que já foi feito',
  },
};

export default function SolicitacoesScreen() {
  const { podeGerir } = useMeuCondominio();
  const [aba, setAba] = useState<SubAba>('salao');
  const [criando, setCriando] = useState(false);
  // Contador que as listas observam: incrementar força o recarregamento
  // depois de uma criação feita pelo +, que vive fora delas.
  const [atualizacao, setAtualizacao] = useState(0);

  function aoCriar(tipo: SubAba) {
    setCriando(false);
    setAba(tipo);
    setAtualizacao((n) => n + 1);
  }

  return (
    <View style={styles.container}>
      <CabecalhoApp />
      <Text style={styles.legenda}>{LEGENDAS[aba][podeGerir ? 'gestor' : 'morador']}</Text>

      <View style={{ flex: 1 }}>
        {aba === 'salao' && <ReservasScreen atualizacao={atualizacao} />}
        {aba === 'manutencao' && <ManutencaoScreen atualizacao={atualizacao} />}
      </View>

      <SubAbas opcoes={SUB_ABAS} valor={aba} aoTrocar={setAba} />

      {/* Mesmo botão do Mural, mesma posição: a folga até a barra é igual à
          da lateral, e o inset inferior não entra na conta porque as barras
          de baixo já o consumiram. */}
      <Pressable
        onPress={() => setCriando(true)}
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Ionicons name="add" size={30} color={cores.textoClaro} />
      </Pressable>

      {criando && <ModalNovaSolicitacao aoFechar={() => setCriando(false)} aoCriar={aoCriar} />}
    </View>
  );
}

// ---------- CRIAÇÃO ----------
// Dois passos numa tela cheia: escolher o tipo, depois preencher. O formulário
// de cada tipo é diferente o bastante (o do Salão é calendário, o de
// Manutenção é texto e categoria) pra não caber num formulário único.

function ModalNovaSolicitacao({
  aoFechar,
  aoCriar,
}: {
  aoFechar: () => void;
  aoCriar: (tipo: SubAba) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tipo, setTipo] = useState<SubAba | null>(null);

  const escolhido = TIPOS.find((t) => t.chave === tipo);

  function escolher(t: Tipo) {
    if (t.emBreve) {
      Alert.alert(
        `${t.rotulo} — em breve`,
        'Esse tipo de solicitação ainda não está disponível. Por enquanto, fale com o síndico.'
      );
      return;
    }
    setTipo(t.chave as SubAba);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={aoFechar}>
      <View style={styles.container}>
        <View style={[styles.topo, { paddingTop: insets.top + espaco.sm }]}>
          <Pressable onPress={tipo ? () => setTipo(null) : aoFechar} hitSlop={14}>
            <Ionicons
              name={tipo ? 'chevron-back' : 'close'}
              size={26}
              color={cores.textoFraco}
            />
          </Pressable>
          <Text style={styles.topoTitulo}>{escolhido ? escolhido.rotulo : 'Nova solicitação'}</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.corpo} keyboardShouldPersistTaps="handled">
          {!tipo ? (
            <>
              <Text style={styles.pergunta}>O que você precisa solicitar?</Text>
              <View style={{ gap: espaco.sm, marginTop: espaco.lg }}>
                {TIPOS.map((t) => (
                  <Pressable
                    key={t.chave}
                    onPress={() => escolher(t)}
                    style={({ pressed }) => [
                      styles.tipo,
                      t.emBreve && styles.tipoEmBreve,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.tipoIcone, t.emBreve && styles.tipoIconeEmBreve]}>
                      <Ionicons
                        name={t.icone}
                        size={20}
                        color={t.emBreve ? cores.textoFraco : cores.primaria}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tipoRotulo, t.emBreve && styles.tipoTextoFraco]}>
                        {t.rotulo}
                      </Text>
                      <Text style={styles.tipoResumo}>{t.resumo}</Text>
                    </View>
                    {t.emBreve ? (
                      <Text style={styles.emBreve}>em breve</Text>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={cores.textoFraco} />
                    )}
                  </Pressable>
                ))}
              </View>
            </>
          ) : tipo === 'salao' ? (
            <FormularioSalao aoConcluir={() => aoCriar('salao')} />
          ) : (
            <FormularioManutencao aoConcluir={() => aoCriar('manutencao')} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  legenda: {
    fontSize: 14,
    color: cores.textoFraco,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.md,
    paddingBottom: espaco.md,
  },

  fab: {
    position: 'absolute',
    right: espaco.lg,
    // Acima da barra de sub-abas, não da barra de abas do app.
    bottom: 54 + espaco.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    ...sombra,
    elevation: 6,
  },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.md,
    backgroundColor: cores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  topoTitulo: { fontSize: 18, fontWeight: '800', color: cores.texto },
  corpo: { padding: espaco.lg, paddingBottom: espaco.xxl },
  pergunta: { fontSize: 20, fontWeight: '800', color: cores.texto },

  tipo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.md,
    padding: espaco.md,
  },
  tipoEmBreve: { backgroundColor: cores.superficieAlt },
  tipoIcone: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.primariaFundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipoIconeEmBreve: { backgroundColor: cores.borda },
  tipoRotulo: { fontSize: 17, fontWeight: '700', color: cores.texto },
  tipoTextoFraco: { color: cores.textoFraco },
  tipoResumo: { fontSize: 14, color: cores.textoFraco, marginTop: 1 },
  emBreve: { fontSize: 12, color: cores.textoFraco, fontStyle: 'italic' },
});
