-- Afet Yönetimi Uygulaması Supabase SQL Şeması
-- PostGIS eklentisinin aktif olduğundan emin olun (Database -> Extensions -> postgis)

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. MESSAGES TABLE
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_name TEXT NOT NULL,
    text TEXT,
    location geometry(Point, 4326),
    status TEXT DEFAULT 'sent', -- 'sent', 'synced'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_offline BOOLEAN DEFAULT false
);

-- RLS (Row Level Security) for Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Herkes mesaj okuyabilir (Afet durumunda genel iletişim)
CREATE POLICY "Anyone can read messages" 
ON public.messages 
FOR SELECT 
USING (true);

-- Herkes mesaj gönderebilir
CREATE POLICY "Anyone can insert messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (true);

-- 2. GATHERING POINTS TABLE (Toplanma Alanları)
CREATE TABLE public.gathering_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    capacity INT,
    location geometry(Point, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Gathering Points
ALTER TABLE public.gathering_points ENABLE ROW LEVEL SECURITY;

-- Herkes toplanma alanlarını okuyabilir
CREATE POLICY "Anyone can read gathering points" 
ON public.gathering_points 
FOR SELECT 
USING (true);

-- Sadece yetkililer ekleme yapabilir (Şimdilik insert kapalı veya admin role)
CREATE POLICY "Only admins can insert gathering points" 
ON public.gathering_points 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role'); -- admin yetkisi örneklemi

-- 3. FIRST AID INFO TABLE (İlk Yardım Bilgileri)
CREATE TABLE public.first_aid_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for First Aid Info
ALTER TABLE public.first_aid_info ENABLE ROW LEVEL SECURITY;

-- Herkes ilk yardım bilgilerini okuyabilir
CREATE POLICY "Anyone can read first aid info" 
ON public.first_aid_info 
FOR SELECT 
USING (true);

-- SPATIAL INDEXES for Map Queries
CREATE INDEX messages_location_idx ON public.messages USING GIST (location);
CREATE INDEX gathering_points_location_idx ON public.gathering_points USING GIST (location);

-- 4. EMERGENCY REPORTS TABLE (Acil Durum Bildirimleri)
CREATE TABLE public.emergency_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status_type TEXT NOT NULL, -- 'SAFE' or 'TRAPPED'
    location geometry(Point, 4326),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_offline BOOLEAN DEFAULT false
);

-- RLS for Emergency Reports
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;

-- Herkes raporları okuyabilir (veya sadece yetkililer okusun istenebilir, şimdilik public)
CREATE POLICY "Anyone can read emergency reports" 
ON public.emergency_reports 
FOR SELECT 
USING (true);

-- Herkes rapor gönderebilir
CREATE POLICY "Anyone can insert emergency reports" 
ON public.emergency_reports 
FOR INSERT 
WITH CHECK (true);

CREATE INDEX emergency_reports_location_idx ON public.emergency_reports USING GIST (location);

-- 5. PROFILES TABLE (Kullanıcı Profilleri ve Zombi Telefon Takibi)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    address TEXT,
    knows_first_aid BOOLEAN DEFAULT false,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. HOUSEHOLDS TABLE (Haneler)
CREATE TABLE public.households (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view households they belong to" ON public.households 
FOR SELECT USING (true);
CREATE POLICY "Users can create households" ON public.households FOR INSERT WITH CHECK (true);

-- 7. HOUSEHOLD MEMBERS TABLE (Hane Üyeleri ve Çift Taraflı Onay)
CREATE TABLE public.household_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(household_id, user_id)
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view members of their households" ON public.household_members 
FOR SELECT USING (true);
CREATE POLICY "Admins can add members" ON public.household_members 
FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own status" ON public.household_members 
FOR UPDATE USING (true);
CREATE POLICY "Admins can delete members" ON public.household_members 
FOR DELETE USING (true);

-- Gerekli tablo güncellemeleri
ALTER TABLE public.emergency_reports ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
