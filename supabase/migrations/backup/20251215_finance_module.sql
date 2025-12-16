-- Finance Module Migration

-- 1. Create Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kiosk_id UUID REFERENCES kiosks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('provider', 'service', 'withdrawal', 'other')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'card', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date TIMESTAMPTZ DEFAULT NOW() -- For easy querying by date distinct from created_at
);

-- 2. Create Cash Shifts (Caja) Table
CREATE TABLE IF NOT EXISTS cash_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kiosk_id UUID REFERENCES kiosks(id) ON DELETE CASCADE NOT NULL,
    opened_by UUID REFERENCES auth.users(id) NOT NULL,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    initial_cash NUMERIC(12, 2) DEFAULT 0,
    
    -- Snapshots at closing time
    final_cash_reported NUMERIC(12, 2), -- What user counts
    total_sales_cash NUMERIC(12, 2), -- Calculated from sales
    total_expenses_cash NUMERIC(12, 2), -- Calculated from expenses
    expected_cash NUMERIC(12, 2), -- initial + sales - expenses
    difference NUMERIC(12, 2), -- expected - reported
    
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT
);

-- RLS Policies

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;

-- Allow access based on kiosk membership (simplified using existing patterns if possible, or direct checks)
-- Since RLS can be complex with joins, we often use a helper function or assume app sends kiosk_id and we verify via RPC or context.
-- For simplicity in this app iteration, we allow authenticated users to select/insert if they belong to the kiosk.

-- Start with broad policies for authenticated users for now, refining later if needed for strict security
CREATE POLICY "Users can view expenses of their kiosks"
    ON expenses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM kiosk_members 
            WHERE kiosk_members.kiosk_id = expenses.kiosk_id 
            AND kiosk_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert expenses to their kiosks"
    ON expenses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM kiosk_members 
            WHERE kiosk_members.kiosk_id = expenses.kiosk_id 
            AND kiosk_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view shifts of their kiosks"
    ON cash_shifts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM kiosk_members 
            WHERE kiosk_members.kiosk_id = cash_shifts.kiosk_id 
            AND kiosk_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage shifts of their kiosks"
    ON cash_shifts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM kiosk_members 
            WHERE kiosk_members.kiosk_id = cash_shifts.kiosk_id 
            AND kiosk_members.user_id = auth.uid()
        )
    );


-- Functions

-- Close Shift Function
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
    -- Get Shift info
    SELECT * INTO v_shift FROM cash_shifts WHERE id = p_shift_id AND status = 'open';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Shift not found or already closed');
    END IF;

    -- Calculate Sales in Cash during this shift
    -- Assumes 'sales' table has 'created_at', 'kiosk_id', 'payment_method'
    SELECT COALESCE(SUM(total), 0) INTO v_sales_cash
    FROM sales
    WHERE kiosk_id = v_shift.kiosk_id
      AND payment_method = 'cash'
      AND created_at >= v_shift.opened_at;

    -- Calculate Expenses in Cash during this shift
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses_cash
    FROM expenses
    WHERE kiosk_id = v_shift.kiosk_id
      AND payment_method = 'cash'
      AND created_at >= v_shift.opened_at;

    -- Calculate Expected
    v_expected := v_shift.initial_cash + v_sales_cash - v_expenses_cash;
    v_diff := p_final_cash - v_expected;

    -- Update Shift
    UPDATE cash_shifts
    SET 
        status = 'closed',
        closed_at = NOW(),
        final_cash_reported = p_final_cash,
        total_sales_cash = v_sales_cash,
        total_expenses_cash = v_expenses_cash,
        expected_cash = v_expected,
        difference = v_diff,
        notes = p_notes
    WHERE id = p_shift_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
