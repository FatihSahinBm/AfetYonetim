import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, AppState, Alert, Vibration, Platform, Modal, TextInput, Image, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { Barometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { checkInternetConnection, syncPendingMessages, syncPendingEmergencyReports } from '../services/syncService';
import { supabase } from '../services/supabase';
import { getDb, insertEmergencyReport, insertAidRequest, updateHazardReportVotes } from '../services/db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DisasterAlert from '../components/DisasterAlert';
import { generateSyntheticSiren } from '../utils/audioGenerator';

const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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
  const [floodRisk, setFloodRisk] = useState<{ level: 'LOW' | 'HIGH', rain: number, capacity: number } | null>(null);
  const [quakeRisk, setQuakeRisk] = useState<{ level: 'LOW' | 'MEDIUM' | 'HIGH', distance: number, ground: string } | null>(null);

  // Yardım İste form stateleri
  const [showAidModal, setShowAidModal] = useState(false);
  const [aidFullName, setAidFullName] = useState('');
  const [aidType, setAidType] = useState('Tıbbi Yardım');
  const [aidDesc, setAidDesc] = useState('');

  // Düzenleme stateleri
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('ENKAZ');

  // Tehlike raporları (Topluluk Oylaması)
  const [communityHazards, setCommunityHazards] = useState<any[]>([]);
  const [votedHazards, setVotedHazards] = useState<Set<string>>(new Set());
  // Geçmiş ihbarlarım
  const [myReports, setMyReports] = useState<any[]>([]);
  // Kriz Masası uyarıları (Realtime)
  const [disasterAlerts, setDisasterAlerts] = useState<any[]>([]);

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
      } catch (e) { }
    };

    checkBattery();
    try {
      batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        if (batteryLevel === 0.20 || batteryLevel === 0.10) {
          Alert.alert('Kritik Pil', `Şarjınız %${Math.round(batteryLevel * 100)}'e düştü!`);
        }
      });
    } catch (e) { }

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
      // Titreşimi başlat
      Vibration.vibrate([500, 500, 500], true);

      try {
        // Önceden izinleri veya ses ayarlarını kontrol edelim
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        // Matematiksel olarak sentezlenen (köpek/sismik uyumlu) siren sesini çal
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: generateSyntheticSiren() },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        setSound(newSound);
        setSirenPlaying(true);
      } catch (err) {
        console.error('Siren çalınamadı:', err);
        // Ses dosyası bulunamazsa bile alarm titreşimi devam etsin
        setSirenPlaying(true);
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
      console.log('Supabase fetch failed (probably offline):', e instanceof Error ? e.message : e);
      await loadGatheringPointsFromLocal();
    }
  };

  const loadGatheringPointsFromLocal = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync('SELECT * FROM gathering_points ORDER BY created_at DESC');

    if (rows.length === 0) {
      // Mock data if DB is empty
      const mockPoints = [
        { id: 'm1', name: 'Atatürk Kent Parkı (Açık Alan)', description: 'Geniş açık alan, çadır kurulabilir.', capacity: 500 },
        { id: 'm2', name: 'Belediye Meydanı', description: 'Geçici acil durum toplanma noktası.', capacity: 200 },
        { id: 'm3', name: 'Millet Bahçesi', description: 'Acil durum gıda ve su destek merkezi.', capacity: 1000 },
        { id: 'm4', name: '75. Yıl İlköğretim Okulu Bahçesi', description: 'Güvenli bölge.', capacity: 300 },
      ];
      setGatheringPoints(mockPoints);
    } else {
      setGatheringPoints(rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkNetworkAndSync();

    // Kriz Masası'ndan gelen uyarıları çek
    const fetchActiveAlerts = async () => {
      try {
        const { data } = await supabase
          .from('disaster_alerts')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (data) setDisasterAlerts(data);
      } catch (e) { console.log('Alert fetch error:', e); }
    };
    fetchActiveAlerts();

    // Supabase Realtime — Kriz Masası'ndan anlık uyarı geldiğinde tetikle
    const channel = supabase
      .channel('disaster_alerts_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'disaster_alerts' }, payload => {
        const newAlert = payload.new as any;
        setDisasterAlerts(prev => [newAlert, ...prev]);
        Vibration.vibrate([0, 500, 200, 500, 200, 1000]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'disaster_alerts' }, payload => {
        const updated = payload.new as any;
        if (!updated.is_active) {
          setDisasterAlerts(prev => prev.filter(a => a.id !== updated.id));
        }
      })
      .subscribe();

    // Uygulama ön plana geldiğinde (resume) tekrar kontrol et
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkNetworkAndSync();
        fetchActiveAlerts();
      }
    });

    // Ayrıca her 10 saniyede bir polling yapalım
    const interval = setInterval(() => {
      checkNetworkAndSync();
      fetchCommunityHazards();
      fetchMyReports();
      fetchActiveAlerts();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      subscription.remove();
      clearInterval(interval);
      if (sound) { sound.unloadAsync(); }
      Vibration.cancel();
    };
  }, [sound]);

  const fetchCommunityHazards = async () => {
    try {
      const isOnline = await checkInternetConnection();
      let fetchedHazards: any[] = [];
      if (isOnline) {
        // En az 3 yalanlama almayanları getir
        const { data } = await supabase
          .from('hazard_reports')
          .select('id, hazard_type, description, image_uri, upvotes, downvotes, created_at')
          .lt('downvotes', 3)
          .order('created_at', { ascending: false });

        if (data) fetchedHazards = data;
      } else {
        const db = await getDb();
        const rows = await db.getAllAsync("SELECT * FROM hazard_reports WHERE downvotes < 3 ORDER BY created_at DESC");
        fetchedHazards = rows;
      }

      // Test için mock data
      if (fetchedHazards.length === 0) {
        fetchedHazards = [
          {
            id: 'mock_haz_1',
            hazard_type: 'ENKAZ',
            description: 'Atatürk Caddesi üzerinde eski bir bina yola doğru çöktü, yol tamamen kapalı durumda. Lütfen bu güzergahı kullanmayın!',
            upvotes: 12,
            downvotes: 1,
          },
          {
            id: 'mock_haz_2',
            hazard_type: 'YANGIN',
            description: 'Ormanlık alanda dumanlar yükseliyor, rüzgar şehre doğru esiyor. İtfaiye henüz bölgede değil.',
            upvotes: 5,
            downvotes: 0,
          }
        ];
      }
      setCommunityHazards(fetchedHazards);
    } catch (e) {
      console.log('Tehlike raporları listesi çekilemedi:', e);
    }
  };

  const fetchMyReports = async () => {
    try {
      const myIdsStr = await AsyncStorage.getItem('my_hazard_ids');
      let myIds: string[] = [];
      if (myIdsStr) myIds = JSON.parse(myIdsStr);

      const { data: authData } = await supabase.auth.getSession();
      const currentUserId = authData?.session?.user?.id;

      let query = supabase.from('hazard_reports').select('*').order('created_at', { ascending: false });

      if (currentUserId && myIds.length > 0) {
        query = query.or(`user_id.eq.${currentUserId},id.in.(${myIds.map(id => `"${id}"`).join(',')})`);
      } else if (currentUserId) {
        query = query.eq('user_id', currentUserId);
      } else if (myIds.length > 0) {
        query = query.in('id', myIds);
      } else {
        if (__DEV__) {
          // Dev modundaysak tüm ihbarları "benim" gibi göstersin
          const { data } = await supabase.from('hazard_reports').select('*').order('created_at', { ascending: false }).limit(5);
          if (data) setMyReports(data);
        } else {
          setMyReports([]);
        }
        return;
      }

      const { data } = await query;
      if (data) setMyReports(data);
    } catch (e) { console.log('My reports fetch error:', e); }
  };

  const handleDeleteMyReport = (reportId: string) => {
    Alert.alert(
      'İhbarı Sil',
      'Bu geçmiş ihbarınızı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            const isOnline = await checkInternetConnection();
            if (isOnline) {
              const { error } = await supabase.from('hazard_reports').delete().eq('id', reportId);
              if (error) { Alert.alert('Hata', 'Silme başarısız: ' + error.message); return; }
            }
            const db = await getDb();
            await db.runAsync('DELETE FROM hazard_reports WHERE id = ?', [reportId]);
            Alert.alert('Silindi', 'İhbarınız başarıyla kaldırıldı.');
            fetchMyReports();
            fetchCommunityHazards();
          }
        }
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!editingReport) return;
    try {
      const isOnline = await checkInternetConnection();
      if (isOnline) {
        const { error } = await supabase.from('hazard_reports').update({ hazard_type: editType, description: editDesc }).eq('id', editingReport.id);
        if (error) { Alert.alert('Hata', 'Güncelleme başarısız: ' + error.message); return; }
      }
      const db = await getDb();
      await db.runAsync('UPDATE hazard_reports SET hazard_type = ?, description = ? WHERE id = ?', [editType, editDesc, editingReport.id]);
      
      Alert.alert('Başarılı', 'İhbarınız güncellendi.');
      setShowEditModal(false);
      setEditingReport(null);
      fetchMyReports();
      fetchCommunityHazards();
    } catch (e) {
      console.log('Update error:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCommunityHazards();
      fetchMyReports();
      // Daha önce oy verilmiş ihbarları yükle
      AsyncStorage.getItem('voted_hazards').then(val => {
        if (val) setVotedHazards(new Set(JSON.parse(val)));
      });
    }, [])
  );

  const handleVoteHazard = async (id: string, type: 'up' | 'down') => {
    // Daha önce oy kullanmış mı kontrol et
    if (votedHazards.has(id)) {
      Alert.alert('Oy Kullanıldı', 'Bu ihbar için zaten oy kullandınız. Her ihbar için sadece bir kez oy verebilirsiniz.');
      return;
    }

    try {
      const isOnline = await checkInternetConnection();
      if (isOnline) {
        const { data } = await supabase.from('hazard_reports').select('upvotes, downvotes').eq('id', id).single();
        if (data) {
          if (type === 'up') {
            await supabase.from('hazard_reports').update({ upvotes: data.upvotes + 1 }).eq('id', id);
          } else {
            await supabase.from('hazard_reports').update({ downvotes: data.downvotes + 1 }).eq('id', id);
          }
        }
      } else {
        await updateHazardReportVotes(id, type);
      }

      // Oyu kaydet (bu cihazda bir daha oy kullanılamasın)
      const newVoted = new Set(votedHazards);
      newVoted.add(id);
      setVotedHazards(newVoted);
      await AsyncStorage.setItem('voted_hazards', JSON.stringify(Array.from(newVoted)));

      // UI hemen güncellensin
      fetchCommunityHazards();
    } catch (error) {
      console.log('Oylama hatası:', error);
    }
  };

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
      const { data: authData } = await supabase.auth.getSession();
      const userId = authData?.session?.user?.id || null;

      const online = await checkInternetConnection();
      if (online) {
        let locationData = null;
        if (lat !== null && lon !== null) {
          locationData = `SRID=4326;POINT(${lon} ${lat})`;
        }

        const { error } = await supabase.from('emergency_reports').insert({
          id: newId,
          user_id: userId,
          status_type: statusType,
          location: locationData,
          lat: lat,
          lon: lon,
          status: 'synced',
          created_at: createdAt,
          is_offline: false,
        });

        if (error) {
          Alert.alert('Supabase Hatası', 'Güvenlik bildiriminiz sunucuya iletilemedi:\n\n' + error.message);
          console.error('Supabase Insert Error:', error);
          await insertEmergencyReport(newId, userId, statusType, lat, lon, 'pending', createdAt);
        }
      } else {
        await insertEmergencyReport(newId, userId, statusType, lat, lon, 'pending', createdAt);
      }
    };

    processReport();

    Alert.alert(
      'Durum Bildirildi',
      statusType === 'SAFE' ? 'Güvende olduğunuz sisteme iletildi.' : 'Mahsur kalma durumunuz ve konumunuz acil durum ekiplerine iletildi.'
    );
  };

  const handleAidRequest = async () => {
    if (!aidDesc.trim() || !aidFullName.trim()) {
      Alert.alert('Hata', 'Lütfen ad soyad ve açıklama alanlarını doldurun.');
      return;
    }
    Alert.alert('İşlem Başlatıldı', 'Yardım çağrınız iletiliyor...');
    setShowAidModal(false);

    let location: Location.LocationObject | null = null;
    try {
      location = await Location.getLastKnownPositionAsync({});
      if (!location) {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
    } catch (e) {
      console.error('Konum alınamadı:', e);
    }

    const newId = generateId();
    const lat = location ? location.coords.latitude : null;
    const lon = location ? location.coords.longitude : null;
    const createdAt = new Date().toISOString();

    const processAid = async () => {
      const { data: authData } = await supabase.auth.getSession();
      const userId = authData?.session?.user?.id || newId; // Fallback to newId if offline/no session

      const online = await checkInternetConnection();
      if (online) {
        let locationData = null;
        if (lat !== null && lon !== null) {
          locationData = `SRID=4326;POINT(${lon} ${lat})`;
        }

        const { error } = await supabase.from('aid_requests').insert({
          id: newId,
          user_id: userId,
          full_name: aidFullName,
          type: aidType,
          category: 'acil',
          description: aidDesc,
          status: 'pending',
          latitude: lat,
          longitude: lon,
          location: locationData,
          created_at: createdAt
        });

        if (error) {
          Alert.alert('Supabase Hatası', 'Yardım çağrınız sunucuya iletilemedi:\n\n' + error.message);
          console.error('Supabase Insert Error:', error);
          await insertAidRequest(newId, userId, aidFullName, aidType, 'acil', aidDesc, 'pending', lat, lon, createdAt);
        }
      } else {
        await insertAidRequest(newId, userId, aidFullName, aidType, 'acil', aidDesc, 'pending', lat, lon, createdAt);
      }

      setAidDesc('');
      setAidFullName('');
      setAidType('Tıbbi Yardım');
      Alert.alert('Başarılı', 'Yardım çağrınız sisteme ulaştı. Bölgedeki gönüllüler haberdar edildi.');
    };

    processAid();
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.statusBar, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}>
        <Text style={styles.statusText}>
          {isOnline ? '🟢 ÇEVRİMİÇİ (Senkronize)' : '🔴 ÇEVRİMDİŞİ (Lokal Veritabanı)'}
        </Text>
      </View>

      {/* Kriz Masası Uyarı Bannerlari (Realtime) */}
      {disasterAlerts.map(alert => {
        const colors: Record<string, string> = { FIRE: '#EF4444', FLOOD: '#3B82F6', EARTHQUAKE: '#F59E0B' };
        const icons: Record<string, string> = { FIRE: '🔥', FLOOD: '🌊', EARTHQUAKE: '🌍' };
        const color = colors[alert.alert_type] || '#EF4444';
        const icon = icons[alert.alert_type] || '⚠️';
        return (
          <View key={alert.id} style={[styles.alertBanner, { backgroundColor: color }]}>
            <Text style={styles.alertBannerIcon}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertBannerTitle}>{alert.title}</Text>
              <Text style={styles.alertBannerMsg}>{alert.message}</Text>
            </View>
          </View>
        );
      })}

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

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
          onPress={() => setShowAidModal(true)}
        >
          <Text style={styles.actionBtnText}>🆘 YARDIM İSTE</Text>
        </TouchableOpacity>
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
            Bulunduğunuz bölgenin altyapı su kaldırma kapasitesi: <Text style={{ fontWeight: 'bold' }}>{floodRisk.capacity} mm/saat</Text>.
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
            Zemin Sınıfı: <Text style={{ fontWeight: 'bold' }}>{quakeRisk.ground}</Text>
          </Text>
          <Text style={styles.aiDesc}>
            Aktif Fay Hattına Uzaklık: <Text style={{ fontWeight: 'bold' }}>{quakeRisk.distance} km</Text>
          </Text>
          <Text style={[styles.aiDesc, { marginTop: 4, color: quakeRisk.level === 'HIGH' ? '#EF4444' : '#475569', fontWeight: quakeRisk.level === 'HIGH' ? 'bold' : 'normal' }]}>
            {quakeRisk.level === 'HIGH' ? ' DİKKAT: Zemin sıvılaşma riski veya faya yakınlık sebebiyle binanızın acil deprem dayanım testi yaptırması önerilir!' : ' Bulunduğunuz zemin ve konum itibarıyla risk standart seviyededir.'}
          </Text>
        </View>
      )}

      {/* Geçmiş İhbarlarım (Kullanıcının kendi ekledikleri) */}
      {myReports.length > 0 && (
        <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Geçmiş İhbarlarım</Text>
          <FlatList
            horizontal
            data={myReports}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              // Haritadaki aynı hata yakalamayı buraya da ekliyoruz (inline logic for brevity)
              return (
                <View style={[styles.hazardCard, { borderColor: '#7C3AED', borderWidth: 1 }]}>
                  <View style={styles.hazardHeader}>
                    <Text style={[styles.hazardTitle, { color: '#7C3AED' }]}>🟣 {item.hazard_type}</Text>
                  </View>
                  {item.image_uri && (
                    <Image source={{ uri: item.image_uri }} style={styles.hazardImage} />
                  )}
                  <Text style={styles.hazardDescText} numberOfLines={2}>{item.description}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity 
                      style={[styles.voteBtn, { backgroundColor: '#7C3AED', flex: 1 }]} 
                      onPress={() => {
                        setEditingReport(item);
                        setEditType(item.hazard_type);
                        setEditDesc(item.description);
                        setShowEditModal(true);
                      }}
                    >
                      <Text style={styles.voteBtnText}>✏️ Düzenle</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.voteBtn, { backgroundColor: '#EF4444', flex: 1 }]} 
                      onPress={() => handleDeleteMyReport(item.id)}
                    >
                      <Text style={styles.voteBtnText}>🗑️ Sil</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* Tehlike İhbarları Doğrulama Kartları */}
      <View style={{ marginTop: 8, paddingHorizontal: 16 }}>
        <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Çevrenizdeki Tehlike Bildirimleri</Text>
        {communityHazards.length > 0 ? (
          <FlatList
            horizontal
            data={communityHazards}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.hazardCard}>
                <View style={styles.hazardHeader}>
                  <Text style={styles.hazardTitle}>⚠️ {item.hazard_type}</Text>
                  <Text style={styles.hazardVotes}>👍 {item.upvotes}  👎 {item.downvotes}</Text>
                </View>
                {item.image_uri && (
                  <Image source={{ uri: item.image_uri }} style={styles.hazardImage} />
                )}
                <Text style={styles.hazardDescText} numberOfLines={3}>{item.description}</Text>
                <View style={styles.voteContainer}>
                  {votedHazards.has(item.id) ? (
                    <View style={[styles.voteBtn, { flex: 1, backgroundColor: '#94A3B8' }]}>
                      <Text style={styles.voteBtnText}>✅ Oyunuzu Kullandınız</Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity style={[styles.voteBtn, styles.voteUpBtn]} onPress={() => handleVoteHazard(item.id, 'up')}>
                        <Text style={styles.voteBtnText}>👍 Evet</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.voteBtn, styles.voteDownBtn]} onPress={() => handleVoteHazard(item.id, 'down')}>
                        <Text style={styles.voteBtnText}>👎 Hayır</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}
          />
        ) : (
          <Text style={{ color: '#64748B', fontStyle: 'italic', marginBottom: 12 }}>
            Şu an çevrenizde doğrulanmayı bekleyen bir tehlike ihbarı bulunmuyor.
          </Text>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Toplanma Alanları</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" />
        ) : gatheringPoints.length === 0 ? (
          <Text style={styles.emptyText}>Henüz toplanma alanı verisi yok.</Text>
        ) : (
          <View style={styles.listContainer}>
            {gatheringPoints.map((item) => (
              <React.Fragment key={item.id}>
                {renderGatheringPoint({ item })}
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      {/* Yardım İste Modal Formu */}
      <Modal visible={showAidModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🆘 Yardım / İhbar Formu</Text>

            <TextInput
              style={styles.input}
              placeholder="Ad Soyad"
              placeholderTextColor="#94A3B8"
              value={aidFullName}
              onChangeText={setAidFullName}
            />

            <Text style={styles.label}>İhtiyaç Türü:</Text>
            <View style={styles.typeContainer}>
              {['Tıbbi Yardım', 'Enkaz Kurtarma', 'Erzak', 'Diğer'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, aidType === type && styles.typeBtnActive]}
                  onPress={() => setAidType(type)}
                >
                  <Text style={[styles.typeBtnText, aidType === type && styles.typeBtnTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Lütfen durumu detaylı açıklayın (Yaralı sayısı, aciliyet vb.)"
              placeholderTextColor="#94A3B8"
              value={aidDesc}
              onChangeText={setAidDesc}
              multiline
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleAidRequest}>
              <Text style={styles.submitBtnText}>Yardım Çağrısı Gönder</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAidModal(false)}>
              <Text style={styles.cancelBtnText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Geçmiş İhbarı Düzenle Modal Formu */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ İhbarı Düzenle</Text>

            <Text style={styles.label}>Tehlike Türü:</Text>
            <View style={styles.typeContainer}>
              {['YANGIN', 'SEL', 'DEPREM', 'ENKAZ', 'DİĞER'].map((type) => (
                <TouchableOpacity
                  key={'edit-' + type}
                  style={[styles.typeBtn, editType === type && styles.typeBtnSelected]}
                  onPress={() => setEditType(type)}
                >
                  <Text style={[styles.typeBtnText, editType === type && styles.typeBtnTextSelected]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Tehlike detayları, son durum..."
              placeholderTextColor="#94A3B8"
              multiline
              value={editDesc}
              onChangeText={setEditDesc}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                setShowEditModal(false);
                setEditingReport(null);
              }}>
                <Text style={styles.cancelBtnText}>İPTAL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveEdit}>
                <Text style={styles.submitBtnText}>KAYDET</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    gap: 12,
  },
  alertBannerIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  alertBannerTitle: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 6,
  },
  alertBannerMsg: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1E293B',
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
    color: '#1E293B',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  typeBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  typeBtnText: {
    fontSize: 13,
    color: '#475569',
  },
  typeBtnTextActive: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: 'bold',
  },
  hazardCard: {
    backgroundColor: '#FFF',
    width: 280,
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hazardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hazardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  hazardVotes: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 'bold',
  },
  hazardImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  hazardDescText: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 12,
  },
  voteContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  voteUpBtn: {
    backgroundColor: '#10B981',
  },
  voteDownBtn: {
    backgroundColor: '#EF4444',
  },
  voteBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
