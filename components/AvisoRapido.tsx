// Mensagem flutuante de confirmação — o "presença confirmada" que aparece,
// espera uns segundos e some sozinha.
//
// Três regras que definem o componente:
//   1. Não bloqueia nada: o balão é `pointerEvents="none"`, então nem o toque
//      nem a rolagem passam por ele.
//   2. Não exige interação pra sair: some sozinho depois de ~2,6s.
//   3. Qualquer toque do usuário antecipa a saída. Isso vem de um "farejador"
//      de toques — um `onStartShouldSetResponderCapture` que devolve `false`.
//      Ele é consultado em todo toque, da raiz pra baixo, e devolver `false`
//      significa "não quero ser o responsável": o toque segue o caminho
//      normal até o filho. É observar sem interceptar.
//
// POR QUE É UM PROVIDER, E POR QUE PODE HAVER MAIS DE UM:
//
// Modal do React Native é uma janela nativa separada. Um balão renderizado na
// árvore principal fica ATRÁS de qualquer modal aberto — invisível justamente
// quando a ação acontece dentro da FolhaExpandida. Por isso a folha monta o
// próprio provider: o `useAvisoRapido` resolve pelo provider mais próximo na
// árvore de render, então quem está dentro da folha mostra na folha, e quem
// está fora mostra na tela.

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { cores, espaco, raio, sombra } from '../lib/tema';

const DURACAO_MS = 2600;

type Contexto = { mostrar: (texto: string) => void };

const AvisoContexto = createContext<Contexto>({ mostrar: () => {} });

export function useAvisoRapido() {
  return useContext(AvisoContexto);
}

export function AvisoRapidoProvider({
  children,
  margemInferior = espaco.xl,
}: {
  children: ReactNode;
  /** Distância até a base. A folha passa um valor maior pra não cobrir o rodapé. */
  margemInferior?: number;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const opacidade = useRef(new Animated.Value(0)).current;
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Espelha `texto` pra ser lido dentro do farejador sem closure velha.
  const visivel = useRef(false);

  const limparRelogio = () => {
    if (relogio.current) {
      clearTimeout(relogio.current);
      relogio.current = null;
    }
  };

  const esconder = useCallback(() => {
    if (!visivel.current) return;
    visivel.current = false;
    limparRelogio();
    Animated.timing(opacidade, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setTexto(null));
  }, [opacidade]);

  const mostrar = useCallback(
    (novo: string) => {
      limparRelogio();
      visivel.current = true;
      setTexto(novo);
      Animated.timing(opacidade, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
      relogio.current = setTimeout(esconder, DURACAO_MS);
    },
    [esconder, opacidade]
  );

  useEffect(() => limparRelogio, []);

  return (
    <AvisoContexto.Provider value={{ mostrar }}>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          if (visivel.current) esconder();
          return false; // observa e devolve o toque a quem for de direito
        }}
      >
        {children}

        {texto !== null && (
          <Animated.View
            pointerEvents="none"
            style={[styles.balao, { bottom: margemInferior, opacity: opacidade }]}
          >
            <Text style={styles.texto}>{texto}</Text>
          </Animated.View>
        )}
      </View>
    </AvisoContexto.Provider>
  );
}

const styles = StyleSheet.create({
  balao: {
    position: 'absolute',
    left: espaco.xl,
    right: espaco.xl,
    alignItems: 'center',
    backgroundColor: cores.texto,
    borderRadius: raio.pill,
    paddingVertical: espaco.md,
    paddingHorizontal: espaco.lg,
    ...sombra,
    elevation: 8,
  },
  texto: { color: cores.textoClaro, fontSize: 16, fontWeight: '700' },
});
