import * as SQLite from 'expo-sqlite';

/**
 * expo-sqlite Veritabanı Servisi
 * Uygulamanın offline (çevrimdışı) çalışabilmesi için verilerin lokalde saklanmasını sağlar.
 */

// Veritabanını açıyoruz. Eğer yoksa oluşturur.
export const getDb = async () => {
  return await SQLite.openDatabaseAsync('afet_yonetim.db');
};

/**
 * Gerekli tabloların SQLite üzerinde oluşturulması
 * Messages, GatheringPoints ve FirstAidInfo tabloları lokalde tutulacak.
 */
export const initDb = async () => {
  const db = await getDb();
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_name TEXT NOT NULL,
      text TEXT,
      latitude REAL,
      longitude REAL,
      status TEXT DEFAULT 'pending', -- 'pending' (bekliyor) veya 'synced' (eşleşti)
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gathering_points (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      capacity INTEGER,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS first_aid_info (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      created_at TEXT NOT NULL
    );
  `);
};

/**
 * Mesajı lokal SQLite veritabanına kaydeder.
 */
export const insertLocalMessage = async (
  id: string, 
  sender_name: string, 
  text: string, 
  latitude: number | null, 
  longitude: number | null, 
  status: string, 
  created_at: string
) => {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO messages (id, sender_name, text, latitude, longitude, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, sender_name, text, latitude, longitude, status, created_at]
  );
};

/**
 * Çevrimdışı okuma için lokal mesajları getirir.
 */
export const getLocalMessages = async () => {
  const db = await getDb();
  const allRows = await db.getAllAsync('SELECT * FROM messages ORDER BY created_at DESC');
  return allRows;
};

/**
 * Supabase'e gönderilmemiş olan 'pending' (bekleyen) mesajları getirir.
 */
export const getPendingMessages = async () => {
  const db = await getDb();
  const allRows = await db.getAllAsync("SELECT * FROM messages WHERE status = 'pending'");
  return allRows;
};

/**
 * Mesaj eşleştiğinde durumunu 'synced' yapar.
 */
export const markMessageAsSynced = async (id: string) => {
  const db = await getDb();
  await db.runAsync("UPDATE messages SET status = 'synced' WHERE id = ?", [id]);
};
