-- ==============================================================================
-- MASTER SCHEMA (CONSOLIDATED)
-- Combined from previous 000 + 001-005 migrations
-- Timestamp: 2025-12-14
-- ==============================================================================

-- ==============================================================================
-- PART 1: BASE SCHEMA
-- ==============================================================================

-- 1. CORE & AUTH
-- ==============================================================================

-- Kiosks Table
create table if not exists public.kiosks (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  owner_id uuid references auth.users(id)
);

-- Kiosk Members (Roles)
create table if not exists public.kiosk_members (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  kiosk_id uuid references public.kiosks(id) not null,
  role text not null check (role in ('owner', 'seller')),
  unique(user_id, kiosk_id)
);

-- RLS: Kiosks & Members
alter table public.kiosks enable row level security;
alter table public.kiosk_members enable row level security;

-- 2. INVENTORY
-- ==============================================================================

-- Products Table
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text,
  price decimal(10,2) not null default 0,
  stock integer not null default 0,
  min_stock integer default 5, -- Low stock alert threshold
  barcode text,
  category text, 
  image_url text,
  cost decimal(10,2) default 0, -- Cost per unit
  kiosk_id uuid references public.kiosks(id),
  
  -- Constraints
  unique(kiosk_id, barcode)
);

-- RLS: Products
alter table public.products enable row level security;

create policy "Users can view products of their kiosk"
on public.products for select
using (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = products.kiosk_id
  )
);

create policy "Users can manage products of their kiosk"
on public.products for all
using (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = products.kiosk_id
  )
);

-- 3. SUPPLIERS
-- ==============================================================================

create table if not exists public.suppliers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  kiosk_id uuid references public.kiosks(id) on delete cascade not null,
  user_id uuid references auth.users(id)
);

alter table public.suppliers enable row level security;

-- 4. SALES (POS)
-- ==============================================================================

create table if not exists public.sales (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  total decimal(10,2) not null default 0,
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'other')),
  kiosk_id uuid references public.kiosks(id),
  user_id uuid references auth.users(id)
);

create table if not exists public.sale_items (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null,
  unit_price decimal(10,2) not null,
  subtotal decimal(10,2) not null
);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- 5. CASH REGISTER (SESSIONS & MOVEMENTS)
-- ==============================================================================

create table if not exists public.cash_sessions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  kiosk_id uuid references public.kiosks(id) not null,
  user_id uuid references auth.users(id) not null,
  
  opened_at timestamp with time zone default timezone('utc'::text, now()) not null,
  closed_at timestamp with time zone,
  
  initial_cash decimal(12,2) not null default 0,
  final_cash decimal(12,2),
  expected_cash decimal(12,2),
  difference decimal(12,2),
  
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text
);

create table if not exists public.cash_movements (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  cash_session_id uuid references public.cash_sessions(id) not null,
  user_id uuid references auth.users(id) not null,
  
  type text not null check (type in ('in', 'out')),
  amount decimal(12,2) not null check (amount > 0),
  reason text not null,
  description text
);

alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;

-- 6. SUPPLIER TRANSACTIONS (ORDERS & PAYMENTS)
-- ==============================================================================

create table if not exists public.supplier_orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  kiosk_id uuid references public.kiosks(id) not null,
  supplier_id uuid references public.suppliers(id) not null,
  user_id uuid references auth.users(id) not null,
  total_amount decimal(12,2) not null default 0,
  
  status text not null default 'pending' check (status in ('pending', 'received', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  delivery_date timestamp with time zone,
  notes text
);

create table if not exists public.supplier_order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.supplier_orders(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null,
  cost decimal(12,2) not null,
  subtotal decimal(12,2) not null
);

create table if not exists public.supplier_payments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  order_id uuid references public.supplier_orders(id) on delete cascade not null,
  kiosk_id uuid references public.kiosks(id) not null,
  user_id uuid references auth.users(id) not null,
  
  amount decimal(12,2) not null check (amount > 0),
  payment_method text not null,
  cash_session_id uuid references public.cash_sessions(id),
  notes text
);

alter table public.supplier_orders enable row level security;
alter table public.supplier_order_items enable row level security;
alter table public.supplier_payments enable row level security;

-- 7. EXPENSES
-- ==============================================================================

