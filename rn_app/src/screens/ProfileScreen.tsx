import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../services/supabase';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [knowsFirstAid, setKnowsFirstAid] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Kullanıcı oturumu bulunamadı.');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setEmail(data.email || session.user.email || '');
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
        setKnowsFirstAid(data.knows_first_aid || false);
      }
    } catch (error: any) {
      Alert.alert('Hata', 'Profil bilgileri yüklenirken bir sorun oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Kullanıcı oturumu bulunamadı.');

      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        email: email, // Email genelde değişmez ama upsert için koyuyoruz
        full_name: fullName,
        phone: phone,
        address: address,
        knows_first_aid: knowsFirstAid,
        last_active_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (error) throw error;

      Alert.alert('Başarılı', 'Profil bilgileriniz başarıyla güncellendi.');
    } catch (error: any) {
      Alert.alert('Hata', 'Güncelleme başarısız oldu: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkış Yap', 
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 10, color: '#64748B' }}>Profil yükleniyor...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profilim</Text>
          <Text style={styles.subtitle}>Kişisel ve acil durum bilgilerinizi güncelleyin</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>E-posta Adresi</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={email}
            editable={false} // E-posta değiştirilemez
            selectTextOnFocus={false}
          />

          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Örn: Ahmet Yılmaz"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Telefon Numarası</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="05XX XXX XX XX"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Yaşadığınız Adres</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={address}
            onChangeText={setAddress}
            placeholder="Açık adresiniz..."
            placeholderTextColor="#94A3B8"
            multiline={true}
            numberOfLines={4}
          />

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.labelSwitch}>İlk Yardım Eğitimi</Text>
              <Text style={styles.hintText}>Sertifikalı ilk yardım eğitimiz var mı?</Text>
            </View>
            <Switch
              value={knowsFirstAid}
              onValueChange={setKnowsFirstAid}
              trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
              thumbColor={'#FFF'}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={updateProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Bilgileri Kaydet</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 16,
  },
  disabledInput: {
    backgroundColor: '#E2E8F0',
    color: '#64748B',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  labelSwitch: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
