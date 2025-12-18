-- AFIP Settings Table
create table if not exists public.afip_settings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) not null,
  kiosk_id uuid references public.kiosks(id) not null,
  cuit numeric not null,
  cert_crt text,
  cert_key text,
  point_of_sale integer not null default 1,
  is_production boolean default false,
  unique(kiosk_id)
);

alter table public.afip_settings enable row level security;

-- Policies
create policy "Users can manage their afip settings" on public.afip_settings for all using (
    exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = afip_settings.kiosk_id)
);

-- Add AFIP fields to Sales table
alter table public.sales 
add column if not exists cai text, -- Using CAI/CAE interchangeably in common speech, getting ready for CAE
add column if not exists cae text,
add column if not exists cae_expiration timestamp with time zone,
add column if not exists invoice_type text, -- 'A', 'B', 'C'
add column if not exists invoice_number numeric;
