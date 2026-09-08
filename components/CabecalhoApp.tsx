// Cabeçalho fixo das quatro abas. Substitui o antigo `Cabecalho` de título
// por tela: quem diz onde você está é a barra de abas embaixo, então o topo
// passou a ser sobre QUEM você é — o que importa num app em que a mesma
// pessoa alterna entre papéis com poderes diferentes.
//
// O Perfil deixou de ser aba e virou destino do avatar. Não há stack
// navigator no projeto, então ele abre como Modal de tela cheia: resolve sem
// adicionar dependência de navegação nova.

import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useMeuCondominio } from '../lib/useMeuCondominio';
import { cores, espaco, raio, sombra } from '../lib/tema';
import { Avatar } from './ui';
import PerfilScreen from '../screens/PerfilScreen';

export default function CabecalhoApp() {
  const { nome, fotoUrl, unidadeRotulo, rotuloConta, condominioNome } = useMeuCondominio();
  const insets = useSafeAreaInsets();
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);

  // "302 · Morador" — e só "Morador" enquanto a unidade não carregou.
  const subtitulo = [unidadeRotulo, rotuloConta].filter(Boolean).join(' · ');

  return (
    <>
      <View style={[styles.barra, { paddingTop: insets.top + espaco.sm }]}>
        <Pressable
          style={({ pressed }) => [styles.identidade, pressed && { opacity: 0.6 }]}
          onPress={() => setPerfilAberto(true)}
          hitSlop={6}
        >
          <Avatar nome={nome} fotoUrl={fotoUrl} tamanho={42} />
          <View style={styles.textos}>
            <Text style={styles.nome} numberOfLines={1}>
              {nome ?? 'Carregando...'}
            </Text>
            <Text style={styles.subtitulo} numberOfLines={1}>
              {subtitulo}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setMenuAberto(true)}
          hitSlop={12}
          style={({ pressed }) => [styles.pontinhos, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={cores.texto} />
        </Pressable>
      </View>

      <MenuOpcoes
        aberto={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        topo={insets.top + 56}
        condominioNome={condominioNome}
      />

      <Modal
        visible={perfilAberto}
        animationType="slide"
        onRequestClose={() => setPerfilAberto(false)}
      >
        <PerfilScreen aoFechar={() => setPerfilAberto(false)} />
      </Modal>
    </>
  );
}

type Opcao = { rotulo: string; icone: keyof typeof Ionicons.glyphMap; emBreve?: boolean };

const OPCOES: Opcao[] = [
  { rotulo: 'Conta', icone: 'person-outline', emBreve: true },
  { rotulo: 'Privacidade', icone: 'lock-closed-outline', emBreve: true },
  { rotulo: 'Preferências', icone: 'options-outline', emBreve: true },
  { rotulo: 'Notificações', icone: 'notifications-outline', emBreve: true },
];

function MenuOpcoes({
  aberto,
  aoFechar,
  topo,
  condominioNome,
}: {
  aberto: boolean;
  aoFechar: () => void;
  topo: number;
  condominioNome: string | null;
}) {
  function confirmarSaida() {
    aoFechar();
    Alert.alert('Sair da conta', 'Você vai precisar entrar de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <Modal visible={aberto} transparent animationType="fade" onRequestClose={aoFechar}>
      {/* O fundo inteiro fecha o menu: é o gesto que todo mundo já tenta. */}
      <Pressable style={styles.fundo} onPress={aoFechar}>
        <Pressable style={[styles.menu, { top: topo }]} onPress={(e) => e.stopPropagation()}>
          {condominioNome ? <Text style={styles.menuTopo}>{condominioNome}</Text> : null}

          {OPCOES.map((o) => (
            <Pressable
              key={o.rotulo}
              disabled={o.emBreve}
              onPress={aoFechar}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressionado]}
            >
              <Ionicons
                name={o.icone}
                size={18}
                color={o.emBreve ? cores.textoFraco : cores.texto}
              />
              <Text style={[styles.itemTexto, o.emBreve && styles.itemInativo]}>{o.rotulo}</Text>
              {o.emBreve && <Text style={styles.emBreve}>em breve</Text>}
            </Pressable>
          ))}

          <View style={styles.divisor} />

          <Pressable
            onPress={confirmarSaida}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressionado]}
          >
            <Ionicons name="log-out-outline" size={18} color={cores.perigo} />
            <Text style={[styles.itemTexto, { color: cores.perigo }]}>Sair</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // A barra do topo é a única superfície laranja do app. Ela ancora a
  // identidade e, por ser a mesma em todas as abas, dá a sensação de um app
  // só em vez de quatro telas soltas. Sem borda inferior: a mudança de cor
  // pro cinza do conteúdo já é a separação.
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.lg,
    backgroundColor: cores.primaria,
  },
  identidade: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.md },
  textos: { flex: 1 },
  // Texto escuro sobre o laranja, não branco: o laranja é claro demais
  // pra sustentar branco com contraste de leitura.
  nome: { fontSize: 18, fontWeight: '800', color: cores.texto },
  subtitulo: { fontSize: 14, color: cores.texto, opacity: 0.75, marginTop: 1 },
  pontinhos: { padding: espaco.xs },

  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: {
    position: 'absolute',
    right: espaco.md,
    minWidth: 220,
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingVertical: espaco.sm,
    ...sombra,
    elevation: 8,
  },
  menuTopo: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: cores.textoFraco,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.xs,
    paddingBottom: espaco.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    paddingVertical: espaco.md,
    paddingHorizontal: espaco.lg,
  },
  itemPressionado: { backgroundColor: cores.superficieAlt },
  itemTexto: { flex: 1, fontSize: 16, color: cores.texto, fontWeight: '600' },
  itemInativo: { color: cores.textoFraco, fontWeight: '500' },
  emBreve: {
    fontSize: 12,
    color: cores.textoFraco,
    fontStyle: 'italic',
  },
  divisor: {
    height: 1,
    backgroundColor: cores.borda,
    marginVertical: espaco.xs,
    marginHorizontal: espaco.md,
  },
});
