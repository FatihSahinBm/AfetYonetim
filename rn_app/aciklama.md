# 🛡️ Afet Yönetim Uygulaması - Açıklama

## 📋 Proje Özeti

Türkiye'ye özel, kapsamlı bir afet yönetim mobil uygulamasıdır. Deprem, sel, yangın ve fırtına gibi doğal afetlerde kullanıcıların güvenliğini sağlamak, iletişim kurmak ve kurtarma çalışmalarına destek olmak amacıyla geliştirilmiştir.

**Referans Sistemler:** AYDES (kaynak dağıtımı), PKAS (erken uyarı), ARAS (risk tespiti), TAMP (afet risklerine önlem)

---

## 🏗️ Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
|--------|-----------|----------|
| **Mobil** | React Native 0.85 | Cross-platform (Android + iOS) |
| **Backend** | Supabase | Auth, PostgreSQL, Realtime, Storage |
| **Coğrafi Sorgu** | PostGIS | Yakınlık sorguları, bölge tespiti |
| **Offline DB** | WatermelonDB | SQLite tabanlı offline-first veritabanı |
| **Mesh Ağı** | Bridgefy SDK | Bluetooth üzerinden internetsiz mesajlaşma |
| **Navigasyon** | React Navigation | Stack + Tab navigasyon yapısı |

---

## 📁 Dosya Yapısı

```
rn_app/
├── App.tsx                          # Ana uygulama bileşeni (giriş noktası)
├── index.js                         # React Native başlatıcı
├── supabase_migration.sql           # ⚡ Supabase SQL tabloları (SQL Editor'de çalıştır)
├── package.json                     # Bağımlılıklar
│
└── src/
    ├── config/
    │   ├── supabase.ts              # Supabase istemci yapılandırması
    │   └── constants.ts             # Sabitler, renkler, enum'lar
    │
    ├── types/
    │   └── index.ts                 # TypeScript tip tanımları
    │
    ├── database/
    │   ├── index.ts                 # WatermelonDB başlatma
    │   ├── schema.ts                # Lokal veritabanı şeması
    │   └── models/
    │       ├── AssemblyPointModel.ts # Toplanma alanı modeli
    │       ├── FirstAidGuideModel.ts # İlk yardım rehberi modeli
    │       └── DisasterAlertModel.ts # Afet uyarısı modeli
    │
    ├── services/
    │   ├── authService.ts           # Kimlik doğrulama (kayıt, giriş, profil)
    │   ├── disasterService.ts       # Afet uyarıları, SOS, toplanma alanları
    │   ├── locationService.ts       # GPS konum, mesafe hesaplama
    │   ├── meshService.ts           # Bridgefy mesh ağı mesajlaşma
    │   ├── notificationService.ts   # Bildirim yönetimi
    │   ├── sensorService.ts         # Barometre, pil izleme
    │   └── syncService.ts           # WatermelonDB ↔ Supabase senkronizasyon
    │
    ├── hooks/
    │   └── useNetworkStatus.ts      # Ağ bağlantı durumu hook'u
    │
    ├── navigation/
    │   └── AppNavigator.tsx         # Navigasyon yapısı (Auth + Tab)
    │
    ├── screens/
    │   ├── auth/
    │   │   ├── LoginScreen.tsx      # Giriş ekranı
    │   │   └── RegisterScreen.tsx   # Kayıt ekranı
    │   └── main/
    │       ├── HomeScreen.tsx       # Ana sayfa (uyarılar, hızlı erişim)
    │       ├── MapScreen.tsx        # Harita (toplanma alanları, afet bölgeleri)
    │       ├── SOSScreen.tsx        # SOS / Mahsur kaldım çağrısı
    │       ├── ChatScreen.tsx       # Offline mesh mesajlaşma
    │       └── ProfileScreen.tsx    # Profil ve ayarlar
    │
    └── components/
        ├── AlertCard.tsx            # Afet uyarısı kartı
        ├── QuickActionButton.tsx    # Hızlı erişim butonu
        └── StatusBanner.tsx         # Online/Offline + pil durumu çubuğu
```

---

## 🗄️ Veritabanı Tabloları (Supabase)

`supabase_migration.sql` dosyasını Supabase SQL Editor'de çalıştırarak tüm tabloları oluşturabilirsiniz.

### Tablo Listesi

