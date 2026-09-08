// Peças visuais compartilhadas. Existem por dois motivos:
//
// 1. O `Button` do React Native não aceita estilo. No Android ele renderiza
//    azul e em CAIXA ALTA, ignorando a paleta inteira do app — era a coisa
//    mais destoante de todas as telas.
// 2. Cartão, etiqueta de status, chip de categoria e estado vazio estavam
//    copiados e colados em quase toda tela, já com pequenas divergências.

import { ReactNode } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, espaco, raio, sombra } from '../lib/tema';

// ---------- BOTÃO ----------

type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma';

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  disabled,
  carregando,
  pequeno,
  estilo,
}: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBotao;
  disabled?: boolean;
  carregando?: boolean;
  pequeno?: boolean;
  estilo?: ViewStyle;
}) {
  const inativo = disabled || carregando;
  const v = VARIANTES[variante];

  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      style={({ pressed }) => [
        b.base,
        pequeno && b.pequeno,
        { backgroundColor: v.fundo, borderColor: v.borda },
        pressed && !inativo && b.pressionado,
        inativo && b.inativo,
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator size="small" color={v.texto} />
      ) : (
        <Text style={[b.texto, pequeno && b.textoPequeno, { color: v.texto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

// O texto do botão primário é ESCURO, não branco. O laranja é claro demais:
// branco sobre ele dá cerca de 2:1 de contraste, abaixo de qualquer mínimo
// legível — e o público desta fase é de gente de mais idade. Escuro sobre
// laranja passa de 6:1, e é o mesmo tratamento da barra do topo.
//
// No secundário o rótulo também é escuro: laranja sobre branco tem o mesmo
// problema em texto de 16px.
const VARIANTES: Record<VarianteBotao, { fundo: string; borda: string; texto: string }> = {
  primario: { fundo: cores.primaria, borda: cores.primaria, texto: cores.texto },
  secundario: { fundo: cores.superficie, borda: cores.borda, texto: cores.texto },
  perigo: { fundo: cores.superficie, borda: cores.perigo, texto: cores.perigo },
  fantasma: { fundo: 'transparent', borda: 'transparent', texto: cores.textoFraco },
};

const b = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderRadius: raio.pill,
    paddingVertical: 11,
    paddingHorizontal: espaco.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // alvo de toque confortável
  },
  pequeno: { paddingVertical: 6, paddingHorizontal: espaco.md, minHeight: 34 },
  pressionado: { opacity: 0.75 },
  inativo: { opacity: 0.4 },
  texto: { fontSize: 16, fontWeight: '700' },
  textoPequeno: { fontSize: 14 },
});

// ---------- LINK (ação textual, sem peso de botão) ----------

export function Link({
  titulo,
  onPress,
  tom = 'primaria',
}: {
  titulo: string;
  onPress: () => void;
  tom?: 'primaria' | 'perigo' | 'fraco';
}) {
  const cor = tom === 'perigo' ? cores.perigo : tom === 'fraco' ? cores.textoFraco : cores.primaria;
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      {({ pressed }) => (
        <Text style={[l.texto, { color: cor }, pressed && { opacity: 0.6 }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const l = StyleSheet.create({
  texto: { fontSize: 15, fontWeight: '600' },
});

// ---------- AVATAR ----------

/** "Ana Paula Ribeiro" -> "AR" */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// O app nunca coletou foto: `usuarios.foto_url` existe no schema desde o
// começo e nenhuma tela jamais gravou nela. O componente já lê a coluna pra
// quando existir upload, mas na prática todo mundo cai nas iniciais.
export function Avatar({
  nome,
  fotoUrl,
  tamanho = 40,
}: {
  nome: string | null;
  fotoUrl?: string | null;
  tamanho?: number;
}) {
  const estiloBase = {
    width: tamanho,
    height: tamanho,
    borderRadius: tamanho / 2,
  };

  if (fotoUrl) {
    return <Image source={{ uri: fotoUrl }} style={[av.foto, estiloBase]} />;
  }

  return (
    <View style={[av.base, estiloBase]}>
      <Text style={[av.texto, { fontSize: tamanho * 0.36 }]}>{iniciais(nome ?? '?')}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  base: {
    backgroundColor: cores.primariaFundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foto: { backgroundColor: cores.borda },
  texto: { fontWeight: '800', color: cores.primaria },
});

// ---------- CARTÃO ----------

export function Cartao({
  children,
  estilo,
  destaque,
}: {
  children: ReactNode;
  estilo?: ViewStyle;
  /** Faixa lateral colorida — usada em aviso fixado, item cancelado etc. */
  destaque?: string;
}) {
  return (
    <View
      style={[
        c.card,
        destaque ? { borderLeftWidth: 4, borderLeftColor: destaque } : null,
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    padding: espaco.xl,
    marginBottom: espaco.md,
    // Sem borda: com o fundo cinza, o branco do cartão já se separa sozinho.
    // Borda mais sombra deixava cada cartão parecendo uma caixa de diálogo.
    // `overflow: hidden` é o que faz a faixa lateral respeitar o arredondado.
    overflow: 'hidden',
    ...sombra,
  },
});

// ---------- CAMPO DE TEXTO ----------

export function Campo({
  rotulo,
  estilo,
  ...props
}: TextInputProps & { rotulo?: string; estilo?: ViewStyle }) {
  return (
    <View style={estilo}>
      {rotulo ? <Text style={ca.rotulo}>{rotulo}</Text> : null}
      <TextInput
        placeholderTextColor={cores.textoFraco}
        {...props}
        style={[ca.input, props.multiline && ca.multiline, props.style]}
      />
    </View>
  );
}

const ca = StyleSheet.create({
  rotulo: {
    fontSize: 14,
    fontWeight: '600',
    color: cores.textoFraco,
    marginBottom: espaco.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.sm,
    paddingHorizontal: espaco.md,
    paddingVertical: 10,
    backgroundColor: cores.superficie,
    color: cores.texto,
    fontSize: 16,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});

// ---------- CHIP (escolha de categoria, opção de votação) ----------

export function Chip({
  titulo,
  ativo,
  onPress,
  disabled,
}: {
  titulo: string;
  ativo?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        ch.chip,
        ativo && ch.ativo,
        pressed && !disabled && { opacity: 0.7 },
        disabled && !ativo && { opacity: 0.5 },
      ]}
    >
      <Text style={[ch.texto, ativo && ch.textoAtivo]}>{titulo}</Text>
    </Pressable>
  );
}

const ch = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.pill,
    paddingVertical: 7,
    paddingHorizontal: espaco.md,
    backgroundColor: cores.superficie,
  },
  ativo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  texto: { fontSize: 14, color: cores.textoFraco, fontWeight: '600' },
  textoAtivo: { color: cores.textoClaro },
});

// ---------- ETIQUETA DE STATUS ----------

export type Tom = 'neutro' | 'atencao' | 'critico' | 'ok' | 'restrito' | 'info';

const TONS: Record<Tom, { bg: string; cor: string }> = {
  neutro: { bg: cores.borda, cor: cores.textoFraco },
  atencao: { bg: cores.atencaoFundo, cor: cores.atencao },
  critico: { bg: cores.perigoFundo, cor: cores.perigo },
  ok: { bg: cores.sucessoFundo, cor: cores.sucesso },
  restrito: { bg: cores.restritoFundo, cor: cores.restrito },
  info: { bg: cores.primariaFundo, cor: cores.primaria },
};

export function corDoTom(tom: Tom): string {
  return TONS[tom].cor;
}

export function Etiqueta({ texto, tom = 'neutro' }: { texto: string; tom?: Tom }) {
  const t = TONS[tom];
  return (
    <View style={[e.base, { backgroundColor: t.bg }]}>
      <Text style={[e.texto, { color: t.cor }]}>{texto}</Text>
    </View>
  );
}

const e = StyleSheet.create({
  base: {
    borderRadius: raio.pill,
    // Cresceu junto com o texto (10 -> 12): a pílula apertada em volta de
    // letra maior lê como erro de layout, não como etiqueta.
    paddingVertical: 4,
    paddingHorizontal: 11,
    alignSelf: 'flex-start',
  },
  texto: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ---------- ESPAÇO DE TOPO ----------

// O cabeçalho das abas logadas é o `components/CabecalhoApp`. Isto aqui serve
// só às telas de fora do app (login e onboarding), que não têm cabeçalho e
// precisam apenas respeitar o recorte da tela.
export function EspacoTopo({ extra = 0 }: { extra?: number }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top + extra }} />;
}

// ---------- SELETOR (abas internas) ----------

export function Seletor<T extends string>({
  opcoes,
  valor,
  aoTrocar,
}: {
  opcoes: readonly { chave: T; label: string }[];
  valor: T;
  aoTrocar: (chave: T) => void;
}) {
  // Com muitas abas (Gestão tem sete) a barra vira rolagem horizontal em vez
  // de quebrar em duas linhas: quebrar empurra o conteúdo pra baixo e faz a
  // tela parecer outra a cada troca de aba.
  const muitas = opcoes.length > 4;
  const conteudo = opcoes.map((o) => (
    <Pressable
      key={o.chave}
      onPress={() => aoTrocar(o.chave)}
      style={[s.opcao, muitas && s.opcaoLarga, valor === o.chave && s.opcaoAtiva]}
    >
      <Text style={[s.texto, valor === o.chave && s.textoAtivo]}>{o.label}</Text>
    </Pressable>
  ));

  if (muitas) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.barraRolante}
      >
        {conteudo}
      </ScrollView>
    );
  }

  return <View style={s.barra}>{conteudo}</View>;
}

const s = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    marginHorizontal: espaco.lg,
    backgroundColor: cores.borda,
    borderRadius: raio.md,
    padding: 3,
    gap: 3,
  },
  barraRolante: {
    paddingHorizontal: espaco.lg,
    gap: espaco.sm,
  },
  opcao: { flex: 1, paddingVertical: 9, borderRadius: raio.sm, alignItems: 'center' },
  opcaoLarga: {
    flex: 0,
    paddingHorizontal: espaco.lg,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  opcaoAtiva: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  texto: { fontSize: 15, color: cores.textoFraco, fontWeight: '600' },
  textoAtivo: { color: cores.textoClaro },
});

// ---------- RÓTULO DE SEÇÃO ----------

export function Secao({ titulo, acao }: { titulo: string; acao?: ReactNode }) {
  return (
    <View style={sc.linha}>
      <Text style={sc.texto}>{titulo}</Text>
      {acao}
    </View>
  );
}

const sc = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espaco.xl,
    marginBottom: espaco.sm,
  },
  texto: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: cores.textoFraco,
    fontWeight: '700',
  },
});

