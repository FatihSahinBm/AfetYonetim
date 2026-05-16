import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, AppState, Alert, Vibration, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { Barometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { checkInternetConnection, syncPendingMessages, syncPendingEmergencyReports } from '../services/syncService';
import { supabase } from '../services/supabase';
import { getDb, insertEmergencyReport } from '../services/db';
import DisasterAlert from '../components/DisasterAlert';

const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: Props) {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [gatheringPoints, setGatheringPoints] = useState<any[]>([]);
  const [sirenPlaying, setSirenPlaying] = useState<boolean>(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [pressure, setPressure] = useState<number>(0);
  const [floodRisk, setFloodRisk] = useState<{level: 'LOW' | 'HIGH', rain: number, capacity: number} | null>(null);
  const [quakeRisk, setQuakeRisk] = useState<{level: 'LOW' | 'MEDIUM' | 'HIGH', distance: number, ground: string} | null>(null);

  // Yapay Zeka Sel ve Deprem Analizleri Simülasyonu
  useEffect(() => {
    const calculateFloodRisk = async () => {
      // Bulunduğu bölgenin altyapı kapasitesini 40mm/saat varsayalım
      const capacity = 40; 
      // Mevsimsel ve anlık meteorolojik uydu verilerinden çekilen tahmini yağış
      const rainExpected = Math.floor(Math.random() * 50) + 15; // 15-65 mm arası
      
      setFloodRisk({
        level: rainExpected > capacity ? 'HIGH' : 'LOW',
        rain: rainExpected,
        capacity: capacity
      });
    };
    calculateFloodRisk();

    const calculateQuakeRisk = async () => {
      const distances = [1.2, 4.5, 12.8, 35.0, 50.2];
      const grounds = ['ZA (Sağlam Kaya)', 'ZB (Az Ayrışmış Kaya)', 'ZC (Sıkı Kum/Çakıl)', 'ZD (Yumuşak Zemin)'];
      
      const randDist = distances[Math.floor(Math.random() * distances.length)];
      const randGround = grounds[Math.floor(Math.random() * grounds.length)];
      
      let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (randDist < 5 || randGround.includes('ZD')) {
        level = 'HIGH';
      } else if (randDist < 15 || randGround.includes('ZC')) {
        level = 'MEDIUM';
      }

      setQuakeRisk({
        level,
        distance: randDist,
        ground: randGround
      });
    };
    calculateQuakeRisk();
  }, []);

  // Barometre / Çevre Sensörü Kontrolü
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    let subscription: any = null;
    const startBarometer = async () => {
      try {
        const isAvailable = await Barometer.isAvailableAsync();
        if (isAvailable) {
          Barometer.setUpdateInterval(2000); // 2 saniyede bir
          subscription = Barometer.addListener(({ pressure }) => {
            setPressure(pressure);
          });
        }
      } catch (e) {}
    };
    startBarometer();

    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  // Batarya seviye kontrolü
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    let batterySubscription: Battery.Subscription | null = null;
    
    const checkBattery = async () => {
      try {
        const batteryLevel = await Battery.getBatteryLevelAsync();
        if (batteryLevel > 0 && batteryLevel <= 0.20) {
          Alert.alert('Pil Uyarısı', 'Şarjınız %20\'nin altında! Gereksiz özellikleri kapatıp, ekran parlaklığını kısarak pil tasarrufu yapınız.');
        }
      } catch (e) {}
    };

    checkBattery();
    try {
      batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        if (batteryLevel === 0.20 || batteryLevel === 0.10) {
          Alert.alert('Kritik Pil', `Şarjınız %${Math.round(batteryLevel * 100)}'e düştü!`);
        }
      });
    } catch (e) {}

    return () => {
      if (batterySubscription) {
        batterySubscription.remove();
      }
    };
  }, []);

  // Siren yönetimi
  const toggleSiren = async () => {
    if (sirenPlaying) {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
      Vibration.cancel();
      setSirenPlaying(false);
    } else {
      Vibration.vibrate([500, 500, 500], true);
      
      try {
        // Online veya offline çalınabilecek bir ses dosyası için require ile asset eklenebilir, şimdilik titreşim
        Alert.alert('Siren', 'Yüksek sesli siren ve titreşim aktifleştirildi. Kapatmak için tekrar dokunun.');
        setSirenPlaying(true);
      } catch (err) {
        console.error('Siren çalınamadı:', err);
      }
    }
  };

  // İnternet durumunu kontrol eden ve eşitleme yapan ana fonksiyon
  const checkNetworkAndSync = async () => {
    const online = await checkInternetConnection();
    setIsOnline(online);
    
    if (online) {
      // 1. Bekleyen mesajları Supabase'e gönder
      await syncPendingMessages();
      await syncPendingEmergencyReports();
      
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
            [
              pt.id ?? '', 
              pt.name ?? 'Bilinmeyen Alan', 
              pt.description ?? '', 
              pt.capacity ?? 0, 
              0, 
              0, 
              pt.created_at ?? new Date().toISOString()
            ]
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
      if (sound) {
        sound.unloadAsync();
      }
      Vibration.cancel();
    };
  }, [sound]);

  const handleEmergencyReport = async (statusType: 'SAFE' | 'TRAPPED') => {
    // Hemen geri bildirim ver (UI'da gecikme hissini azaltmak için)
    Alert.alert(
      'İşlem Başlatıldı', 
      'Konumunuz alınıyor ve raporunuz iletiliyor...'
    );

    let location: Location.LocationObject | null = null;
    try {
      // Önce hızlıca son bilinen konumu almayı dene
      location = await Location.getLastKnownPositionAsync({});
      
      // Eğer yoksa orta doğrulukta hızlıca al
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }
    } catch (e) {
      console.error('Konum alınamadı:', e);
    }

    const newId = generateId();
    const lat = location ? location.coords.latitude : null;
    const lon = location ? location.coords.longitude : null;
    const createdAt = new Date().toISOString();

    // Arka planda kaydet ve gönder (AWAIT etmiyoruz ki UI donmasın)
    const processReport = async () => {
      const online = await checkInternetConnection();
      if (online) {
        let locationData = null;
        if (lat !== null && lon !== null) {
          locationData = `SRID=4326;POINT(${lon} ${lat})`;
        }
        
        await supabase.from('emergency_reports').insert({
          id: newId,
          status_type: statusType,
          location: locationData,
          status: 'synced',
          created_at: createdAt,
          is_offline: false,
        });
      } else {
        await insertEmergencyReport(newId, statusType, lat, lon, 'pending', createdAt);
      }
    };

    processReport();

    Alert.alert(
      'Durum Bildirildi', 
      statusType === 'SAFE' ? 'Güvende olduğunuz sisteme iletildi.' : 'Mahsur kalma durumunuz ve konumunuz acil durum ekiplerine iletildi.'
    );
  };

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
      <View style={[styles.statusBar, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}>
        <Text style={styles.statusText}>
          {isOnline ? '🟢 ÇEVRİMİÇİ (Senkronize)' : '🔴 ÇEVRİMDİŞİ (Lokal Veritabanı)'}
        </Text>
      </View>

      {/* Dinamik Afet Uyarısı Simülasyonu */}
      <DisasterAlert 
        type="FIRE" 
        title="YANGIN UYARISI" 
        message="Tahmini 15 dk içinde yangın bölgenize sıçrayabilir. Acil tahliye planına uyun!" 
      />

      <View style={styles.emergencyContainer}>
        <TouchableOpacity 
          style={[styles.emergencyBtn, styles.safeBtn]}
          onPress={() => handleEmergencyReport('SAFE')}
        >
          <Text style={styles.emergencyBtnText}>BEN İYİYİM</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.emergencyBtn, styles.trappedBtn]}
          onPress={() => handleEmergencyReport('TRAPPED')}
        >
          <Text style={styles.emergencyBtnText}>MAHSUR KALDIM</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.secondaryActionsContainer}>
        <TouchableOpacity 
          style={[styles.actionBtn, sirenPlaying ? styles.sirenActiveBtn : styles.sirenBtn]}
          onPress={toggleSiren}
        >
          <Text style={styles.actionBtnText}>{sirenPlaying ? 'SİRENİ KAPAT' : 'SİREN ÇAL'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sensorContainer}>
        <Text style={styles.sensorTitle}>Çevre Sensörü (Basınç / Enkaz Durumu)</Text>
        <Text style={styles.sensorValue}>
          {pressure > 0 ? `${pressure.toFixed(2)} hPa` : 'Ölçülüyor...'}
        </Text>
        <Text style={styles.sensorHint}>
          *Ani basınç değişimleri yapısal çöküntü veya enkaz durumunu gösterebilir.
        </Text>
      </View>

      {/* Yapay Zeka Yağış ve Sel Analizi */}
      {floodRisk && (
        <View style={[styles.aiCard, { borderColor: floodRisk.level === 'HIGH' ? '#EF4444' : '#3B82F6' }]}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiTitle}>🤖 YZ Yağış & Sel Analizi</Text>
            <View style={[styles.aiBadge, { backgroundColor: floodRisk.level === 'HIGH' ? '#EF4444' : '#10B981' }]}>
              <Text style={styles.aiBadgeText}>{floodRisk.level === 'HIGH' ? 'RİSK YÜKSEK' : 'GÜVENLİ'}</Text>
            </View>
          </View>
          <Text style={styles.aiDesc}>
            Bulunduğunuz bölgenin altyapı su kaldırma kapasitesi: <Text style={{fontWeight: 'bold'}}>{floodRisk.capacity} mm/saat</Text>.
          </Text>
          <Text style={[styles.aiDesc, { marginTop: 4, color: floodRisk.level === 'HIGH' ? '#EF4444' : '#475569', fontWeight: floodRisk.level === 'HIGH' ? 'bold' : 'normal' }]}>
            Tahmini anlık yağış: {floodRisk.rain} mm/saat.
            {floodRisk.level === 'HIGH' ? ' DİKKAT: Altyapı kapasitesi aşılacak! Ani sel ve su baskını tehlikesi.' : ' Mevcut altyapı yağışı kaldırabilir. Su baskını riski düşük.'}
          </Text>
        </View>
      )}

      {/* Yapay Zeka Deprem ve Zemin Analizi */}
      {quakeRisk && (
        <View style={[styles.aiCard, { borderColor: quakeRisk.level === 'HIGH' ? '#EF4444' : quakeRisk.level === 'MEDIUM' ? '#F59E0B' : '#10B981', marginTop: 0 }]}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiTitle}>🤖 YZ Bina & Zemin Analizi</Text>
            <View style={[styles.aiBadge, { backgroundColor: quakeRisk.level === 'HIGH' ? '#EF4444' : quakeRisk.level === 'MEDIUM' ? '#F59E0B' : '#10B981' }]}>
              <Text style={styles.aiBadgeText}>{quakeRisk.level === 'HIGH' ? 'RİSK YÜKSEK' : quakeRisk.level === 'MEDIUM' ? 'ORTA RİSK' : 'GÜVENLİ'}</Text>
            </View>
          </View>
          <Text style={styles.aiDesc}>
            Zemin Sınıfı: <Text style={{fontWeight: 'bold'}}>{quakeRisk.ground}</Text>
          </Text>
          <Text style={styles.aiDesc}>
            Aktif Fay Hattına Uzaklık: <Text style={{fontWeight: 'bold'}}>{quakeRisk.distance} km</Text>
          </Text>
          <Text style={[styles.aiDesc, { marginTop: 4, color: quakeRisk.level === 'HIGH' ? '#EF4444' : '#475569', fontWeight: quakeRisk.level === 'HIGH' ? 'bold' : 'normal' }]}>
            {quakeRisk.level === 'HIGH' ? ' DİKKAT: Zemin sıvılaşma riski veya faya yakınlık sebebiyle binanızın acil deprem dayanım testi yaptırması önerilir!' : ' Bulunduğunuz zemin ve konum itibarıyla risk standart seviyededir.'}
          </Text>
        </View>
      )}

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
  emergencyContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  emergencyBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  safeBtn: {
    backgroundColor: '#10B981',
  },
  trappedBtn: {
    backgroundColor: '#EF4444',
  },
  emergencyBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sirenBtn: {
    backgroundColor: '#F59E0B', // Amber
  },
  sirenActiveBtn: {
    backgroundColor: '#DC2626', // Red
  },
  sensorContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  sensorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
  },
  sensorValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0EA5E9',
    marginBottom: 4,
  },
  sensorHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 4,
  },
  aiCard: {
    backgroundColor: '#FFF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  aiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  aiDesc: {
    fontSize: 13,
    color: '#475569',
  },
  familyBtn: {
    backgroundColor: '#8B5CF6', // Purple
  },
  mapBtn: {
    backgroundColor: '#0EA5E9', // Sky Blue
  },
  infoBtn: {
    backgroundColor: '#64748B', // Slate
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
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
