/**
 * Ağ Bağlantı Durumu Hook'u
 * 
 * İnternet bağlantısını izler, bağlantı geldiğinde
 * otomatik senkronizasyon tetikler.
 */

import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncDatabase } from '../services/syncService';

interface NetworkStatus {
  isConnected: boolean;
  isWifi: boolean;
  connectionType: string;
}

/**
 * Ağ durumunu izler ve senkronizasyonu yönetir.
 * Bağlantı geri geldiğinde otomatik sync tetiklenir.
 */
export const useNetworkStatus = (): NetworkStatus => {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isWifi: false,
    connectionType: 'unknown',
  });

  useEffect(() => {
    // Ağ değişikliklerini dinle
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      const wasOffline = !status.isConnected;

      setStatus({
        isConnected,
        isWifi: state.type === 'wifi',
        connectionType: state.type,
      });

      // Offline'dan online'a geçiş - otomatik senkronize et
      if (wasOffline && isConnected) {
        console.log('[Network] Bağlantı geri geldi, senkronizasyon başlatılıyor...');
        syncDatabase();
      }
    });

    return () => unsubscribe();
  }, [status.isConnected]);

  return status;
};
