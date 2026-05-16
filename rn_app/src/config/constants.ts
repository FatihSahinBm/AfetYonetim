/**
 * Uygulama Sabitleri
 * 
 * Tüm uygulama genelinde kullanılan sabit değerler burada tanımlanır.
 * Afet türleri, renk kodları, harita ayarları ve bildirim kategorileri içerir.
 */

// Afet türleri enum tanımı
export enum DisasterType {
  EARTHQUAKE = 'earthquake',   // Deprem
  FLOOD = 'flood',             // Sel
  FIRE = 'fire',               // Yangın
  STORM = 'storm',             // Fırtına
  LANDSLIDE = 'landslide',     // Heyelan
}

// Aciliyet seviyeleri
export enum SeverityLevel {
  LOW = 'low',           // Düşük
  MEDIUM = 'medium',     // Orta
  HIGH = 'high',         // Yüksek
  CRITICAL = 'critical', // Kritik
}

// Kullanıcı durumları
export enum UserStatus {
  SAFE = 'safe',           // Güvende
  NEED_HELP = 'need_help', // Yardım gerekiyor
  TRAPPED = 'trapped',     // Mahsur kaldı
  UNKNOWN = 'unknown',     // Bilinmiyor
}

// Mesh mesaj tipleri
export enum MeshMessageType {
  SOS = 'sos',                    // Acil yardım
  STATUS_UPDATE = 'status_update', // Durum güncellemesi
  CHAT = 'chat',                   // Normal mesaj
  LOCATION_SHARE = 'location_share', // Konum paylaşımı
  RESOURCE_REQUEST = 'resource_request', // Kaynak talebi
}

// Uygulama renk paleti
export const COLORS = {
  primary: '#1A73E8',       // Ana mavi
  secondary: '#FF6B35',     // Turuncu vurgu
  danger: '#D32F2F',        // Tehlike kırmızı
  warning: '#FFA000',       // Uyarı sarı
  success: '#388E3C',       // Başarı yeşil
  info: '#0288D1',          // Bilgi mavi
  dark: '#1A1A2E',          // Koyu arka plan
  light: '#F5F5F5',         // Açık arka plan
  white: '#FFFFFF',
  black: '#000000',
  grey: '#9E9E9E',
  overlay: 'rgba(0, 0, 0, 0.5)', // Yarı saydam katman

  // Afet türü renkleri
  earthquake: '#8B0000',
  flood: '#1565C0',
  fire: '#FF5722',
  storm: '#4A148C',
  landslide: '#795548',
};

// Harita varsayılan ayarları (Türkiye merkezi)
export const MAP_CONFIG = {
  defaultLatitude: 39.9334,
  defaultLongitude: 32.8597,
  defaultZoom: 6,
  clusterRadius: 50,
};

// Offline senkronizasyon ayarları
export const SYNC_CONFIG = {
  syncIntervalMs: 300000,         // 5 dakika
  assemblyPointRefreshMs: 604800000, // 1 hafta (güncel toplanma alanları)
  maxRetryAttempts: 3,
  conflictResolution: 'server_wins' as const,
};

// Bridgefy / BLE Mesh ayarları
export const MESH_CONFIG = {
  scanDurationMs: 10000,    // 10 saniye tarama
  broadcastRadius: 100,     // Metre cinsinden yayın yarıçapı
  maxHops: 5,               // Maksimum hop sayısı
  messageRetentionMs: 86400000, // 24 saat mesaj saklama
};

// Pil tasarrufu eşikleri
export const BATTERY_THRESHOLDS = {
  low: 20,        // %20 altında pil tasarrufu uyarısı
  critical: 10,   // %10 altında kritik pil uyarısı
  ultraSave: 5,   // %5 altında ultra tasarruf modu
};