create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  description text not null,
  amount decimal(10,2) not null,
  category text not null,
  date timestamp with time zone not null default now(),
  kiosk_id uuid references public.kiosks(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  employee_id uuid -- Optional FK to employees
);

alter table public.expenses enable row level security;

-- 8. EMPLOYEES & SHIFTS
-- ==============================================================================

create table if not exists public.employees (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  kiosk_id uuid references public.kiosks(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  hourly_rate decimal(10,2) default 0,
  alias text,
  contact_info text,
  unique(kiosk_id, user_id)
);

create table if not exists public.work_shifts (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  employee_id uuid references public.employees(id) on delete cascade not null,
  kiosk_id uuid references public.kiosks(id) on delete cascade not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  total_hours decimal(10,2) default 0,
  date date default CURRENT_DATE
);

alter table public.employees enable row level security;
alter table public.work_shifts enable row level security;

-- 9. FUNCTIONS & RPCs
-- ==============================================================================

-- Stock Update with Weighted Average Cost
create or replace function public.increment_stock_and_update_cost(
    p_product_id uuid,
    p_quantity integer,
    p_new_cost decimal
)
returns void
language plpgsql
security definer
as $$
declare
    v_current_stock integer;
    v_current_cost decimal;
    v_final_stock integer;
    v_final_cost decimal;
begin
    select stock, cost into v_current_stock, v_current_cost
    from public.products
    where id = p_product_id
    for update;
    
    if v_current_stock is null then v_current_stock := 0; end if;
    if v_current_cost is null then v_current_cost := 0; end if;
    if p_new_cost is null then p_new_cost := 0; end if;
    
    v_final_stock := v_current_stock + p_quantity;
    
    if v_final_stock > 0 then
        v_final_cost := ((v_current_stock * v_current_cost) + (p_quantity * p_new_cost)) / v_final_stock;
    else
        v_final_cost := p_new_cost;
    end if;
    
    update public.products
    set stock = v_final_stock,
        cost = round(v_final_cost, 2)
    where id = p_product_id;
end;
$$;


-- ==============================================================================
-- PART 2: FINANCIAL UPDATES (from financial_update.sql)
-- ==============================================================================

-- 1. Add cost column to Sale Items
alter table public.sale_items 
add column if not exists cost decimal(10,2) not null default 0;

-- 2. Update dashboard stats function for Real Gross Profit / Net Income
create or replace function get_dashboard_stats_v2(
  p_user_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  v_total_sales bigint;
  v_total_revenue decimal;   -- Total facturado (Price * Qty)
  v_total_cogs decimal;      -- Cost of Goods Sold (Cost * Qty)
  v_gross_profit decimal;    -- Revenue - COGS
  v_total_expenses decimal;  -- Gastos operativos
  v_net_income decimal;      -- Gross Profit - Expenses
  
  v_top_kiosk text;
  v_user_kiosks uuid[];
begin
  -- Get user's kiosks
  select array_agg(kiosk_id) into v_user_kiosks
  from kiosk_members
  where user_id = p_user_id;

  -- 1. Sales, Revenue & COGS
  select 
    count(distinct s.id), 
    coalesce(sum(si.subtotal), 0),
    coalesce(sum(si.quantity * si.cost), 0)
  into v_total_sales, v_total_revenue, v_total_cogs
  from sales s
  join sale_items si on s.id = si.sale_id
  where s.created_at >= p_start_date 
    and s.created_at <= p_end_date
    and s.kiosk_id = any(v_user_kiosks);

  v_gross_profit := v_total_revenue - v_total_cogs;

  -- 2. Expenses (Operational)
  select 
    coalesce(sum(amount), 0)
  into v_total_expenses
  from expenses
  where date >= p_start_date 
    and date <= p_end_date
    and kiosk_id = any(v_user_kiosks);

  v_net_income := v_gross_profit - v_total_expenses;

  -- 3. Top Kiosk
  select k.name into v_top_kiosk
  from sales s
  join kiosks k on s.kiosk_id = k.id
  where s.created_at >= p_start_date 
    and s.created_at <= p_end_date
    and s.kiosk_id = any(v_user_kiosks)
  group by k.name
  order by sum(s.total) desc
  limit 1;

  return json_build_object(
    'totalSales', v_total_sales,
    'totalRevenue', v_total_revenue,
    'totalCost', v_total_cogs,
    'grossProfit', v_gross_profit,
    'totalExpenses', v_total_expenses,
    'netIncome', v_net_income,
    'topKiosk', coalesce(v_top_kiosk, 'N/A'),
    'trend', '[]'::json, -- Placeholder
    'pie', '[]'::json    -- Placeholder
  );
end;
$$;


-- ==============================================================================
-- PART 3: MIGRATIONS & FIXES (001-006)
-- ==============================================================================

-- 1. PRICE CHANGES HISTORY
create table if not exists price_changes_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  action_type text not null, -- 'BULK_MANUAL', 'BULK_SUPPLIER', 'REVERT'
  description text,
  affected_products jsonb -- Stores array of { id, name, old_price, new_price }
);

alter table price_changes_history enable row level security;

drop policy if exists "Users can view history" on price_changes_history;
create policy "Users can view history"
  on price_changes_history for select
  to authenticated
  using (true);

drop policy if exists "Users can insert history" on price_changes_history;
create policy "Users can insert history"
  on price_changes_history for insert
  to authenticated
  with check (auth.uid() = user_id);


-- 2. FIX: KIOSK & MEMBERS POLICIES (Redefining for stricter/better control)
-- Re-apply 'Users can create kiosks' just in case
drop policy if exists "Users can create kiosks" on public.kiosks;
create policy "Users can create kiosks"
on public.kiosks for insert
to authenticated
with check (true);

-- Fix Recursion Issue with 'is_kiosk_owner' function
create or replace function public.is_kiosk_owner(p_kiosk_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.kiosks
    where id = p_kiosk_id
    and owner_id = auth.uid()
  );
end;
$$;

grant execute on function public.is_kiosk_owner to authenticated;
grant execute on function public.is_kiosk_owner to anon;

-- Fix Kiosk Members Policy to avoid circular dependency
drop policy if exists "View kiosk members" on public.kiosk_members;
create policy "View kiosk members"
on public.kiosk_members for select
using (
   -- Users can view their own membership
   auth.uid() = user_id
   OR
   -- Owners can view members of their kiosks (using the safe function)
   public.is_kiosk_owner(kiosk_id)
);


-- 3. RPC: Create Initial Kiosk (Helper for registration)
create or replace function public.create_initial_kiosk(
  p_kiosk_name text,
  p_owner_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_kiosk_id uuid;
  v_kiosk_data json;
begin
  insert into public.kiosks (name, owner_id)
  values (p_kiosk_name, p_owner_id)
  returning id into v_kiosk_id;

  insert into public.kiosk_members (user_id, kiosk_id, role)
  values (p_owner_id, v_kiosk_id, 'owner');
  
  select json_build_object(
    'id', id,
    'name', name,
    'owner_id', owner_id,
    'created_at', created_at
  ) into v_kiosk_data
  from public.kiosks
  where id = v_kiosk_id;

  return v_kiosk_data;
end;
$$;

grant execute on function public.create_initial_kiosk to public;
grant execute on function public.create_initial_kiosk to anon;
grant execute on function public.create_initial_kiosk to authenticated;


-- 4. STORAGE POLICIES
-- Create 'products' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Access to Products" on storage.objects;
create policy "Public Access to Products"
on storage.objects for select
using ( bucket_id = 'products' );

drop policy if exists "Authenticated users can upload products" on storage.objects;
create policy "Authenticated users can upload products"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'products' );

drop policy if exists "Authenticated users can update products" on storage.objects;
create policy "Authenticated users can update products"
on storage.objects for update
to authenticated
using ( bucket_id = 'products' );

drop policy if exists "Authenticated users can delete products" on storage.objects;
create policy "Authenticated users can delete products"
on storage.objects for delete
to authenticated
using ( bucket_id = 'products' );


-- 5. LATEST UPDATES
-- Add customer_name column to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name TEXT;


-- ==============================================================================
-- INCLUDED MIGRATION 001: STOCK CONTROL
-- ==============================================================================

-- 1. Create stock_movements table
create table if not exists public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  product_id uuid references public.products(id) on delete cascade not null,
  kiosk_id uuid references public.kiosks(id) not null,
  user_id uuid references auth.users(id) not null,
  
  type text not null check (type in ('sale', 'restock', 'correction', 'loss', 'return')),
  quantity integer not null, -- Positive adds to stock, negative removes
  reason text, -- For corrections/losses e.g. "Expired", "Stolen"
  notes text,
  
  -- Snapshot of cost/price at the time of movement (Optional but good for auditing)
  cost_at_time decimal(10,2),
  price_at_time decimal(10,2)
);

