import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import AuthScreen from '../screens/AuthScreen';
import InfoScreen from '../screens/InfoScreen';
import FamilyScreen from '../screens/FamilyScreen';
import MapScreen from '../screens/MapScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  Auth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: any = 'home';
          if (route.name === 'HomeTab') iconName = 'home';
          else if (route.name === 'MapTab') iconName = 'map';
          else if (route.name === 'FamilyTab') iconName = 'people';
          else if (route.name === 'InfoTab') iconName = 'information-circle';
          else if (route.name === 'ChatTab') iconName = 'chatbubbles';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        headerStyle: { backgroundColor: '#1E293B' },
        headerTintColor: '#fff',
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: 'gray',
        headerRight: () => (
          <TouchableOpacity onPress={() => supabase.auth.signOut()} style={{ marginRight: 15 }}>
            <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Çıkış</Text>
          </TouchableOpacity>
        )
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen name="MapTab" component={MapScreen} options={{ title: 'Harita' }} />
      <Tab.Screen name="FamilyTab" component={FamilyScreen} options={{ title: 'Aile' }} />
      <Tab.Screen name="ChatTab" component={ChatScreen} options={{ title: 'Mesajlar' }} />
      <Tab.Screen name="InfoTab" component={InfoScreen} options={{ title: 'Bilgi' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const updateUserActivity = async (sess: Session | null) => {
      setSession(sess);
      if (sess?.user) {
        // Upsert user profile to update last_active_at (Zombi Telefon takibi)
        await supabase.from('profiles').upsert({
          id: sess.user.id,
          email: sess.user.email,
          last_active_at: new Date().toISOString()
        }, { onConflict: 'id' });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      updateUserActivity(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      updateUserActivity(session);
    });
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session && session.user ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
