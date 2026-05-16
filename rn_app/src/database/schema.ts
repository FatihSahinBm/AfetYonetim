/**
 * WatermelonDB Şema Tanımı
 * 
 * Offline-first çalışma için lokal veritabanı şeması.
 * İnternet varken Supabase ile senkronize edilir,
 * internet kesildiğinde bu lokal veritabanından çalışılır.
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Uygulama veritabanı şeması
 * Her tablo, Supabase'deki karşılığı ile senkronize olur.
 */
export const schema = appSchema({
  version: 1,
  tables: [
    // Toplanma alanları tablosu
    tableSchema({
      name: 'assembly_points',
      columns: [
        { name: 'remote_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'capacity', type: 'number' },
        { name: 'current_occupancy', type: 'number' },
        { name: 'address', type: 'string' },
        { name: 'district', type: 'string' },
        { name: 'city', type: 'string' },
        { name: 'is_active', type: 'boolean' },
        { name: 'facilities', type: 'string' }, // JSON string olarak saklanır
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // İlk yardım rehberleri tablosu
    tableSchema({
      name: 'first_aid_guides',
      columns: [
        { name: 'remote_id', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'steps', type: 'string' },       // JSON string
        { name: 'image_urls', type: 'string' },   // JSON string
        { name: 'is_offline_available', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Afet uyarıları tablosu
    tableSchema({
      name: 'disaster_alerts',
      columns: [
        { name: 'remote_id', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'severity', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'radius_km', type: 'number' },
        { name: 'is_active', type: 'boolean' },
        { name: 'source', type: 'string' },
        { name: 'extra_data', type: 'string' },  // JSON - afet türüne göre ek veriler
        { name: 'created_at', type: 'number' },
        { name: 'expires_at', type: 'number', isOptional: true },
      ],
    }),

    // Kritik altyapı noktaları tablosu
    tableSchema({
      name: 'critical_infrastructure',
      columns: [
        { name: 'remote_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'is_operational', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Bina risk bilgileri tablosu
    tableSchema({
      name: 'building_risks',
      columns: [
        { name: 'remote_id', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'address', type: 'string' },
        { name: 'risk_level', type: 'string' },
        { name: 'construction_year', type: 'number', isOptional: true },
        { name: 'notes', type: 'string' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Offline mesh mesajları tablosu
    tableSchema({
      name: 'mesh_messages',
      columns: [
        { name: 'sender_id', type: 'string' },
        { name: 'sender_name', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'timestamp', type: 'number' },
        { name: 'hop_count', type: 'number' },
        { name: 'ttl', type: 'number' },
      ],
    }),

    // Kullanıcının SOS geçmişi
    tableSchema({
      name: 'sos_requests',
      columns: [
        { name: 'remote_id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'message', type: 'string', isOptional: true },
        { name: 'people_count', type: 'number' },
        { name: 'has_injury', type: 'boolean' },
        { name: 'needs', type: 'string' },          // JSON string
        { name: 'building_info', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'resolved_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
