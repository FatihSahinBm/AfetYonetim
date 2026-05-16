import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Text, Platform, Linking, TextInput, Keyboard } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { getDb } from '../services/db';

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [gatheringPoints, setGatheringPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDest, setSelectedDest] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [showNearestList, setShowNearestList] = useState(false);
  const [nearestPoints, setNearestPoints] = useState<any[]>([]);
  const mapRef = useRef<MapView>(null);

  // Kuş uçuşu mesafe hesaplama (Haversine Formülü)
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      0.5 - Math.cos(dLat)/2 + 
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      (1 - Math.cos(dLon))/2;
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
  }
});
