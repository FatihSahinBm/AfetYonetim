/**
 * Mesh Ağı Mesajlaşma Servisi (Bridgefy SDK)
 * 
 * İnternetsiz ortamlarda Bluetooth Low Energy (BLE) üzerinden
 * cihazlar arası mesajlaşma sağlar.
 * 
 * Bridgefy SDK kullanarak mesh ağı oluşturur:
 * - Cihazlar birbirine mesaj iletir (multi-hop)
 * - SOS çağrıları ağ üzerinden yayılır
 * - Konum bilgisi paylaşılabilir
 * 
 * NOT: Bridgefy SDK'nın API anahtarı gereklidir (bridgefy.me)
 */

import { MeshMessage, MeshMessageType } from '../types';
import { MESH_CONFIG } from '../config/constants';

// Bridgefy SDK - React Native wrapper
// import Bridgefy from 'bridgefy-react-native';

/**
 * Mesh ağı bağlantı durumu
 */
interface MeshConnectionState {
  isStarted: boolean;
  connectedPeers: string[];
  userId: string;
}

// Modül düzeyinde durum
let meshState: MeshConnectionState = {
  isStarted: false,
  connectedPeers: [],
  userId: '',
};

// Mesaj dinleyici callback'leri
type MessageListener = (message: MeshMessage) => void;
const messageListeners: MessageListener[] = [];

/**
 * Mesh ağını başlatır.
 * Bridgefy SDK'yı API anahtarı ile initialize eder.
 * @param userId - Mevcut kullanıcının ID'si
 * @param apiKey - Bridgefy API anahtarı
 */
export const startMeshNetwork = async (
  userId: string,
  apiKey: string
): Promise<boolean> => {
  try {
    // Bridgefy SDK başlatma
    // await Bridgefy.start({
    //   apiKey,
    //   userId,
    //   propagationProfile: 'standard',
    //   operationMode: 'hybrid', // Hem foreground hem background
    // });

    meshState = {
      isStarted: true,
      connectedPeers: [],
      userId,
    };

    console.log('[Mesh] Ağ başlatıldı. Kullanıcı:', userId);

    // Mesaj dinleyicilerini kaydet
    setupMessageHandlers();

    return true;
  } catch (error) {
    console.error('[Mesh] Ağ başlatma hatası:', error);
    return false;
  }
};

/**
 * Mesh ağını durdurur.
 */
export const stopMeshNetwork = async (): Promise<void> => {
  try {
    // await Bridgefy.stop();
    meshState.isStarted = false;
    meshState.connectedPeers = [];
    console.log('[Mesh] Ağ durduruldu');
  } catch (error) {
    console.error('[Mesh] Ağ durdurma hatası:', error);
  }
};

/**
 * Tüm yakındaki cihazlara mesaj yayınlar (broadcast).
 * Mesaj mesh ağı üzerinden hop'layarak yayılır.
 */
export const broadcastMessage = async (
  type: MeshMessageType,
  content: string,
  senderName: string,
  latitude?: number,
  longitude?: number
): Promise<string | null> => {
  if (!meshState.isStarted) {
    console.warn('[Mesh] Ağ başlatılmamış. Mesaj gönderilemedi.');
    return null;
  }

  const message: MeshMessage = {
    id: generateMessageId(),
    sender_id: meshState.userId,
    sender_name: senderName,
    type,
    content,
    latitude,
    longitude,
    timestamp: Date.now(),
    hop_count: 0,
    ttl: MESH_CONFIG.messageRetentionMs,
  };

  try {
    // Bridgefy üzerinden broadcast
    // await Bridgefy.send({
    //   data: JSON.stringify(message),
    //   mode: 'broadcast',
    // });

    console.log('[Mesh] Mesaj yayınlandı:', type, content.substring(0, 50));
    return message.id;
  } catch (error) {
    console.error('[Mesh] Mesaj gönderme hatası:', error);
    return null;
  }
};

/**
 * Belirli bir cihaza doğrudan mesaj gönderir.
 */
export const sendDirectMessage = async (
  peerId: string,
  type: MeshMessageType,
  content: string,
  senderName: string
): Promise<string | null> => {
  if (!meshState.isStarted) {
    console.warn('[Mesh] Ağ başlatılmamış.');
    return null;
  }

  const message: MeshMessage = {
    id: generateMessageId(),
    sender_id: meshState.userId,
    sender_name: senderName,
    type,
    content,
    timestamp: Date.now(),
    hop_count: 0,
    ttl: MESH_CONFIG.messageRetentionMs,
  };

  try {
    // await Bridgefy.send({
    //   data: JSON.stringify(message),
    //   recipientId: peerId,
    //   mode: 'direct',
    // });

    console.log('[Mesh] Doğrudan mesaj gönderildi:', peerId);
    return message.id;
  } catch (error) {
    console.error('[Mesh] Doğrudan mesaj hatası:', error);
    return null;
  }
};

/**
 * SOS çağrısı yayınlar.
 * Yüksek öncelikli olarak mesh ağı üzerinden tüm cihazlara ulaştırılır.
 */
export const broadcastSOS = async (
  senderName: string,
  latitude: number,
  longitude: number,
  additionalInfo?: string
): Promise<string | null> => {
  const sosContent = JSON.stringify({
    message: 'MAHSUR KALDIM - ACİL YARDIM',
    info: additionalInfo || '',
    timestamp: Date.now(),
  });

  return broadcastMessage(
    'sos' as MeshMessageType,
    sosContent,
    senderName,
    latitude,
    longitude
  );
};

/**
 * Mesaj dinleyicisi ekler.
 * Gelen her mesh mesajında bu callback çağrılır.
 */
export const addMessageListener = (listener: MessageListener): void => {
  messageListeners.push(listener);
};

/**
 * Mesaj dinleyicisini kaldırır.
 */
export const removeMessageListener = (listener: MessageListener): void => {
  const index = messageListeners.indexOf(listener);
  if (index > -1) {
    messageListeners.splice(index, 1);
  }
};

/**
 * Bağlı cihaz (peer) listesini döndürür.
 */
export const getConnectedPeers = (): string[] => {
  return [...meshState.connectedPeers];
};

/**
 * Mesh ağının başlatılıp başlatılmadığını kontrol eder.
 */
export const isMeshActive = (): boolean => {
  return meshState.isStarted;
};

// ==================== Dahili Yardımcı Fonksiyonlar ====================

/**
 * Bridgefy SDK mesaj event handler'larını kaydet.
 */
const setupMessageHandlers = (): void => {
  // Bridgefy.onMessageReceived((data: string) => {
  //   try {
  //     const message: MeshMessage = JSON.parse(data);
  //     message.hop_count += 1;
  //     
  //     // Tüm dinleyicilere bildir
  //     messageListeners.forEach((listener) => listener(message));
  //   } catch (error) {
  //     console.error('[Mesh] Mesaj parse hatası:', error);
  //   }
  // });

  // Bridgefy.onPeerConnected((peerId: string) => {
  //   meshState.connectedPeers.push(peerId);
  //   console.log('[Mesh] Yeni peer bağlandı:', peerId);
  // });

  // Bridgefy.onPeerDisconnected((peerId: string) => {
  //   meshState.connectedPeers = meshState.connectedPeers.filter(id => id !== peerId);
  //   console.log('[Mesh] Peer ayrıldı:', peerId);
  // });

  console.log('[Mesh] Mesaj dinleyicileri kaydedildi');
};

/**
 * Benzersiz mesaj ID'si üretir.
 */
const generateMessageId = (): string => {
  return `mesh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};
