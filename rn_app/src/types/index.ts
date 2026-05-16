/**
 * Uygulama Tip Tanımları
 * 
 * TypeScript arayüzleri ile tüm veri modellerini tanımlar.
 * Supabase tabloları, mesh mesajları ve UI bileşenleri için tip güvenliği sağlar.
 */

import { DisasterType, SeverityLevel, UserStatus, MeshMessageType } from '../config/constants';

// ==================== Kullanıcı Tipleri ====================

/** Kullanıcı profil bilgileri */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

/** Hane (aile) bilgileri */
export interface Household {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

/** Hane üyesi */
export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

// ==================== Afet ve Uyarı Tipleri ====================

/** Afet uyarısı */
export interface DisasterAlert {
  id: string;
  type: DisasterType;
  severity: SeverityLevel;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  is_active: boolean;
  source: string; // AFAD, PKAS, kullanıcı bildirimi vb.
  created_at: string;
  expires_at?: string;
}

/** Deprem uyarısı detayları */
export interface EarthquakeAlert extends DisasterAlert {
  magnitude: number;
  depth_km: number;
  building_risk_level?: SeverityLevel;
}

/** Yangın uyarısı detayları */
export interface FireAlert extends DisasterAlert {
  spread_direction: string;      // Yayılma yönü
  humidity: number;              // Bağıl nem
  temperature: number;           // Sıcaklık
  wind_speed: number;            // Rüzgar hızı
  estimated_spread_zones: string; // GeoJSON formatında tahmini yayılma alanları
}

/** Sel uyarısı detayları */
export interface FloodAlert extends DisasterAlert {
  water_level_cm: number;         // Su seviyesi
  rainfall_capacity: number;      // Yağış kaldırma kapasitesi
  high_altitude_escape_points: GeoPoint[]; // Yüksek rakımlı kaçış noktaları
}

// ==================== Konum ve Harita Tipleri ====================

/** Coğrafi nokta */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Toplanma alanı */
export interface AssemblyPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  current_occupancy: number;
  address: string;
  district: string;
  city: string;
  is_active: boolean;
  facilities: string[];  // WC, su, ilk yardım vb.
  updated_at: string;
}

/** Kritik altyapı noktaları (hastane, itfaiye vb.) */
export interface CriticalInfrastructure {
  id: string;
  name: string;
  type: 'hospital' | 'fire_station' | 'police' | 'shelter' | 'pharmacy';
  latitude: number;
  longitude: number;
  phone?: string;
  is_operational: boolean;
}

// ==================== Mesajlaşma Tipleri ====================

/** Mesh ağı mesajı (offline) */
export interface MeshMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  type: MeshMessageType;
  content: string;
  latitude?: number;
  longitude?: number;
  timestamp: number;
  hop_count: number;
  ttl: number;  // Time to live (saniye)
}

/** Online sohbet mesajı */
export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id?: string;
  channel_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ==================== SOS ve Yardım Tipleri ====================

/** Mahsur kaldım / SOS çağrısı */
export interface SOSRequest {
  id: string;
  user_id: string;
  user_name: string;
  status: UserStatus;
  latitude: number;
  longitude: number;
  message?: string;
  people_count: number;
  has_injury: boolean;
  needs: string[];       // Su, yiyecek, ilk yardım vb.
  building_info?: string; // Bina bilgisi (kat, daire)
  created_at: string;
  resolved_at?: string;
}

/** İlk yardım bilgisi */
export interface FirstAidGuide {
  id: string;
  title: string;
  category: string;
  content: string;
  steps: string[];
  image_urls: string[];
  is_offline_available: boolean;
}

// ==================== Bildirim Tipleri ====================

/** Bina risk bilgisi */
export interface BuildingRisk {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  risk_level: SeverityLevel;
  construction_year?: number;
  last_inspection?: string;
  notes: string;
}

/** Hayvan sevkiyat talebi */
export interface AnimalRescueRequest {
  id: string;
  user_id: string;
  animal_type: string;
  count: number;
  latitude: number;
  longitude: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

// ==================== Sensör Verileri ====================

/** Barometre sensör verisi */
export interface BarometerReading {
  pressure: number;          // hPa cinsinden basınç
  timestamp: number;
  change_rate: number;       // Basınç değişim hızı
  alert_triggered: boolean;  // Ani düşüş tespit edildi mi
}

/** Pil durumu */
export interface BatteryStatus {
  level: number;        // Yüzde
  is_charging: boolean;
  temperature: number;
}

// ==================== Navigasyon Tipleri ====================

/** Ana navigasyon parametreleri */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
};

/** Ana tab navigasyon parametreleri */
export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  SOS: undefined;
  Chat: undefined;
  Profile: undefined;
};

/** Alt ekran parametreleri */
export type SubScreenParamList = {
  DisasterDetail: { alertId: string };
  AssemblyPointDetail: { pointId: string };
  FirstAidDetail: { guideId: string };
  SOSForm: undefined;
  MeshChat: undefined;
  Settings: undefined;
  HouseholdManagement: undefined;
  BuildingRiskCheck: undefined;
  OfflineInfo: undefined;
  AnimalRescue: undefined;
  ObserverNetwork: undefined;
};
