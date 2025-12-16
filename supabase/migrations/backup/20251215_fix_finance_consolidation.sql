-- Consolidation: Use existing 'cash_sessions' instead of new 'cash_shifts'

-- 1. Drop the duplicate table if created
DROP TABLE IF EXISTS cash_shifts;

-- 2. Enhance cash_sessions to support the Finance Module features
-- It already has: id, kiosk_id, user_id, initial_cash, notes, status, opened_at, closed_at, final_cash, expected_cash, difference
-- We need to check what is missing.
-- Based on error logs or code, 'cash_sessions' seems to be the one used by POS.
-- Let's ensure it has all columns we need for closing math.

-- Add columns if they don't exist (using safe ALTER)
ALTER TABLE cash_sessions 
ADD COLUMN IF NOT EXISTS total_sales_cash NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS total_expenses_cash NUMERIC(12, 2);

-- 3. Update the RPC function to use 'cash_sessions'
CREATE OR REPLACE FUNCTION close_shift(
    p_shift_id UUID,
    p_final_cash NUMERIC,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift RECORD;
    v_sales_cash NUMERIC;
    v_expenses_cash NUMERIC;
    v_expected NUMERIC;
    v_diff NUMERIC;
BEGIN
    -- Get Session info
    SELECT * INTO v_shift FROM cash_sessions WHERE id = p_shift_id AND status = 'open';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Shift not found or already closed');
    END IF;

    -- Calculate Sales in Cash during this shift
    SELECT COALESCE(SUM(total), 0) INTO v_sales_cash
    FROM sales
    WHERE kiosk_id = v_shift.kiosk_id
      AND payment_method = 'cash'
      AND created_at >= v_shift.opened_at;

    -- Calculate Expenses in Cash during this shift
    -- (Expenses table is new and correct)
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses_cash
    FROM expenses
    WHERE kiosk_id = v_shift.kiosk_id
      AND payment_method = 'cash'
      AND created_at >= v_shift.opened_at;

    -- Calculate Expected
    -- cash_sessions uses 'initial_cash'
    v_expected := v_shift.initial_cash + v_sales_cash - v_expenses_cash;
    v_diff := p_final_cash - v_expected;

    -- Update Session
    UPDATE cash_sessions
    SET 
        status = 'closed',
        closed_at = NOW(),
        final_cash = p_final_cash, -- Note: cash_sessions uses 'final_cash' not 'final_cash_reported' depending on schema, let's assume final_cash based on previous code usage
        total_sales_cash = v_sales_cash,
        total_expenses_cash = v_expenses_cash,
        expected_cash = v_expected,
        difference = v_diff,
        notes = p_notes
    WHERE id = p_shift_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