-- 2. Enable RLS
alter table public.stock_movements enable row level security;

create policy "Users can view movements of their kiosk"
on public.stock_movements for select
using (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = stock_movements.kiosk_id
  )
);

create policy "Users can insert movements for their kiosk"
on public.stock_movements for insert
with check (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = stock_movements.kiosk_id
  )
);

-- 3. RPC: Register Stock Adjustment
-- This function handles the atomic update of the product stock AND the creation of the movement record
create or replace function public.register_stock_adjustment(
  p_product_id uuid,
  p_kiosk_id uuid,
  p_type text, -- 'restock', 'correction', 'loss', 'return'
  p_quantity integer, -- Absolute Value. Logic will handle sign.
  p_reason text,
  p_notes text
)
returns void
language plpgsql
security definer
as $$
declare
  v_final_quantity integer;
  v_current_stock integer;
begin
  if p_type = 'loss' or p_type = 'sale' then
     v_final_quantity := -1 * abs(p_quantity);
  else
     if p_type = 'restock' or p_type = 'return' then
        v_final_quantity := abs(p_quantity);
     elsif p_type = 'loss' then
        v_final_quantity := -1 * abs(p_quantity);
     else 
        v_final_quantity := p_quantity; 
     end if;
  end if;

  -- 1. Insert Movement
  insert into public.stock_movements (
    product_id, kiosk_id, user_id, type, quantity, reason, notes
  ) values (
    p_product_id, p_kiosk_id, auth.uid(), p_type, v_final_quantity, p_reason, p_notes
  );

  -- 2. Update Product Stock
  update public.products
  set stock = stock + v_final_quantity
  where id = p_product_id;
  
