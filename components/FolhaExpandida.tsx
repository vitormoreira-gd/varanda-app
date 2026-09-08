// Folha que sobe pela metade de baixo da tela. É o formato de "abrir um item"
// do app inteiro: post do Mural, aviso, reunião e votação.
//
// Meia tela, e não tela cheia, por alcance: a alcinha fica no meio da tela,
// onde o polegar chega sem reposicionar a mão. E sobra o fundo escurecido em
// cima, que também fecha ao toque — um alvo de metade da tela.
//
// Três saídas que funcionam, nenhuma exigindo mira:
//   1. tocar no fundo escurecido acima da folha;
//   2. tocar na faixa da alcinha (largura cheia);
//   3. arrastar a alcinha pra baixo.
//
// E uma que NÃO funciona, mantida sem custo: arrastar pra baixo sobre a área
// de conteúdo. No Android o ScrollView intercepta o toque no nível nativo
// (`onInterceptTouchEvent`), fora do sistema de responder do JS, então o
// PanResponder de ancestral nunca chega a ser consultado. Foram tentados
// gatilhos de 12px e de 3px (abaixo do slop nativo de ~8px) — nenhum resolve,
// porque o problema não é o limiar. A saída de verdade é
// `react-native-gesture-handler`, que hoje não está instalado.
// Ver armadilha nº20 do CONTEXTO antes de tentar de novo.

import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  GestureResponderHandlers,
} from 'react-native';
import { cores, espaco, raio } from '../lib/tema';
import { AvisoRapidoProvider } from './AvisoRapido';

/** Props que o chamador espalha na sua lista/scroll pra alimentar o gesto. */
export type PropsRolagem = {
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  onContentSizeChange: (largura: number, altura: number) => void;
  onLayout: (e: LayoutChangeEvent) => void;
};

export type ApiFolha = {
  propsRolagem: PropsRolagem;
  /** Espalhar no contêiner da área rolável pra habilitar o arrasto ali. */
  arrasto: GestureResponderHandlers;
};

/** Fração da tela ocupada pela folha. */
const ALTURA = 0.58;

// Abaixo do slop do ScrollView do Android (~8px), senão a lista ganha o gesto.
const GATILHO_CONTEUDO = 3;
const GATILHO_BARRA = 3;

const DISTANCIA_PRA_FECHAR = 90;
const VELOCIDADE_PRA_FECHAR = 0.7;

