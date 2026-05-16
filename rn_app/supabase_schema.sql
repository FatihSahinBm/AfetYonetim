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
