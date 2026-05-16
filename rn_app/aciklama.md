# Afet Yönetimi Uygulaması Mimari ve Kurulum Özeti

Bu proje Expo Managed Workflow kullanılarak geliştirilmiştir. Uygulamanın amacı, internet kesintilerinde lokal veritabanı ile çalışmaya devam edebilmek ve internet tekrar geldiğinde merkezi sunucu (Supabase) ile veri eşitlemesi yapabilmektir.

## 1. Teknolojiler
- **React Native (Expo Managed Workflow):** Native kod müdahalesi gerektirmeyen, hızlı geliştirme sunan framework.
- **Expo Network:** Cihazın internet bağlantı durumunu anlık olarak dinler.
- **Expo SQLite:** İnternetsiz çalışma ve lokal önbellekleme için kullanılan ana veritabanı teknolojisi (WatermelonDB kullanılmadı).
- **Supabase:** Uzak veritabanı. Toplanma alanları ve ilk yardım bilgileri gibi ana verileri tutar, PostGIS ile konum bazlı işlemler için uygundur.

## 2. Mimari Yapı
Proje modüler bir dizin yapısına sahiptir (`src/` altında toplanmıştır):

- `/components`: Arayüzde tekrar kullanılabilecek buton, kart, mesaj balonu gibi UI bileşenleri.
- `/screens`: `HomeScreen` (Toplanma alanları/harita vb.) ve `ChatScreen` (İnternetsiz/İnternetli mesajlaşma) gibi ana sayfalar.
- `/services`: 
  - `db.ts`: `expo-sqlite` kurulumu ve lokal veritabanı işlemleri.
  - `supabase.ts`: Supabase istemci kurulumu.
  - `network.ts`: İnternet durumunun dinlenmesi, online olduğunda Supabase ile `expo-sqlite` arasındaki senkronizasyon mantığı.
- `/navigation`: React Navigation kullanarak sayfa yönlendirmeleri (`AppNavigator.tsx`).
- `App.tsx`: Tüm bileşenleri birleştiren ana giriş noktası.

## 3. Çalışma Mantığı ve Çevrimdışı (Offline) Senaryosu
1. Uygulama açıldığında `expo-network` ile internet durumu kontrol edilir.
2. İnternet varsa, Supabase'den güncel veriler (`gathering_points`, `first_aid_info`) çekilir ve SQLite içine (`expo-sqlite`) kaydedilir.
3. Cihaz offline olduğunda (veya internet yokken), arayüz tamamen SQLite'tan beslenir. Atılan mesajlar "bekliyor/offline" etiketiyle SQLite'a yazılır.
4. İnternet tekrar geldiğinde `services/network.ts` (sync mekanizması) devreye girer, SQLite içindeki henüz gönderilmemiş mesajları bulur ve Supabase'e yazar, Supabase'deki yeni mesajları SQLite'a indirir.

## 4. Güvenlik
Supabase tabloları ve RLS (Row Level Security) ayarları `supabase_schema.sql` dosyasında listelenmiştir. Her tablo için yalnızca gerekli izinler (herkes okuyabilir/mesaj atabilir, admin veri ekleyebilir) oluşturulmuştur.

## 5. Kurulum & Çalıştırma
Projeyi çalıştırmak için:
```bash
npm install
npx expo start
```