// ---------- ESTADO VAZIO ----------

// Tela vazia é onde o app parece quebrado. Um ícone e uma frase que diz o que
// fazer a seguir custam nada e mudam a leitura de "não carregou" pra "ainda
// não tem nada aqui".
export function Vazio({ icone, titulo, texto }: { icone: string; titulo: string; texto?: string }) {
  return (
    <View style={v.base}>
      <Text style={v.icone}>{icone}</Text>
      <Text style={v.titulo}>{titulo}</Text>
      {texto ? <Text style={v.texto}>{texto}</Text> : null}
    </View>
  );
}

const v = StyleSheet.create({
  base: { alignItems: 'center', paddingVertical: espaco.xxl, paddingHorizontal: espaco.xl },
  icone: { fontSize: 32, marginBottom: espaco.sm },
  titulo: { fontSize: 16, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  texto: {
    fontSize: 15,
    color: cores.textoFraco,
    textAlign: 'center',
    marginTop: espaco.xs,
    lineHeight: 22,
  },
});

// ---------- CARREGANDO ----------

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <View style={cg.base}>
      <ActivityIndicator color={cores.primaria} />
      <Text style={cg.texto}>{texto}</Text>
    </View>
  );
}

const cg = StyleSheet.create({
  base: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.md,
    backgroundColor: cores.fundo,
  },
  texto: { fontSize: 15, color: cores.textoFraco },
});

