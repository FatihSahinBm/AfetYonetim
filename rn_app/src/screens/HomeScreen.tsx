import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, AppState } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { checkInternetConnection, syncPendingMessages } from '../services/syncService';
import { supabase } from '../services/supabase';
import { getDb } from '../services/db';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [gatheringPoints, setGatheringPoints] = useState<any[]>([]);

  // İnternet durumunu kontrol eden ve eşitleme yapan ana fonksiyon
  const checkNetworkAndSync = async () => {
    const online = await checkInternetConnection();
    setIsOnline(online);
    
    if (online) {
      // 1. Bekleyen mesajları Supabase'e gönder
      await syncPendingMessages();
      
      // 2. Supabase'den toplanma alanlarını çekip SQLite'a kaydet
      await syncGatheringPoints();
    } else {
      // Çevrimdışı ise direkt SQLite'dan oku
      await loadGatheringPointsFromLocal();
    }
  };

  const syncGatheringPoints = async () => {
    try {
      const { data, error } = await supabase.from('gathering_points').select('*');
      if (data && !error) {
        const db = await getDb();
        // Önce eskileri temizle (basit bir yenileme mantığı)
        await db.runAsync('DELETE FROM gathering_points');
        
        for (const pt of data) {
          await db.runAsync(
            'INSERT INTO gathering_points (id, name, description, capacity, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [pt.id, pt.name, pt.description, pt.capacity, 0, 0, pt.created_at] // Şimdilik lat/lon 0 geçtik, postgis parse işlemi eklenebilir.
          );
        }
      }
      await loadGatheringPointsFromLocal();
    } catch (e) {
      console.error(e);
      await loadGatheringPointsFromLocal();
    }
  };

  const loadGatheringPointsFromLocal = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync('SELECT * FROM gathering_points ORDER BY created_at DESC');
    setGatheringPoints(rows);
    setLoading(false);
  };

  useEffect(() => {
    checkNetworkAndSync();

    // Uygulama ön plana geldiğinde (resume) tekrar kontrol et
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkNetworkAndSync();
      }
    });

    // Ayrıca her 10 saniyede bir polling yapalım
    const interval = setInterval(() => {
      checkNetworkAndSync();
    }, 10000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const renderGatheringPoint = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.name}</Text>
      <Text style={styles.cardDesc}>{item.description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.capacityText}>Kapasite: {item.capacity}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}>
        <Text style={styles.statusText}>
          {isOnline ? '🟢 ÇEVRİMİÇİ (Senkronize)' : '🔴 ÇEVRİMDİŞİ (Lokal Veritabanı)'}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Toplanma Alanları</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" />
        ) : gatheringPoints.length === 0 ? (
          <Text style={styles.emptyText}>Henüz toplanma alanı verisi yok.</Text>
        ) : (
          <FlatList
            data={gatheringPoints}
            keyExtractor={(item) => item.id}
            renderItem={renderGatheringPoint}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Floating Action Button for Chat */}
      <TouchableOpacity 
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Chat')}
      >
        <Text style={styles.fabIcon}>💬</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  statusBar: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 16,
  },
  listContainer: {
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
  },
});
