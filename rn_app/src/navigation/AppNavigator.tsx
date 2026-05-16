/**
 * Ana Navigasyon Yapılandırması
 * 
 * Uygulama navigasyon ağacını yönetir:
 * - Auth Stack: Giriş ve kayıt ekranları
 * - Main Tabs: Ana sayfa, harita, SOS, mesajlaşma, profil
 * - Sub Screens: Detay ekranları (modal olarak açılır)
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../types';
import { COLORS } from '../config/constants';

// Ekranları içe aktar
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import HomeScreen from '../screens/main/HomeScreen';
import MapScreen from '../screens/main/MapScreen';
import SOSScreen from '../screens/main/SOSScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Alt tab navigasyonu (ana ekranlar).
 * Her tab bir ana özelliği temsil eder.
 */
const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.dark,
          borderTopColor: 'rgba(255,255,255,0.1)',
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.grey,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Ana Sayfa', tabBarIcon: () => null }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarLabel: 'Harita', tabBarIcon: () => null }}
      />
      <Tab.Screen
        name="SOS"
        component={SOSScreen}
        options={{
          tabBarLabel: 'SOS',
          tabBarIcon: () => null,
          tabBarLabelStyle: { color: COLORS.danger, fontSize: 13, fontWeight: '800' },
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: 'Mesajlar', tabBarIcon: () => null }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profil', tabBarIcon: () => null }}
      />
    </Tab.Navigator>
  );
};

/**
 * Kök navigasyon yapısı.
 * Oturum durumuna göre Auth veya Main stack gösterilir.
 */
const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="Auth"
      >
        <Stack.Screen name="Auth" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
