/**
 * Afet Yönetim Servisi
 * 
 * Afet uyarıları, SOS çağrıları, bina risk kontrolü,
 * hane yönetimi ve hayvan sevkiyat taleplerini yönetir.
 * Supabase ile iletişim kurar, offline durumda WatermelonDB kullanır.
 */

import supabase from '../config/supabase';
import { DisasterAlert, SOSRequest, AssemblyPoint, BuildingRisk, AnimalRescueRequest } from '../types';

// ==================== Afet Uyarıları ====================

/** Aktif afet uyarılarını getirir */
export const getActiveAlerts = async (): Promise<DisasterAlert[]> => {
  const { data, error } = await supabase
    .from('disaster_alerts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Disaster] Uyarı çekme hatası:', error.message);
    return [];
  }
  return data as DisasterAlert[];
};

/** Yeni afet uyarısı oluşturur (yetkili kullanıcılar) */
export const createAlert = async (alert: Omit<DisasterAlert, 'id' | 'created_at'>): Promise<string | null> => {
  const { data, error } = await supabase
    .from('disaster_alerts')
    .insert(alert)
    .select('id')
    .single();

  if (error) {
    console.error('[Disaster] Uyarı oluşturma hatası:', error.message);
    return null;
  }
  return data.id;
};

// ==================== SOS Çağrıları ====================

/** Yeni SOS çağrısı oluşturur */
export const createSOSRequest = async (sos: Omit<SOSRequest, 'id' | 'created_at' | 'resolved_at'>): Promise<string | null> => {
  const { data, error } = await supabase
    .from('sos_requests')
    .insert(sos)
    .select('id')
    .single();

  if (error) {
    console.error('[Disaster] SOS oluşturma hatası:', error.message);
    return null;
  }
  return data.id;
};

/** Yakındaki SOS çağrılarını getirir (PostGIS) */
export const getNearbySOSRequests = async (lat: number, lng: number, radiusKm: number): Promise<SOSRequest[]> => {
  const { data, error } = await supabase.rpc('get_nearby_sos', {
    user_lat: lat,
    user_lng: lng,
    radius_km: radiusKm,
  });

  if (error) {
    console.error('[Disaster] Yakın SOS çekme hatası:', error.message);
    return [];
  }
  return data as SOSRequest[];
};

// ==================== Toplanma Alanları ====================

/** Tüm aktif toplanma alanlarını getirir */
export const getAssemblyPoints = async (): Promise<AssemblyPoint[]> => {
  const { data, error } = await supabase
    .from('assembly_points')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('[Disaster] Toplanma alanları hatası:', error.message);
    return [];
  }
  return data as AssemblyPoint[];
};

/** Yakındaki toplanma alanlarını PostGIS ile getirir */
export const getNearbyAssemblyPoints = async (lat: number, lng: number, radiusKm: number): Promise<AssemblyPoint[]> => {
  const { data, error } = await supabase.rpc('get_nearby_assembly_points', {
    user_lat: lat,
    user_lng: lng,
    radius_km: radiusKm,
  });

  if (error) {
    console.error('[Disaster] Yakın toplanma alanı hatası:', error.message);
    return [];
  }
  return data as AssemblyPoint[];
};

// ==================== Bina Risk Kontrolü ====================

/** Konum bazlı bina risk seviyesini sorgular */
export const checkBuildingRisk = async (lat: number, lng: number): Promise<BuildingRisk | null> => {
  const { data, error } = await supabase.rpc('check_building_risk', {
    check_lat: lat,
    check_lng: lng,
  });

  if (error) {
    console.error('[Disaster] Bina risk kontrolü hatası:', error.message);
    return null;
  }
  return data as BuildingRisk;
};

// ==================== Hane (Aile) Yönetimi ====================

/** Yeni hane oluşturur */
export const createHousehold = async (name: string, ownerId: string): Promise<string | null> => {
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from('households')
    .insert({ name, owner_id: ownerId, invite_code: inviteCode })
    .select('id')
    .single();

  if (error) {
    console.error('[Disaster] Hane oluşturma hatası:', error.message);
    return null;
  }
  return data.id;
};

/** Davet kodu ile haneye katılır */
export const joinHousehold = async (inviteCode: string, userId: string): Promise<boolean> => {
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('invite_code', inviteCode)
    .single();

  if (!household) return false;

  const { error } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: userId, role: 'member' });

  return !error;
};

/** Hane üyelerinin durumlarını getirir */
export const getHouseholdMemberStatuses = async (householdId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('household_members')
    .select('*, profiles(*), user_statuses(*)')
    .eq('household_id', householdId);

  if (error) {
    console.error('[Disaster] Hane üyeleri hatası:', error.message);
    return [];
  }
  return data;
};

/** "Ben iyiyim" durumu günceller */
export const updateMyStatus = async (userId: string, status: string, lat?: number, lng?: number): Promise<boolean> => {
  const { error } = await supabase
    .from('user_statuses')
    .upsert({
      user_id: userId,
      status,
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString(),
    });

  return !error;
};

// ==================== Hayvan Sevkiyat ====================

/** Hayvan kurtarma talebi oluşturur */
export const createAnimalRescueRequest = async (request: Omit<AnimalRescueRequest, 'id' | 'created_at'>): Promise<string | null> => {
  const { data, error } = await supabase
    .from('animal_rescue_requests')
    .insert(request)
    .select('id')
    .single();

  if (error) {
    console.error('[Disaster] Hayvan kurtarma hatası:', error.message);
    return null;
  }
  return data.id;
};