end;
$$;


-- ==============================================================================
-- INCLUDED MIGRATION 002: STOCK AUDIT
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


-- ==============================================================================
-- INCLUDED MIGRATION 003: AUDIT REVERT
-- ==============================================================================

create or replace function public.revert_stock_audit(
  p_audit_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_audit_record record;
  v_item record;
  v_diff integer;
begin
  -- 1. Get Audit and verify it is completed
  select * into v_audit_record
  from public.stock_audits
  where id = p_audit_id;
  
  if v_audit_record.status != 'completed' then
    raise exception 'Solo se pueden cancelar auditorías completadas';
  end if;
  
  -- 2. Iterate items and revert changes
  for v_item in select * from public.stock_audit_items where audit_id = p_audit_id
  loop
     v_diff := v_item.counted_stock - v_item.expected_stock;
     
     if v_diff != 0 then
         perform public.register_stock_adjustment(
            v_item.product_id,
            v_audit_record.kiosk_id,
            'correction',
            -1 * v_diff, -- Reverse the adjustment
            'Audit Revert',
            'Reverting Audit #' || p_audit_id::text
         );
     end if;
  end loop;

  -- 3. Update Audit Status
  update public.stock_audits
  set status = 'cancelled',
  notes = coalesce(notes, '') || ' [Cancelled/Reverted]'
  where id = p_audit_id;

end;
$$;


-- ==============================================================================
-- INCLUDED MIGRATION 004: CATEGORIES & RELATIONS
-- ==============================================================================

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


-- ==============================================================================
-- INCLUDED MIGRATION 005: KIOSK RLS FIX
-- ==============================================================================

-- Fix: Allow users to view kiosks they own or belong to
DROP POLICY IF EXISTS "Users can view their kiosks" ON public.kiosks;

CREATE POLICY "Users can view their kiosks"
ON public.kiosks FOR SELECT
USING (
    -- Access if owner
    auth.uid() = owner_id
    OR
    -- Access if member (seller)
    EXISTS (
        SELECT 1 FROM public.kiosk_members
        WHERE kiosk_members.kiosk_id = kiosks.id
        AND kiosk_members.user_id = auth.uid()
    )
);
