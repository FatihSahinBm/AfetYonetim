import * as SQLite from 'expo-sqlite';

/**
 * expo-sqlite Veritabanı Servisi
 * Uygulamanın offline (çevrimdışı) çalışabilmesi için verilerin lokalde saklanmasını sağlar.
 */

// Veritabanını açıyoruz. Eğer yoksa oluşturur.
let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('afet_yonetim.db');
  }
  return dbInstance;
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

    CREATE TABLE IF NOT EXISTS emergency_reports (
      id TEXT PRIMARY KEY,
      status_type TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS household_members (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT,
      full_name TEXT,
      role TEXT,
      status TEXT,
      last_active_at TEXT,
      last_report_status TEXT,
      last_report_time TEXT
    );

    CREATE TABLE IF NOT EXISTS aid_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      full_name TEXT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      helper_id TEXT,
      latitude REAL,
      longitude REAL,
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
    [id ?? '', sender_name ?? 'Anonim', text ?? '', latitude ?? null, longitude ?? null, status ?? 'pending', created_at ?? new Date().toISOString()]
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

/**
 * Acil durum raporunu SQLite'a kaydeder.
 */
export const insertEmergencyReport = async (
  id: string,
  status_type: string,
  latitude: number | null,
  longitude: number | null,
  status: string,
  created_at: string
) => {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO emergency_reports (id, status_type, latitude, longitude, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id ?? '', status_type ?? 'SAFE', latitude ?? null, longitude ?? null, status ?? 'pending', created_at ?? new Date().toISOString()]
  );
};

/**
 * Supabase'e gönderilmemiş olan acil durum raporlarını getirir.
 */
export const getPendingEmergencyReports = async () => {
  const db = await getDb();
  return await db.getAllAsync("SELECT * FROM emergency_reports WHERE status = 'pending'");
};

/**
 * Acil durum raporu eşleştiğinde durumunu 'synced' yapar.
 */
export const markEmergencyReportAsSynced = async (id: string) => {
  const db = await getDb();
  await db.runAsync("UPDATE emergency_reports SET status = 'synced' WHERE id = ?", [id]);
};

/**
 * Hane üyelerini SQLite üzerinde önbelleğe alır. (Çevrimdışı erişim için)
 */
export const cacheHouseholdMembers = async (members: any[]) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM household_members'); // Basit cache mantığı: her seferinde temizle
  
  for (const m of members) {
    await db.runAsync(
      'INSERT INTO household_members (id, household_id, user_id, email, full_name, role, status, last_active_at, last_report_status, last_report_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [m.id ?? '', m.household_id ?? '', m.user_id ?? '', m.email ?? '', m.full_name ?? '', m.role ?? '', m.status ?? '', m.last_active_at ?? '', m.last_report_status ?? '', m.last_report_time ?? '']
    );
  }
};

/**
 * Çevrimdışı modda iken yerel veritabanındaki hane üyelerini getirir.
 */
export const getCachedHouseholdMembers = async () => {
  const db = await getDb();
  return await db.getAllAsync('SELECT * FROM household_members');
};
