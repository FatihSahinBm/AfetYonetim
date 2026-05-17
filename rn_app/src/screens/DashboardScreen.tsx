import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, Alert, TextInput } from 'react-native';
import { supabase } from '../services/supabase';
import TrapMap from '../components/TrapMap';

type AlertType = 'FIRE' | 'FLOOD' | 'EARTHQUAKE';

interface SimulationParams {
  FIRE: { distance: number; windSpeed: number; windDir: string; eta: string };
  FLOOD: { rainfall: number; riverLevel: number; eta: string; affectedArea: string };
  EARTHQUAKE: { magnitude: number; depth: number; distance: number; tsunamiRisk: boolean };
}

export default function DashboardScreen() {
  const [stats, setStats] = useState({ safeCount: 0, trappedCount: 0, pendingAid: 0, resolvedAid: 0 });
  const [trappedReports, setTrappedReports] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [sending, setSending] = useState<AlertType | null>(null);

  // Simülasyon parametreleri
  const [fireParams, setFireParams] = useState({ distance: 12, windSpeed: 35, windDir: 'Kuzey', eta: '45 dakika' });
  const [floodParams, setFloodParams] = useState({ rainfall: 87, riverLevel: 4.2, eta: '2 saat', affectedArea: 'Alt geçitler ve sahil şeridi' });
  const [quakeParams, setQuakeParams] = useState({ magnitude: 6.1, depth: 10, distance: 8, tsunamiRisk: false });

  const [showFireForm, setShowFireForm] = useState(false);
  const [showFloodForm, setShowFloodForm] = useState(false);
  const [showQuakeForm, setShowQuakeForm] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchActiveAlerts();
    const interval = setInterval(() => {
      fetchStats();
      fetchActiveAlerts();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const { data: reports } = await supabase.from('emergency_reports').select('id, status_type, lat, lon, user_id, created_at');
      const { data: aids } = await supabase.from('aid_requests').select('status');
      let safe = 0, trapped = 0, pAid = 0, rAid = 0;
      const trapped_list: any[] = [];
      reports?.forEach(r => {
        if (r.status_type === 'SAFE') safe++;
        if (r.status_type === 'TRAPPED') { trapped++; trapped_list.push(r); }
      });
      aids?.forEach(a => { if (a.status === 'pending') pAid++; if (a.status === 'resolved' || a.status === 'in_progress') rAid++; });
      setStats({ safeCount: safe, trappedCount: trapped, pendingAid: pAid, resolvedAid: rAid });
      setTrappedReports(trapped_list);
    } catch (e) { console.log('Error fetching stats', e); }
  };

  const fetchActiveAlerts = async () => {
    try {
      const { data } = await supabase.from('disaster_alerts').select('*').eq('is_active', true).order('created_at', { ascending: false });
      if (data) setActiveAlerts(data);
    } catch (e) { console.log('Active alerts fetch error', e); }
  };

  const sendSimulation = async (type: AlertType) => {
    setSending(type);
    try {
      let title = '';
      let message = '';
      let extra_data = {};

      if (type === 'FIRE') {
        title = '🔥 ACİL YANGIN UYARISI';
        message = `Bulunduğunuz bölgeye ${fireParams.distance} km uzaklıkta orman yangını tespit edildi!\n\n🌬️ Rüzgar: ${fireParams.windSpeed} km/sa — ${fireParams.windDir} yönünde\n⏱️ Yangın tahminen ${fireParams.eta} içinde bölgenize sıçrayabilir.\n\n⛔ Acilen tahliye olun! Tüm pencere ve kapıları kapatın, araçlara binin!`;
        extra_data = { ...fireParams };
      } else if (type === 'FLOOD') {
        title = '🌊 ACİL SEL UYARISI';
        message = `Bulunduğunuz bölgede kritik düzeyde sel tehlikesi!\n\n🌧️ Saatlik yağış: ${floodParams.rainfall} mm (Altyapı kapasitesinin üzerinde)\n🏞️ Nehir/dere seviyesi: ${floodParams.riverLevel} metre — Kritik eşiğin üzerinde\n📍 Etkilenecek alanlar: ${floodParams.affectedArea}\n⏱️ Tahmini ulaşma süresi: ${floodParams.eta}\n\n⛔ Zemin katlardan hemen çıkın! Sel yatakları ve alt geçitlerden uzak durun!`;
        extra_data = { ...floodParams };
      } else if (type === 'EARTHQUAKE') {
        title = '🌍 ACİL DEPREM UYARISI';
        const tsunami = quakeParams.tsunamiRisk ? '\n\n🌊 TSUNAMI RİSKİ YÜKSEK! Kıyı bölgelerini derhal terk edin!' : '';
        message = `Bölgenizde ${quakeParams.magnitude} büyüklüğünde deprem riski tespit edildi!\n\n📍 Mesafe: ${quakeParams.distance} km\n📏 Odak derinliği: ${quakeParams.depth} km (Sığ deprem — yıkıcı olabilir)\n\n⛔ Güvenli alanlara geçin! Bina içindeyseniz masanın altına girin, dışarıdaysanız açık alanda kalın!${tsunami}`;
        extra_data = { ...quakeParams };
      }

      const { error } = await supabase.from('disaster_alerts').insert({
        alert_type: type,
        title,
        message,
        severity: 'CRITICAL',
        is_active: true,
        created_by: 'crisis_desk',
        extra_data,
        expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 saat
      });

      if (error) {
        Alert.alert('Hata', 'Uyarı gönderilemedi:\n' + error.message);
      } else {
        Alert.alert('✅ Başarılı', `${type === 'FIRE' ? 'Yangın' : type === 'FLOOD' ? 'Sel' : 'Deprem'} uyarısı tüm mobil kullanıcılara gönderildi!`);
        setShowFireForm(false);
        setShowFloodForm(false);
        setShowQuakeForm(false);
        fetchActiveAlerts();
      }
    } catch (e) {
      Alert.alert('Hata', 'Bir hata oluştu.');
    }
    setSending(null);
  };

  const cancelAlert = async (id: string, type: string) => {
    const { error } = await supabase.from('disaster_alerts').update({ is_active: false }).eq('id', id);
    if (!error) {
      Alert.alert('Uyarı İptal Edildi', 'Mobil kullanıcılara uyarı kaldırıldı.');
      fetchActiveAlerts();
    }
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Kriz Masası Yetkili Paneli sadece Web platformunda (Bilgisayar üzerinden) görüntülenmek üzere tasarlanmıştır.</Text>
      </View>
    );
  }

  const alertTypeLabel = (type: string) => {
    if (type === 'FIRE') return '🔥 Yangın';
    if (type === 'FLOOD') return '🌊 Sel';
    if (type === 'EARTHQUAKE') return '🌍 Deprem';
    return type;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚨 AFAD &amp; Kriz Yönetim Merkezi</Text>
        <Text style={styles.subtitle}>Gerçek Zamanlı Karar Destek Sistemi</Text>
      </View>

      {/* İstatistik Kartları */}
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
          <Text style={styles.cardDesc}>Henüz üstlenilmemiş ihtiyaç sayısı</Text>
        </View>
        <View style={[styles.card, { borderTopColor: '#3B82F6' }]}>
          <Text style={styles.cardTitle}>Çözülen Lojistik</Text>
          <Text style={[styles.cardNumber, { color: '#3B82F6' }]}>{stats.resolvedAid}</Text>
          <Text style={styles.cardDesc}>Saha ekiplerince ulaştırılan kargo sayısı</Text>
        </View>
      </View>

      {/* Afet Simülasyon Butonu */}
      <View style={styles.simSection}>
        <Text style={styles.simTitle}>⚡ Afet Simülasyonu &amp; Gerçek Zamanlı Uyarı Sistemi</Text>
        <Text style={styles.simSubtitle}>Aşağıdaki butonları kullanarak tüm mobil kullanıcılara anlık uyarı gönderin. Parametreleri ayarlayıp gönderin.</Text>

        <View style={styles.simGrid}>
          {/* YANGIN */}
          <View style={[styles.simCard, { borderColor: '#EF4444' }]}>
            <Text style={styles.simCardIcon}>🔥</Text>
            <Text style={styles.simCardTitle}>Yangın Simülasyonu</Text>
            <Text style={styles.simCardDesc}>Orman / kentsel yangın uyarısı gönder</Text>
            <TouchableOpacity style={styles.simConfigBtn} onPress={() => { setShowFireForm(!showFireForm); setShowFloodForm(false); setShowQuakeForm(false); }}>
              <Text style={styles.simConfigBtnText}>⚙️ Parametreleri Ayarla</Text>
            </TouchableOpacity>
            {showFireForm && (
              <View style={styles.paramForm}>
                <Text style={styles.paramLabel}>Mesafe (km)</Text>
                <TextInput style={styles.paramInput} value={String(fireParams.distance)} onChangeText={v => setFireParams(p => ({ ...p, distance: Number(v) || 0 }))} keyboardType="numeric" />
                <Text style={styles.paramLabel}>Rüzgar Hızı (km/sa)</Text>
                <TextInput style={styles.paramInput} value={String(fireParams.windSpeed)} onChangeText={v => setFireParams(p => ({ ...p, windSpeed: Number(v) || 0 }))} keyboardType="numeric" />
                <Text style={styles.paramLabel}>Rüzgar Yönü</Text>
                <TextInput style={styles.paramInput} value={fireParams.windDir} onChangeText={v => setFireParams(p => ({ ...p, windDir: v }))} />
                <Text style={styles.paramLabel}>Tahmini Süre</Text>
                <TextInput style={styles.paramInput} value={fireParams.eta} onChangeText={v => setFireParams(p => ({ ...p, eta: v }))} placeholder="örn: 45 dakika" />
              </View>
            )}
            <TouchableOpacity
              style={[styles.simSendBtn, { backgroundColor: '#EF4444' }, sending === 'FIRE' && styles.disabled]}
              onPress={() => sendSimulation('FIRE')}
              disabled={sending !== null}
            >
              <Text style={styles.simSendBtnText}>{sending === 'FIRE' ? 'Gönderiliyor...' : '📡 Tüm Kullanıcılara Gönder'}</Text>
            </TouchableOpacity>
          </View>

          {/* SEL */}
          <View style={[styles.simCard, { borderColor: '#3B82F6' }]}>
            <Text style={styles.simCardIcon}>🌊</Text>
            <Text style={styles.simCardTitle}>Sel Simülasyonu</Text>
            <Text style={styles.simCardDesc}>Su baskını / sel tehlikesi uyarısı gönder</Text>
            <TouchableOpacity style={styles.simConfigBtn} onPress={() => { setShowFloodForm(!showFloodForm); setShowFireForm(false); setShowQuakeForm(false); }}>
              <Text style={styles.simConfigBtnText}>⚙️ Parametreleri Ayarla</Text>
            </TouchableOpacity>
            {showFloodForm && (
              <View style={styles.paramForm}>
                <Text style={styles.paramLabel}>Saatlik Yağış (mm)</Text>
                <TextInput style={styles.paramInput} value={String(floodParams.rainfall)} onChangeText={v => setFloodParams(p => ({ ...p, rainfall: Number(v) || 0 }))} keyboardType="numeric" />
                <Text style={styles.paramLabel}>Nehir Seviyesi (metre)</Text>
                <TextInput style={styles.paramInput} value={String(floodParams.riverLevel)} onChangeText={v => setFloodParams(p => ({ ...p, riverLevel: Number(v) || 0 }))} keyboardType="numeric" />
                <Text style={styles.paramLabel}>Tahmini Ulaşma Süresi</Text>
                <TextInput style={styles.paramInput} value={floodParams.eta} onChangeText={v => setFloodParams(p => ({ ...p, eta: v }))} placeholder="örn: 2 saat" />
                <Text style={styles.paramLabel}>Etkilenecek Alanlar</Text>
                <TextInput style={styles.paramInput} value={floodParams.affectedArea} onChangeText={v => setFloodParams(p => ({ ...p, affectedArea: v }))} placeholder="örn: Alt geçitler, sahil şeridi" />
              </View>
            )}
            <TouchableOpacity
              style={[styles.simSendBtn, { backgroundColor: '#3B82F6' }, sending === 'FLOOD' && styles.disabled]}
              onPress={() => sendSimulation('FLOOD')}
              disabled={sending !== null}
            >
              <Text style={styles.simSendBtnText}>{sending === 'FLOOD' ? 'Gönderiliyor...' : '📡 Tüm Kullanıcılara Gönder'}</Text>
            </TouchableOpacity>
          </View>

          {/* DEPREM */}
          <View style={[styles.simCard, { borderColor: '#F59E0B' }]}>
            <Text style={styles.simCardIcon}>🌍</Text>
            <Text style={styles.simCardTitle}>Deprem Simülasyonu</Text>
            <Text style={styles.simCardDesc}>Deprem / artçı sarsıntı uyarısı gönder</Text>
            <TouchableOpacity style={styles.simConfigBtn} onPress={() => { setShowQuakeForm(!showQuakeForm); setShowFireForm(false); setShowFloodForm(false); }}>
              <Text style={styles.simConfigBtnText}>⚙️ Parametreleri Ayarla</Text>
            </TouchableOpacity>
            {showQuakeForm && (
              <View style={styles.paramForm}>
                <Text style={styles.paramLabel}>Büyüklük (Richter)</Text>
                <TextInput style={styles.paramInput} value={String(quakeParams.magnitude)} onChangeText={v => setQuakeParams(p => ({ ...p, magnitude: Number(v) || 0 }))} keyboardType="numeric" />
                <Text style={styles.paramLabel}>Derinlik (km)</Text>
                <TextInput style={styles.paramInput} value={String(quakeParams.depth)} onChangeText={v => setQuakeParams(p => ({ ...p, depth: Number(v) || 0 }))} keyboardType="numeric" />
                <Text style={styles.paramLabel}>Merkeze Uzaklık (km)</Text>
                <TextInput style={styles.paramInput} value={String(quakeParams.distance)} onChangeText={v => setQuakeParams(p => ({ ...p, distance: Number(v) || 0 }))} keyboardType="numeric" />
                <TouchableOpacity style={styles.toggleBtn} onPress={() => setQuakeParams(p => ({ ...p, tsunamiRisk: !p.tsunamiRisk }))}>
                  <Text style={styles.toggleBtnText}>{quakeParams.tsunamiRisk ? '🌊 Tsunami Riski: AÇIK' : '🌊 Tsunami Riski: KAPALI'}</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={[styles.simSendBtn, { backgroundColor: '#F59E0B' }, sending === 'EARTHQUAKE' && styles.disabled]}
              onPress={() => sendSimulation('EARTHQUAKE')}
              disabled={sending !== null}
            >
              <Text style={styles.simSendBtnText}>{sending === 'EARTHQUAKE' ? 'Gönderiliyor...' : '📡 Tüm Kullanıcılara Gönder'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Aktif Uyarılar */}
      {activeAlerts.length > 0 && (
        <View style={styles.activeSection}>
          <Text style={styles.activeTitle}>🔴 Şu An Aktif Uyarılar ({activeAlerts.length})</Text>
          {activeAlerts.map(alert => (
            <View key={alert.id} style={styles.activeAlertRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeAlertType}>{alertTypeLabel(alert.alert_type)}</Text>
                <Text style={styles.activeAlertTitle}>{alert.title}</Text>
                <Text style={styles.activeAlertTime}>{new Date(alert.created_at).toLocaleString('tr-TR')}</Text>
              </View>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelAlert(alert.id, alert.alert_type)}>
                <Text style={styles.cancelBtnText}>❌ İptal Et</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Isı Haritası */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapTitle}>🗺️ Canlı Isı Haritası &amp; Risk Analizi</Text>
        <Text style={styles.mapDesc}>
          {trappedReports.length > 0
            ? `${trappedReports.filter(r => r.lat && r.lon).length} mahsur kalanın konumu haritada gösteriliyor. Kırmızı noktalar aktif MAHSUR bildirimleridir.`
            : `Sistemde henüz konumu kayıtlı mahsur kalan bildirilmemiş. Toplam ${stats.trappedCount} MAHSUR kaydı var.`
          }
        </Text>
        <TrapMap reports={trappedReports} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#EF4444', fontSize: 16, textAlign: 'center', fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#F1F5F9', padding: 32 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#64748B' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 32 },
  card: {
    flex: 1, minWidth: 200, backgroundColor: '#FFF', padding: 24, borderRadius: 16, borderTopWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 12 },
  cardNumber: { fontSize: 48, fontWeight: '900', marginBottom: 8 },
  cardDesc: { fontSize: 13, color: '#94A3B8' },
  // Simülasyon bölümü
  simSection: { backgroundColor: '#1E293B', borderRadius: 20, padding: 28, marginBottom: 32 },
  simTitle: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 8 },
  simSubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 24 },
  simGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  simCard: { flex: 1, minWidth: 260, backgroundColor: '#0F172A', borderRadius: 16, borderWidth: 2, padding: 20 },
  simCardIcon: { fontSize: 36, marginBottom: 8 },
  simCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 4 },
  simCardDesc: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  simConfigBtn: { backgroundColor: '#1E293B', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  simConfigBtnText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  paramForm: { backgroundColor: '#0F172A', borderRadius: 10, padding: 12, marginBottom: 12 },
  paramLabel: { fontSize: 12, color: '#64748B', marginBottom: 4, marginTop: 8, fontWeight: '600' },
  paramInput: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 6, padding: 8, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  toggleBtn: { marginTop: 12, backgroundColor: '#1E293B', borderRadius: 8, padding: 10, alignItems: 'center' },
  toggleBtnText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 13 },
  simSendBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  simSendBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  disabled: { opacity: 0.5 },
  // Aktif uyarılar
  activeSection: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 32, borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  activeTitle: { fontSize: 18, fontWeight: 'bold', color: '#EF4444', marginBottom: 16 },
  activeAlertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  activeAlertType: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  activeAlertTitle: { fontSize: 13, color: '#475569', marginTop: 2 },
  activeAlertTime: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  cancelBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 12 },
  cancelBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 13 },
  // Harita
  mapPlaceholder: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, marginBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  mapTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  mapDesc: { fontSize: 14, color: '#64748B', marginBottom: 20 },
});
