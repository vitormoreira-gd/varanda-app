import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

// Em que ponto do onboarding o usuário logado está.
export type Situacao = 'sem_perfil' | 'sem_vinculo' | 'pendente' | 'aprovado';

// Cargo no condomínio, guardado na tabela `cargos`. É separado de `papel`
// (que é a relação com a unidade) de propósito: dá pra ser inquilino do 302
// E subsíndico. O síndico continua vindo em `papel`, não aqui.
export type Cargo = 'subsindico' | 'conselho';

type CondominioBruto = { nome: string } | { nome: string }[] | null;

type UnidadeBruta = {
  condominio_id: string;
  bloco: string | null;
  numero: string;
  condominios: CondominioBruto;
};

type VinculoBruto = {
  papel: string;
  status: string;
  unidade_id: string;
  unidades: UnidadeBruta | UnidadeBruta[] | null;
};

const um = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

// Descobre perfil, condominio_id e papel do usuário logado.
//
// Não é chamado direto pelas telas: quem chama é o CondominioProvider, uma
// vez por sessão. Antes cada tela rodava o próprio, e depois que o cabeçalho
// passou a aparecer em todas as abas isso virava duas consultas por aba, com
// o nome do usuário piscando "Carregando..." a cada troca.
function useCarregarCondominio() {
  const [situacao, setSituacao] = useState<Situacao>('sem_perfil');
  const [nome, setNome] = useState<string | null>(null);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [unidadeRotulo, setUnidadeRotulo] = useState<string | null>(null);
  const [condominioNome, setCondominioNome] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [papel, setPapel] = useState<string | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    setErro(null);

    const { data: userData, error: erroUser } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (erroUser || !userId) {
      setErro(erroUser?.message ?? 'Não consegui identificar seu usuário logado.');
      setLoading(false);
      return;
    }

    const { data: perfil, error: erroPerfil } = await supabase
      .from('usuarios')
      .select('nome, foto_url')
      .eq('id', userId)
      .maybeSingle();

    if (erroPerfil) {
      setErro(erroPerfil.message);
      setLoading(false);
      return;
    }

    setNome(perfil?.nome ?? null);
    setFotoUrl(perfil?.foto_url ?? null);

    if (!perfil) {
      limparVinculo();
      setSituacao('sem_perfil');
      setLoading(false);
      return;
    }

    // .eq('usuario_id') é obrigatório: a policy "sindico ve vinculos do
    // condominio" faz o select devolver os vínculos de TODO o condomínio
    // quando quem pergunta é síndico. Sem o filtro, um síndico com dois
    // moradores aprovados recebia várias linhas.
    const { data: vinculos, error: erroVinculos } = await supabase
      .from('vinculos')
      .select('papel, status, unidade_id, unidades(condominio_id, bloco, numero, condominios(nome))')
      .eq('usuario_id', userId);

    if (erroVinculos) {
      setErro(erroVinculos.message);
      setLoading(false);
      return;
    }

    const lista = (vinculos ?? []) as unknown as VinculoBruto[];
    // Síndico na frente: quem é morador num prédio e síndico noutro entra como síndico.
    const aprovado =
      lista.find((v) => v.status === 'aprovado' && v.papel === 'sindico') ??
      lista.find((v) => v.status === 'aprovado');

    if (aprovado) {
      const unidade = um(aprovado.unidades);
      setCondominioId(unidade?.condominio_id ?? null);
      setUnidadeId(aprovado.unidade_id);
      // "302" quando nao ha bloco, "A · 302" quando ha. E o que o cabecalho
      // mostra depois do nome.
      setUnidadeRotulo(
        unidade ? [unidade.bloco, unidade.numero].filter(Boolean).join(' · ') : null
      );
      setCondominioNome(um(unidade?.condominios)?.nome ?? null);
      setPapel(aprovado.papel);
      setSituacao('aprovado');

      if (unidade?.condominio_id) {
        const { data: cargoData, error: erroCargo } = await supabase
          .from('cargos')
          .select('cargo')
          .eq('usuario_id', userId)
          .eq('condominio_id', unidade.condominio_id)
          .maybeSingle();

        if (erroCargo) {
          setErro(erroCargo.message);
          setLoading(false);
          return;
        }
        setCargo((cargoData?.cargo as Cargo) ?? null);
      }
    } else {
      limparVinculo();
      setSituacao(lista.length > 0 ? 'pendente' : 'sem_vinculo');
    }

    setLoading(false);
  }

  function limparVinculo() {
    setCondominioId(null);
    setUnidadeId(null);
    setUnidadeRotulo(null);
    setCondominioNome(null);
    setPapel(null);
    setCargo(null);
  }

  // Espelham pode_gerir() e pode_fiscalizar() do banco. A UI usa isso só pra
  // esconder botão: quem manda é o RLS, e update bloqueado por RLS falha
  // calado (armadilha nº4) — por isso esconder importa.
  const ehSindico = papel === 'sindico';
  const podeGerir = ehSindico || cargo === 'subsindico';
  const podeFiscalizar = podeGerir || cargo === 'conselho';

  // Como o cabecalho apresenta a pessoa. Proprietario e inquilino colapsam em
  // "Morador": a diferenca importa pro sindico, nao pra quem le o mural.
  const rotuloConta = ehSindico
    ? 'Síndico'
    : cargo === 'subsindico'
      ? 'Subsíndico'
      : cargo === 'conselho'
        ? 'Conselho fiscal'
        : 'Morador';

  return {
    situacao,
    nome,
    fotoUrl,
    condominioId,
    condominioNome,
    unidadeId,
    unidadeRotulo,
    papel,
    cargo,
    ehSindico,
    podeGerir,
    podeFiscalizar,
    rotuloConta,
    loading,
    erro,
    recarregar: carregar,
  };
}

type Condominio = ReturnType<typeof useCarregarCondominio>;

const CondominioContext = createContext<Condominio | null>(null);

export function CondominioProvider({ children }: { children: ReactNode }) {
  const valor = useCarregarCondominio();
  return <CondominioContext.Provider value={valor}>{children}</CondominioContext.Provider>;
}

export function useMeuCondominio(): Condominio {
  const valor = useContext(CondominioContext);
  if (!valor) {
    throw new Error('useMeuCondominio precisa estar dentro de um <CondominioProvider>.');
  }
  return valor;
}
