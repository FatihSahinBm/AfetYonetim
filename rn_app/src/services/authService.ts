/**
 * Kimlik Doğrulama Servisi
 * 
 * Supabase Auth ile kullanıcı kayıt, giriş ve oturum yönetimi.
 * Email/şifre ve telefon doğrulama destekler.
 */

import supabase from '../config/supabase';
import { UserProfile } from '../types';

/**
 * Email ve şifre ile yeni kullanıcı kaydı oluşturur.
 * Kayıt sonrası profiles tablosuna kullanıcı bilgileri eklenir.
 */
export const signUp = async (
  email: string,
  password: string,
  fullName: string,
  phone: string
): Promise<{ user: any; error: string | null }> => {
  try {
    // Supabase Auth ile kullanıcı oluştur
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }

    // Profil tablosuna kullanıcı bilgilerini ekle
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email,
          full_name: fullName,
          phone,
        });

      if (profileError) {
        console.error('[Auth] Profil oluşturma hatası:', profileError.message);
      }
    }

    return { user: data.user, error: null };
  } catch (err: any) {
    return { user: null, error: err.message };
  }
};

/**
 * Email ve şifre ile giriş yapar.
 */
export const signIn = async (
  email: string,
  password: string
): Promise<{ user: any; error: string | null }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    return { user: data.user, error: null };
  } catch (err: any) {
    return { user: null, error: err.message };
  }
};

/**
 * Oturumu sonlandırır.
 */
export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
};

/**
 * Mevcut oturum bilgisini kontrol eder.
 */
export const getCurrentSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

/**
 * Mevcut kullanıcı ID'sini döndürür.
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  const session = await getCurrentSession();
  return session?.user?.id || null;
};

/**
 * Kullanıcı profilini getirir.
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Auth] Profil çekme hatası:', error.message);
    return null;
  }

  return data as UserProfile;
};

/**
 * Kullanıcı profilini günceller.
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error: string | null }> => {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
};
