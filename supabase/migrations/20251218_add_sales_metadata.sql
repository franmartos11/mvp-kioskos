-- Add metadata column for storing extra info like active price list
alter table public.sales 
add column if not exists metadata jsonb default '{}'::jsonb;
