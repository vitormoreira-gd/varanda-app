// O que antes se chamava "Problemas".
//
// Mudou de nome e de casa em 21/08/2026: relatar um vazamento é PEDIR UM
// CONSERTO, então é uma solicitação como qualquer outra — eu peço, o síndico
// decide, tem estado. Sugestão, que era a irmã desta tela, foi embora pro
// Mural justamente por não ter esse contrato.
//
// A tabela continua se chamando `problemas`: renomear arrastaria policies, a
// FK de `historico_status` e o seed, sem ganho nenhum.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { diasDesde, emDias } from '../lib/datas';
import { cores, espaco } from '../lib/tema';
import { Botao, Campo, Cartao, Chip, Etiqueta, Seletor, Tom, Vazio, corDoTom } from '../components/ui';
import { useAvisoRapido } from '../components/AvisoRapido';

const CATEGORIAS = ['Hidráulica', 'Elétrica', 'Estrutural', 'Limpeza', 'Segurança'];

// Onde o pedido acontece decide quem o vê. "Área comum" é o padrão porque a
// visibilidade pública entrega duas coisas que nenhuma tela substitui: dedup
// (três vizinhos relatando o mesmo portão sem saber uns dos outros geram três
// chamados e a sensação de que ninguém liga) e pressão (o badge "aberto há X
// dias" só cobra porque o prédio inteiro vê o número). O que muda é a
// torneira do próprio banheiro, que nunca precisou de plateia.
const ALCANCES = [
  { chave: 'comum', label: 'Área comum' },
  { chave: 'unidade', label: 'Minha unidade' },
] as const;

type Alcance = (typeof ALCANCES)[number]['chave'];

/**
 * Há quanto tempo o pedido está parado. Conta da última mudança de status,
 * não da abertura — é o "aberto há 5 dias sem atualização" que a pesquisa
 * apontou como a queixa nº1 contra síndico.
 */
function tempoEmAberto(p: Manutencao): { texto: string; tom: Tom } {
  const historico = [...(p.historico_status ?? [])].sort((a, b) =>
    a.criado_em.localeCompare(b.criado_em)
  );

  if (p.status === 'resolvido') {
    const resolvido = [...historico].reverse().find((h) => h.status === 'resolvido');
    if (!resolvido) return { texto: 'resolvido', tom: 'ok' };
    const dias = diasDesde(p.criado_em, new Date(resolvido.criado_em));
    const quanto = dias === 0 ? 'menos de 1 dia' : dias === 1 ? '1 dia' : `${dias} dias`;
    return { texto: `resolvido em ${quanto}`, tom: 'ok' };
  }

  const ultimaMovimentacao = historico.length
    ? historico[historico.length - 1].criado_em
    : p.criado_em;
  const dias = diasDesde(ultimaMovimentacao);
  const prefixo = p.status === 'aberto' ? 'aberto' : 'em andamento';
  const tom: Tom = dias >= 7 ? 'critico' : dias >= 3 ? 'atencao' : 'neutro';

  return { texto: `${prefixo} ${emDias(dias)}`, tom };
}

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
};
const STATUS_TOM: Record<string, Tom> = {
  aberto: 'critico',
  em_andamento: 'atencao',
  resolvido: 'ok',
};

type Manutencao = {
  id: string;
  titulo: string;
  categoria: string;
  local: string;
  descricao: string;
  status: string;
  area_comum: boolean;
  criado_em: string;
  historico_status: { status: string; criado_em: string }[];
};

export default function ManutencaoScreen({ atualizacao }: { atualizacao?: number }) {
  const { condominioId } = useMeuCondominio();
  const [lista, setLista] = useState<Manutencao[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('problemas')
      .select(
        'id, titulo, categoria, local, descricao, status, area_comum, criado_em, historico_status(status, criado_em)'
      )
      .is('arquivado_em', null)
      .order('criado_em', { ascending: false });

    if (error) {
      Alert.alert('Erro ao carregar pedidos de manutenção', error.message);
      return;
    }
    setLista((data as unknown as Manutencao[]) ?? []);
  }, []);

  // `atualizacao` é um contador que o host incrementa quando algo novo é
  // criado pelo botão +, que vive fora desta tela.
  useEffect(() => {
    if (condominioId) carregar();
  }, [condominioId, carregar, atualizacao]);

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  return (
    <FlatList
      style={styles.container}
      data={lista}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 96 }}
      ListEmptyComponent={
        <Vazio
          icone="🔧"
          titulo="Nada pendente de conserto"
          texto="Cada pedido fica com data e histórico — dá pra cobrar depois."
        />
      }
      renderItem={({ item }) => {
        const sla = tempoEmAberto(item);
        return (
          <Cartao>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.titulo}>{item.titulo}</Text>
                <Text style={styles.meta}>
                  {[item.categoria, item.local].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Etiqueta
                texto={STATUS_LABEL[item.status] ?? item.status}
                tom={STATUS_TOM[item.status] ?? 'neutro'}
              />
            </View>

            {/* Quem enxerga este card sabendo que ele e privado ou e o autor
                ou e quem gere — a policy nao deixa mais ninguem chegar aqui.
                A etiqueta existe pros dois lados: o morador confere que o
                pedido nao foi parar no mural do predio, e o sindico entende
                por que ninguem mais comentou. */}
            {!item.area_comum && (
              <View style={styles.privado}>
                <Etiqueta texto="Só na unidade" tom="info" />
              </View>
            )}

            <Text style={[styles.sla, { color: corDoTom(sla.tom) }]}>{sla.texto}</Text>
            <Text style={styles.descricao}>{item.descricao}</Text>
          </Cartao>
        );
      }}
    />
  );
}

