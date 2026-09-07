import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Share, StyleSheet, RefreshControl, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { cores, espaco } from '../lib/tema';
import { Botao, Campo, Cartao, Secao, Vazio } from '../components/ui';

type Unidade = {
  id: string;
  bloco: string | null;
  numero: string;
  codigo_convite: string | null;
};

/**
 * Transforma o que o síndico digitou numa lista de números de unidade.
 * Aceita lista ("101, 102, 103"), intervalo ("101-110") e mistura dos dois.
 */
export function expandirNumeros(texto: string): string[] {
  const numeros: string[] = [];

  for (const parte of texto.split(',')) {
    const item = parte.trim();
    if (!item) continue;

    const intervalo = item.match(/^(\d+)\s*-\s*(\d+)$/);
    if (intervalo) {
      const inicio = parseInt(intervalo[1], 10);
      const fim = parseInt(intervalo[2], 10);
      if (inicio <= fim && fim - inicio <= 500) {
        for (let n = inicio; n <= fim; n++) numeros.push(String(n));
        continue;
      }
    }
    numeros.push(item);
  }

  return [...new Set(numeros)];
}

export default function UnidadesScreen() {
  const { condominioId } = useMeuCondominio();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [moradoresPorUnidade, setMoradoresPorUnidade] = useState<Record<string, number>>({});
  const [bloco, setBloco] = useState('');
  const [numeros, setNumeros] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    if (!condominioId) return;

    const { data, error } = await supabase
      .from('unidades')
      .select('id, bloco, numero, codigo_convite')
      .eq('condominio_id', condominioId)
      .order('bloco', { ascending: true })
      .order('numero', { ascending: true });

    if (error) {
      Alert.alert('Erro ao carregar unidades', error.message);
      return;
    }
    setUnidades(data ?? []);

    // A policy "sindico ve vinculos do condominio" deixa o síndico contar
    // quem já entrou em cada unidade.
    const { data: vinculos, error: erroVinculos } = await supabase
      .from('vinculos')
      .select('unidade_id')
      .eq('status', 'aprovado');

    if (erroVinculos) {
      Alert.alert('Erro ao carregar moradores', erroVinculos.message);
      return;
    }
    const contagem: Record<string, number> = {};
    (vinculos ?? []).forEach((v) => {
      contagem[v.unidade_id] = (contagem[v.unidade_id] ?? 0) + 1;
    });
    setMoradoresPorUnidade(contagem);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarUnidades() {
    if (!condominioId) {
      Alert.alert('Aviso', 'Não encontrei seu condomínio ainda.');
      return;
    }

    const lista = expandirNumeros(numeros);
    if (lista.length === 0) {
      Alert.alert('Faltam os números', 'Ex: 101-110 ou 11, 12, 21, 22');
      return;
    }

    const blocoLimpo = bloco.trim() || null;
    const jaExistem = new Set(
      unidades.filter((u) => (u.bloco ?? null) === blocoLimpo).map((u) => u.numero)
    );
    const novas = lista.filter((n) => !jaExistem.has(n));

    if (novas.length === 0) {
      Alert.alert('Nada a criar', 'Todas essas unidades já estão cadastradas nesse bloco.');
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from('unidades')
      .insert(novas.map((numero) => ({ condominio_id: condominioId, bloco: blocoLimpo, numero })));
    setBusy(false);

    if (error) {
      Alert.alert('Erro ao criar unidades', error.message);
      return;
    }

    const ignoradas = lista.length - novas.length;
    Alert.alert(
      'Unidades criadas',
      `${novas.length} criada(s)` + (ignoradas > 0 ? `, ${ignoradas} já existia(m).` : '.')
    );
    setNumeros('');
    carregar();
  }

  async function compartilhar(u: Unidade) {
    if (!u.codigo_convite) {
      Alert.alert('Sem código', 'Essa unidade não tem código de convite gerado.');
      return;
    }
    const identificacao = u.bloco ? `${u.bloco} ${u.numero}` : u.numero;
    await Share.share({
      message:
        `Convite do Varanda para a unidade ${identificacao}.\n\n` +
        `Baixe o app, crie sua conta e use o código: ${u.codigo_convite}\n\n` +
        `Depois disso eu aprovo seu acesso.`,
    });
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Cartao>
        <Text style={styles.formTitulo}>Cadastrar unidades</Text>
        <Text style={styles.formDica}>
          Aceita intervalo (101-110), lista (11, 12, 21) ou os dois juntos.
        </Text>
        <View style={styles.linha}>
          <Campo
            rotulo="Bloco"
            value={bloco}
            onChangeText={setBloco}
            placeholder="opcional"
            estilo={{ flex: 1 }}
          />
          <Campo
            rotulo="Números"
            value={numeros}
            onChangeText={setNumeros}
            placeholder="101-110"
            estilo={{ flex: 2 }}
          />
        </View>
        <Botao
          titulo="Criar unidades"
          onPress={criarUnidades}
          disabled={busy}
          carregando={busy}
          estilo={{ marginTop: espaco.lg }}
        />
      </Cartao>

      <FlatList
        data={unidades}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: espaco.xxl }}
        ListHeaderComponent={
          unidades.length > 0 ? (
            <Secao titulo={`${unidades.length} unidade${unidades.length === 1 ? '' : 's'}`} />
          ) : null
        }
        ListEmptyComponent={
          <Vazio
            icone="🔑"
            titulo="Nenhuma unidade ainda"
            texto="Cada unidade ganha um código de convite próprio, que você compartilha com o morador."
          />
        }
        renderItem={({ item }) => {
          const moradores = moradoresPorUnidade[item.id] ?? 0;
          return (
            <Cartao>
              <View style={styles.cardLinha}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unidade}>
                    {item.bloco ? `${item.bloco} · ` : ''}
                    {item.numero}
                  </Text>
                  <Text style={styles.moradores}>
                    {moradores === 0
                      ? 'ninguém entrou ainda'
                      : moradores === 1
                        ? '1 morador'
                        : `${moradores} moradores`}
                  </Text>
                </View>
                <Botao
                  titulo="Convidar"
                  variante="secundario"
                  pequeno
                  onPress={() => compartilhar(item)}
                />
              </View>
              <Text style={styles.codigo}>{item.codigo_convite ?? 'sem código'}</Text>
            </Cartao>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg },
  formTitulo: { fontSize: 17, fontWeight: '700', color: cores.texto },
  formDica: { fontSize: 14, color: cores.textoFraco, marginTop: espaco.xs, marginBottom: espaco.md },
  linha: { flexDirection: 'row', gap: espaco.sm },
  cardLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  unidade: { fontSize: 17, fontWeight: '800', color: cores.texto },
  moradores: { fontSize: 14, color: cores.textoFraco, marginTop: 2 },
  codigo: {
    fontSize: 15,
    color: cores.primaria,
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginTop: espaco.md,
    backgroundColor: cores.primariaFundo,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: espaco.md,
    alignSelf: 'flex-start',
  },
});
