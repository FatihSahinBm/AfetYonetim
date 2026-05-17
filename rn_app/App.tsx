import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { initDb } from './src/services/db';

// Ekranda çıkan sarı/kırmızı uyarıları gizler
LogBox.ignoreLogs(['Network request failed', 'AuthRetryableFetchError']);

// Terminale basılan kırmızı ağ hatalarını sessize alır (Sadece Sunum İçin)
const originalConsoleError = console.error;
console.error = (...args) => {
  const errorString = args.join(' ');
  if (errorString.includes('Network request failed') || errorString.includes('AuthRetryableFetchError')) {
    return; // Hatayı yut ve terminale basma
  }
  originalConsoleError(...args);
};

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        await initDb();
        setIsDbReady(true);
      } catch (error) {
        console.error("Veritabanı başlatılamadı:", error);
      }
    };

    setupDatabase();
  }, []);

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <AppNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
});
