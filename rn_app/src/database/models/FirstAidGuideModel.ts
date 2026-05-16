/**
 * İlk Yardım Rehberi WatermelonDB Modeli
 * 
 * İlk yardım bilgilerini offline kullanım için saklar.
 * Kullanıcılar internet olmadan da ilk yardım rehberlerine erişebilir.
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, json } from '@nozbe/watermelondb/decorators';

// JSON parse yardımcı fonksiyonu
const sanitizeJSON = (rawJSON: string): string[] => {
  try {
    return JSON.parse(rawJSON) || [];
  } catch {
    return [];
  }
};

export default class FirstAidGuideModel extends Model {
  static table = 'first_aid_guides';

  /** Supabase tarafındaki benzersiz ID */
  @text('remote_id') remoteId!: string;

  /** Rehber başlığı */
  @text('title') title!: string;

  /** Kategori (yanık, kırık, kanama vb.) */
  @text('category') category!: string;

  /** Detaylı içerik */
  @text('content') content!: string;

  /** Adım adım talimatlar - JSON olarak saklanır */
  @json('steps', sanitizeJSON) steps!: string[];

  /** Görsel URL'leri - JSON olarak saklanır */
  @json('image_urls', sanitizeJSON) imageUrls!: string[];

  /** Offline erişilebilir mi */
  @field('is_offline_available') isOfflineAvailable!: boolean;

  /** Son güncelleme zamanı */
  @field('updated_at') updatedAt!: number;
}
