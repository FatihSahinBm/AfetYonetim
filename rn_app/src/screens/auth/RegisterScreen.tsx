/**
 * Kayıt Ekranı
 * Yeni kullanıcı kaydı - Supabase Auth ile
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { signUp } from '../../services/authService';
import { COLORS } from '../../config/constants';

const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [loading, setLoading] = useState(false);

  /** Kayıt işlemi */
  const handleRegister = async () => {
    if (!fullName || !email || !password || !phone) {
      Alert.alert('Hata', 'Ad, email, telefon ve şifre zorunludur.');
      return;
    }

    setLoading(true);
    const { user, error } = await signUp(email, password, fullName, phone);
    setLoading(false);

    if (error) {
      Alert.alert('Kayıt Hatası', error);
      return;
    }

    Alert.alert('Başarılı', 'Hesabınız oluşturuldu. Giriş yapabilirsiniz.', [
      { text: 'Tamam', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Kayıt Ol</Text>
      <Text style={styles.subtitle}>Afet anında sizi koruyabilmemiz için bilgilerinizi girin</Text>

      <TextInput style={styles.input} placeholder="Ad Soyad *" placeholderTextColor={COLORS.grey} value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Email *" placeholderTextColor={COLORS.grey} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Telefon *" placeholderTextColor={COLORS.grey} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Şifre *" placeholderTextColor={COLORS.grey} value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Kan Grubu" placeholderTextColor={COLORS.grey} value={bloodType} onChangeText={setBloodType} />
      <TextInput style={styles.input} placeholder="Acil Durum Kişisi Adı" placeholderTextColor={COLORS.grey} value={emergencyName} onChangeText={setEmergencyName} />
      <TextInput style={styles.input} placeholder="Acil Durum Kişisi Telefon" placeholderTextColor={COLORS.grey} value={emergencyPhone} onChangeText={setEmergencyPhone} keyboardType="phone-pad" />

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.linkText}>Zaten hesabınız var mı? Giriş yapın</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.dark },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.white, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.grey, marginBottom: 32 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 16, fontSize: 16,
    color: COLORS.white, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', marginBottom: 12,
  },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  linkText: { color: COLORS.primary, textAlign: 'center', marginTop: 16, fontSize: 14, marginBottom: 40 },
});

export default RegisterScreen;
