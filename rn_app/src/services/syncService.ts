import * as Network from 'expo-network';
import { supabase } from './supabase';
import { getPendingMessages, markMessageAsSynced, getPendingEmergencyReports, markEmergencyReportAsSynced } from './db';

/**
 * Cihazın anlık internet bağlantısını kontrol eder.
 * @returns {Promise<boolean>} İnternet varsa true, yoksa false döner.
 */
export const checkInternetConnection = async (): Promise<boolean> => {
  const networkState = await Network.getNetworkStateAsync();
  return !!networkState.isConnected && !!networkState.isInternetReachable;
};

/**
 * Lokal SQLite'da bekleyen (pending) mesajları Supabase'e gönderir.
 * Eğer başarılı olursa durumu 'synced' olarak günceller.
 */
export const syncPendingMessages = async () => {
  const isOnline = await checkInternetConnection();
  if (!isOnline) return;

  try {
    const pendingMessages: any[] = await getPendingMessages();
    
    if (pendingMessages.length === 0) return;

    console.log(`${pendingMessages.length} adet bekleyen mesaj senkronize ediliyor...`);

    for (const msg of pendingMessages) {
      // Supabase tablosuna mesajı ekliyoruz
      // PostGIS için location formatı (latitude, longitude) uygun bir geometry stringine veya Supabase PostGIS fonksiyonuna dönüştürülebilir
      // Şimdilik null veya PostGIS raw formata uygun şekilde göndermemiz gerekiyor. Supabase'de PostGIS için st_point vs kullanmak gerek.
      // Basitlik adına burada text olarak veya Supabase fonksiyonu kullanarak ekleyebiliriz.
      // Eger Supabase direkt EWKT alıyorsa `SRID=4326;POINT(${longitude} ${latitude})` formatında atabiliriz.
      
      let locationData = null;
      if (msg.longitude !== null && msg.latitude !== null) {
        locationData = `SRID=4326;POINT(${msg.longitude} ${msg.latitude})`;
      }

      const { error } = await supabase.from('messages').insert({
        id: msg.id,
        sender_name: msg.sender_name,
        text: msg.text,
        location: locationData,
        status: 'synced',
        created_at: msg.created_at,
        is_offline: true, // Aslında offline atıldığı için bunu işaretliyoruz
      });

      if (!error) {
        // Başarılı ise lokal veritabanında güncelleyelim
        await markMessageAsSynced(msg.id);
      } else {
        console.error("Mesaj senkronizasyon hatası:", error);
      }
    }
  } catch (error) {
    console.error("Senkronizasyon sırasında hata oluştu:", error);
  }
};

/**
 * Lokal SQLite'da bekleyen acil durum raporlarını Supabase'e gönderir.
 */
export const syncPendingEmergencyReports = async () => {
  const isOnline = await checkInternetConnection();
  if (!isOnline) return;

  try {
    const pendingReports: any[] = await getPendingEmergencyReports();
    
    if (pendingReports.length === 0) return;

    for (const report of pendingReports) {
      let locationData = null;
      if (report.longitude !== null && report.latitude !== null) {
        locationData = `SRID=4326;POINT(${report.longitude} ${report.latitude})`;
      }

      const { error } = await supabase.from('emergency_reports').insert({
        id: report.id,
        status_type: report.status_type,
        location: locationData,
        status: 'synced',
        created_at: report.created_at,
        is_offline: true,
      });

      if (!error) {
        await markEmergencyReportAsSynced(report.id);
      } else {
        console.error("Acil durum raporu senkronizasyon hatası:", error);
      }
    }
  } catch (error) {
    console.error("Acil durum raporu senkronizasyonu sırasında hata oluştu:", error);
  }
};
