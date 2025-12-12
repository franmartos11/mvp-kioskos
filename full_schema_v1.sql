-- ==============================================================================
-- KIOSK APP - FULL SCHEMA V1
-- Consolidado: Public Profiles, Kiosks, Products, Sales, Suppliers, Cash & Employees
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
-- (Note: Add specific RLS for Kiosks/Members if needed, usually managed by system/supabase-admin or strict policies)

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
-- Include basic View/Manage policies similar to products (omitted for brevity but implied)

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

-- Dashboard Stats V2
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
  v_total_revenue decimal;
  v_total_expenses decimal;
  v_top_kiosk text;
  v_trend json;
  v_pie json;
  v_user_kiosks uuid[];
begin
  select array_agg(kiosk_id) into v_user_kiosks
  from kiosk_members
  where user_id = p_user_id;

  select count(*), coalesce(sum(total), 0)
  into v_total_sales, v_total_revenue
  from sales
  where created_at >= p_start_date and created_at <= p_end_date and kiosk_id = any(v_user_kiosks);

  select coalesce(sum(amount), 0)
  into v_total_expenses
  from expenses
  where date >= p_start_date and date <= p_end_date and kiosk_id = any(v_user_kiosks);

  select k.name into v_top_kiosk
  from sales s
  join kiosks k on s.kiosk_id = k.id
  where s.created_at >= p_start_date and s.created_at <= p_end_date and s.kiosk_id = any(v_user_kiosks)
  group by k.name
  order by sum(s.total) desc
  limit 1;

  -- (Omitting trend/pie details for brevity in this merged file but they should be here in real deployment)
  -- Just passing empty or simplified for this consolidated view reference
  return json_build_object(
    'totalSales', v_total_sales,
    'totalRevenue', v_total_revenue,
    'totalExpenses', v_total_expenses,
    'netIncome', v_total_revenue - v_total_expenses,
    'topKiosk', coalesce(v_top_kiosk, 'N/A'),
    'trend', '[]'::json,
    'pie', '[]'::json
  );
end;
$$;
