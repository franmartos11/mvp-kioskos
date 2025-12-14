-- 1. Create categories table first!
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kiosk_id UUID REFERENCES public.kiosks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kiosk_id, name)
);

-- 2. Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view categories of their kiosk" ON public.categories;
CREATE POLICY "Users can view categories of their kiosk" ON public.categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.kiosk_members 
      WHERE kiosk_members.user_id = auth.uid() 
      AND kiosk_members.kiosk_id = categories.kiosk_id
    )
  );

DROP POLICY IF EXISTS "Owners can manage categories" ON public.categories;
CREATE POLICY "Owners can manage categories" ON public.categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.kiosk_members 
      WHERE kiosk_members.user_id = auth.uid() 
      AND kiosk_members.kiosk_id = categories.kiosk_id
      AND kiosk_members.role = 'owner'
    )
  );

-- 3. Add Foreign Key column to products safely
DO $$ 
BEGIN
    -- Add column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
        ALTER TABLE public.products ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
    END IF;
END $$;