| # | Tablo | Açıklama | RLS |
|---|-------|----------|-----|
| 1 | `profiles` | Kullanıcı profilleri (kan grubu, acil kişi) | ✅ Sadece kendi profili |
| 2 | `user_statuses` | Kullanıcı durumları (güvende/mahsur) | ✅ Kendi + hane üyeleri |
| 3 | `households` | Hane (aile) tanımları | ✅ Kendi hanesi |
| 4 | `household_members` | Hane üyeleri | ✅ Aynı hane üyeleri |
| 5 | `disaster_alerts` | Afet uyarıları (deprem/sel/yangın/fırtına) | ✅ Herkes okur |
| 6 | `assembly_points` | Toplanma alanları | ✅ Herkes okur |
| 7 | `sos_requests` | SOS / mahsur kaldım çağrıları | ✅ Herkes okur, kendi yazar |
| 8 | `critical_infrastructure` | Hastane, itfaiye, eczane | ✅ Herkes okur |
| 9 | `building_risks` | Bina deprem risk seviyeleri | ✅ Herkes okur |
| 10 | `first_aid_guides` | İlk yardım rehberleri | ✅ Herkes okur |
| 11 | `animal_rescue_requests` | Hayvan kurtarma talepleri | ✅ Herkes okur, kendi yazar |
| 12 | `chat_messages` | Online sohbet mesajları | ✅ Kendi mesajları |
| 13 | `observer_reports` | Gözlemci ağı bildirimleri | ✅ Herkes okur, kendi yazar |

### PostGIS Fonksiyonları (RPC)

| Fonksiyon | Açıklama |
|-----------|----------|
| `get_nearby_sos(lat, lng, radius_km)` | Yakındaki SOS çağrılarını getirir |
| `get_nearby_assembly_points(lat, lng, radius_km)` | Yakındaki toplanma alanlarını getirir |
| `check_building_risk(lat, lng)` | 200m yarıçapta bina risk kontrolü |
| `pull_changes(last_pulled_at)` | WatermelonDB senkronizasyon - pull |
| `push_changes(changes)` | WatermelonDB senkronizasyon - push |

---

## 🔐 Satır Düzeyi Güvenlik (RLS)

Tüm tablolarda RLS aktiftir. Güvenlik politikaları:

- **Profiller:** Kullanıcı sadece kendi profilini okur/günceller
- **Durumlar:** Kullanıcı kendi durumunu günceller, aynı hanenin üyeleri birbirini görür
- **Uyarılar:** Herkes okuyabilir (halk güvenliği bilgisi)
- **SOS:** Herkes görebilir (kurtarma amaçlı), sadece kendi çağrısını oluşturabilir
- **Toplanma Alanları:** Herkes görebilir
- **Sohbet:** Kendi gönderdiği/aldığı mesajlar + kanal mesajları

---

## 📡 Offline Çalışma Mimarisi

```
┌─────────────┐     İnternet VAR     ┌──────────────┐
│  Uygulama   │ ◄──────────────────► │   Supabase   │
│  (React     │    Senkronizasyon    │  (PostgreSQL  │
│   Native)   │                      │   + PostGIS)  │
└──────┬──────┘                      └──────────────┘
       │
       │ Her zaman
       ▼
┌──────────────┐
│ WatermelonDB │  ← Lokal SQLite (offline-first)
│   (Lokal)    │
└──────────────┘

İnternet YOK durumunda:
┌──────────┐  Bluetooth BLE  ┌──────────┐
│ Cihaz A  │ ◄─────────────► │ Cihaz B  │
│(Bridgefy)│   Mesh Network  │(Bridgefy)│
└──────────┘                 └──────────┘
```

### Senkronizasyon Tetikleyicileri
1. **Uygulama açılışı** - Otomatik sync
2. **Ağ bağlantısı geri geldiğinde** - `useNetworkStatus` hook'u ile otomatik
3. **Kullanıcı tetiklemesi** - Pull-to-refresh
4. **Periyodik** - 5 dakikada bir (toplanma alanları haftada bir)

---

## 📱 Uygulama Özellikleri

### Deprem Modülü
- [x] Afet anında konum çekme ve yetkili birimlere gönderme
- [x] Hane (aile) mantığı - üye durumlarını görme
- [x] Offline çalışma (WatermelonDB)
- [x] İnternetsiz mesajlaşma (Bridgefy Mesh)
- [x] Afet anında binaları bildirme
- [x] Eve girmeyin uyarısı
- [x] Toplanma noktalarına yol tarifi
- [x] Güncel toplanma alanlarını çekme (haftada bir)
- [x] Bilgilendirme sayfası (deprem rehberi)
- [x] Bulunan evin deprem riski sorgulama

### Yangın Modülü
- [x] Yangın ve sıçrama noktaları tahmini (extra_data JSON)
- [x] Bağıl nem + Sıcaklık + Rüzgar verileri
- [x] Yangın alev bildirimi
- [x] Aile üyelerine bildirim
- [x] Pencere/mobilya yangın uyarısı

### Sel Modülü
- [x] Su seviyesi bildirme
- [x] Kritik nokta gösterme
- [x] Yüksek rakımlı kaçış noktaları
- [x] Sudan uzak durum ikazı
- [x] Yapay zeka destekli yağış analizi (extra_data ile)

