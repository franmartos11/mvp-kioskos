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
