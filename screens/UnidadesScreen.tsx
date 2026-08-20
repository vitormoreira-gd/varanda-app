import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Pressable,
  FlatList,
  Share,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';

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
      <View style={styles.form}>
        <Text style={styles.subtitulo}>Cadastrar unidades</Text>
        <View style={styles.linha}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={bloco}
            onChangeText={setBloco}
            placeholder="Bloco (opcional)"
          />
          <TextInput
            style={[styles.input, { flex: 2 }]}
            value={numeros}
            onChangeText={setNumeros}
            placeholder="101-110 ou 11, 12, 21"
          />
        </View>
        <Button title="Criar" onPress={criarUnidades} disabled={busy} />
      </View>

      <FlatList
        data={unidades}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <Text style={styles.contador}>
            {unidades.length} unidade(s) cadastrada(s)
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.vazio}>
            Nenhuma unidade ainda. Cadastre as unidades pra poder convidar os moradores.
          </Text>
        }
        renderItem={({ item }) => {
          const moradores = moradoresPorUnidade[item.id] ?? 0;
          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.unidade}>
                  {item.bloco ? `${item.bloco} · ` : ''}
                  {item.numero}
                </Text>
                <Text style={styles.codigo}>{item.codigo_convite ?? 'sem código'}</Text>
                <Text style={styles.moradores}>
                  {moradores === 0 ? 'ninguém entrou ainda' : `${moradores} morador(es)`}
                </Text>
              </View>
              <Pressable onPress={() => compartilhar(item)} hitSlop={8}>
                <Text style={styles.compartilhar}>Compartilhar</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  form: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFD2',
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  subtitulo: { fontSize: 14, fontWeight: '700', color: '#1B4B66' },
  linha: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E4DFD2',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  contador: { fontSize: 12, color: '#6B665D', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DFD2',
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unidade: { fontSize: 15, fontWeight: '700', color: '#211F1B' },
  codigo: { fontSize: 13, color: '#1B4B66', fontFamily: 'monospace', marginTop: 2 },
  moradores: { fontSize: 11, color: '#6B665D', marginTop: 2 },
  compartilhar: { fontSize: 13, color: '#1B4B66', fontWeight: '600' },
  vazio: { textAlign: 'center', color: '#6B665D', marginTop: 40 },
});
