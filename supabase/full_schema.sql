-- ==============================================================================
-- MASTER CONSOLIDATED SCHEMA (2025-12-15)
-- Represents the full state of the database including all modules.
-- ==============================================================================

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

-- Profiles Table (Implicitly needed for relationships, ensuring existence)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text
);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Kiosk Members (Roles)
create table if not exists public.kiosk_members (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  kiosk_id uuid references public.kiosks(id) not null,
  role text not null check (role in ('owner', 'seller')),
  unique(user_id, kiosk_id)
);

-- Add Foreign Key to Profiles if not exists (Safety check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_kiosk_members_profiles') THEN 
        -- Clean up orphans first
        DELETE FROM kiosk_members WHERE user_id NOT IN (SELECT id FROM profiles);
        
        ALTER TABLE kiosk_members
        ADD CONSTRAINT fk_kiosk_members_profiles
        FOREIGN KEY (user_id) REFERENCES public.profiles (id);
    END IF; 
END $$;

-- RLS: Kiosks & Members
alter table public.kiosks enable row level security;
alter table public.kiosk_members enable row level security;
alter table public.profiles enable row level security;

-- Helper Function for Owner Check (Used in Policies)
create or replace function public.is_kiosk_owner(p_kiosk_id uuid)
returns boolean language plpgsql security definer as $$
begin
  return exists (select 1 from public.kiosks where id = p_kiosk_id and owner_id = auth.uid());
end;
$$;
grant execute on function public.is_kiosk_owner to authenticated;
grant execute on function public.is_kiosk_owner to anon;

-- Policy: Users can view their own profile
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Policy: Kiosks View
create policy "Users can view their kiosks" on public.kiosks for select using (
    auth.uid() = owner_id OR 
    exists (select 1 from public.kiosk_members where kiosk_members.kiosk_id = kiosks.id and kiosk_members.user_id = auth.uid())
);

-- Policy: Kiosks Create
create policy "Users can create kiosks" on public.kiosks for insert with check (true);

-- Policy: Kiosk Members View
create policy "View kiosk members" on public.kiosk_members for select using (
   auth.uid() = user_id OR public.is_kiosk_owner(kiosk_id)
);

-- Policy: Kiosk Members Manage (Owner Only) !!! SECURITY FIX !!!
create policy "Owners can manage members" on public.kiosk_members for all using (
    public.is_kiosk_owner(kiosk_id)
);


-- ==============================================================================
-- 2. SUBSCRIPTIONS & PAYMENTS
-- ==============================================================================

create table if not exists public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    plan_id TEXT NOT NULL CHECK (plan_id IN ('free', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled', 'past_due', 'trialing')),
    current_period_end TIMESTAMPTZ,
    mercadopago_subscription_id TEXT,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

create table if not exists public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'ARS',
    status TEXT NOT NULL, -- approved, pending, rejected
    provider_payment_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

create policy "Users can view own subscription" on subscriptions for select using (auth.uid() = user_id);
create policy "Users can view own payments" on payments for select using (auth.uid() = user_id);

-- RPC: Start Pro Trial
create or replace function start_pro_trial(p_user_id UUID)
returns jsonb language plpgsql security definer as $$
declare
    v_sub_id UUID;
    v_has_used_trial BOOLEAN;
begin
    -- Check if user already has a subscription record
    SELECT id, (trial_ends_at IS NOT NULL) INTO v_sub_id, v_has_used_trial
    FROM subscriptions WHERE user_id = p_user_id;

    IF v_sub_id IS NOT NULL THEN
       SELECT (trial_ends_at IS NOT NULL) INTO v_has_used_trial FROM subscriptions WHERE id = v_sub_id;
       IF v_has_used_trial THEN
           RETURN jsonb_build_object('success', false, 'message', 'Ya has utilizado tu prueba gratuita.');
       END IF;

       UPDATE subscriptions 
       SET status = 'trialing', plan_id = 'pro', trial_ends_at = NOW() + INTERVAL '15 days', updated_at = NOW()
       WHERE id = v_sub_id;
    ELSE
        INSERT INTO subscriptions (user_id, plan_id, status, trial_ends_at)
        VALUES (p_user_id, 'pro', 'trialing', NOW() + INTERVAL '15 days');
    END IF;

    RETURN jsonb_build_object('success', true);
end;
$$;


-- ==============================================================================
-- 3. INVENTORY & CATEGORIES
-- ==============================================================================

-- Categories
create table if not exists public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kiosk_id UUID REFERENCES public.kiosks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kiosk_id, name)
);
alter table public.categories enable row level security;

-- Products
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text,
  price decimal(10,2) not null default 0,
  stock integer not null default 0,
  min_stock integer default 5,
  barcode text,
  image_url text,
  cost decimal(10,2) default 0,
  kiosk_id uuid references public.kiosks(id),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  unique(kiosk_id, barcode)
);
alter table public.products enable row level security;

