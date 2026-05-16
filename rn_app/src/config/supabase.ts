/**
 * Supabase İstemci Yapılandırması
 * 
 * Supabase bağlantısını merkezi olarak yönetir.
 * Tüm API çağrıları bu istemci üzerinden yapılır.
 * Çevresel değişkenlerden URL ve anon key alır.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase proje bilgileri - .env dosyasından okunmalıdır
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

/**
 * Supabase istemcisini AsyncStorage ile başlatır.
 * Bu sayede oturum bilgileri cihazda kalıcı olarak saklanır.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
