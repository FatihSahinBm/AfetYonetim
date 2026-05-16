/**
 * Afet Uyarısı WatermelonDB Modeli
 * 
 * Afet uyarılarını (deprem, sel, yangın, fırtına) offline saklar.
 * Afet anında internet kesilse bile son uyarılar erişilebilir olur.
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, json } from '@nozbe/watermelondb/decorators';

// Ekstra verileri güvenli parse etme
const sanitizeExtraData = (rawJSON: string): Record<string, any> => {
  try {
    return JSON.parse(rawJSON) || {};
  } catch {
    return {};
  }
};

export default class DisasterAlertModel extends Model {
  static table = 'disaster_alerts';

  /** Supabase tarafındaki benzersiz ID */
  @text('remote_id') remoteId!: string;

  /** Afet türü (earthquake, flood, fire, storm) */
  @text('type') type!: string;

  /** Aciliyet seviyesi */
  @text('severity') severity!: string;

  /** Uyarı başlığı */
  @text('title') title!: string;

  /** Uyarı açıklaması */
  @text('description') description!: string;

  /** Enlem koordinatı */
  @field('latitude') latitude!: number;

  /** Boylam koordinatı */
  @field('longitude') longitude!: number;

  /** Etki yarıçapı (km) */
  @field('radius_km') radiusKm!: number;

  /** Aktif mi */
  @field('is_active') isActive!: boolean;

  /** Kaynak (AFAD, PKAS, kullanıcı vb.) */
  @text('source') source!: string;

  /** Afet türüne özel ek veriler (JSON) */
  @json('extra_data', sanitizeExtraData) extraData!: Record<string, any>;

  /** Oluşturulma zamanı */
  @field('created_at') createdAt!: number;

  /** Sona erme zamanı */
  @field('expires_at') expiresAt!: number | null;
}
