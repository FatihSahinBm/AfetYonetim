-- ================================================================
-- AFET YÖNETİM UYGULAMASI - SUPABASE VERİTABANI TABLOLARI
-- ================================================================
-- Bu dosyayı Supabase SQL Editor'de çalıştırın.
-- PostGIS extension'ı etkinleştirilmiş olmalıdır.
-- Satır düzeyi güvenlik (RLS) tüm tablolarda aktiftir.
-- ================================================================

-- ================================================================
-- 0. UZANTILAR (Extensions)
-- ================================================================

-- PostGIS: Coğrafi sorgular için (yakındaki toplanma alanları, SOS vb.)
CREATE EXTENSION IF NOT EXISTS postgis;

-- UUID oluşturma
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. KULLANICI PROFİLLERİ
-- ================================================================
-- Supabase Auth ile entegre çalışır.
-- auth.users tablosuna foreign key ile bağlıdır.

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    blood_type TEXT,                          -- Kan grubu (A+, B-, O+ vb.)
    emergency_contact_name TEXT,              -- Acil durum kişisi adı
    emergency_contact_phone TEXT,             -- Acil durum kişisi telefonu
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Kullanıcılar sadece kendi profillerini görebilir ve düzenleyebilir
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ================================================================
-- 2. KULLANICI DURUMLARI (Ben iyiyim / Yardım gerekiyor)
-- ================================================================
-- Afet anında kullanıcıların durumlarını ve konumlarını tutar.
-- Aile üyeleri birbirlerinin durumunu görebilir.

CREATE TABLE IF NOT EXISTS user_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (status IN ('safe', 'need_help', 'trapped', 'unknown')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326),         -- PostGIS konum
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)                           -- Her kullanıcının tek bir durumu olur
);

-- Konum otomatik güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_user_status_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_status_location
    BEFORE INSERT OR UPDATE ON user_statuses
    FOR EACH ROW EXECUTE FUNCTION update_user_status_location();

-- RLS: Kendi durumunu yönetebilir, aynı hanedeki üyelerin durumunu görebilir
ALTER TABLE user_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_statuses_select" ON user_statuses
    FOR SELECT USING (
        auth.uid() = user_id
        OR user_id IN (
            SELECT hm2.user_id FROM household_members hm1
            JOIN household_members hm2 ON hm1.household_id = hm2.household_id
            WHERE hm1.user_id = auth.uid()
        )
    );

CREATE POLICY "user_statuses_upsert_own" ON user_statuses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_statuses_update_own" ON user_statuses
    FOR UPDATE USING (auth.uid() = user_id);

-- ================================================================
-- 3. HANE (AİLE) YÖNETİMİ
-- ================================================================

-- Hane tablosu
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,         -- 6 haneli davet kodu
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hane üyeleri tablosu
CREATE TABLE IF NOT EXISTS household_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(household_id, user_id)            -- Aynı kişi aynı haneye iki kez eklenemez
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Hane: Üyeler kendi hanelerini görebilir
CREATE POLICY "households_select" ON households
    FOR SELECT USING (
        owner_id = auth.uid()
        OR id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
    );

CREATE POLICY "households_insert" ON households
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Hane Üyeleri: Aynı hanenin üyeleri birbirini görebilir
CREATE POLICY "household_members_select" ON household_members
    FOR SELECT USING (
        household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "household_members_insert" ON household_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        OR household_id IN (
            SELECT id FROM households WHERE owner_id = auth.uid()
        )
    );

-- ================================================================
-- 4. AFET UYARILARI
-- ================================================================
-- Deprem, sel, yangın, fırtına uyarılarını tutar.
-- PostGIS ile coğrafi sorgulama yapılabilir.

CREATE TABLE IF NOT EXISTS disaster_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL
        CHECK (type IN ('earthquake', 'flood', 'fire', 'storm', 'landslide')),
    severity TEXT NOT NULL
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    radius_km DOUBLE PRECISION NOT NULL DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    source TEXT NOT NULL DEFAULT 'system',    -- AFAD, PKAS, kullanıcı vb.
    extra_data JSONB DEFAULT '{}',           -- Afet türüne özel veriler
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Konum otomatik güncelleme
CREATE OR REPLACE FUNCTION update_alert_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alert_location
    BEFORE INSERT OR UPDATE ON disaster_alerts
    FOR EACH ROW EXECUTE FUNCTION update_alert_location();

-- İndeks: Aktif uyarılarda hızlı sorgulama
CREATE INDEX idx_alerts_active ON disaster_alerts(is_active, created_at DESC);
CREATE INDEX idx_alerts_location ON disaster_alerts USING GIST(location);

ALTER TABLE disaster_alerts ENABLE ROW LEVEL SECURITY;

-- Herkes aktif uyarıları görebilir (herkese açık güvenlik bilgisi)
CREATE POLICY "alerts_select_all" ON disaster_alerts
    FOR SELECT USING (TRUE);

-- Sadece yetkili kullanıcılar uyarı oluşturabilir
CREATE POLICY "alerts_insert_authorized" ON disaster_alerts
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT id FROM profiles WHERE email LIKE '%@afad.gov.tr'
        )
        OR auth.uid() = created_by
    );

