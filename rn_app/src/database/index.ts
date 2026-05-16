/**
 * WatermelonDB Veritabanı Başlatma
 * 
 * Lokal SQLite veritabanını WatermelonDB ile başlatır.
 * Tüm model sınıflarını kaydeder.
 */

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';

// Model sınıflarını içe aktar
import AssemblyPointModel from './models/AssemblyPointModel';
import FirstAidGuideModel from './models/FirstAidGuideModel';
import DisasterAlertModel from './models/DisasterAlertModel';

/**
 * SQLite adaptörünü şema ile yapılandır.
 * Bu adaptör, WatermelonDB'yi cihazın yerel SQLite veritabanına bağlar.
 */
const adapter = new SQLiteAdapter({
  schema,
  // Üretim ortamında true yapılmalı (performans için)
  jsi: true,
  // Hata ayıklama sırasında migration kontrollerini devre dışı bırak
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Veritabanı kurulum hatası:', error);
  },
});

/**
 * Veritabanı örneğini oluştur ve model sınıflarını kaydet.
 * Bu örnek uygulama genelinde paylaşılır.
 */
const database = new Database({
  adapter,
  modelClasses: [
    AssemblyPointModel,
    FirstAidGuideModel,
    DisasterAlertModel,
  ],
});

export default database;
