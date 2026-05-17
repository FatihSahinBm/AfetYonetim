import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Text, Platform, Linking, TextInput, Keyboard, Modal, Image } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getDb, updateAidRequestStatus, insertHazardReport, getPendingHazardReports } from '../services/db';
import { checkInternetConnection } from '../services/syncService';
import { supabase } from '../services/supabase';

const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [gatheringPoints, setGatheringPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDest, setSelectedDest] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [showNearestList, setShowNearestList] = useState(false);
  const [nearestPoints, setNearestPoints] = useState<any[]>([]);
  const [aidRequests, setAidRequests] = useState<any[]>([]);
  const [hazardReports, setHazardReports] = useState<any[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [hazardType, setHazardType] = useState('ENKAZ');
  const [hazardDesc, setHazardDesc] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  // Düzenle / Sil
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<any | null>(null); // null = yeni bildirim
  const mapRef = useRef<MapView>(null);
  const route = useRoute<any>();

  useEffect(() => {
    if (route.params?.targetLat && route.params?.targetLng && location) {
      const { targetLat, targetLng, targetName } = route.params;
      setSelectedDest({ lat: targetLat, lng: targetLng, name: targetName || 'Kayıp Kişi' });

      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: (location.coords.latitude + targetLat) / 2,
          longitude: (location.coords.longitude + targetLng) / 2,
          latitudeDelta: Math.abs(location.coords.latitude - targetLat) * 2.5 || 0.05,
          longitudeDelta: Math.abs(location.coords.longitude - targetLng) * 2.5 || 0.05,
        }, 1000);
      }, 500);
    }
  }, [route.params, location]);

  // Kuş uçuşu mesafe hesaplama (Haversine Formülü)
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      0.5 - Math.cos(dLat) / 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.loaderContainer}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#3B82F6', marginBottom: 10 }}>Harita Özelliği</Text>
        <Text style={{ textAlign: 'center', paddingHorizontal: 20, color: '#64748B' }}>
          Harita ve Navigasyon sistemi sadece iOS ve Android cihazlarda (mobil) çalışmaktadır. Lütfen telefonunuzdan test ediniz.
        </Text>
      </View>
    );
  }

  useEffect(() => {
    // Kullanıcı ID'sini çek
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data?.session?.user?.id || null);
    });

    (async () => {
      let currentLoc: Location.LocationObject | null = null;
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Hata', 'Konum izni verilmedi. Harita tam çalışmayabilir.');
      } else {
        // Hızlıca son konumu al
        currentLoc = await Location.getLastKnownPositionAsync({});
        if (!currentLoc) {
          currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        setLocation(currentLoc);
      }

      // Toplanma Alanlarını Lokal Veritabanından Al
      const db = await getDb();
      const rows = await db.getAllAsync('SELECT * FROM gathering_points');

      // Eğer veritabanında toplanma alanı yoksa (veya postgis parse edilmediyse),
      // kullanıcının bulunduğu konuma yakın, test edebilmesi için "Sanal" toplanma alanları ekliyoruz.
      if (rows.length === 0 && currentLoc) {
        const mockPoints = [
          { id: 'm1', name: 'Atatürk Kent Parkı (Açık Alan)', description: 'Geniş açık alan, çadır kurulabilir.', latitude: currentLoc.coords.latitude + 0.005, longitude: currentLoc.coords.longitude + 0.005 },
          { id: 'm2', name: 'Belediye Meydanı', description: 'Geçici acil durum toplanma noktası.', latitude: currentLoc.coords.latitude - 0.003, longitude: currentLoc.coords.longitude + 0.002 },
          { id: 'm3', name: 'Millet Bahçesi', description: 'Acil durum gıda ve su destek merkezi. Açık alan.', latitude: currentLoc.coords.latitude + 0.008, longitude: currentLoc.coords.longitude - 0.004 },
          { id: 'm4', name: '75. Yıl İlköğretim Okulu Bahçesi', description: 'Güvenli bölge.', latitude: currentLoc.coords.latitude - 0.006, longitude: currentLoc.coords.longitude - 0.005 },
        ];
        setGatheringPoints(mockPoints);
      } else {
        setGatheringPoints(rows);
      }

      setLoading(false);
    })();
  }, []);

  const fetchAidRequests = async () => {
    try {
      const isOnline = await checkInternetConnection();
      if (isOnline) {
        const { data } = await supabase.from('aid_requests').select('*').eq('status', 'pending');
        if (data) setAidRequests(data);
      } else {
        const db = await getDb();
        const rows = await db.getAllAsync("SELECT * FROM aid_requests WHERE status = 'pending'");
        setAidRequests(rows);
      }
    } catch (e) {
      console.log('Yardım çağrıları çekilemedi:', e);
    }
  };

  const fetchHazardReports = async () => {
    try {
      const isOnline = await checkInternetConnection();
      if (isOnline) {
        // En az 3 yalanlama almayanları göster
        const { data } = await supabase.from('hazard_reports').select('id, hazard_type, description, lat, lon, image_uri, upvotes, downvotes, status').lt('downvotes', 3);
        if (data) {
          // Supabase'den gelen lat, lon değerlerini map edelim
          const formatted = data.map(r => ({ ...r, latitude: r.lat, longitude: r.lon }));
          setHazardReports(formatted);
        }
      } else {
        const db = await getDb();
        const rows = await db.getAllAsync("SELECT * FROM hazard_reports WHERE downvotes < 3");
        setHazardReports(rows);
      }
    } catch (e) {
      console.log('Tehlike raporları çekilemedi:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAidRequests();
      fetchHazardReports();
    }, [])
  );

  const handleHelpVolunteer = async (req: any) => {
    Alert.alert(
      'Yardıma Gidiyorsunuz',
      `${req.full_name || 'Bu kişiye'} yardım etmeyi onaylıyor musunuz? Çağrı durumu güncellenecek.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Gidiyorum',
          onPress: async () => {
            const isOnline = await checkInternetConnection();
            const { data: authData } = await supabase.auth.getSession();
            const userId = authData?.session?.user?.id || 'volunteer_id';

            if (isOnline) {
              await supabase.from('aid_requests').update({ status: 'assigned', helper_id: userId }).eq('id', req.id);
            } else {
              await updateAidRequestStatus(req.id, 'assigned', userId);
            }
            Alert.alert('Bilgi', 'Durum güncellendi. Lütfen en kısa sürede bölgeye intikal edin.');
            fetchAidRequests(); // Refresh map markers
          }
        }
      ]
    );
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Hata', 'Fotoğraf seçmek için izin vermeniz gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5, // Dosya boyutunu küçültmek için
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const submitHazardReport = async () => {
    if (!hazardDesc.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen durumla ilgili kısa bir açıklama yazın.');
      return;
    }

    setShowReportModal(false);

    const { data: authData } = await supabase.auth.getSession();
    const userId = authData?.session?.user?.id || 'anonymous';

    // Düzenle modu
    if (editingReport) {
      Alert.alert('Güncelleniyor', 'Bildiriminiz güncelleniyor...');
      const isOnline = await checkInternetConnection();
      if (isOnline) {
        const { error } = await supabase.from('hazard_reports').update({
          hazard_type: hazardType,
          description: hazardDesc,
          image_uri: imageUri,
        }).eq('id', editingReport.id);
        if (error) Alert.alert('Hata', 'Güncelleme başarısız: ' + error.message);
      } else {
        const db = await getDb();
        await db.runAsync(
          'UPDATE hazard_reports SET hazard_type = ?, description = ?, image_uri = ? WHERE id = ?',
          [hazardType, hazardDesc, imageUri, editingReport.id]
        );
      }
      setHazardDesc('');
      setImageUri(null);
      setEditingReport(null);
      Alert.alert('Başarılı', 'İhbarınız başarıyla güncellendi.');
      fetchHazardReports();
      return;
    }

    Alert.alert('Gönderiliyor', 'Tehlike bildiriminiz işleniyor...');

    const newId = generateId();
    const lat = location ? location.coords.latitude : null;
    const lon = location ? location.coords.longitude : null;
    const createdAt = new Date().toISOString();

    // userId zaten yukarıda tanımlandı, tekrar tanımlamaya gerek yok

    const online = await checkInternetConnection();
    if (online) {
      let locationData = null;
      if (lat !== null && lon !== null) {
        locationData = `SRID=4326;POINT(${lon} ${lat})`;
      }

      const { error } = await supabase.from('hazard_reports').insert({
        id: newId,
        user_id: userId,
        hazard_type: hazardType,
        description: hazardDesc,
        location: locationData,
        lat: lat,
        lon: lon,
        image_uri: imageUri,
        upvotes: 0,
        downvotes: 0,
        status: 'synced',
        created_at: createdAt
      });

      if (error) {
        Alert.alert('Supabase Hatası', 'Veritabanı tablonuza veri eklenirken hata oluştu (Örn: RLS politikaları eksik olabilir):\n\n' + error.message);
        console.error('Supabase Insert Error:', error);
        // Fallback to local
        await insertHazardReport(newId, userId, hazardType, hazardDesc, lat, lon, imageUri, 'pending', createdAt);
      }
    } else {
      await insertHazardReport(newId, userId, hazardType, hazardDesc, lat, lon, imageUri, 'pending', createdAt);
    }

    setHazardDesc('');
    setImageUri(null);
    setEditingReport(null);
    Alert.alert('Başarılı', editingReport ? 'İhbarınız güncellendi.' : 'İhbarınız bölgedeki kullanıcılara iletildi. Doğrulama bekliyor.');
    fetchHazardReports();
  };

  const openEditHazard = (report: any) => {
    setEditingReport(report);
    setHazardType(report.hazard_type);
    setHazardDesc(report.description || '');
    setImageUri(report.image_uri || null);
    setShowReportModal(true);
  };

  const handleDeleteHazard = (report: any) => {
    Alert.alert(
      'Bildirimi Sil',
      'Bu tehlike ihbarını silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            const isOnline = await checkInternetConnection();
            if (isOnline) {
              const { error } = await supabase.from('hazard_reports').delete().eq('id', report.id);
              if (error) { Alert.alert('Hata', 'Silme işlemi başarısız: ' + error.message); return; }
            } else {
              const db = await getDb();
              await db.runAsync('DELETE FROM hazard_reports WHERE id = ?', [report.id]);
            }
            Alert.alert('Silindi', 'Tehlike ihbarınız kaldırıldı.');
            fetchHazardReports();
          }
        }
      ]
    );
  };

  const openDirections = (lat: number, lng: number, name: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const label = name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    if (url) {
      Linking.openURL(url);
    }
  };

  if (loading || !location) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 10 }}>Harita ve Konum Hazırlanıyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        loadingEnabled={true}
        onPress={() => {
          Keyboard.dismiss();
          setSelectedDest(null);
        }}
      >
        {/* Acil Durum Rotası Çizgisi (Polyline) */}
        {selectedDest && (
          <Polyline
            coordinates={[
              { latitude: location.coords.latitude, longitude: location.coords.longitude },
              { latitude: selectedDest.lat, longitude: selectedDest.lng }
            ]}
            strokeColor="#Eab308" // Turuncu/Sarı Acil Durum Rengi
            strokeWidth={4}
            lineDashPattern={[10, 10]} // Kesik kesik çizgi
          />
        )}

        {/* Seçilen Hedef (Kayıp Kişi veya Toplanma Alanı) İçin Özel İşaretçi */}
        {selectedDest && (
          <Marker
            coordinate={{ latitude: selectedDest.lat, longitude: selectedDest.lng }}
            pinColor="red"
            title={selectedDest.name}
            description="Kuş uçuşu mesafe: Seçili Hedef"
          />
        )}

        {/* Yardım Çağrıları (İhbarlar) */}
        {aidRequests.map(req => {
          if (!req.latitude || !req.longitude) return null;
          return (
            <Marker
              key={`aid-${req.id}`}
              coordinate={{ latitude: req.latitude, longitude: req.longitude }}
              title={`🆘 ${req.type}`}
            >
              <View style={styles.aidMarker}>
                <Text style={styles.aidMarkerText}>🆘</Text>
              </View>
              <Callout onPress={() => handleHelpVolunteer(req)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>🆘 {req.type}</Text>
                  <Text style={styles.calloutDesc}><Text style={{ fontWeight: 'bold' }}>{req.full_name}</Text>: {req.description}</Text>
                  <TouchableOpacity style={[styles.routeBtn, { backgroundColor: '#EF4444', marginTop: 8 }]}>
                    <Text style={styles.routeBtnText}>Yardıma Gidiyorum</Text>
                  </TouchableOpacity>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Tehlike Raporları */}
        {hazardReports.map(report => {
          if (!report.latitude || !report.longitude) return null;
          const isOwner = currentUserId && report.user_id === currentUserId;
          return (
            <Marker
              key={`haz-${report.id}`}
              coordinate={{ latitude: report.latitude, longitude: report.longitude }}
              title={`⚠️ ${report.hazard_type}`}
            >
              <View style={[styles.aidMarker, { borderColor: isOwner ? '#7C3AED' : '#F59E0B', shadowColor: isOwner ? '#7C3AED' : '#F59E0B' }]}>
                <Text style={styles.aidMarkerText}>{isOwner ? '🟣' : '⚠️'}</Text>
              </View>
              <Callout>
                <View style={styles.callout}>
                  <Text style={[styles.calloutTitle, { color: isOwner ? '#7C3AED' : '#F59E0B' }]}>
                    {isOwner ? '🟣 Benim İhbarım' : '⚠️ ' + report.hazard_type}
                  </Text>
                  <Text style={[styles.calloutTitle, { fontSize: 12, color: '#475569', marginBottom: 2 }]}>{report.hazard_type}</Text>
                  <Text style={styles.calloutDesc}>{report.description}</Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>👍 {report.upvotes} | 👎 {report.downvotes}</Text>
                  {isOwner && (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.routeBtn, { backgroundColor: '#7C3AED', flex: 1 }]}
                        onPress={() => openEditHazard(report)}
                      >
                        <Text style={styles.routeBtnText}>✏️ Düzenle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.routeBtn, { backgroundColor: '#EF4444', flex: 1 }]}
                        onPress={() => handleDeleteHazard(report)}
                      >
                        <Text style={styles.routeBtnText}>🗑️ Sil</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Toplanma Alanları */}
        {gatheringPoints
          .filter(p => {
            if (!searchQuery.trim()) return true; // Arama yoksa hepsini göster

            // "en yakın park" -> ["park"] (gereksiz kelimeleri at)
            const stopWords = ['en', 'yakın', 'bana', 'nerede', 'göster', 'var', 'mı'];
            const keywords = searchQuery.toLowerCase().split(' ').filter(k => k.length > 2 && !stopWords.includes(k));

            // Eğer filtrelenmiş kelime kalmadıysa normal arama yap
            const searchTerms = keywords.length > 0 ? keywords : [searchQuery.toLowerCase()];

            // Herhangi bir kelime isimde veya açıklamada geçiyorsa göster
            return searchTerms.some(k => p.name.toLowerCase().includes(k) || (p.description && p.description.toLowerCase().includes(k)));
          })
          .map(point => {
            const pLat = point.latitude === 0 ? location.coords.latitude + 0.01 : point.latitude;
            const pLng = point.longitude === 0 ? location.coords.longitude + 0.01 : point.longitude;
            const distance = getDistanceKm(location.coords.latitude, location.coords.longitude, pLat, pLng).toFixed(2);

            return (
              <Marker
                key={point.id}
                coordinate={{ latitude: pLat, longitude: pLng }}
                pinColor={selectedDest?.name === point.name ? "red" : "green"}
                title={point.name}
                onPress={() => {
                  setSelectedDest({ lat: pLat, lng: pLng, name: point.name });
                  // Haritayı bu noktaya kaydır
                  mapRef.current?.animateToRegion({
                    latitude: (location.coords.latitude + pLat) / 2,
                    longitude: (location.coords.longitude + pLng) / 2,
                    latitudeDelta: Math.abs(location.coords.latitude - pLat) * 2.5,
                    longitudeDelta: Math.abs(location.coords.longitude - pLng) * 2.5,
                  }, 1000);
                }}
              >
                <Callout onPress={() => openDirections(pLat, pLng, point.name)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{point.name}</Text>
                    <Text style={styles.calloutDesc}>{point.description}</Text>
                    <Text style={styles.distanceText}>📍 Kuş uçuşu mesafe: {distance} km</Text>
                    <TouchableOpacity style={styles.routeBtn}>
                      <Text style={styles.routeBtnText}>Navigasyonu Başlat</Text>
                    </TouchableOpacity>
                  </View>
                </Callout>
              </Marker>
            );
          })}
      </MapView>

      {/* Arama Motoru ve Sonuç Listesi */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Toplanma alanı, park, açık alan ara..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (showNearestList) setShowNearestList(false);
              if (selectedDest) setSelectedDest(null);
            }}
          />
          {(searchQuery.length > 0 || showNearestList) && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setShowNearestList(false); setSelectedDest(null); Keyboard.dismiss(); }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>X</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Arama Sonuçları Dropdown */}
        {(searchQuery.length > 0 || showNearestList) && !selectedDest && (
          <View style={styles.searchResults}>
            {(() => {
              let listToRender = [];
              if (showNearestList) {
                listToRender = nearestPoints;
              } else {
                listToRender = gatheringPoints
                  .filter(p => {
                    const stopWords = ['en', 'yakın', 'bana', 'nerede', 'göster', 'var', 'mı'];
                    const keywords = searchQuery.toLowerCase().split(' ').filter(k => k.length > 2 && !stopWords.includes(k));
                    const searchTerms = keywords.length > 0 ? keywords : [searchQuery.toLowerCase()];
                    return searchTerms.some(k => p.name.toLowerCase().includes(k) || (p.description && p.description.toLowerCase().includes(k)));
                  })
                  .map(p => {
                    const pLat = p.latitude === 0 ? location.coords.latitude + 0.01 : p.latitude;
                    const pLng = p.longitude === 0 ? location.coords.longitude + 0.01 : p.longitude;
                    const dist = getDistanceKm(location.coords.latitude, location.coords.longitude, pLat, pLng);
                    return { ...p, calcLat: pLat, calcLng: pLng, distance: dist };
                  });
              }

              return listToRender.map(point => {
                const distanceStr = point.distance.toFixed(2);
                return (
                  <TouchableOpacity
                    key={'search-' + point.id}
                    style={styles.searchResultItem}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedDest({ lat: point.calcLat, lng: point.calcLng, name: point.name });
                      setSearchQuery(point.name);
                      setShowNearestList(false);

                      mapRef.current?.animateToRegion({
                        latitude: (location.coords.latitude + point.calcLat) / 2,
                        longitude: (location.coords.longitude + point.calcLng) / 2,
                        latitudeDelta: Math.abs(location.coords.latitude - point.calcLat) * 2.5 || 0.05,
                        longitudeDelta: Math.abs(location.coords.longitude - point.calcLng) * 2.5 || 0.05,
                      }, 1000);
                    }}
                  >
                    <Text style={styles.searchResultName}>{point.name}</Text>
                    <Text style={styles.searchResultDistance}>{distanceStr} km uzakta</Text>
                  </TouchableOpacity>
                );
              });
            })()}
          </View>
        )}
      </View>

      {/* Deprem Bildirim Kutusu */}
      <View style={styles.floatingAlert}>
        <Text style={styles.alertTitle}>Bulunduğunuz Evin Deprem Riski</Text>
        <Text style={styles.alertDesc}>Orta - Yüksek Riskli Bölge (Zemin Analizi: Yumuşak). Lütfen toplanma alanlarına yakınlığınızı kontrol edin.</Text>
      </View>

      {/* En Yakın Güvenli Alanları Listele Butonu */}
      <TouchableOpacity
        style={styles.findNearestBtn}
        onPress={() => {
          if (gatheringPoints.length === 0 || !location) return;

          Keyboard.dismiss();

          // Tüm noktaların mesafesini hesapla
          const pointsWithDist = gatheringPoints.map(p => {
            const pLat = p.latitude === 0 ? location.coords.latitude + 0.01 : p.latitude;
            const pLng = p.longitude === 0 ? location.coords.longitude + 0.01 : p.longitude;
            const dist = getDistanceKm(location.coords.latitude, location.coords.longitude, pLat, pLng);
            return { ...p, calcLat: pLat, calcLng: pLng, distance: dist };
          });

          // Mesafeye göre küçükten büyüğe sırala
          pointsWithDist.sort((a, b) => a.distance - b.distance);

          // En yakın 3 tanesini seç ve listeyi aç
          setNearestPoints(pointsWithDist.slice(0, 3));
          setShowNearestList(true);
          setSelectedDest(null);
          setSearchQuery('');
        }}
      >
        <Text style={styles.findNearestBtnText}>Acil: Bana En Yakın 3 Alanı Listele</Text>
      </TouchableOpacity>

      {/* Tehlike Bildir Floating Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowReportModal(true)}
      >
        <Text style={styles.fabIcon}>⚠️</Text>
      </TouchableOpacity>

      {/* Tehlike Bildir / Düzenle Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingReport ? '✏️ İhbarı Düzenle' : '⚠️ Tehlike Bildir'}</Text>

            <Text style={styles.label}>Tehlike Türü:</Text>
            <View style={styles.typeContainer}>
              {['ENKAZ', 'SEL', 'YANGIN', 'KAPALI YOL'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, hazardType === t && styles.typeBtnActive]}
                  onPress={() => setHazardType(t)}
                >
                  <Text style={[styles.typeBtnText, hazardType === t && styles.typeBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Fotoğraf (Opsiyonel ama önerilir):</Text>
            <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <Text style={styles.imagePickerText}>📷 Kamera / Galeri Seç</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Açıklama:</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Yıkılan bina, kapanan yol hakkında detay verin..."
              value={hazardDesc}
              onChangeText={setHazardDesc}
              multiline
            />

            <TouchableOpacity style={styles.submitBtn} onPress={submitHazardReport}>
              <Text style={styles.submitBtnText}>{editingReport ? 'Kaydı Güncelle' : 'Bildirimi Gönder'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => {
              setShowReportModal(false);
              setEditingReport(null);
              setHazardDesc('');
              setImageUri(null);
            }}>
              <Text style={styles.cancelBtnText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  callout: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  calloutDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  routeBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  routeBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  floatingAlert: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    padding: 16,
    borderRadius: 12,
  },
  alertTitle: {
    color: '#F59E0B',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  alertDesc: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
  },
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 999, // Arama sonuçlarının haritanın üstünde kalması için
  },
  searchInputWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    color: '#94A3B8',
    fontWeight: 'bold',
    fontSize: 16,
  },
  searchResults: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    maxHeight: 200,
  },
  searchResultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchResultName: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
  },
  searchResultDistance: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: 'bold',
  },
  distanceText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  findNearestBtn: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: '#EF4444', // Acil durum kırmızısı
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  findNearestBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  aidMarker: {
    backgroundColor: '#FFF',
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  aidMarkerText: {
    fontSize: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
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
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
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
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
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
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  typeBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: '#D97706',
    fontWeight: 'bold',
  },
  imagePickerBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  imagePickerText: {
    color: '#64748B',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
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
  }
});