// ---------- SUB-ABAS ----------

// Segunda barra, encostada por cima da barra de abas do app. É o padrão que
// o Vitor pediu pra Oficial: as seções deixam de ser títulos empilhados num
// scroll longo e viram destinos, com o polegar já na região onde ele está.
export function SubAbas<T extends string>({
  opcoes,
  valor,
  aoTrocar,
}: {
  opcoes: readonly {
    chave: T;
    label: string;
    icone: keyof typeof Ionicons.glyphMap;
    // Contador opcional desenhado sobre o ícone (ex: vínculos esperando
    // aprovação). Zero e undefined não desenham nada: badge vazio é sujeira.
    badge?: number;
  }[];
  valor: T;
  aoTrocar: (chave: T) => void;
}) {
  return (
    <View style={sa.barra}>
      {opcoes.map((o) => {
        const ativo = valor === o.chave;
        return (
          <Pressable
            key={o.chave}
            onPress={() => aoTrocar(o.chave)}
            style={({ pressed }) => [sa.item, pressed && { opacity: 0.6 }]}
          >
            <View>
              <Ionicons
                name={o.icone}
                size={22}
                color={ativo ? cores.primaria : cores.textoFraco}
              />
              {!!o.badge && (
                <View style={sa.badge}>
                  <Text style={sa.badgeTexto}>
                    {o.badge > 9 ? '9+' : String(o.badge)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[sa.texto, ativo && sa.textoAtivo]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const sa = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: espaco.sm,
    minHeight: 60,
  },
  texto: { fontSize: 13, fontWeight: '600', color: cores.textoFraco },
  textoAtivo: { color: cores.primaria, fontWeight: '800' },
  // Sai fora da caixa do ícone de propósito: encostado nele, o número
  // competiria com o próprio desenho do ícone.
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: cores.perigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { fontSize: 12, fontWeight: '800', color: cores.textoClaro },
});
