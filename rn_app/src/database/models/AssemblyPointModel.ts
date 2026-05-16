/**
 * Toplanma Alanı WatermelonDB Modeli
 * 
 * Offline toplanma alanı verilerini yönetir.
 * Haftada bir Supabase'den güncel veriler çekilir.
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, json, readonly, date } from '@nozbe/watermelondb/decorators';

// JSON verilerini güvenli şekilde parse eden yardımcı fonksiyon
const sanitizeJSON = (rawJSON: string): string[] => {
  try {
    return JSON.parse(rawJSON) || [];
  } catch {
    return [];
  }
};

export default class AssemblyPointModel extends Model {
  static table = 'assembly_points';

  /** Supabase tarafındaki benzersiz ID */
  @text('remote_id') remoteId!: string;

  /** Toplanma alanı adı */
  @text('name') name!: string;

  /** Enlem koordinatı */
  @field('latitude') latitude!: number;

  /** Boylam koordinatı */
  @field('longitude') longitude!: number;

  /** Maksimum kapasite */
  @field('capacity') capacity!: number;

  /** Mevcut doluluk */
  @field('current_occupancy') currentOccupancy!: number;

  /** Adres bilgisi */
  @text('address') address!: string;

  /** İlçe */
  @text('district') district!: string;

  /** Şehir */
  @text('city') city!: string;

  /** Aktif mi */
  @field('is_active') isActive!: boolean;

  /** Tesis olanakları (WC, su, ilk yardım vb.) - JSON olarak saklanır */
  @json('facilities', sanitizeJSON) facilities!: string[];

  /** Son güncelleme zamanı */
  @field('updated_at') updatedAt!: number;
}
