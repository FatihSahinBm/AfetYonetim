import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Text, Platform, Linking } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { getDb } from '../services/db';

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [gatheringPoints, setGatheringPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Konum İzni ve Alımı
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Hata', 'Konum izni verilmedi. Harita tam çalışmayabilir.');
      } else {
        // Hızlıca son konumu al
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        setLocation(loc);
      }

      // Toplanma Alanlarını Lokal Veritabanından Al
      const db = await getDb();
      const rows = await db.getAllAsync('SELECT * FROM gathering_points');
      setGatheringPoints(rows);
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
      >
        {/* Toplanma Alanları */}
        {gatheringPoints.map(point => (
          // Eğer koordinat 0 ise (şu an test için) kendi konumumuzun yakınına mock yapalım
          <Marker 
            key={point.id}
            coordinate={{ 
              latitude: point.latitude === 0 ? location.coords.latitude + 0.01 : point.latitude, 
              longitude: point.longitude === 0 ? location.coords.longitude + 0.01 : point.longitude 
            }}
            pinColor="green"
            title={point.name}
            description="Tıklayarak yol tarifi alabilirsiniz"
          >
            <Callout onPress={() => openDirections(
                point.latitude === 0 ? location.coords.latitude + 0.01 : point.latitude,
                point.longitude === 0 ? location.coords.longitude + 0.01 : point.longitude,
                point.name
              )}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{point.name}</Text>
                <Text style={styles.calloutDesc}>{point.description}</Text>
                <TouchableOpacity style={styles.routeBtn}>
                  <Text style={styles.routeBtnText}>Yol Tarifi Al</Text>
                </TouchableOpacity>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      
      {/* Deprem Bildirim Kutusu (Test) */}
      <View style={styles.floatingAlert}>
        <Text style={styles.alertTitle}>Bulunduğunuz Evin Deprem Riski</Text>
        <Text style={styles.alertDesc}>Orta - Yüksek Riskli Bölge (Zemin Analizi: Yumuşak). Lütfen toplanma alanlarına yakınlığınızı kontrol edin.</Text>
      </View>
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
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
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
    color: '#FFF',
    fontSize: 12,
    lineHeight: 18,
  }
});
