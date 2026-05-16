# 🚨 Afet Yönetimi ve Toplumsal Dayanışma Platformu (MVP)

Bu proje, "Fikirden Ürüne Web Geliştirme Kampı" kapsamında geliştirilmiş, afet öncesi, anı ve sonrasında hayat kurtarmayı hedefleyen **Offline-First (İnternetsiz çalışabilen)** yenilikçi bir afet yönetim ve lojistik koordinasyon platformudur.

## 🌟 Temel Odak Alanları ve Çözümlerimiz

1. **Kriz Yönetimi ve Karar Destek Sistemleri:**
   - **Gerçek Zamanlı Afet Bildirimi:** Kullanıcılar tek tuşla "Güvendeyim" veya "Mahsur Kaldım" bildirimi yapabilir.
   - **Kriz Merkezi Dashboard (Web):** Sahadaki ekiplerin anlık veriyi (enkaz altındaki kişiler, lojistik talepleri) izleyebileceği merkezi bir yönetim paneli.

2. **Lojistik ve Yardım Optimizasyonu:**
   - **Yardım Ağı (İhtiyaç ve Lojistik Haritası):** Afetzedelerin ihtiyaçlarını (Su, Çadır, Gıda vb.) girebildiği, gönüllülerin veya yetkililerin bu görevleri "Üstlenerek" doğrudan hedefe ulaştırdığı optimize edilmiş lojistik modülü.

3. **Toplumsal Dayanışma ve İletişim Ağları:**
   - **Offline-First İletişim:** Altyapı çöktüğünde dahi yerel veritabanında (SQLite) mesajları sıraya alan ve internet bağlantısı yakalandığı an Supabase üzerinden senkronize eden iletişim altyapısı.
   - **Yapay Zeka Afet Asistanı:** İnternetsiz ortamda bile ilk yardım ve kriz yönetimi talimatları veren entegre asistan.
   - **Aile Takip Sistemi (Trafik Lambası):** Çift taraflı onay (Handshake) mimarisiyle çalışan, aile üyelerinin güvende olup olmadığını anlık gösteren sistem.

## 🏗️ Teknik Altyapı ve Mimari

Uygulama modern web/mobil teknolojileri kullanılarak ölçeklenebilir ve açık kaynak standartlarına uygun geliştirilmiştir.

- **Frontend:** React Native & Expo (Web, iOS ve Android platformlarında çapraz platform desteği).
- **Backend & Veritabanı:** Supabase (PostgreSQL, PostGIS, Realtime DB).
- **Lokal Veritabanı (Offline Support):** Expo-SQLite (Veri kaybını önleyen çevrimdışı önbellekleme).
- **Konum ve Navigasyon:** Expo Location, React Native Maps ve Haversine formülü ile matematiksel acil durum rotalandırması.

## 🚀 Kurulum (Local Development)

Projeyi bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

### Gereksinimler
- Node.js (v18+)
- npm veya yarn
- Expo Go (Telefondan test etmek için)

### Adımlar

1. **Depoyu Klonlayın:**
   ```bash
   git clone https://github.com/kullaniciadi/afet-yonetim.git
   cd afet-yonetim/rn_app
   ```

2. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```

3. **Çevresel Değişkenleri Ayarlayın:**
   Proje dizininde bir `.env` dosyası oluşturun ve Supabase anahtarlarınızı girin:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=sizin_supabase_url_adresiniz
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sizin_supabase_anon_key_adresiniz
   ```

4. **Veritabanı Şemasını Yükleyin:**
   `supabase_schema.sql` dosyasının içeriğini Supabase SQL Editor üzerinden çalıştırarak tabloları ve Güvenlik Kurallarını (RLS) oluşturun.

5. **Uygulamayı Başlatın:**
   ```bash
   npx expo start
   ```
   - **Telefonda (Mobil) görmek için:** Terminaldeki QR kodu telefonunuzun kamerasıyla veya Expo Go uygulamasıyla okutun.
   - **Web'de (Yetkili Paneli) görmek için:** Terminalde `w` tuşuna basın.

## 🛡️ Açık Kaynak ve Lisans

Bu proje, afet teknolojileri alanında toplumsal fayda gözetilerek tamamen **Açık Kaynaklı (Open-Source)** olarak geliştirilmiştir. Kodların tamamı şeffaftır ve kopyalanıp geliştirilmeye açıktır. MIT Lisansı ile lisanslanmıştır.