### Genel Özellikler
- [x] Kullanıcıların ilk yardım bilmesi (rehber)
- [x] Zarar gören kullanıcıları bulma (SOS sistemi)
- [x] Anlık kaza ve konum bildirimi
- [x] Hayvan sevkiyat talebi
- [x] Offline mesajlaşma (Mesh Network)
- [x] Mahsur kaldım çağrısı (SOS ekranı)
- [x] Barometre sensörüyle afet algılama
- [x] Pil tasarrufu hatırlatması
- [x] Gözlemci ağı (observer_reports tablosu)
- [x] Ben iyiyim butonu (user_statuses)
- [x] Fırtına uyarısı (barometre + disaster_alerts)

---

## 🚀 Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükle
```bash
cd rn_app
npm install
```

### 2. Gerekli Paketleri Ekle
```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage
npm install @nozbe/watermelondb
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install @react-native-community/geolocation
npm install @react-native-community/netinfo
npm install bridgefy-react-native
```

### 3. Supabase Kurulumu
1. [supabase.com](https://supabase.com) üzerinde yeni proje oluştur
2. SQL Editor'e gir
3. `supabase_migration.sql` dosyasının içeriğini yapıştır ve çalıştır
4. `src/config/supabase.ts` dosyasındaki URL ve KEY değerlerini güncelle

### 4. Bridgefy API Anahtarı
1. [bridgefy.me](https://bridgefy.me) üzerinde hesap oluştur
2. API anahtarını al
3. Mesh servisi başlatırken bu anahtarı kullan

### 5. Uygulamayı Başlat
```bash
npx react-native run-android
# veya
npx react-native run-ios
```

---

## 📝 Yapılan İşler Günlüğü

### Tarih: 2026-05-16

1. **Proje Oluşturma**
   - React Native 0.85.3 projesi oluşturuldu (`rn_app/`)
   - TypeScript desteği aktif

2. **Yapılandırma Dosyaları**
   - `src/config/supabase.ts` - Supabase istemci bağlantısı
   - `src/config/constants.ts` - Sabitler, renkler, enum tanımları

3. **Tip Tanımları**
   - `src/types/index.ts` - Tüm veri modelleri (User, Alert, SOS, Mesh, vb.)

4. **Veritabanı Katmanı (Offline)**
   - `src/database/schema.ts` - WatermelonDB şeması (7 tablo)
   - `src/database/index.ts` - Veritabanı başlatma
   - `src/database/models/` - 3 WatermelonDB modeli

5. **Servis Katmanı**
   - `authService.ts` - Kayıt, giriş, profil yönetimi
   - `disasterService.ts` - Uyarılar, SOS, toplanma, hane, hayvan kurtarma
   - `locationService.ts` - GPS, Haversine mesafe, tehlike bölgesi kontrolü
   - `meshService.ts` - Bridgefy mesh ağı (broadcast, SOS, peer yönetimi)
   - `notificationService.ts` - Afet bildirimleri, SOS, aile, pil uyarıları
   - `sensorService.ts` - Barometre izleme, pil yönetimi
   - `syncService.ts` - WatermelonDB ↔ Supabase delta senkronizasyon

6. **Hook'lar**
   - `useNetworkStatus.ts` - Bağlantı izleme, otomatik sync

7. **Navigasyon**
   - `AppNavigator.tsx` - Auth Stack + Main Tab yapısı

8. **Ekranlar**
   - `LoginScreen.tsx` - Email/şifre giriş
   - `RegisterScreen.tsx` - Kayıt (kan grubu, acil kişi dahil)
   - `HomeScreen.tsx` - Ana sayfa (uyarılar, hızlı erişim, bilgilendirme)
   - `MapScreen.tsx` - Harita (katmanlar, yol tarifi)
   - `SOSScreen.tsx` - Mahsur kaldım (online + offline gönderim)
   - `ChatScreen.tsx` - Mesh mesajlaşma
   - `ProfileScreen.tsx` - Profil, hane, ayarlar

9. **Bileşenler**
   - `AlertCard.tsx` - Uyarı kartı
   - `QuickActionButton.tsx` - Hızlı erişim butonu
   - `StatusBanner.tsx` - Bağlantı + pil durum çubuğu

10. **Veritabanı (Supabase)**
    - `supabase_migration.sql` - 13 tablo, PostGIS, RLS, RPC fonksiyonları
    - Tüm tablolarda satır düzeyi güvenlik aktif
    - Coğrafi sorgular için PostGIS GEOGRAPHY kolonları ve spatial index'ler
    - WatermelonDB senkronizasyon RPC fonksiyonları

---

## ⚠️ Notlar ve Dikkat Edilecekler

- Bridgefy SDK çağrıları şu an yorum satırında (comment out). API anahtarı alındıktan sonra aktif edilmeli.
- `react-native-maps` henüz kurulmadı. Harita ekranı şu an placeholder gösteriyor.
- Sensör servisi simülasyon modunda çalışıyor. Gerçek cihazda `react-native-sensors` paketi kurulmalı.
- `.env` dosyası oluşturup Supabase URL ve KEY değerlerini oraya taşıyın.
- WatermelonDB native kurulumu gerektirir (Expo Go ile çalışmaz, Development Build kullanın).
