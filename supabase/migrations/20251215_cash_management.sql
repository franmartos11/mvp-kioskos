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
