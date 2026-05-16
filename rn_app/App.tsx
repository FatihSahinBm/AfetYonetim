import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { initDb } from './src/services/db';

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
