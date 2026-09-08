// Tokens visuais do app. Antes disso cada tela repetia os mesmos hex à mão,
// e já havia divergência: "perigo" aparecia como #B6512E em umas telas e
// #B4483C em outras. Aqui existe um valor só de cada coisa.
//
// A paleta é a que o app já usava — bege de fundo, azul petróleo como cor
// de ação. Nada aqui é redesenho, é consolidação.

export const cores = {
  // Superfícies. O cinza claro existe pra que o branco dos cartões seja o
  // que salta: fundo e cartão da mesma cor apagariam a separação entre eles.
  fundo: '#EEEEEE',
  superficie: '#FFFFFF',
  superficieAlt: '#F7F7F7',
  borda: '#E4E4E4',

  // Cor de ação: o laranja da barra do topo. É a única cor quente do app, e
  // por isso ela sozinha marca o que tem prioridade — o aviso fixado, o
  // botão principal, a aba ativa.
  primaria: '#EE8E2F',
  primariaFundo: '#FDF0E1',

  // Texto. O escuro é arroxeado de propósito: preto puro sobre cinza vibra e
  // cansa, e esse tom conversa com o laranja em vez de brigar com ele.
  texto: '#332E4D',
  textoFraco: '#606060',
  textoClaro: '#FFFFFF',

  // Semânticas — cada uma com o par (cor forte / fundo de etiqueta).
  perigo: '#C0453B',
  perigoFundo: '#F8E3E0',
  // Âmbar mais fechado que a primária: status de item não pode ser confundido
  // com a cor da marca, senão "em andamento" parece um botão.
  atencao: '#B87613',
  atencaoFundo: '#FBEFD8',
  sucesso: '#3E7D5A',
  sucessoFundo: '#DFEBE4',
  // Roxo do canal do gabinete: sai do mesmo tronco do texto, mais saturado,
  // pra "restrito" ler como severo sem virar alarme.
  restrito: '#6B5CA5',
  restritoFundo: '#EAE7F5',
} as const;

export const espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const raio = {
  sm: 12,
  md: 18,
  pill: 999,
} as const;

export const fonte = {
  titulo: { fontSize: 25, fontWeight: '800' },
  cardTitulo: { fontSize: 17, fontWeight: '700' },
  corpo: { fontSize: 16 },
  corpoPequeno: { fontSize: 15 },
  meta: { fontSize: 14 },
  etiqueta: { fontSize: 12, fontWeight: '700' },
} as const;

// Sombra macia e baixa. Com fundo cinza e cartão branco o contraste já separa
// os dois; a sombra só precisa dar profundidade, não desenhar uma borda.
// No Android só `elevation` tem efeito; no iOS só as quatro de shadow.
export const sombra = {
  shadowColor: '#332E4D',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;
