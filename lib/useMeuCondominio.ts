import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Em que ponto do onboarding o usuário logado está.
export type Situacao = 'sem_perfil' | 'sem_vinculo' | 'pendente' | 'aprovado';

type VinculoBruto = {
  papel: string;
  status: string;
  unidade_id: string;
  unidades: { condominio_id: string } | { condominio_id: string }[] | null;
};

// Descobre perfil, condominio_id e papel do usuário logado.
export function useMeuCondominio() {
  const [situacao, setSituacao] = useState<Situacao>('sem_perfil');
  const [nome, setNome] = useState<string | null>(null);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [papel, setPapel] = useState<string | null>(null);
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
      .select('nome')
      .eq('id', userId)
      .maybeSingle();

    if (erroPerfil) {
      setErro(erroPerfil.message);
      setLoading(false);
      return;
    }

    setNome(perfil?.nome ?? null);

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
      .select('papel, status, unidade_id, unidades(condominio_id)')
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
      const unidade = Array.isArray(aprovado.unidades) ? aprovado.unidades[0] : aprovado.unidades;
      setCondominioId(unidade?.condominio_id ?? null);
      setUnidadeId(aprovado.unidade_id);
      setPapel(aprovado.papel);
      setSituacao('aprovado');
    } else {
      limparVinculo();
      setSituacao(lista.length > 0 ? 'pendente' : 'sem_vinculo');
    }

    setLoading(false);
  }

  function limparVinculo() {
    setCondominioId(null);
    setUnidadeId(null);
    setPapel(null);
  }

  return { situacao, nome, condominioId, unidadeId, papel, loading, erro, recarregar: carregar };
}