-- Policies
create policy "Kiosk Access Products" on public.products for all using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = products.kiosk_id)
);
create policy "Kiosk Access Categories" on public.categories for all using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = categories.kiosk_id)
);


-- ==============================================================================
-- 4. SUPPLIERS (RESTORED & SECURED)
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

create policy "Users can view suppliers of their kiosk" on public.suppliers for select using (
    exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = suppliers.kiosk_id)
);
create policy "Users can manage suppliers of their kiosk" on public.suppliers for all using (
    exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = suppliers.kiosk_id)
);


-- ==============================================================================
-- 5. SALES (POS) & FINANCE
-- ==============================================================================

create table if not exists public.sales (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  total decimal(10,2) not null default 0,
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'other')),
  kiosk_id uuid references public.kiosks(id),
  user_id uuid references auth.users(id),
  customer_name text
);

create table if not exists public.sale_items (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null,
  unit_price decimal(10,2) not null,
  subtotal decimal(10,2) not null,
  cost decimal(10,2) not null default 0
);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Policies: Sales (SECURED)
create policy "Users can view sales of their kiosk" on public.sales for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = sales.kiosk_id)
);
create policy "Users can create sales for their kiosk" on public.sales for insert with check (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = sales.kiosk_id)
);

-- Policies: Sale Items (SECURED)
create policy "Users can view sale items of their kiosk" on public.sale_items for select using (
  exists (
    select 1 from public.sales
    join public.kiosk_members on sales.kiosk_id = kiosk_members.kiosk_id
    where sale_items.sale_id = sales.id
    and kiosk_members.user_id = auth.uid()
  )
);
create policy "Users can create sale items for their kiosk" on public.sale_items for insert with check (
  exists (
    select 1 from public.sales
    join public.kiosk_members on sales.kiosk_id = kiosk_members.kiosk_id
    where sale_items.sale_id = sales.id
    and kiosk_members.user_id = auth.uid()
  )
);


-- EXPENSES (Consolidated Schema)
create table if not exists public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kiosk_id UUID REFERENCES kiosks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('services', 'rent', 'salaries', 'inventory', 'provider', 'withdrawal', 'other')),
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'card', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date TIMESTAMPTZ DEFAULT NOW()
);
alter table public.expenses enable row level security;

create policy "Users can manage expenses of their kiosks" on expenses for all using (
    exists (select 1 from kiosk_members where kiosk_members.kiosk_id = expenses.kiosk_id and kiosk_members.user_id = auth.uid())
);


-- CASH SESSIONS (Shift Management)
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
  
  total_sales_cash NUMERIC(12, 2),
  total_expenses_cash NUMERIC(12, 2),
  
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text
);
alter table public.cash_sessions enable row level security;

create policy "Users can manage sessions of their kiosks" on cash_sessions for all using (
    exists (select 1 from kiosk_members where kiosk_members.kiosk_id = cash_sessions.kiosk_id and kiosk_members.user_id = auth.uid())
);


