/**
 * SOS Ekranı
 * 
 * Mahsur kaldım çağrısı gönderme ekranı.
 * Hem online (Supabase) hem offline (Mesh Network) modunda çalışır.
 * Konum, kişi sayısı, yaralanma durumu ve ihtiyaçları toplar.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ScrollView, Vibration,
} from 'react-native';
import { COLORS } from '../../config/constants';
import { GeoPoint } from '../../types';
import { getCurrentLocation } from '../../services/locationService';
import { createSOSRequest } from '../../services/disasterService';
import { broadcastSOS } from '../../services/meshService';

const SOSScreen: React.FC = () => {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [message, setMessage] = useState('');
  const [peopleCount, setPeopleCount] = useState('1');
  const [hasInjury, setHasInjury] = useState(false);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [buildingInfo, setBuildingInfo] = useState('');
  const [sending, setSending] = useState(false);

  /** Mevcut ihtiyaç seçenekleri */
  const needOptions = ['Su', 'Yiyecek', 'İlk Yardım', 'Battaniye', 'İlaç', 'Kurtarma Ekibi'];

  useEffect(() => {
    fetchLocation();
  }, []);

  /** Konum al */
  const fetchLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch {
      console.error('[SOS] Konum alınamadı');
    }
  };

  /** İhtiyaç seçimi toggle */
  const toggleNeed = (need: string) => {
    setSelectedNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    );
  };

  /** SOS çağrısı gönder */
  const sendSOS = async () => {
    if (!location) {
      Alert.alert('Hata', 'Konum alınamadı. Lütfen konum izni verin.');
      return;
    }

    Alert.alert(
      '🆘 SOS Gönder',
      'Acil yardım çağrısı göndermek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'GÖNDER',
          style: 'destructive',
          onPress: async () => {
            setSending(true);
            Vibration.vibrate([0, 500, 200, 500]); // Titreşim ile geri bildirim

            try {
              // Online: Supabase'e kaydet
              await createSOSRequest({
                user_id: '', // Auth'dan alınacak
                user_name: 'Kullanıcı',
                status: 'trapped',
                latitude: location.latitude,
                longitude: location.longitude,
                message,
                people_count: parseInt(peopleCount, 10) || 1,
                has_injury: hasInjury,
                needs: selectedNeeds,
                building_info: buildingInfo,
              });
            } catch {
              console.log('[SOS] Online gönderilemedi, mesh denenecek');
            }

            // Offline: Mesh ağı üzerinden yayınla
            await broadcastSOS(
              'Kullanıcı',
              location.latitude,
              location.longitude,
              message
            );

            setSending(false);
            Alert.alert('✅ Gönderildi', 'SOS çağrınız gönderildi. Yardım yolda!');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Büyük SOS butonu */}
      <TouchableOpacity
        style={[styles.sosButton, sending && styles.sosButtonSending]}
        onPress={sendSOS}
        disabled={sending}
        activeOpacity={0.7}
      >
        <Text style={styles.sosIcon}>🆘</Text>
        <Text style={styles.sosText}>{sending ? 'Gönderiliyor...' : 'MAHSUR KALDIM'}</Text>
        <Text style={styles.sosSubtext}>Basılı tutarak acil yardım çağırın</Text>
      </TouchableOpacity>

      {/* Konum bilgisi */}
      {location && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </Text>
        </View>
      )}

      {/* Detay bilgileri */}
      <View style={styles.formSection}>
        <Text style={styles.formTitle}>Detay Bilgileri</Text>

        {/* Kişi sayısı */}
        <View style={styles.row}>
          <Text style={styles.label}>Kişi Sayısı</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={styles.counterBtn} onPress={() => setPeopleCount(String(Math.max(1, parseInt(peopleCount) - 1)))}>
              <Text style={styles.counterText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{peopleCount}</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={() => setPeopleCount(String(parseInt(peopleCount) + 1))}>
              <Text style={styles.counterText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Yaralanma durumu */}
        <View style={styles.row}>
          <Text style={styles.label}>Yaralı var mı?</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, hasInjury && styles.toggleActive]} onPress={() => setHasInjury(true)}>
              <Text style={styles.toggleText}>Evet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, !hasInjury && styles.toggleActive]} onPress={() => setHasInjury(false)}>
              <Text style={styles.toggleText}>Hayır</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* İhtiyaçlar */}
        <Text style={styles.label}>İhtiyaçlar</Text>
        <View style={styles.needsGrid}>
          {needOptions.map((need) => (
            <TouchableOpacity
              key={need}
              style={[styles.needChip, selectedNeeds.includes(need) && styles.needChipActive]}
              onPress={() => toggleNeed(need)}
            >
              <Text style={[styles.needText, selectedNeeds.includes(need) && styles.needTextActive]}>{need}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bina bilgisi */}
        <TextInput
          style={styles.input}
          placeholder="Bina bilgisi (kat, daire no, tanımlayıcı özellik)"
          placeholderTextColor={COLORS.grey}
          value={buildingInfo}
          onChangeText={setBuildingInfo}
        />

        {/* Ek mesaj */}
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Ek açıklama (isteğe bağlı)"
          placeholderTextColor={COLORS.grey}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={3}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  content: { padding: 20, paddingTop: 60 },
  sosButton: {
    backgroundColor: COLORS.danger, borderRadius: 24, padding: 40,
    alignItems: 'center', marginBottom: 20,
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  sosButtonSending: { opacity: 0.7 },
  sosIcon: { fontSize: 56, marginBottom: 12 },
  sosText: { fontSize: 24, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  sosSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  locationInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, marginBottom: 20,
  },
  locationIcon: { fontSize: 16, marginRight: 8 },
  locationText: { fontSize: 14, color: COLORS.grey, fontFamily: 'monospace' },
  formSection: { marginTop: 8 },
  formTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  label: { fontSize: 15, color: COLORS.white, marginBottom: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterBtn: { backgroundColor: 'rgba(255,255,255,0.1)', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  counterText: { color: COLORS.white, fontSize: 20, fontWeight: '700' },
  counterValue: { color: COLORS.white, fontSize: 20, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleText: { color: COLORS.white, fontSize: 14 },
  needsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  needChip: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  needChipActive: { backgroundColor: COLORS.primary },
  needText: { color: COLORS.grey, fontSize: 13 },
  needTextActive: { color: COLORS.white },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14,
    fontSize: 14, color: COLORS.white, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
});

export default SOSScreen;
