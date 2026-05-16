/**
 * Profil Ekranı
 * Kullanıcı bilgileri, hane yönetimi, ayarlar
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { COLORS } from '../../config/constants';
import { UserProfile } from '../../types';
import { signOut, getCurrentUserId, getUserProfile } from '../../services/authService';

const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const userId = await getCurrentUserId();
    if (userId) {
      const data = await getUserProfile(userId);
      setProfile(data);
    }
  };

  const handleLogout = () => {
    Alert.alert('Çıkış', 'Oturumu kapatmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => { await signOut(); navigation.replace('Auth'); } },
    ]);
  };

  /** Menü öğesi bileşeni */
  const MenuItem = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profil kartı */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || '?'}</Text>
        </View>
        <Text style={styles.userName}>{profile?.full_name || 'Kullanıcı'}</Text>
        <Text style={styles.userEmail}>{profile?.email || ''}</Text>
        {profile?.blood_type && (
          <View style={styles.bloodBadge}>
            <Text style={styles.bloodText}>🩸 {profile.blood_type}</Text>
          </View>
        )}
      </View>

      {/* Menü */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Hesap</Text>
        <MenuItem icon="👤" label="Profili Düzenle" onPress={() => {}} />
        <MenuItem icon="👨‍👩‍👧‍👦" label="Hane Yönetimi" onPress={() => {}} />
        <MenuItem icon="🔔" label="Bildirim Ayarları" onPress={() => {}} />
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Afet Hazırlığı</Text>
        <MenuItem icon="🏥" label="İlk Yardım Rehberi" onPress={() => {}} />
        <MenuItem icon="🏢" label="Bina Risk Sorgula" onPress={() => {}} />
        <MenuItem icon="📋" label="Acil Durum Çantası" onPress={() => {}} />
        <MenuItem icon="👁️" label="Gözlemci Ağı" onPress={() => {}} />
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Sistem</Text>
        <MenuItem icon="📡" label="Mesh Ağı Ayarları" onPress={() => {}} />
        <MenuItem icon="💾" label="Offline Veri Yönetimi" onPress={() => {}} />
        <MenuItem icon="🔋" label="Pil Tasarrufu" onPress={() => {}} />
        <MenuItem icon="ℹ️" label="Hakkında" onPress={() => {}} />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  content: { paddingTop: 60 },
  profileCard: {
    alignItems: 'center', paddingVertical: 30, marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, marginBottom: 24,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: COLORS.white },
  userName: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  userEmail: { fontSize: 14, color: COLORS.grey, marginTop: 4 },
  bloodBadge: { backgroundColor: 'rgba(211,47,47,0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  bloodText: { fontSize: 13, color: COLORS.danger },
  menuSection: { marginHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.grey, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 15, color: COLORS.white },
  menuArrow: { fontSize: 20, color: COLORS.grey },
  logoutButton: {
    marginHorizontal: 20, marginTop: 12, padding: 16,
    backgroundColor: 'rgba(211,47,47,0.1)', borderRadius: 12, alignItems: 'center',
  },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: '600' },
});

export default ProfileScreen;