-- RPC: Close Shift
CREATE OR REPLACE FUNCTION close_shift(
    p_shift_id UUID,
    p_final_cash NUMERIC,
    p_notes TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_shift RECORD;
    v_sales_cash NUMERIC;
    v_expenses_cash NUMERIC;
    v_expected NUMERIC;
    v_diff NUMERIC;
BEGIN
    SELECT * INTO v_shift FROM cash_sessions WHERE id = p_shift_id AND status = 'open';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Shift not found'); END IF;

    -- Calculate Sales (Cash)
    SELECT COALESCE(SUM(total), 0) INTO v_sales_cash FROM sales
    WHERE kiosk_id = v_shift.kiosk_id AND payment_method = 'cash' AND created_at >= v_shift.opened_at;

    -- Calculate Expenses (Cash)
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses_cash FROM expenses
    WHERE kiosk_id = v_shift.kiosk_id AND payment_method = 'cash' AND created_at >= v_shift.opened_at;

    v_expected := v_shift.initial_cash + v_sales_cash - v_expenses_cash;
    v_diff := p_final_cash - v_expected;

    UPDATE cash_sessions
    SET status = 'closed', closed_at = NOW(), final_cash = p_final_cash,
        total_sales_cash = v_sales_cash, total_expenses_cash = v_expenses_cash,
        expected_cash = v_expected, difference = v_diff, notes = p_notes
    WHERE id = p_shift_id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ==============================================================================
-- 6. SUPPLIER TRANSACTIONS (RESTORED & SECURED)
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

-- Policies for Supplier Transactions (Authenticated Kiosk Members)
create policy "Users can manage supplier orders" on public.supplier_orders for all using (
    exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = supplier_orders.kiosk_id)
);
create policy "Users can manage supplier order items" on public.supplier_order_items for all using (
    exists (
        select 1 from public.supplier_orders
        join public.kiosk_members on supplier_orders.kiosk_id = kiosk_members.kiosk_id
        where supplier_order_items.order_id = supplier_orders.id
        and kiosk_members.user_id = auth.uid()
    )
);
create policy "Users can manage supplier payments" on public.supplier_payments for all using (
    exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = supplier_payments.kiosk_id)
);


-- ==============================================================================
-- 7. EMPLOYEES & SHIFTS (RESTORED & SECURED)
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

-- Policies: Employees (Owners manage, Sellers view?)
create policy "Kiosk Members can view employees" on public.employees for select using (
    exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = employees.kiosk_id)
);
create policy "Owners can manage employees" on public.employees for all using (
    public.is_kiosk_owner(kiosk_id)
);

-- Policies: Work Shifts
create policy "Kiosk Members can view shifts" on public.work_shifts for select using (
    exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = work_shifts.kiosk_id)
);
create policy "Owners can manage shifts" on public.work_shifts for all using (
    public.is_kiosk_owner(kiosk_id)
);


-- ==============================================================================
-- 8. STOCK MOVEMENTS & AUDITS
-- ==============================================================================
create table if not exists public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  product_id uuid references public.products(id) on delete cascade not null,
  kiosk_id uuid references public.kiosks(id) not null,
  user_id uuid references auth.users(id) not null,
  type text not null check (type in ('sale', 'restock', 'correction', 'loss', 'return')),
  quantity integer not null,
  reason text,
  notes text
);
alter table public.stock_movements enable row level security;

create policy "Users can view movements of their kiosk" on public.stock_movements for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = stock_movements.kiosk_id)
);

