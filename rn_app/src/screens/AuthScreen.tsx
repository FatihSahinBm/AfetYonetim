import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Switch } from 'react-native';
import { supabase } from '../services/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [knowsFirstAid, setKnowsFirstAid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Giriş Başarısız', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('Hata', 'Şifreler uyuşmuyor.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('Kayıt Başarısız', error.message);
    } else {
      if (data.user) {
        // Profil tablosuna ekstra bilgileri kaydet
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email,
          full_name: fullName,
          phone: phone,
          address: address,
          knows_first_aid: knowsFirstAid,
          last_active_at: new Date().toISOString()
        });
      }
      Alert.alert('Başarılı', 'Kayıt başarılı! Lütfen giriş yapın.');
      setIsLogin(true);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Afet Yönetimi</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Hesabınıza giriş yapın' : 'Yeni bir hesap oluşturun'}
          </Text>
        </View>

        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          {!isLogin && (
            <>
              <Text style={styles.label}>Ad Soyad</Text>
              <TextInput
                style={styles.input}
                onChangeText={setFullName}
                value={fullName}
                placeholder="Örn: Ahmet Yılmaz"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.label}>Telefon Numarası</Text>
              <TextInput
                style={styles.input}
                onChangeText={setPhone}
                value={phone}
                placeholder="05XX XXX XX XX"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Yaşadığınız Adres</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                onChangeText={setAddress}
                value={address}
                placeholder="Açık adresiniz..."
                placeholderTextColor="#94A3B8"
                multiline={true}
              />
            </>
          )}

          <Text style={styles.label}>E-posta Adresi</Text>
          <TextInput
            style={styles.input}
            onChangeText={(text) => setEmail(text)}
            value={email}
            placeholder="ornek@mail.com"
            placeholderTextColor="#94A3B8"
            autoCapitalize={'none'}
            keyboardType="email-address"
          />

          <Text style={styles.label}>Şifre</Text>
          <TextInput
            style={styles.input}
            onChangeText={(text) => setPassword(text)}
            value={password}
            secureTextEntry={true}
            placeholder="Şifreniz"
            placeholderTextColor="#94A3B8"
            autoCapitalize={'none'}
          />

          {!isLogin && (
            <>
              <Text style={styles.label}>Şifre (Tekrar)</Text>
              <TextInput
                style={styles.input}
                onChangeText={setPasswordConfirm}
                value={passwordConfirm}
                secureTextEntry={true}
                placeholder="Şifrenizi tekrar girin"
                placeholderTextColor="#94A3B8"
                autoCapitalize={'none'}
              />

              <View style={styles.switchRow}>
                <Text style={styles.labelSwitch}>İlk Yardım Eğitimi Aldım</Text>
                <Switch
                  value={knowsFirstAid}
                  onValueChange={setKnowsFirstAid}
                  trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                  thumbColor={'#FFF'}
                />
              </View>
            </>
          )}

          <TouchableOpacity 
            style={styles.mainButton}
            disabled={loading}
            onPress={isLogin ? signInWithEmail : signUpWithEmail}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.mainButtonText}>
                {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity 
          style={styles.switchButton}
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.switchButtonText}>
            {isLogin ? 'Hesabınız yok mu? Kayıt Olun' : 'Zaten hesabınız var mı? Giriş Yapın'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  formContainer: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    maxHeight: '75%', // Sığması için yükseklik limiti
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
    marginBottom: 20,
  },
  mainButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  labelSwitch: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  mainButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
});
