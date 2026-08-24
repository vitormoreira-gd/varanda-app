import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { cores } from './lib/tema';
import { Carregando } from './components/ui';
import { AvisoRapidoProvider } from './components/AvisoRapido';
import AuthScreen from './screens/AuthScreen';
import EntradaScreen from './screens/EntradaScreen';
import MuralScreen from './screens/MuralScreen';
import OficialScreen from './screens/OficialScreen';
import SolicitacoesScreen from './screens/SolicitacoesScreen';
import GestaoScreen from './screens/GestaoScreen';
import { CondominioProvider, useMeuCondominio } from './lib/useMeuCondominio';

const Tab = createBottomTabNavigator();

type NomeIcone = keyof typeof Ionicons.glyphMap;

const ICONES: Record<string, { ativo: NomeIcone; inativo: NomeIcone }> = {
  Oficial: { ativo: 'megaphone', inativo: 'megaphone-outline' },
  Mural: { ativo: 'chatbubbles', inativo: 'chatbubbles-outline' },
  Solicitações: { ativo: 'clipboard', inativo: 'clipboard-outline' },
  Gestão: { ativo: 'shield-checkmark', inativo: 'shield-checkmark-outline' },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <AvisoRapidoProvider margemInferior={78}>
      {loading ? (
        <Carregando />
      ) : !session ? (
        <AuthScreen />
      ) : (
        // `key` obriga a remontagem quando troca a conta logada. Sem isso o
        // provider de dentro não recarrega (o efeito dele só roda na
        // montagem) e, ao trocar de síndico pra morador, o app continuaria
        // exibindo a aba Gestão com os dados do papel anterior.
        <CondominioProvider key={session.user.id}>
          <AppLogado />
        </CondominioProvider>
      )}
      </AvisoRapidoProvider>
    </SafeAreaProvider>
  );
}

function AppLogado() {
  const { situacao, podeFiscalizar, loading, recarregar } = useMeuCondominio();

  if (loading) return <Carregando />;

  // Sem vínculo aprovado o app não tem o que mostrar: nenhuma tela funciona
  // sem condominio_id. Manda pro onboarding em vez de abrir abas quebradas.
  if (situacao !== 'aprovado') {
    return <EntradaScreen situacao={situacao} aoConcluir={recarregar} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: cores.primaria,
          tabBarInactiveTintColor: cores.textoFraco,
          // Sem `height` fixo de propósito: o bottom-tabs soma o inset inferior
          // sozinho, e um valor chumbado corta o rótulo em aparelho com barra
          // de gestos.
          tabBarStyle: {
            backgroundColor: cores.superficie,
            borderTopColor: cores.borda,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ focused, color, size }) => {
            const icone = ICONES[route.name];
            if (!icone) return null;
            return (
              <Ionicons
                name={focused ? icone.ativo : icone.inativo}
                size={size - 2}
                color={color}
              />
            );
          },
        })}
      >
        {/* Perfil não é aba: abre pelo avatar no cabeçalho (CabecalhoApp). */}
        <Tab.Screen name="Oficial" component={OficialScreen} />
        <Tab.Screen name="Mural" component={MuralScreen} />
        <Tab.Screen name="Solicitações" component={SolicitacoesScreen} />
        {podeFiscalizar && <Tab.Screen name="Gestão" component={GestaoScreen} />}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
