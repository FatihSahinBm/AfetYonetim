/**
 * AfetYonetim - Ana Uygulama Bileşeni
 * 
 * Uygulamanın giriş noktası. Veritabanı, navigasyon,
 * bildirim kanalları ve mesh ağı başlatma işlemlerini yönetir.
 */

import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import database from './src/database';
import AppNavigator from './src/navigation/AppNavigator';
import { createNotificationChannels } from './src/services/notificationService';
import { syncDatabase } from './src/services/syncService';
import { COLORS } from './src/config/constants';

// WatermelonDB uyarılarını bastır (geliştirme ortamı)
LogBox.ignoreLogs(['Require cycle']);

const App: React.FC = () => {
  useEffect(() => {
    initializeApp();
  }, []);

  /** Uygulama başlangıç işlemleri */
  const initializeApp = async () => {
    try {
      // 1. Bildirim kanallarını oluştur
      await createNotificationChannels();

      // 2. Veritabanı senkronizasyonunu başlat
      await syncDatabase();

      console.log('[App] Uygulama başarıyla başlatıldı');
    } catch (error) {
      console.error('[App] Başlatma hatası:', error);
      // Hata olsa bile uygulama çalışmaya devam eder (offline mod)
    }
  };

  return (
    <DatabaseProvider database={database}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.dark} />
      <AppNavigator />
    </DatabaseProvider>
  );
};

export default App;