-- RPC: Dashboard Stats V2 (Finance Enhanced)
create or replace function get_dashboard_stats_v2(
  p_user_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns json language plpgsql security definer as $$
declare
  v_total_sales bigint;
  v_total_revenue decimal;
  v_total_cogs decimal;
  v_gross_profit decimal;
  v_total_expenses decimal;
  v_net_income decimal;
  v_top_kiosk text;
  v_user_kiosks uuid[];
begin
  select array_agg(kiosk_id) into v_user_kiosks from kiosk_members where user_id = p_user_id;

  select count(distinct s.id), coalesce(sum(si.subtotal), 0), coalesce(sum(si.quantity * si.cost), 0)
  into v_total_sales, v_total_revenue, v_total_cogs
  from sales s join sale_items si on s.id = si.sale_id
  where s.created_at >= p_start_date and s.created_at <= p_end_date and s.kiosk_id = any(v_user_kiosks);

  v_gross_profit := v_total_revenue - v_total_cogs;

  select coalesce(sum(amount), 0) into v_total_expenses
  from expenses
  where date >= p_start_date and date <= p_end_date and kiosk_id = any(v_user_kiosks);

  v_net_income := v_gross_profit - v_total_expenses;

  select k.name into v_top_kiosk from sales s join kiosks k on s.kiosk_id = k.id
  where s.created_at >= p_start_date and s.created_at <= p_end_date and s.kiosk_id = any(v_user_kiosks)
  group by k.name order by sum(s.total) desc limit 1;

  return json_build_object(
    'totalSales', v_total_sales, 'totalRevenue', v_total_revenue, 'totalCost', v_total_cogs,
    'grossProfit', v_gross_profit, 'totalExpenses', v_total_expenses, 'netIncome', v_net_income,
    'topKiosk', coalesce(v_top_kiosk, 'N/A')
  );
end;
$$;


-- ==============================================================================
-- 9. PERFORMANCE & AUDITING (NEW)
-- ==============================================================================

-- 1. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sales_kiosk_created ON public.sales(kiosk_id, created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_kiosk_date ON public.expenses(kiosk_id, date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_created ON public.stock_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kiosk_members_user_kiosk ON public.kiosk_members(user_id, kiosk_id);

-- 2. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    kiosk_id UUID REFERENCES public.kiosks(id),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- e.g. 'PRICE_CHANGE', 'DELETE_SALE'
    details JSONB,
    ip_address TEXT
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Owners can view logs of their kiosk
CREATE POLICY "Owners can view audit logs" ON public.audit_logs FOR SELECT USING (
    public.is_kiosk_owner(kiosk_id)
);

-- System/Users can insert logs (but not update/delete)
CREATE POLICY "Users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Helper RPC to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
    p_kiosk_id UUID,
    p_action TEXT,
    p_details JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.audit_logs (kiosk_id, user_id, action, details)
    VALUES (p_kiosk_id, auth.uid(), p_action, p_details);
END;
$$;

-- Add address column to kiosks table
ALTER TABLE public.kiosks ADD COLUMN IF NOT EXISTS address TEXT;
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
-- FIXED MIGRATION: Cash Management
-- We drop the table to ensure it is created with ALL required columns (kiosk_id was missing in some environments)
DROP TABLE IF EXISTS public.cash_movements CASCADE;

CREATE TABLE public.cash_movements (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cash_session_id uuid references public.cash_sessions(id) on delete cascade not null,
  kiosk_id uuid references public.kiosks(id) not null,
  user_id uuid references auth.users(id) not null,
  
  type text not null check (type in ('deposit', 'withdrawal')),
  amount decimal(12,2) not null check (amount > 0),
  reason text, -- 'supplier_payment', 'owner_withdrawal', 'change_entry', 'other'
  description text,
  
  -- Linking to other entities if needed
  expense_id uuid references public.expenses(id)
);

-- RLS
alter table public.cash_movements enable row level security;

create policy "Kiosk members can view movements" on public.cash_movements for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = cash_movements.kiosk_id)
);

create policy "Kiosk members can create movements" on public.cash_movements for insert with check (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = cash_movements.kiosk_id)
);

-- Indexes
create index if not exists idx_cash_movements_session on public.cash_movements(cash_session_id);
create index if not exists idx_cash_movements_kiosk_date on public.cash_movements(kiosk_id, created_at);