export default function FolhaExpandida({
  aoFechar,
  children,
  rodape,
}: {
  aoFechar: () => void;
  children: (api: ApiFolha) => ReactNode;
  /** Barra fixa no rodapé — o campo de comentário do Mural. */
  rodape?: ReactNode;
}) {
  const alturaFolha = Dimensions.get('window').height * ALTURA;
  const deslocamento = useRef(new Animated.Value(alturaFolha)).current;

  // Refs, e não estado: quem lê é o PanResponder, criado uma vez só. Com
  // estado ele enxergaria para sempre o valor do primeiro render.
  const noTopo = useRef(true);
  const rolavel = useRef(false);
  const alturaArea = useRef(0);

  // Entrada por conta própria em vez de animationType="slide" do Modal: assim
  // o fundo escurecido acompanha o movimento em vez de deslizar junto.
  useEffect(() => {
    Animated.spring(deslocamento, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 2,
      speed: 14,
    }).start();
  }, [deslocamento]);

  const fechar = useCallback(() => {
    Animated.timing(deslocamento, {
      toValue: alturaFolha,
      duration: 170,
      useNativeDriver: true,
      // Sem `setValue(0)` depois de terminar: era isso que fazia a folha
      // reaparecer inteira por um quadro antes de o pai desmontá-la. Ela é
      // remontada do zero na próxima abertura, então não há o que restaurar.
    }).start(() => aoFechar());
  }, [alturaFolha, aoFechar, deslocamento]);

  const voltar = useCallback(() => {
    Animated.spring(deslocamento, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }, [deslocamento]);

  const criarArrasto = useCallback(
    (podeAssumir: (dy: number, dx: number) => boolean) =>
      PanResponder.create({
        // `false` no start deixa toque simples e rolagem chegarem aos filhos.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_e, g) => podeAssumir(g.dy, g.dx),
        onMoveShouldSetPanResponderCapture: (_e, g) => podeAssumir(g.dy, g.dx),
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) deslocamento.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISTANCIA_PRA_FECHAR || g.vy > VELOCIDADE_PRA_FECHAR) fechar();
          else voltar();
        },
        onPanResponderTerminate: voltar,
      }),
    [deslocamento, fechar, voltar]
  );

  // Na faixa da alcinha qualquer arrasto pra baixo vale: não há o que rolar.
  const arrastoBarra = useMemo(
    () => criarArrasto((dy, dx) => dy > GATILHO_BARRA && Math.abs(dy) > Math.abs(dx)),
    [criarArrasto]
  );

  // No conteúdo, só quando não há para onde rolar pra cima. `rolavel` cobre o
  // caso de a lista ser curta demais pra emitir evento de rolagem — sem ele,
  // conteúdo que não rola nunca liberava o gesto.
  const arrastoConteudo = useMemo(
    () =>
      criarArrasto(
        (dy, dx) =>
          (!rolavel.current || noTopo.current) &&
          dy > GATILHO_CONTEUDO &&
          Math.abs(dy) > Math.abs(dx)
      ),
    [criarArrasto]
  );

  const api: ApiFolha = {
    arrasto: arrastoConteudo.panHandlers,
    propsRolagem: {
      onScroll: (e) => {
        noTopo.current = e.nativeEvent.contentOffset.y <= 2;
      },
      scrollEventThrottle: 16,
      onContentSizeChange: (_largura, altura) => {
        rolavel.current = altura > alturaArea.current + 4;
      },
      onLayout: (e) => {
        alturaArea.current = e.nativeEvent.layout.height;
      },
    },
  };

  // O fundo some junto com o arrasto: a folha "leva" o escurecimento embora.
  const opacidadeFundo = deslocamento.interpolate({
    inputRange: [0, alturaFolha],
    outputRange: [0.4, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={fechar}>
      <View style={styles.raiz}>
        <Animated.View style={[styles.fundo, { opacity: opacidadeFundo }]} pointerEvents="none" />
        <Pressable style={styles.areaFundo} onPress={fechar} />

        <Animated.View
          style={[
            styles.folha,
            { height: alturaFolha, transform: [{ translateY: deslocamento }] },
          ]}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Faixa da alcinha: largura cheia, de ponta a ponta. O alvo é a
                faixa toda — fechar não pode exigir mira. */}
            <View {...arrastoBarra.panHandlers}>
              <Pressable
                onPress={fechar}
                style={({ pressed }) => [styles.barra, pressed && styles.barraPressionada]}
              >
                <View style={styles.pegador} />
              </Pressable>
            </View>

            {/* Provider próprio: Modal é janela nativa separada, e um balão
                montado na árvore de fora ficaria atrás dela. A margem maior
                deixa o balão acima do rodapé fixo. */}
            <AvisoRapidoProvider margemInferior={rodape ? 96 : espaco.xl}>
              {children(api)}
            </AvisoRapidoProvider>

            {rodape}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, justifyContent: 'flex-end' },
  fundo: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  // Alvo de toque separado do véu animado: o véu é pointerEvents="none" pra
  // não competir com o gesto, então quem recebe o toque é esta camada.
  areaFundo: { flex: 1 },
  folha: {
    backgroundColor: cores.superficie,
    borderTopLeftRadius: raio.md * 1.6,
    borderTopRightRadius: raio.md * 1.6,
    overflow: 'hidden',
  },
  barra: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: espaco.lg,
    paddingBottom: espaco.md,
    minHeight: 40,
  },
  barraPressionada: { backgroundColor: cores.superficieAlt },
  // A alcinha que todo mundo já sabe que se puxa pra baixo.
  // Escura e curta. Em cinza-borda ela quase sumia sobre o branco da folha,
   // e é ela que anuncia o gesto de arrastar pra fechar.
  pegador: {
    width: 52,
    height: 6,
    borderRadius: 3,
    backgroundColor: cores.texto,
  },
});
