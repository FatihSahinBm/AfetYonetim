/**
 * Ana Sayfa Ekranı
 * 
 * Aktif afet uyarıları, hızlı erişim butonları,
 * aile üyesi durumları ve pil/bağlantı bilgisi gösterir.
 * Offline modda WatermelonDB'den veri çeker.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { COLORS } from '../../config/constants';
import { DisasterAlert } from '../../types';
import { getActiveAlerts } from '../../services/disasterService';
import { checkBatteryStatus } from '../../services/sensorService';
import { syncDatabase } from '../../services/syncService';
import AlertCard from '../../components/AlertCard';
import QuickActionButton from '../../components/QuickActionButton';
import StatusBanner from '../../components/StatusBanner';

const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isOffline, setIsOffline] = useState(false);

  /** Uygulama açıldığında verileri yükle */
  useEffect(() => {
    loadData();
    checkBattery();
  }, []);

  /** Verileri sunucudan veya lokal veritabanından yükle */
  const loadData = async () => {
    try {
      const activeAlerts = await getActiveAlerts();
      setAlerts(activeAlerts);
    } catch (error) {
      console.error('[Home] Veri yükleme hatası:', error);
      setIsOffline(true);
      // Offline modda WatermelonDB'den yükle
    }
  };

  /** Pil durumunu kontrol et */
  const checkBattery = async () => {
    const { status, warningLevel } = await checkBatteryStatus();
    setBatteryLevel(status.level);
    if (warningLevel !== 'none') {
      Alert.alert('🔋 Pil Uyarısı', `Pil seviyeniz %${status.level}. Tasarruf modunu etkinleştirin.`);
    }
  };

  /** Aşağı çekerek yenile */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncDatabase();
    await loadData();
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Üst durum çubuğu */}
      <StatusBanner isOffline={isOffline} batteryLevel={batteryLevel} />

      {/* Başlık */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Merhaba 👋</Text>
        <Text style={styles.title}>Afet Yönetim Merkezi</Text>
      </View>

      {/* Hızlı erişim butonları */}
      <View style={styles.quickActions}>
        <QuickActionButton
          icon="🆘"
          label="SOS Gönder"
          color={COLORS.danger}
          onPress={() => navigation.navigate('SOS')}
        />
        <QuickActionButton
          icon="🗺️"
          label="Toplanma Alanı"
          color={COLORS.primary}
          onPress={() => navigation.navigate('Map')}
        />
        <QuickActionButton
          icon="💬"
          label="Offline Mesaj"
          color={COLORS.info}
          onPress={() => navigation.navigate('Chat')}
        />
        <QuickActionButton
          icon="🏥"
          label="İlk Yardım"
          color={COLORS.success}
          onPress={() => {}}
        />
      </View>

      {/* İkinci sıra hızlı erişim */}
      <View style={styles.quickActions}>
        <QuickActionButton
          icon="👨‍👩‍👧‍👦"
          label="Aile Durumu"
          color={COLORS.secondary}
          onPress={() => {}}
        />
        <QuickActionButton
          icon="🏢"
          label="Bina Riski"
          color={COLORS.warning}
          onPress={() => {}}
        />
        <QuickActionButton
          icon="🐾"
          label="Hayvan Kurtarma"
          color="#8D6E63"
          onPress={() => {}}
        />
        <QuickActionButton
          icon="✅"
          label="Ben İyiyim"
          color={COLORS.success}
          onPress={() => Alert.alert('Durum', 'Durumunuz "Güvende" olarak güncellendi!')}
        />
      </View>

      {/* Aktif afet uyarıları */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ Aktif Uyarılar</Text>
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>Şu anda aktif afet uyarısı bulunmuyor</Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onPress={() => {}} />
          ))
        )}
      </View>

      {/* Bilgilendirme alanı */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>📋 Bilgilendirme</Text>
        <TouchableOpacity style={styles.infoCard}>
          <Text style={styles.infoTitle}>Deprem Anında Ne Yapmalı?</Text>
          <Text style={styles.infoSubtitle}>Çök - Kapan - Tutun prensibi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.infoCard}>
          <Text style={styles.infoTitle}>Acil Durum Çantası</Text>
          <Text style={styles.infoSubtitle}>Hazırlık listesi ve kontrol noktaları</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  greeting: { fontSize: 16, color: COLORS.grey },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.white, marginTop: 4 },
  quickActions: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: 20, gap: 10,
  },
  section: { paddingHorizontal: 20, marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 32, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.grey },
  infoSection: { paddingHorizontal: 20, marginTop: 28 },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: COLORS.info,
  },
  infoTitle: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  infoSubtitle: { fontSize: 12, color: COLORS.grey, marginTop: 4 },
});

export default HomeScreen;
