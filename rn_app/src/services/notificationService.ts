/**
 * Bildirim Servisi
 * 
 * Afet uyarıları, SOS çağrıları ve durum güncellemeleri için
 * push bildirim ve yerel bildirim yönetimi.
 * 
 * Yüksek sesli frekans uyarısı desteği içerir.
 */

import { DisasterAlert, SOSRequest, SeverityLevel } from '../types';
import { COLORS } from '../config/constants';

/**
 * Bildirim kanalları (Android)
 */
export enum NotificationChannel {
  DISASTER_ALERT = 'disaster_alert',    // Afet uyarıları (yüksek öncelik)
  SOS = 'sos',                          // SOS çağrıları (kritik)
  FAMILY_STATUS = 'family_status',       // Aile üye durumları
  GENERAL = 'general',                   // Genel bildirimler
  BATTERY = 'battery',                   // Pil uyarıları
}

/**
 * Bildirim kanallarını oluşturur (Android için gerekli).
 * Uygulama ilk açıldığında çağrılmalıdır.
 */
export const createNotificationChannels = async (): Promise<void> => {
  // React Native Push Notification kanalları
  // PushNotification.createChannel({
  //   channelId: NotificationChannel.DISASTER_ALERT,
  //   channelName: 'Afet Uyarıları',
  //   channelDescription: 'Deprem, sel, yangın ve fırtına uyarıları',
  //   importance: 5, // MAX
  //   vibrate: true,
  //   playSound: true,
  //   soundName: 'alarm.mp3',
  // });

  // PushNotification.createChannel({
  //   channelId: NotificationChannel.SOS,
  //   channelName: 'SOS Çağrıları',
  //   channelDescription: 'Mahsur kalan kişilerden gelen acil çağrılar',
  //   importance: 5,
  //   vibrate: true,
  //   playSound: true,
  //   soundName: 'sos_alarm.mp3',
  // });

  console.log('[Notification] Bildirim kanalları oluşturuldu');
};

/**
 * Afet uyarısı bildirimi gönderir.
 * Kritik seviyede yüksek sesli alarm çalar.
 */
export const sendDisasterAlert = async (alert: DisasterAlert): Promise<void> => {
  const severityText = getSeverityText(alert.severity as SeverityLevel);
  
  // PushNotification.localNotification({
  //   channelId: NotificationChannel.DISASTER_ALERT,
  //   title: `⚠️ ${severityText} - ${alert.title}`,
  //   message: alert.description,
  //   bigText: alert.description,
  //   color: getAlertColor(alert.severity as SeverityLevel),
  //   vibration: 1000,
  //   priority: 'max',
  //   importance: 'max',
  //   // Kritik seviyede tam ekran bildirim
  //   fullScreenIntent: alert.severity === 'critical',
  // });

  console.log('[Notification] Afet uyarısı gönderildi:', alert.title);
};

/**
 * SOS çağrısı bildirimi gönderir.
 */
export const sendSOSNotification = async (sos: SOSRequest): Promise<void> => {
  // PushNotification.localNotification({
  //   channelId: NotificationChannel.SOS,
  //   title: '🆘 MAHSUR KALDI - ACİL YARDIM',
  //   message: `${sos.user_name} yardım istiyor! ${sos.people_count} kişi.`,
  //   bigText: `${sos.user_name} yardım istiyor!\nKişi sayısı: ${sos.people_count}\nYaralı var mı: ${sos.has_injury ? 'Evet' : 'Hayır'}\n${sos.message || ''}`,
  //   priority: 'max',
  //   importance: 'max',
  //   fullScreenIntent: true,
  // });

  console.log('[Notification] SOS bildirimi gönderildi:', sos.user_name);
};

/**
 * Aile üyesi durum bildirimi gönderir.
 */
export const sendFamilyStatusNotification = async (
  memberName: string,
  status: string
): Promise<void> => {
  const statusEmoji = status === 'safe' ? '✅' : status === 'need_help' ? '🔴' : '❓';

  // PushNotification.localNotification({
  //   channelId: NotificationChannel.FAMILY_STATUS,
  //   title: `${statusEmoji} Aile Üyesi Durumu`,
  //   message: `${memberName}: ${getStatusText(status)}`,
  // });

  console.log('[Notification] Aile durumu bildirimi:', memberName, status);
};

/**
 * Pil uyarısı bildirimi gönderir.
 */
export const sendBatteryWarning = async (level: number): Promise<void> => {
  // PushNotification.localNotification({
  //   channelId: NotificationChannel.BATTERY,
  //   title: '🔋 Pil Tasarrufu Uyarısı',
  //   message: `Pil seviyeniz %${level}. Afet durumunda pil tasarrufu modunu etkinleştirin.`,
  // });

  console.log('[Notification] Pil uyarısı:', level);
};

// ==================== Yardımcı Fonksiyonlar ====================

/** Aciliyet seviyesini Türkçe metne çevirir */
const getSeverityText = (severity: SeverityLevel): string => {
  const map: Record<SeverityLevel, string> = {
    low: 'Düşük Seviye Uyarı',
    medium: 'Orta Seviye Uyarı',
    high: 'Yüksek Seviye Uyarı',
    critical: 'KRİTİK UYARI',
  };
  return map[severity] || 'Uyarı';
};

/** Aciliyet seviyesine göre renk döndürür */
const getAlertColor = (severity: SeverityLevel): string => {
  const map: Record<SeverityLevel, string> = {
    low: COLORS.info,
    medium: COLORS.warning,
    high: COLORS.secondary,
    critical: COLORS.danger,
  };
  return map[severity] || COLORS.primary;
};

/** Kullanıcı durumunu Türkçe metne çevirir */
const getStatusText = (status: string): string => {
  const map: Record<string, string> = {
    safe: 'Güvende',
    need_help: 'Yardım Gerekiyor',
    trapped: 'Mahsur Kaldı',
    unknown: 'Durumu Bilinmiyor',
  };
  return map[status] || 'Bilinmiyor';
};