// ---------- FORMULÁRIO ----------
// Vive fora da lista: quem cria é o botão + de Solicitações, num só lugar
// para todos os tipos.

export function FormularioManutencao({ aoConcluir }: { aoConcluir: () => void }) {
  const { condominioId } = useMeuCondominio();
  const { mostrar } = useAvisoRapido();
  const [userId, setUserId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [alcance, setAlcance] = useState<Alcance>('comum');
  const [enviando, setEnviando] = useState(false);

  const areaComum = alcance === 'comum';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const completo = !!titulo.trim() && !!local.trim() && !!descricao.trim();

  async function enviar() {
    if (!completo || !condominioId || !userId) return;

    setEnviando(true);
    const { error } = await supabase.from('problemas').insert({
      titulo: titulo.trim(),
      local: local.trim(),
      descricao: descricao.trim(),
      categoria,
      area_comum: areaComum,
      condominio_id: condominioId,
      autor_id: userId,
    });
    setEnviando(false);

    if (error) {
      Alert.alert('Erro ao enviar o pedido', error.message);
      return;
    }

    mostrar(areaComum ? 'Pedido enviado ao prédio' : 'Pedido enviado ao síndico');
    aoConcluir();
  }

  return (
    <View>
      {/* Primeira pergunta do formulário, e não a última: o alcance muda o
          jeito de descrever o resto. Quem vai relatar a torneira da própria
          suíte não deveria escrever "Bloco B, 6º andar" no campo Onde. */}
      <Text style={styles.rotulo}>Onde é o problema?</Text>
      <Seletor opcoes={ALCANCES} valor={alcance} aoTrocar={setAlcance} />
      <Text style={styles.dicaAlcance}>
        {areaComum
          ? 'O prédio inteiro vê. Se um vizinho já relatou o mesmo, dá pra perceber antes de abrir outro chamado.'
          : 'Só você e o síndico veem. Nem o conselho fiscal, nem os vizinhos.'}
      </Text>

      <Campo
        rotulo="O que precisa de conserto?"
        placeholder={areaComum ? 'Ex: Vazamento no hall' : 'Ex: Torneira da cozinha pingando'}
        value={titulo}
        onChangeText={setTitulo}
        estilo={{ marginTop: espaco.lg }}
      />

      <Text style={styles.rotulo}>Categoria</Text>
      <View style={styles.chips}>
        {CATEGORIAS.map((c) => (
          <Chip key={c} titulo={c} ativo={categoria === c} onPress={() => setCategoria(c)} />
        ))}
      </View>

      <Campo
        rotulo="Onde"
        placeholder={areaComum ? 'Ex: Bloco B, 6º andar' : 'Ex: Banheiro da suíte'}
        value={local}
        onChangeText={setLocal}
        estilo={{ marginTop: espaco.md }}
      />
      <Campo
        rotulo="Descrição"
        placeholder="O que está acontecendo?"
        value={descricao}
        onChangeText={setDescricao}
        multiline
        estilo={{ marginTop: espaco.md }}
      />

      <Botao
        titulo="Enviar pedido"
        onPress={enviar}
        disabled={!completo || enviando}
        carregando={enviando}
        estilo={{ marginTop: espaco.xl }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: espaco.lg },
  rotulo: {
    fontSize: 12,
    fontWeight: '600',
    color: cores.textoFraco,
    marginTop: espaco.md,
    marginBottom: espaco.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: espaco.sm,
  },
  titulo: { fontWeight: '700', fontSize: 15, color: cores.texto },
  meta: { fontSize: 12, color: cores.textoFraco, marginTop: 2 },
  sla: { fontSize: 11, fontWeight: '700', marginTop: espaco.sm },
  privado: { marginTop: espaco.sm, alignSelf: 'flex-start' },
  dicaAlcance: {
    fontSize: 11,
    color: cores.textoFraco,
    lineHeight: 16,
    marginTop: espaco.sm,
  },
  descricao: { fontSize: 13, color: cores.textoFraco, marginTop: espaco.sm, lineHeight: 19 },
});
