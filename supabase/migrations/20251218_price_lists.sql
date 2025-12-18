-- Price Lists Table
create table if not exists public.price_lists (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  kiosk_id uuid references public.kiosks(id) not null,
  name text not null,
  adjustment_percentage numeric not null default 0, -- Can be negative for discounts
  schedule jsonb, -- Array of rules: [{ day: 0-6, start: "HH:MM", end: "HH:MM" }]
  excluded_category_ids uuid[] default array[]::uuid[], -- Array of UUIDs to ignore
  rounding_rule text default 'none', -- 'none', 'nearest_10', 'nearest_50', 'nearest_100'
  is_active boolean default true,
  priority integer default 0
);

-- RLS
alter table public.price_lists enable row level security;

create policy "Users can manage their kiosk price lists" on public.price_lists for all using (
    exists (select 1 from public.kiosk_members 
            where kiosk_members.user_id = auth.uid() 
            and kiosk_members.kiosk_id = price_lists.kiosk_id)
);

-- Index for faster POS lookups
create index if not exists idx_price_lists_kiosk_active on public.price_lists(kiosk_id) where is_active = true;
