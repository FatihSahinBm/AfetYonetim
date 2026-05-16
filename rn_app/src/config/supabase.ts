/**
 * Supabase İstemci Yapılandırması
 * 
 * Supabase bağlantısını merkezi olarak yönetir.
 * Tüm API çağrıları bu istemci üzerinden yapılır.
 * Çevresel değişkenler .env dosyasından react-native-config ile okunur.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

// Supabase proje bilgileri .env dosyasından okunur
const SUPABASE_URL = Config.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY || '';

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