-- ================================================================
-- 5. TOPLANMA ALANLARI
-- ================================================================

CREATE TABLE IF NOT EXISTS assembly_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    capacity INTEGER NOT NULL DEFAULT 0,
    current_occupancy INTEGER DEFAULT 0,
    address TEXT NOT NULL,
    district TEXT,                            -- İlçe
    city TEXT NOT NULL,                       -- Şehir
    is_active BOOLEAN DEFAULT TRUE,
    facilities TEXT[] DEFAULT '{}',           -- Olanaklar: WC, su, ilk yardım vb.
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_assembly_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assembly_location
    BEFORE INSERT OR UPDATE ON assembly_points
    FOR EACH ROW EXECUTE FUNCTION update_assembly_location();

CREATE INDEX idx_assembly_location ON assembly_points USING GIST(location);
CREATE INDEX idx_assembly_active ON assembly_points(is_active);

ALTER TABLE assembly_points ENABLE ROW LEVEL SECURITY;

-- Herkes toplanma alanlarını görebilir
CREATE POLICY "assembly_select_all" ON assembly_points
    FOR SELECT USING (TRUE);

-- ================================================================
-- 6. SOS ÇAĞRILARI (Mahsur Kaldım)
-- ================================================================

CREATE TABLE IF NOT EXISTS sos_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'trapped'
        CHECK (status IN ('safe', 'need_help', 'trapped', 'unknown')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    message TEXT,
    people_count INTEGER DEFAULT 1,
    has_injury BOOLEAN DEFAULT FALSE,
    needs TEXT[] DEFAULT '{}',               -- Su, yiyecek, ilk yardım vb.
    building_info TEXT,                      -- Bina bilgisi
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION update_sos_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sos_location
    BEFORE INSERT OR UPDATE ON sos_requests
    FOR EACH ROW EXECUTE FUNCTION update_sos_location();

CREATE INDEX idx_sos_location ON sos_requests USING GIST(location);
CREATE INDEX idx_sos_status ON sos_requests(status, created_at DESC);

ALTER TABLE sos_requests ENABLE ROW LEVEL SECURITY;

-- Herkes SOS çağrılarını görebilir (kurtarma amaçlı)
CREATE POLICY "sos_select_all" ON sos_requests
    FOR SELECT USING (TRUE);

-- Kullanıcı kendi SOS çağrısını oluşturabilir
CREATE POLICY "sos_insert_own" ON sos_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendi çağrısını güncelleyebilir
CREATE POLICY "sos_update_own" ON sos_requests
    FOR UPDATE USING (auth.uid() = user_id);

-- ================================================================
-- 7. KRİTİK ALTYAPI (Hastane, İtfaiye, Eczane vb.)
-- ================================================================

CREATE TABLE IF NOT EXISTS critical_infrastructure (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL
        CHECK (type IN ('hospital', 'fire_station', 'police', 'shelter', 'pharmacy')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    phone TEXT,
    is_operational BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_infra_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_infra_location
    BEFORE INSERT OR UPDATE ON critical_infrastructure
    FOR EACH ROW EXECUTE FUNCTION update_infra_location();

CREATE INDEX idx_infra_location ON critical_infrastructure USING GIST(location);

ALTER TABLE critical_infrastructure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "infra_select_all" ON critical_infrastructure
    FOR SELECT USING (TRUE);

-- ================================================================
-- 8. BİNA RİSK BİLGİLERİ
-- ================================================================

CREATE TABLE IF NOT EXISTS building_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    address TEXT NOT NULL,
    risk_level TEXT NOT NULL
        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    construction_year INTEGER,
    last_inspection TIMESTAMPTZ,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_building_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_building_location
    BEFORE INSERT OR UPDATE ON building_risks
    FOR EACH ROW EXECUTE FUNCTION update_building_location();

CREATE INDEX idx_building_location ON building_risks USING GIST(location);

ALTER TABLE building_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "building_select_all" ON building_risks
    FOR SELECT USING (TRUE);

-- ================================================================
-- 9. İLK YARDIM REHBERLERİ
-- ================================================================

CREATE TABLE IF NOT EXISTS first_aid_guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,                  -- Yanık, kırık, kanama, zehirlenme vb.
    content TEXT NOT NULL,
    steps JSONB DEFAULT '[]',               -- Adım adım talimatlar
    image_urls TEXT[] DEFAULT '{}',
    is_offline_available BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE first_aid_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "first_aid_select_all" ON first_aid_guides
    FOR SELECT USING (TRUE);

-- ================================================================
-- 10. HAYVAN KURTARMA TALEPLERİ
-- ================================================================

CREATE TABLE IF NOT EXISTS animal_rescue_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    animal_type TEXT NOT NULL,               -- Kedi, köpek, kuş vb.
    count INTEGER DEFAULT 1,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_animal_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_animal_location
    BEFORE INSERT OR UPDATE ON animal_rescue_requests
    FOR EACH ROW EXECUTE FUNCTION update_animal_location();

ALTER TABLE animal_rescue_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "animal_select_all" ON animal_rescue_requests
    FOR SELECT USING (TRUE);

CREATE POLICY "animal_insert_own" ON animal_rescue_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 11. SOHBET MESAJLARI (Online)
-- ================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id),
    channel_id TEXT,                          -- Genel kanal veya bölge kanalı
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_channel ON chat_messages(channel_id, created_at DESC);
CREATE INDEX idx_chat_receiver ON chat_messages(receiver_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Kendi mesajlarını ve kendine gelen mesajları görebilir
CREATE POLICY "chat_select" ON chat_messages
    FOR SELECT USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
        OR channel_id IS NOT NULL  -- Kanal mesajları herkese açık
    );

CREATE POLICY "chat_insert_own" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ================================================================
-- 12. GÖZLEMCI AĞI BİLDİRİMLERİ
-- ================================================================

CREATE TABLE IF NOT EXISTS observer_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL
        CHECK (report_type IN ('fire_spotted', 'flood_rising', 'building_damage',
               'road_blocked', 'gas_leak', 'power_outage', 'other')),
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    photo_urls TEXT[] DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_observer_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_observer_location
    BEFORE INSERT OR UPDATE ON observer_reports
    FOR EACH ROW EXECUTE FUNCTION update_observer_location();

CREATE INDEX idx_observer_location ON observer_reports USING GIST(location);

ALTER TABLE observer_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "observer_select_all" ON observer_reports
    FOR SELECT USING (TRUE);

CREATE POLICY "observer_insert_own" ON observer_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 13. PostGIS YARDIMCI FONKSİYONLAR (RPC)
-- ================================================================

-- Yakındaki SOS çağrılarını getir
CREATE OR REPLACE FUNCTION get_nearby_sos(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS SETOF sos_requests AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM sos_requests
    WHERE status IN ('trapped', 'need_help')
      AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_km * 1000  -- Metreye çevir
      )
    ORDER BY ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yakındaki toplanma alanlarını getir
CREATE OR REPLACE FUNCTION get_nearby_assembly_points(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 20
)
RETURNS SETOF assembly_points AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM assembly_points
    WHERE is_active = TRUE
      AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_km * 1000
      )
    ORDER BY ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bina risk kontrolü (en yakın bina risk kaydı)
CREATE OR REPLACE FUNCTION check_building_risk(
    check_lat DOUBLE PRECISION,
    check_lng DOUBLE PRECISION
)
RETURNS building_risks AS $$
DECLARE
    result building_risks;
BEGIN
    SELECT * INTO result
    FROM building_risks
    WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326)::geography,
        200  -- 200 metre yarıçap
    )
    ORDER BY ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326)::geography
    )
    LIMIT 1;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 14. WATERMELONDB SENKRONİZASYON RPC
