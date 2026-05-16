/**
 * WatermelonDB - Supabase Senkronizasyon Servisi
 * 
 * İnternet bağlantısı varken lokal WatermelonDB ile 
 * uzak Supabase veritabanı arasında delta senkronizasyon yapar.
 * 
 * Senkronizasyon mantığı:
 * 1. Pull: Sunucudan son çekimden bu yana değişen kayıtları al
 * 2. Push: Lokal değişiklikleri sunucuya gönder
 * 3. Çakışma çözümü: Sunucu kazanır (server_wins)
 */

import { synchronize } from '@nozbe/watermelondb/sync';
import database from '../database';
import supabase from '../config/supabase';

/**
 * Senkronizasyon ana fonksiyonu.
 * AppState değişikliğinde, ağ bağlantısında veya kullanıcı tetiklemesinde çağrılır.
 */
export const syncDatabase = async (): Promise<void> => {
  try {
    await synchronize({
      database,

      /**
       * Pull: Sunucudan değişiklikleri çek
       * @param lastPulledAt - Son başarılı çekme zamanı (timestamp)
       * @returns Değişen kayıtlar (created, updated, deleted)
       */
      pullChanges: async ({ lastPulledAt }) => {
        const timestamp = lastPulledAt || 0;

        // Supabase RPC fonksiyonunu çağırarak delta değişiklikleri al
        const { data, error } = await supabase.rpc('pull_changes', {
          last_pulled_at: new Date(timestamp).toISOString(),
        });

        if (error) {
          throw new Error(`[Sync] Pull hatası: ${error.message}`);
        }

        return {
          changes: data.changes,
          timestamp: data.timestamp,
        };
      },

      /**
       * Push: Lokal değişiklikleri sunucuya gönder
       * @param changes - Lokalde yapılan değişiklikler
       */
      pushChanges: async ({ changes }) => {
        const { error } = await supabase.rpc('push_changes', {
          changes: JSON.stringify(changes),
        });

        if (error) {
          throw new Error(`[Sync] Push hatası: ${error.message}`);
        }
      },

      // Senkronizasyon sırasında çakışma olursa sunucu versiyonu kazanır
      sendCreatedAsUpdated: true,
    });

    console.log('[Sync] Senkronizasyon başarılı');
  } catch (error) {
    console.error('[Sync] Senkronizasyon hatası:', error);
    // Hata durumunda sessizce devam et - offline çalışmaya devam edilir
  }
};

/**
 * Belirli bir tablonun verilerini zorla yenile.
 * Örneğin toplanma alanlarını haftada bir güncellemek için kullanılır.
 */
export const forceRefreshTable = async (tableName: string): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      throw new Error(`[Sync] ${tableName} yenileme hatası: ${error.message}`);
    }

    // Lokal veritabanına toplu yazma
    await database.write(async () => {
      const collection = database.get(tableName);
      
      // Mevcut kayıtları temizle
      const existing = await collection.query().fetch();
      const deleteOps = existing.map((record: any) => record.prepareDestroyPermanently());
      
      // Yeni kayıtları ekle
      const createOps = data.map((item: any) =>
        collection.prepareCreate((record: any) => {
          record.remoteId = item.id;
          // Diğer alanlar tabloya göre dinamik olarak atanır
          Object.keys(item).forEach((key) => {
            if (key !== 'id') {
              try {
                record[key] = typeof item[key] === 'object'
                  ? JSON.stringify(item[key])
                  : item[key];
              } catch {
                // Atlanamayan alan, sessizce geç
              }
            }
          });
        })
      );

      await database.batch(...deleteOps, ...createOps);
    });

    console.log(`[Sync] ${tableName} tablosu yenilendi (${data.length} kayıt)`);
  } catch (error) {
    console.error(`[Sync] ${tableName} yenileme hatası:`, error);
  }
};
