// Tokens visuais do app. Antes disso cada tela repetia os mesmos hex à mão,
// e já havia divergência: "perigo" aparecia como #B6512E em umas telas e
// #B4483C em outras. Aqui existe um valor só de cada coisa.
//
// A paleta é a que o app já usava — bege de fundo, azul petróleo como cor
// de ação. Nada aqui é redesenho, é consolidação.

export const cores = {
  // Superfícies
  fundo: '#F2EFE6',
  superficie: '#FFFFFF',
  superficieAlt: '#F7F5EF',
  borda: '#E4DFD2',

  // Cor de ação
  primaria: '#1B4B66',
  primariaFundo: '#E6EDF1',

  // Texto
  texto: '#211F1B',
  textoFraco: '#6B665D',
  textoClaro: '#FFFFFF',

  // Semânticas — cada uma com o par (cor forte / fundo de etiqueta)
  perigo: '#B6512E',
  perigoFundo: '#F7E4DA',
  atencao: '#C98A1F',
  atencaoFundo: '#F6E7C8',
  sucesso: '#43715B',
  sucessoFundo: '#DEE9E1',
  // Roxo do canal do gabinete: precisa destoar das outras três pra ninguém
  // confundir "restrito" com "urgente".
  restrito: '#7A4B8C',
  restritoFundo: '#EFE6F3',
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
  sm: 10,
  md: 14,
  pill: 999,
} as const;

export const fonte = {
  titulo: { fontSize: 22, fontWeight: '800' },
  cardTitulo: { fontSize: 15, fontWeight: '700' },
  corpo: { fontSize: 14 },
  corpoPequeno: { fontSize: 13 },
  meta: { fontSize: 12 },
  etiqueta: { fontSize: 10, fontWeight: '700' },
} as const;

// Sombra discreta e uniforme. No Android só `elevation` tem efeito; no iOS só
// as quatro propriedades de shadow. Manter as duas evita card chapado num e
// pesado no outro.
export const sombra = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;
