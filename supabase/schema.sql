-- =============================================
-- FLASHCARDS AI - SUPABASE SCHEMA
-- Execute este SQL no Supabase Dashboard:
-- Project > SQL Editor > New Query
-- =============================================

-- Tabela de perfis (complementa auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de decks
CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reviewed_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de cards
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY,
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  repetitions INT DEFAULT 0,
  interval_days INT DEFAULT 0,
  ease_factor FLOAT DEFAULT 2.5,
  next_review_at TIMESTAMPTZ,
  reviews INT DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  grade_log JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de revisões de cards (para estatísticas)
CREATE TABLE IF NOT EXISTS public.card_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  deck_id UUID REFERENCES public.decks(id) ON DELETE SET NULL,
  grade INT NOT NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário vê o próprio, admin vê todos
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_admin_select_all" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Decks: usuário gerencia os próprios
CREATE POLICY "decks_own" ON public.decks
  FOR ALL USING (auth.uid() = user_id);

-- Cards: usuário gerencia os próprios
CREATE POLICY "cards_own" ON public.cards
  FOR ALL USING (auth.uid() = user_id);

-- Card reviews: usuário gerencia os próprios
CREATE POLICY "card_reviews_own" ON public.card_reviews
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- TRIGGER: Cria perfil automaticamente no signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- PARA CRIAR O PRIMEIRO ADMIN:
-- Após criar o primeiro usuário pelo app ou Dashboard,
-- execute:
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'seu@email.com';
-- =============================================
