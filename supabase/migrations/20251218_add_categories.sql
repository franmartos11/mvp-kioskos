-- Create Categories Table if not exists
create table if not exists public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kiosk_id UUID REFERENCES public.kiosks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kiosk_id, name)
);

-- Enable RLS
alter table public.categories enable row level security;

-- Policy to view categories
create policy "Kiosk Access Categories" on public.categories for all using (
  exists (select 1 from public.kiosk_members 
          where kiosk_members.user_id = auth.uid() 
          and kiosk_members.kiosk_id = categories.kiosk_id)
);

-- Add category_id to products if not exists
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'category_id') then 
        alter table public.products add column category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
    end if; 
end $$;
