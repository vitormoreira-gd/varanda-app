// Modo demonstração: atalhos pra entrar como cada papel sem digitar login.
//
// Existe pra uma situação específica — apresentar o app a um síndico, ao vivo,
// alternando entre os papéis pra mostrar que a régua de permissão é real. As
// contas são de verdade e o login é o `signInWithPassword` normal: o que o
// morador comum não vê, não vê porque o RLS recusou, não porque a tela
// escondeu. É justamente isso que vale demonstrar.
//
// O flag é lido do .env em tempo de build. Um `.apk` gerado sem
// EXPO_PUBLIC_DEMO=1 não tem como mostrar esses botões, então não há risco de
// o atalho de "entrar como síndico" viajar junto com uma build de verdade.

import { supabase } from './supabase';

export const MODO_DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

// Todas as contas de demonstração usam a mesma senha. São contas descartáveis
// num condomínio fictício — não há nada a proteger, e senha diferente por
// conta só criaria trabalho na hora de recriar o seed.
export const SENHA_DEMO = 'demo1234';

export type PerfilDemo = {
  chave: string;
  rotulo: string;
  /** O que essa pessoa consegue fazer, em uma linha, pra guiar a apresentação. */
  resumo: string;
  email: string;
  icone: string;
};

export const PERFIS_DEMO: readonly PerfilDemo[] = [
  {
    chave: 'sindico',
    rotulo: 'Síndico',
    resumo: 'Publica, modera, decide e distribui cargos',
    email: 'sindico@demo.varanda.app',
    icone: '🔑',
  },
  {
    chave: 'subsindico',
    rotulo: 'Subsíndico',
    resumo: 'Faz tudo o que o síndico faz, menos dar cargo',
    email: 'subsindico@demo.varanda.app',
    icone: '🗝️',
  },
  {
    chave: 'conselho',
    rotulo: 'Conselho fiscal',
    resumo: 'Acompanha tudo, sem poder alterar nada',
    email: 'conselho@demo.varanda.app',
    icone: '👓',
  },
  {
    chave: 'morador',
    rotulo: 'Morador',
    resumo: 'O condômino comum — não enxerga o canal restrito',
    email: 'morador@demo.varanda.app',
    icone: '🏠',
  },
] as const;

/**
 * Troca de conta em um passo. O `signOut` antes é necessário: sem ele o
 * Supabase mantém a sessão anterior se o login novo falhar, e a apresentação
 * continuaria no papel errado sem ninguém perceber.
 */
export async function entrarComoDemo(perfil: PerfilDemo): Promise<string | null> {
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: perfil.email,
    password: SENHA_DEMO,
  });
  return error ? error.message : null;
}