-- ================================================================

-- Pull: Son çekimden bu yana değişen kayıtları getir
CREATE OR REPLACE FUNCTION pull_changes(
    last_pulled_at TIMESTAMPTZ DEFAULT '1970-01-01'
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    result = jsonb_build_object(
        'changes', jsonb_build_object(
            'assembly_points', jsonb_build_object(
                'created', (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM assembly_points t WHERE t.updated_at > last_pulled_at),
                'updated', '[]'::jsonb,
                'deleted', '[]'::jsonb
            ),
            'first_aid_guides', jsonb_build_object(
                'created', (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM first_aid_guides t WHERE t.updated_at > last_pulled_at),
                'updated', '[]'::jsonb,
                'deleted', '[]'::jsonb
            ),
            'disaster_alerts', jsonb_build_object(
                'created', (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM disaster_alerts t WHERE t.created_at > last_pulled_at),
                'updated', '[]'::jsonb,
                'deleted', '[]'::jsonb
            )
        ),
        'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Push: Lokal değişiklikleri sunucuya uygula
CREATE OR REPLACE FUNCTION push_changes(
    changes JSONB
)
RETURNS VOID AS $$
BEGIN
    -- SOS istekleri push
    IF changes ? 'sos_requests' THEN
        INSERT INTO sos_requests (user_id, user_name, status, latitude, longitude, message, people_count, has_injury, needs, building_info)
        SELECT
            (item->>'user_id')::UUID,
            item->>'user_name',
            item->>'status',
            (item->>'latitude')::DOUBLE PRECISION,
            (item->>'longitude')::DOUBLE PRECISION,
            item->>'message',
            (item->>'people_count')::INTEGER,
            (item->>'has_injury')::BOOLEAN,
            ARRAY(SELECT jsonb_array_elements_text(item->'needs')),
            item->>'building_info'
        FROM jsonb_array_elements(changes->'sos_requests'->'created') AS item
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 15. updated_at OTOMATİK GÜNCELLEME
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tüm tablolara updated_at trigger'ı ekle
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assembly_updated_at BEFORE UPDATE ON assembly_points FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_infra_updated_at BEFORE UPDATE ON critical_infrastructure FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_building_updated_at BEFORE UPDATE ON building_risks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_first_aid_updated_at BEFORE UPDATE ON first_aid_guides FOR EACH ROW EXECUTE FUNCTION update_updated_at();
