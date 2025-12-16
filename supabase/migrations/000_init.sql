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

