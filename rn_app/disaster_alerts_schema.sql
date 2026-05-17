-- 8. DISASTER ALERTS TABLE (Kriz Masası Uyarı Sistemi)
-- Web panelinden gönderilir, mobil uygulamaya gerçek zamanlı iletilir
CREATE TABLE public.disaster_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('FIRE', 'FLOOD', 'EARTHQUAKE')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    is_active BOOLEAN DEFAULT true,
    created_by TEXT DEFAULT 'crisis_desk',
    extra_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Herkes okuyabilsin (mobil kullanıcılar)
ALTER TABLE public.disaster_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read disaster alerts" ON public.disaster_alerts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert disaster alerts" ON public.disaster_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update disaster alerts" ON public.disaster_alerts FOR UPDATE USING (true);

-- Realtime bu tablo için aktif olsun
ALTER TABLE public.disaster_alerts REPLICA IDENTITY FULL;
