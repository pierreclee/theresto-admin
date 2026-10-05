-- Script de migration SQL pour Supabase (PostgreSQL)
-- Ce script crée la structure de base nécessaire pour que le panel d'administration fonctionne.

-- 1. Activer l'extension pour les UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Configuration Globale
CREATE TABLE IF NOT EXISTS public.app_config (
    id text PRIMARY KEY,
    commission_rate numeric NOT NULL DEFAULT 5,
    currency text NOT NULL DEFAULT 'EUR',
    maintenance_mode boolean NOT NULL DEFAULT false,
    updated_at timestamp with time zone,
    updated_by text
);

-- Insérer la ligne de config par défaut
INSERT INTO public.app_config (id, commission_rate, currency, maintenance_mode) 
VALUES ('global', 5, 'EUR', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Restaurants
CREATE TABLE IF NOT EXISTS public.restaurants (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    address text,
    description text,
    establishment_type text,
    cuisine_types text[],
    main_photo_url text,
    latitude numeric,
    longitude numeric,
    status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'suspended'
    subscription_plan text DEFAULT 'free', -- 'free', 'croissance', 'liberte', 'premium'
    commission_rate numeric DEFAULT 5,
    correction_mode text,
    moderation_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 4. Utilisateurs (Profils publics liés à auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid REFERENCES auth.users(id) PRIMARY KEY,
    email text NOT NULL,
    name text,
    phone_number text,
    photo_url text,
    roles text[] DEFAULT '{"customer"}',
    restaurant_id uuid REFERENCES public.restaurants(id),
    loyalty_points integer DEFAULT 0,
    lifetime_points integer DEFAULT 0,
    moderation_status text DEFAULT 'active', -- 'active', 'suspended', 'banned'
    moderation_reason text,
    moderated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. Statistiques utilisateurs (CRM)
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id uuid REFERENCES public.users(id) PRIMARY KEY,
    total_orders integer DEFAULT 0,
    total_spent numeric DEFAULT 0,
    no_show_count integer DEFAULT 0,
    average_rating numeric
);

-- 6. Réservations
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id),
    restaurant_id uuid REFERENCES public.restaurants(id),
    status text,
    guests integer,
    booking_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 7. Restaurants favoris
CREATE TABLE IF NOT EXISTS public.favorite_restaurants (
    user_id uuid REFERENCES public.users(id),
    restaurant_id uuid REFERENCES public.restaurants(id),
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (user_id, restaurant_id)
);

-- 8. Logs d'audit
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    action text NOT NULL,
    target_id text, -- Peut être un UUID ou autre ID
    details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    created_by text
);

-- 9. Sécurité (RLS - Row Level Security)
-- Note : L'application Admin TheResto utilise la clé SERVICE_ROLE_KEY dans ses Server Actions.
-- Les politiques RLS suivantes sont un exemple pour protéger les données si d'autres clients (ex: App Mobile) y accèdent.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Autoriser la lecture publique de la config
CREATE POLICY "Config est publique en lecture" ON public.app_config FOR SELECT USING (true);

-- (Optionnel) Ajouter d'autres politiques pour vos autres clients (utilisateurs mobiles, restaurateurs, etc.)
