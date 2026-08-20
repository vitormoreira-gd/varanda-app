import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import AuthScreen from './screens/AuthScreen';
import MuralScreen from './screens/MuralScreen';
import PerfilScreen from './screens/PerfilScreen';
import EmBreveScreen from './screens/EmBreveScreen';
import OficialScreen from './screens/OficialScreen';
import SolicitacoesScreen from './screens/SolicitacoesScreen';
import GestaoScreen from './screens/GestaoScreen';
import { useMeuCondominio } from './lib/useMeuCondominio';

const Tab = createBottomTabNavigator();

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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  if (!session) return <AuthScreen />;

  return <AppLogado session={session} />;
}

function AppLogado({ session }: { session: Session }) {
  const { papel } = useMeuCondominio();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#1B4B66',
          tabBarInactiveTintColor: '#6B665D',
        }}
      >
        <Tab.Screen name="Mural" component={MuralScreen} />
        <Tab.Screen name="Oficial" component={OficialScreen} />
        <Tab.Screen name="Solicitações" component={SolicitacoesScreen} />
        {papel === 'sindico' && <Tab.Screen name="Gestão" component={GestaoScreen} />}
        <Tab.Screen name="Perfil">
          {() => <PerfilScreen session={session} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
