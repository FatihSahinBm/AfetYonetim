/**
 * Konum Servisi
 * 
 * GPS konum izleme, konum paylaşımı ve mesafe hesaplama.
 * Afet anında kullanıcı konumlarını yetkili birimlere iletir.
 * En yakın toplanma alanı ve yol tarifi hesaplar.
 */

import Geolocation from '@react-native-community/geolocation';
import { GeoPoint, AssemblyPoint } from '../types';

/**
 * Kullanıcının mevcut konumunu alır.
 * Yüksek doğruluk modu kullanır (GPS).
 */
export const getCurrentLocation = (): Promise<GeoPoint> => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.error('[Location] Konum alınamadı:', error.message);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
};

/**
 * Konumu sürekli izler (afet anında).
 * @param onLocationUpdate - Her konum güncellemesinde çağrılacak callback
 * @returns Dinleyiciyi durdurmak için watch ID
 */
export const watchLocation = (
  onLocationUpdate: (location: GeoPoint) => void
): number => {
  return Geolocation.watchPosition(
    (position) => {
      onLocationUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    },
    (error) => {
      console.error('[Location] Konum izleme hatası:', error.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10,  // 10 metre değişiklikte güncelle
      interval: 5000,      // 5 saniyede bir kontrol et
    }
  );
};

/**
 * Konum izlemeyi durdurur.
 */
export const stopWatchingLocation = (watchId: number): void => {
  Geolocation.clearWatch(watchId);
};

/**
 * İki nokta arasındaki mesafeyi Haversine formülü ile hesaplar.
 * @returns Mesafe (kilometre cinsinden)
 */
export const calculateDistance = (point1: GeoPoint, point2: GeoPoint): number => {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
    Math.cos(toRad(point2.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Derece değerini radyana çevirir.
 */
const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * En yakın toplanma alanlarını mesafeye göre sıralı döndürür.
 * @param currentLocation - Kullanıcının mevcut konumu
 * @param assemblyPoints - Tüm toplanma alanları listesi
 * @param limit - Döndürülecek maksimum sayı
 * @returns Mesafeye göre sıralı toplanma alanları
 */
export const findNearestAssemblyPoints = (
  currentLocation: GeoPoint,
  assemblyPoints: AssemblyPoint[],
  limit: number = 5
): (AssemblyPoint & { distance: number })[] => {
  return assemblyPoints
    .filter((point) => point.is_active) // Sadece aktif alanlar
    .map((point) => ({
      ...point,
      distance: calculateDistance(currentLocation, {
        latitude: point.latitude,
        longitude: point.longitude,
      }),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
};

/**
 * Konumun belirli bir afet bölgesi içinde olup olmadığını kontrol eder.
 * @param location - Kontrol edilecek konum
 * @param center - Afet merkezi
 * @param radiusKm - Etki yarıçapı (km)
 */
export const isInDangerZone = (
  location: GeoPoint,
  center: GeoPoint,
  radiusKm: number
): boolean => {
  const distance = calculateDistance(location, center);
  return distance <= radiusKm;
};
