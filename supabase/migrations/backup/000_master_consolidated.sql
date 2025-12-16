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

-- Helper Function for Owner Check
create or replace function public.is_kiosk_owner(p_kiosk_id uuid)
returns boolean language plpgsql security definer as $$
begin
  return exists (select 1 from public.kiosks where id = p_kiosk_id and owner_id = auth.uid());
end;
$$;
grant execute on function public.is_kiosk_owner to authenticated;
grant execute on function public.is_kiosk_owner to anon;


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

-- Policies (Simplified)
create policy "Kiosk Access Products" on public.products for all using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = products.kiosk_id)
);
create policy "Kiosk Access Categories" on public.categories for all using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = categories.kiosk_id)
);

-- ==============================================================================
-- 4. SALES (POS) & FINANCE
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


-- EXPENSES (Consolidated Schema)
create table if not exists public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kiosk_id UUID REFERENCES kiosks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    -- Merged Categories + Payment Method
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
-- Enhanced with totals for Finance Module
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
  
  -- Finance Module additions
  total_sales_cash NUMERIC(12, 2),
  total_expenses_cash NUMERIC(12, 2),
  
  status text not null default 'open' check (status in ('open', 'closed')),
  notes text
);
alter table public.cash_sessions enable row level security;

create policy "Users can manage sessions of their kiosks" on cash_sessions for all using (
    exists (select 1 from kiosk_members where kiosk_members.kiosk_id = cash_sessions.kiosk_id and kiosk_members.user_id = auth.uid())
);


-- RPC: Close Shift (Consolidated Logic)
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

    -- Math
    v_expected := v_shift.initial_cash + v_sales_cash - v_expenses_cash;
    v_diff := p_final_cash - v_expected;

    -- Update
    UPDATE cash_sessions
    SET status = 'closed', closed_at = NOW(), final_cash = p_final_cash,
        total_sales_cash = v_sales_cash, total_expenses_cash = v_expenses_cash,
        expected_cash = v_expected, difference = v_diff, notes = p_notes
    WHERE id = p_shift_id;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ==============================================================================
-- 5. STOCK MOVEMENTS & AUDITS
-- ==============================================================================
-- Use existing tables from previous schema, simplified here for brevity but kept compliant.
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

  -- Sales & COGS
  select count(distinct s.id), coalesce(sum(si.subtotal), 0), coalesce(sum(si.quantity * si.cost), 0)
  into v_total_sales, v_total_revenue, v_total_cogs
  from sales s join sale_items si on s.id = si.sale_id
  where s.created_at >= p_start_date and s.created_at <= p_end_date and s.kiosk_id = any(v_user_kiosks);

  v_gross_profit := v_total_revenue - v_total_cogs;

  -- Expenses
  select coalesce(sum(amount), 0) into v_total_expenses
  from expenses
  where date >= p_start_date and date <= p_end_date and kiosk_id = any(v_user_kiosks);

  v_net_income := v_gross_profit - v_total_expenses;

  -- Top Kiosk
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