-- UDPATED RPC: Close Shift with Movements
CREATE OR REPLACE FUNCTION close_shift(
    p_shift_id UUID,
    p_final_cash NUMERIC,
    p_notes TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_shift RECORD;
    v_sales_cash NUMERIC;
    v_expenses_cash NUMERIC;
    v_deposits NUMERIC;
    v_withdrawals NUMERIC;
    v_expected NUMERIC;
    v_diff NUMERIC;
BEGIN
    SELECT * INTO v_shift FROM cash_sessions WHERE id = p_shift_id AND status = 'open';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Shift not found or already closed'); END IF;

    -- 1. Calculate Sales (Cash)
    SELECT COALESCE(SUM(total), 0) INTO v_sales_cash FROM sales
    WHERE kiosk_id = v_shift.kiosk_id AND payment_method = 'cash' AND created_at >= v_shift.opened_at;

    -- 2. Calculate Expenses (Cash)
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses_cash FROM expenses
    WHERE kiosk_id = v_shift.kiosk_id AND payment_method = 'cash' AND created_at >= v_shift.opened_at;

    -- 3. Calculate Movements (Deposits)
    SELECT COALESCE(SUM(amount), 0) INTO v_deposits FROM cash_movements
    WHERE cash_session_id = p_shift_id AND type = 'deposit';

    -- 4. Calculate Movements (Withdrawals)
    SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals FROM cash_movements
    WHERE cash_session_id = p_shift_id AND type = 'withdrawal';

    -- Formula: Initial + Sales + Deposits - Expenses - Withdrawals
    v_expected := v_shift.initial_cash + v_sales_cash + v_deposits - v_expenses_cash - v_withdrawals;
    v_diff := p_final_cash - v_expected;

    UPDATE cash_sessions
    SET status = 'closed', closed_at = NOW(), final_cash = p_final_cash,
        total_sales_cash = v_sales_cash, total_expenses_cash = v_expenses_cash,
        expected_cash = v_expected, difference = v_diff, notes = p_notes
    WHERE id = p_shift_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
-- Secure Function to Delete Kiosk and Cascade Data
CREATE OR REPLACE FUNCTION delete_kiosk_fully(target_kiosk_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_owner BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    -- 1. Security Check: Must be Owner
    SELECT EXISTS (
        SELECT 1 FROM kiosk_members 
        WHERE kiosk_id = target_kiosk_id AND user_id = v_user_id AND role = 'owner'
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos de propietario para eliminar este kiosco.');
    END IF;

    -- 2. Cascade Deletions (Order matters for Foreign Keys)
    
    -- Finance & Shift Management
    DELETE FROM cash_sessions WHERE kiosk_id = target_kiosk_id;
    DELETE FROM expenses WHERE kiosk_id = target_kiosk_id;

    -- Sales & Operations
    -- sale_items depends on sales. Delete items first via subquery or let CASCADE handle it if configured. 
    -- Assuming NO CASCADE on schema, manual delete:
    DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE kiosk_id = target_kiosk_id);
    DELETE FROM sales WHERE kiosk_id = target_kiosk_id;

    -- Inventory & Supply
    DELETE FROM stock_movements WHERE kiosk_id = target_kiosk_id;
    
    -- Supplier Orders (Complex dependency)
    DELETE FROM supplier_order_items WHERE order_id IN (SELECT id FROM supplier_orders WHERE kiosk_id = target_kiosk_id);
    DELETE FROM supplier_payments WHERE kiosk_id = target_kiosk_id;
    DELETE FROM supplier_orders WHERE kiosk_id = target_kiosk_id;
    DELETE FROM suppliers WHERE kiosk_id = target_kiosk_id;

    -- Products & Categories
    -- Products might be referenced implicitly.
    DELETE FROM products WHERE kiosk_id = target_kiosk_id;
    DELETE FROM categories WHERE kiosk_id = target_kiosk_id;

    -- Staff
    DELETE FROM work_shifts WHERE kiosk_id = target_kiosk_id;
    DELETE FROM employees WHERE kiosk_id = target_kiosk_id;

    -- Memberships
    DELETE FROM kiosk_members WHERE kiosk_id = target_kiosk_id;

    -- Finally, the Kiosk itself
    DELETE FROM kiosks WHERE id = target_kiosk_id;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
-- Add Foreign Key from cash_sessions.user_id to profiles.id for easier expanding
-- First, ensure all user_ids in cash_sessions exist in profiles (should be true if profiles are created on signup)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_cash_sessions_profiles_opener') THEN
        ALTER TABLE public.cash_sessions
        ADD CONSTRAINT fk_cash_sessions_profiles_opener
        FOREIGN KEY (user_id) REFERENCES public.profiles(id);
    END IF;
END $$;

-- Add closed_by column to cash_sessions
ALTER TABLE public.cash_sessions 
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.profiles(id);

-- Update close_shift RPC to set closed_by = auth.uid()
CREATE OR REPLACE FUNCTION close_shift(
    p_shift_id UUID,
    p_final_cash NUMERIC,
    p_notes TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_shift RECORD;
    v_sales_cash NUMERIC;
    v_expenses_cash NUMERIC;
    v_deposits NUMERIC;
    v_withdrawals NUMERIC;
    v_expected NUMERIC;
    v_diff NUMERIC;
BEGIN
    SELECT * INTO v_shift FROM cash_sessions WHERE id = p_shift_id AND status = 'open';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Shift not found or already closed'); END IF;

    -- 1. Calculate Sales (Cash)
    SELECT COALESCE(SUM(total), 0) INTO v_sales_cash FROM sales
    WHERE kiosk_id = v_shift.kiosk_id AND payment_method = 'cash' AND created_at >= v_shift.opened_at;

    -- 2. Calculate Expenses (Cash)
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses_cash FROM expenses
    WHERE kiosk_id = v_shift.kiosk_id AND payment_method = 'cash' AND created_at >= v_shift.opened_at;

    -- 3. Calculate Movements (Deposits)
    SELECT COALESCE(SUM(amount), 0) INTO v_deposits FROM cash_movements
    WHERE cash_session_id = p_shift_id AND type = 'deposit';

    -- 4. Calculate Movements (Withdrawals)
    SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals FROM cash_movements
    WHERE cash_session_id = p_shift_id AND type = 'withdrawal';

    -- Formula: Initial + Sales + Deposits - Expenses - Withdrawals
    v_expected := v_shift.initial_cash + v_sales_cash + v_deposits - v_expenses_cash - v_withdrawals;
    v_diff := p_final_cash - v_expected;

    UPDATE cash_sessions
    SET status = 'closed', closed_at = NOW(), final_cash = p_final_cash,
        total_sales_cash = v_sales_cash, total_expenses_cash = v_expenses_cash,
        expected_cash = v_expected, difference = v_diff, notes = p_notes,
        closed_by = auth.uid() -- Track who closed it
    WHERE id = p_shift_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
-- Add permissions column to kiosk_members
ALTER TABLE public.kiosk_members 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Migrate Existing Owners (Full Access)
UPDATE public.kiosk_members
SET permissions = '{
    "view_dashboard": true,
    "view_finance": true,
    "manage_products": true,
    "view_costs": true,
    "manage_stock": true,
    "manage_members": true,
    "view_reports": true
}'::jsonb
WHERE role = 'owner';

-- Migrate Existing Sellers (Restricted Access - POS Only by default)
UPDATE public.kiosk_members
SET permissions = '{
    "view_dashboard": false,
    "view_finance": false,
    "manage_products": false,
    "view_costs": false,
    "manage_stock": true,
    "manage_members": false,
    "view_reports": false
}'::jsonb
WHERE role = 'seller' OR role IS NULL;
create or replace function get_dashboard_stats_v3(
  p_user_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns json language plpgsql security definer as $$
declare
  v_user_kiosks uuid[];
  v_total_sales bigint;
  v_total_revenue decimal;
  v_total_cost decimal;
  v_total_expenses decimal;
  v_gross_profit decimal;
  v_net_income decimal;
  v_ticket_avg decimal;
  v_margin decimal;
  v_trend json;
  v_pie json;
  v_top_products json;
  v_stock_alerts bigint;
begin
  -- 1. Get User Kiosks
  select array_agg(kiosk_id) into v_user_kiosks from kiosk_members where user_id = p_user_id;

  -- 2. Financial Aggregates
  -- Using Sales + SaleItems to ensure accuracy (Net Revenue vs Items)
  select
    count(distinct s.id),
    coalesce(sum(si.subtotal), 0),
    coalesce(sum(si.quantity * coalesce(si.cost, 0)), 0)
  into v_total_sales, v_total_revenue, v_total_cost
  from sales s
  join sale_items si on s.id = si.sale_id
  where s.created_at >= p_start_date
    and s.created_at <= p_end_date
    and s.kiosk_id = any(v_user_kiosks);

  -- 3. Expenses
  select coalesce(sum(amount), 0) into v_total_expenses
  from expenses
  where date >= p_start_date
    and date <= p_end_date
    and kiosk_id = any(v_user_kiosks);

  -- 4. Derived Metrics
  v_gross_profit := v_total_revenue - v_total_cost;
  v_net_income := v_gross_profit - v_total_expenses;
  
  if v_total_sales > 0 then
    v_ticket_avg := v_total_revenue / v_total_sales;
  else
    v_ticket_avg := 0;
  end if;

  if v_total_revenue > 0 then
    v_margin := (v_gross_profit / v_total_revenue) * 100;
  else
    v_margin := 0;
  end if;

  -- 5. Trend (Daily Sales)
  select json_agg(t) into v_trend from (
    select date(s.created_at) as date, sum(s.total) as amount
    from sales s
    where s.created_at >= p_start_date
      and s.created_at <= p_end_date
      and s.kiosk_id = any(v_user_kiosks)
    group by date(s.created_at)
    order by date(s.created_at)
  ) t;

  -- 6. Pie (Sales by Kiosk)
  select json_agg(t) into v_pie from (
    select k.name, sum(s.total) as value
    from sales s
    join kiosks k on s.kiosk_id = k.id
    where s.created_at >= p_start_date
      and s.created_at <= p_end_date
      and s.kiosk_id = any(v_user_kiosks)
    group by k.name
  ) t;

  -- 7. Top Products
  -- Requires join with products table via sale_items
  -- Attempting to use product name from products table. 
  -- If sale_items has product_id, this works.
  select json_agg(t) into v_top_products from (
    select p.name, sum(si.quantity) as quantity, sum(si.subtotal) as revenue
    from sale_items si
    join sales s on si.sale_id = s.id
    join products p on si.product_id = p.id
    where s.created_at >= p_start_date
      and s.created_at <= p_end_date
      and s.kiosk_id = any(v_user_kiosks)
    group by p.name
    order by quantity desc
    limit 5
  ) t;

  -- 8. Stock Alerts (Global across all user kiosks)
  select count(*) into v_stock_alerts
  from products
  where kiosk_id = any(v_user_kiosks)
    and stock <= min_stock;

  return json_build_object(
    'totalSales', v_total_sales,
    'totalRevenue', v_total_revenue,
    'totalCost', v_total_cost,
    'totalExpenses', v_total_expenses,
    'grossProfit', v_gross_profit,
    'netIncome', v_net_income,
    'ticketAvg', v_ticket_avg,
    'margin', v_margin,
    'trend', coalesce(v_trend, '[]'::json),
    'pie', coalesce(v_pie, '[]'::json),
    'topProducts', coalesce(v_top_products, '[]'::json),
    'stockAlerts', v_stock_alerts
  );
end;
$$;
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
-- Add metadata column for storing extra info like active price list
alter table public.sales 
add column if not exists metadata jsonb default '{}'::jsonb;
-- Add AFIP Invoicing fields to Sales table
alter table public.sales
add column if not exists invoice_number text, -- e.g. "00001-00000045"
add column if not exists invoice_type text,   -- "A", "B", "C"
add column if not exists doc_type text,       -- "DNI", "CUIT"
add column if not exists doc_number text,     -- Customer Doc Number
add column if not exists cae text,            -- AFIP Authorization Code
add column if not exists cae_expiration timestamp with time zone;

-- Index for faster filtering of uninvoiced sales
create index if not exists idx_sales_uninvoiced on public.sales(kiosk_id, created_at) where invoice_number is null;
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
-- Add excluded_product_ids to price_lists
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'price_lists' and column_name = 'excluded_product_ids') then 
        alter table public.price_lists add column excluded_product_ids UUID[] DEFAULT '{}';
    end if; 
end $$;
-- EMERGENCY FIX: Allow Viewing Categories
drop policy if exists "Kiosk Members View Categories" on public.categories;

create policy "Kiosk Members View Categories" on public.categories for select using (
  true
);
-- Note: we use "true" temporarily to verify if it's RLS blocking. 
-- In production this should be: kiosk_id = (select kiosk_id from kiosk_members where user_id = auth.uid())
-- ==============================================================================
-- 1. FIX CONCURRENCY (Atomic Stock Update)
-- ==============================================================================
create or replace function public.decrement_stock(p_product_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
as $$
declare
  current_stock integer;
begin
  select stock into current_stock from public.products where id = p_product_id for update;
  
  if not found then
    raise exception 'Product not found';
  end if;

  update public.products
  set stock = stock - p_quantity
  where id = p_product_id;
end;
$$;


-- ==============================================================================
-- 2. ENFORCE GRANULAR PERMISSIONS
-- ==============================================================================

-- Helper function to check JSONB permissions
-- Returns true if user is owner OR has the specific permission bit set to true
create or replace function public.check_permission(p_kiosk_id uuid, p_permission text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.kiosk_members
    where user_id = auth.uid()
    and kiosk_id = p_kiosk_id
    and (
        role = 'owner' -- Owners always have access
        OR 
        (permissions->>p_permission)::boolean = true
    )
  );
end;
$$;

-- Drop loose policies
drop policy if exists "Kiosk Access Products" on public.products;
drop policy if exists "Kiosk Access Categories" on public.categories;
drop policy if exists "Users can manage their kiosk price lists" on public.price_lists;

-- Drop new policies if they already exist (Idempotency)
drop policy if exists "Kiosk Members View Products" on public.products;
drop policy if exists "Authorized Users Manage Products" on public.products;
drop policy if exists "Owners Manage Products" on public.products; -- Cleanup old name if exists

drop policy if exists "Kiosk Members View Categories" on public.categories;
drop policy if exists "Authorized Users Manage Categories" on public.categories;
drop policy if exists "Owners Manage Categories" on public.categories; -- Cleanup old name if exists

drop policy if exists "Kiosk Members View Price Lists" on public.price_lists;
drop policy if exists "Authorized Users Manage Price Lists" on public.price_lists;
drop policy if exists "Owners Manage Price Lists" on public.price_lists; -- Cleanup old name if exists

-- ------------------------------------------------------------------
-- PRODUCTS: Strict Policies
-- ------------------------------------------------------------------
-- VIEW: All members can view products (needed for selling)
create policy "Kiosk Members View Products" on public.products for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = products.kiosk_id)
);
-- MANAGE: Only with 'manage_products' permission
create policy "Authorized Users Manage Products" on public.products for all using (
  public.check_permission(products.kiosk_id, 'manage_products')
);

-- ------------------------------------------------------------------
-- CATEGORIES: Strict Policies
-- ------------------------------------------------------------------
-- VIEW: All members
create policy "Kiosk Members View Categories" on public.categories for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = categories.kiosk_id)
);
-- MANAGE: Only with 'manage_products' permission
create policy "Authorized Users Manage Categories" on public.categories for all using (
  public.check_permission(categories.kiosk_id, 'manage_products')
);

-- ------------------------------------------------------------------
-- PRICE LISTS: Strict Policies
-- ------------------------------------------------------------------
-- VIEW: All members
create policy "Kiosk Members View Price Lists" on public.price_lists for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = price_lists.kiosk_id)
);

-- MANAGE: Only with 'manage_products' (or could be 'view_finance'?) - sticking to products for catalog mgmt
create policy "Authorized Users Manage Price Lists" on public.price_lists for all using (
  public.check_permission(price_lists.kiosk_id, 'manage_products')
);
