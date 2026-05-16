import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { supabase } from '../services/supabase';

export default function DashboardScreen() {
  const [stats, setStats] = useState({
    safeCount: 0,
    trappedCount: 0,
    pendingAid: 0,
    resolvedAid: 0
  });

  useEffect(() => {
    fetchStats();
    // 10 saniyede bir güncelle (Canlı dashboard hissi için)
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    // Gerçek bir sistemde count(*) query'si atılır. Burada Supabase'den çekiyoruz.
    try {
      const { data: reports } = await supabase.from('emergency_reports').select('status_type');
      const { data: aids } = await supabase.from('aid_requests').select('status');

      let safe = 0;
      let trapped = 0;
      let pAid = 0;
      let rAid = 0;

      reports?.forEach(r => {
        if (r.status_type === 'SAFE') safe++;
        if (r.status_type === 'TRAPPED') trapped++;
      });

      aids?.forEach(a => {
        if (a.status === 'pending') pAid++;
        if (a.status === 'resolved' || a.status === 'in_progress') rAid++;
      });

      setStats({
        safeCount: safe,
        trappedCount: trapped,
        pendingAid: pAid,
        resolvedAid: rAid
      });

    } catch (e) {
      console.log('Error fetching stats', e);
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Kriz Masası Yetkili Paneli sadece Web platformunda (Bilgisayar üzerinden) görüntülenmek üzere tasarlanmıştır.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚨 AFAD & Kriz Yönetim Merkezi</Text>
        <Text style={styles.subtitle}>Gerçek Zamanlı Karar Destek Sistemi</Text>
      </View>

      <View style={styles.grid}>
        <View style={[styles.card, { borderTopColor: '#EF4444' }]}>
          <Text style={styles.cardTitle}>Enkaz Altında / Acil</Text>
          <Text style={[styles.cardNumber, { color: '#EF4444' }]}>{stats.trappedCount}</Text>
          <Text style={styles.cardDesc}>Aktif kurtarma bekleyen kişi sayısı</Text>
        </View>

        <View style={[styles.card, { borderTopColor: '#10B981' }]}>
          <Text style={styles.cardTitle}>Güvende Bildirimi</Text>
          <Text style={[styles.cardNumber, { color: '#10B981' }]}>{stats.safeCount}</Text>
          <Text style={styles.cardDesc}>Başarıyla tahliye olmuş kişi sayısı</Text>
        </View>

        <View style={[styles.card, { borderTopColor: '#F59E0B' }]}>
          <Text style={styles.cardTitle}>Bekleyen Lojistik</Text>
          <Text style={[styles.cardNumber, { color: '#F59E0B' }]}>{stats.pendingAid}</Text>
          <Text style={styles.cardDesc}>Henüz üstlenilmemiş ihtiyaç/bağış sayısı</Text>
        </View>

        <View style={[styles.card, { borderTopColor: '#3B82F6' }]}>
          <Text style={styles.cardTitle}>Çözülen Lojistik</Text>
          <Text style={[styles.cardNumber, { color: '#3B82F6' }]}>{stats.resolvedAid}</Text>
          <Text style={styles.cardDesc}>Saha ekiplerince ulaştırılan kargo sayısı</Text>
        </View>
      </View>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapTitle}>🗺️ Canlı Isı Haritası & Risk Analizi</Text>
        <Text style={styles.mapDesc}>Sistemdeki {stats.trappedCount} acil durum çağrısının yoğunluk merkezleri hesaplanıyor...</Text>
        <View style={styles.fakeMap}>
          {/* Sadece web arayüzüne derinlik katmak için görsel simülasyon */}
          <View style={[styles.radarPoint, { top: '30%', left: '40%' }]} />
          <View style={[styles.radarPoint, { top: '60%', left: '70%', backgroundColor: '#EF4444', width: 40, height: 40 }]} />
          <View style={[styles.radarPoint, { top: '20%', left: '80%' }]} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#EF4444', fontSize: 16, textAlign: 'center', fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 32 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#64748B' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 32 },
  card: { 
    flex: 1, 
    minWidth: 250, 
    backgroundColor: '#FFF', 
    padding: 24, 
    borderRadius: 16, 
    borderTopWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#475569', marginBottom: 12 },
  cardNumber: { fontSize: 48, fontWeight: '900', marginBottom: 8 },
  cardDesc: { fontSize: 13, color: '#94A3B8' },
  mapPlaceholder: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  mapTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  mapDesc: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  fakeMap: { height: 300, backgroundColor: '#E2E8F0', borderRadius: 12, position: 'relative', overflow: 'hidden' },
  radarPoint: { position: 'absolute', width: 20, height: 20, backgroundColor: '#F59E0B', borderRadius: 50, opacity: 0.7 }
});
