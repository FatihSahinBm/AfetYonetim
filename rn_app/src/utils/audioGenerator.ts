export const generateSyntheticSiren = (): string => {
  const sampleRate = 44100; // Standart yüksek kalite örnekleme hızı
  const duration = 1.0; // 1 saniyelik kusursuz döngü
  const numSamples = sampleRate * duration;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // WAV Header (Başlık) Bölümü
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM Format
  view.setUint16(22, 1, true); // Mono (1 Kanal)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  
  // Ses Verisi (Sinyal Üretimi)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    
    // 1. İnsanlar için rahatsız edici ve dikkat çekici siren (2000Hz - 4000Hz arası saniyede 2 kez gidip gelen dalga)
    const phaseHuman = 2 * Math.PI * (3000 * t - (1000 / (4 * Math.PI)) * Math.cos(4 * Math.PI * t));
    const sampleHuman = Math.sin(phaseHuman) > 0 ? 1 : -1; // Kare dalga (çok yırtıcı bir ses)
    
    // 2. Köpekler ve arama-kurtarma hayvanları için (15.000 Hz Yüksek Frekans)
    const phaseDog = 2 * Math.PI * 15000 * t;
    const sampleDog = Math.sin(phaseDog); // Sinüs dalga
    
    // 3. Sismik cihazlar ve göçük altı titreşim için (50 Hz Düşük Frekanslı Vuruntu/Gümleme)
    const phaseSeismic = 2 * Math.PI * 50 * t;
    const sampleSeismic = Math.sin(phaseSeismic) > 0 ? 1 : -1;
    
    // Üç sesi birleştiriyoruz
    // İnsan: %40 ses, Köpek: %30 ses, Sismik Titreşim: %30 ses
    let sample = (sampleHuman * 0.4) + (sampleDog * 0.3) + (sampleSeismic * 0.3);
    
    // 16-bit PCM formatına çevir
    view.setInt16(offset, sample * 32767, true);
    offset += 2;
  }
  
  // ArrayBuffer'ı Base64 formatına çevirme (Hızlı kodlama algoritması)
  const bytes = new Uint8Array(buffer);
  let base64 = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let i;
  const l = bytes.length;
  for (i = 2; i < l; i += 3) {
    base64 += chars[bytes[i - 2] >> 2];
    base64 += chars[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    base64 += chars[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
    base64 += chars[bytes[i] & 0x3f];
  }
  if (i === l + 1) {
    base64 += chars[bytes[i - 2] >> 2];
    base64 += chars[(bytes[i - 2] & 0x03) << 4];
    base64 += '==';
  }
  if (i === l) {
    base64 += chars[bytes[i - 2] >> 2];
    base64 += chars[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    base64 += chars[(bytes[i - 1] & 0x0f) << 2];
    base64 += '=';
  }
  
  // Expo Audio'nun doğrudan okuyabileceği Data URI formatında döndür
  return `data:audio/wav;base64,${base64}`;
};
