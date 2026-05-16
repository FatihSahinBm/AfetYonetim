/**
 * Harita Ekranı
 * 
 * Toplanma alanları, afet bölgeleri, SOS konumları ve
 * kritik altyapıyı harita üzerinde gösterir.
 * En yakın toplanma alanına yol tarifi verir.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
// import MapView, { Marker, Circle } from 'react-native-maps';
import { COLORS, MAP_CONFIG } from '../../config/constants';
import { AssemblyPoint, DisasterAlert, GeoPoint } from '../../types';
import { getCurrentLocation, findNearestAssemblyPoints } from '../../services/locationService';
import { getAssemblyPoints, getActiveAlerts } from '../../services/disasterService';

/** Harita üzerinde gösterilecek katmanlar */
type MapLayer = 'assembly' | 'alerts' | 'sos' | 'infrastructure';

const MapScreen: React.FC = () => {
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [assemblyPoints, setAssemblyPoints] = useState<AssemblyPoint[]>([]);
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [activeLayers, setActiveLayers] = useState<Set<MapLayer>>(new Set(['assembly', 'alerts']));
  const [selectedPoint, setSelectedPoint] = useState<AssemblyPoint | null>(null);

  useEffect(() => {
    initMap();
  }, []);

  /** Haritayı başlat: konum al ve verileri yükle */
  const initMap = async () => {
    try {
      const location = await getCurrentLocation();
      setUserLocation(location);

      const [points, activeAlerts] = await Promise.all([
        getAssemblyPoints(),
        getActiveAlerts(),
      ]);
      setAssemblyPoints(points);
      setAlerts(activeAlerts);
    } catch (error) {
      console.error('[Map] Başlatma hatası:', error);
    }
  };

  /** Katman açma/kapama */
  const toggleLayer = (layer: MapLayer) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  /** En yakın toplanma alanına yol tarifi başlat */
  const navigateToNearest = () => {
    if (!userLocation || assemblyPoints.length === 0) {
      Alert.alert('Hata', 'Konum veya toplanma alanı bilgisi bulunamadı.');
      return;
    }

    const nearest = findNearestAssemblyPoints(userLocation, assemblyPoints, 1);
    if (nearest.length > 0) {
      setSelectedPoint(nearest[0]);
      Alert.alert(
        'En Yakın Toplanma Alanı',
        `${nearest[0].name}\n${nearest[0].address}\nMesafe: ${nearest[0].distance.toFixed(1)} km`
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Harita alanı - react-native-maps entegrasyonu */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>🗺️ Harita Yükleniyor...</Text>
        <Text style={styles.mapSubtext}>react-native-maps kurulumu gereklidir</Text>
        {userLocation && (
          <Text style={styles.coordText}>
            📍 {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
          </Text>
        )}
      </View>

      {/* Katman kontrolleri */}
      <View style={styles.layerPanel}>
        <TouchableOpacity
          style={[styles.layerButton, activeLayers.has('assembly') && styles.layerActive]}
          onPress={() => toggleLayer('assembly')}
        >
          <Text style={styles.layerIcon}>📍</Text>
          <Text style={styles.layerLabel}>Toplanma</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.layerButton, activeLayers.has('alerts') && styles.layerActive]}
          onPress={() => toggleLayer('alerts')}
        >
          <Text style={styles.layerIcon}>⚠️</Text>
          <Text style={styles.layerLabel}>Uyarılar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.layerButton, activeLayers.has('sos') && styles.layerActive]}
          onPress={() => toggleLayer('sos')}
        >
          <Text style={styles.layerIcon}>🆘</Text>
          <Text style={styles.layerLabel}>SOS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.layerButton, activeLayers.has('infrastructure') && styles.layerActive]}
          onPress={() => toggleLayer('infrastructure')}
        >
          <Text style={styles.layerIcon}>🏥</Text>
          <Text style={styles.layerLabel}>Hastane</Text>
        </TouchableOpacity>
      </View>

      {/* Alt navigasyon butonu */}
      <TouchableOpacity style={styles.navigateButton} onPress={navigateToNearest}>
        <Text style={styles.navigateText}>🧭 En Yakın Toplanma Alanına Git</Text>
      </TouchableOpacity>

      {/* Seçili nokta detay kartı */}
      {selectedPoint && (
        <View style={styles.detailCard}>
          <Text style={styles.detailName}>{selectedPoint.name}</Text>
          <Text style={styles.detailAddress}>{selectedPoint.address}</Text>
          <Text style={styles.detailCapacity}>
            Kapasite: {selectedPoint.current_occupancy}/{selectedPoint.capacity}
          </Text>
          <TouchableOpacity onPress={() => setSelectedPoint(null)}>
            <Text style={styles.closeText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  mapPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1a2332',
  },
  mapText: { fontSize: 24, color: COLORS.white },
  mapSubtext: { fontSize: 12, color: COLORS.grey, marginTop: 8 },
  coordText: { fontSize: 14, color: COLORS.primary, marginTop: 16 },
  layerPanel: {
    position: 'absolute', top: 60, right: 12,
    backgroundColor: 'rgba(26,26,46,0.95)', borderRadius: 12,
    padding: 8, gap: 4,
  },
  layerButton: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8 },
  layerActive: { backgroundColor: 'rgba(26,115,232,0.2)' },
  layerIcon: { fontSize: 16, marginRight: 6 },
  layerLabel: { fontSize: 12, color: COLORS.white },
  navigateButton: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: COLORS.primary, borderRadius: 16, padding: 18, alignItems: 'center',
  },
  navigateText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  detailCard: {
    position: 'absolute', bottom: 90, left: 20, right: 20,
    backgroundColor: COLORS.dark, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  detailName: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  detailAddress: { fontSize: 13, color: COLORS.grey, marginTop: 4 },
  detailCapacity: { fontSize: 14, color: COLORS.primary, marginTop: 8 },
  closeText: { color: COLORS.danger, textAlign: 'right', marginTop: 12, fontSize: 14 },
});

export default MapScreen;
