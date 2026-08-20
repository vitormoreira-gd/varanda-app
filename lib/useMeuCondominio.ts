import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Descobre o condominio_id e o papel do usuário logado, a partir do vínculo aprovado.
export function useMeuCondominio() {
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
    const { data, error } = await supabase
      .from('vinculos')
      .select('papel, unidade_id, unidades(condominio_id)')
      .eq('status', 'aprovado')
      .maybeSingle();

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      const unidade: any = Array.isArray((data as any).unidades)
        ? (data as any).unidades[0]
        : (data as any).unidades;
      setCondominioId(unidade?.condominio_id ?? null);
      setUnidadeId((data as any).unidade_id ?? null);
      setPapel((data as any).papel ?? null);
    } else {
      setErro('Nenhum vínculo aprovado encontrado para este usuário.');
    }

    setLoading(false);
  }

  return { condominioId, unidadeId, papel, loading, erro, recarregar: carregar };
}
