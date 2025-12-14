-- ==============================================================================
-- MIGRATION 002: STOCK AUDIT
-- ==============================================================================

-- 1. Create stock_audits table
create table if not exists public.stock_audits (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  kiosk_id uuid references public.kiosks(id) not null,
  performed_by uuid references auth.users(id) not null,
  
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  completed_at timestamp with time zone,
  
  notes text
);

-- 2. Create stock_audit_items table
create table if not exists public.stock_audit_items (
  id uuid default gen_random_uuid() primary key,
  audit_id uuid references public.stock_audits(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  
  expected_stock integer not null, -- Snapshot of what the system thought we had
  counted_stock integer not null,  -- What was actually counted
  difference integer generated always as (counted_stock - expected_stock) stored
);

-- 3. RLS
alter table public.stock_audits enable row level security;
alter table public.stock_audit_items enable row level security;

create policy "Users can view audits of their kiosk"
on public.stock_audits for select
using (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = stock_audits.kiosk_id
  )
);

create policy "Users can insert audits for their kiosk"
on public.stock_audits for insert
with check (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = stock_audits.kiosk_id
  )
);

create policy "Users can update audits for their kiosk"
on public.stock_audits for update
using (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = stock_audits.kiosk_id
  )
);

-- Items policies
create policy "Users can view audit items of their kiosk"
on public.stock_audit_items for select
using (
  exists (
    select 1 from public.stock_audits
    join public.kiosk_members on stock_audits.kiosk_id = kiosk_members.kiosk_id
    where stock_audit_items.audit_id = stock_audits.id
    and kiosk_members.user_id = auth.uid()
  )
);

create policy "Users can insert audit items for their kiosk"
on public.stock_audit_items for insert
with check (
  exists (
    select 1 from public.stock_audits
    join public.kiosk_members on stock_audits.kiosk_id = kiosk_members.kiosk_id
    where stock_audit_items.audit_id = stock_audits.id
    and kiosk_members.user_id = auth.uid()
  )
);

-- 4. RPC: Finish Audit
-- Receives a JSON array of items: [{ product_id: uuid, quantity: int }]
create or replace function public.finish_stock_audit(
  p_audit_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_counted_stock integer;
  v_current_stock integer;
  v_diff integer;
  v_kiosk_id uuid;
  v_status text;
begin
  -- Check audit status
  select status, kiosk_id into v_status, v_kiosk_id
  from public.stock_audits
  where id = p_audit_id;
  
  if v_status != 'in_progress' then
    raise exception 'Audit is not in progress';
  end if;

  -- Iterate items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_counted_stock := (v_item->>'quantity')::integer;
    
    -- Get current expected stock
    select stock into v_current_stock
    from public.products
    where id = v_product_id;
    
    if v_current_stock is null then
        continue; -- Skip if product doesn't exist?
    end if;
    
    v_diff := v_counted_stock - v_current_stock;
    
    -- Record item in audit log
    insert into public.stock_audit_items (audit_id, product_id, expected_stock, counted_stock)
    values (p_audit_id, v_product_id, v_current_stock, v_counted_stock);
    
    -- If there is a difference, make a correction
    if v_diff != 0 then
        -- Use existing RPC for consistency.
        -- Type: 'correction'
        -- Quantity: The diff. If we have 8 but expected 10, diff is -2.
        -- The register_stock_adjustment RPC logic:
        --   if type='correction', v_final_quantity := p_quantity
        -- So we pass -2 directly.
        perform public.register_stock_adjustment(
            v_product_id,
            v_kiosk_id,
            'correction',
            v_diff,
            'Audit Correction',
            'Auto-correction from Audit #' || p_audit_id::text
        );
    end if;
  end loop;

  -- Close the audit
  update public.stock_audits
  set status = 'completed',
      completed_at = now()
  where id = p_audit_id;
  
end;
$$;
