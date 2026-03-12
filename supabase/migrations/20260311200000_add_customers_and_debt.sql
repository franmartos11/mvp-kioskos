-- ==============================================================================
-- CLIENTES Y CUENTA CORRIENTE (FIADO)
-- 2026-03-11
-- Agrega soporte de clientes frecuentes y deuda/fiado por kiosco.
-- ==============================================================================

-- 1. Tabla de clientes por kiosko
CREATE TABLE IF NOT EXISTS public.customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id    UUID NOT NULL REFERENCES public.kiosks(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    phone       TEXT,
    email       TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by kiosk
CREATE INDEX IF NOT EXISTS idx_customers_kiosk ON public.customers(kiosk_id);

-- 2. Linkear ventas a clientes (columna opcional)
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Index  
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id) WHERE customer_id IS NOT NULL;

-- 3. Tabla de cuenta corriente (fiado)
-- Cada registro representa un saldo abierto con un cliente.
-- balance > 0 → el cliente le debe al kiosco
-- balance = 0 → al día
CREATE TABLE IF NOT EXISTS public.customer_debt (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id        UUID NOT NULL REFERENCES public.kiosks(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    balance         NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- Current outstanding debt
    credit_limit    NUMERIC(12, 2),                       -- Optional max credit allowed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (kiosk_id, customer_id)                        -- One balance per customer per kiosk
);

CREATE INDEX IF NOT EXISTS idx_customer_debt_kiosk ON public.customer_debt(kiosk_id);

-- 4. Log de movimientos de cuenta corriente
-- Registra cada venta a fiado y cada pago del cliente.
CREATE TABLE IF NOT EXISTS public.customer_debt_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kiosk_id        UUID NOT NULL REFERENCES public.kiosks(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    sale_id         UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    type            TEXT NOT NULL CHECK (type IN ('charge', 'payment')), -- 'charge' = fiado, 'payment' = abono
    amount          NUMERIC(12, 2) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_debt_movements_customer ON public.customer_debt_movements(customer_id, created_at DESC);

-- 5. RPC: registrar venta a fiado (carga en cuenta corriente)
CREATE OR REPLACE FUNCTION public.record_debt_charge(
    p_kiosk_id    UUID,
    p_customer_id UUID,
    p_sale_id     UUID,
    p_amount      NUMERIC,
    p_user_id     UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Upsert customer_debt
    INSERT INTO public.customer_debt (kiosk_id, customer_id, balance)
    VALUES (p_kiosk_id, p_customer_id, p_amount)
    ON CONFLICT (kiosk_id, customer_id)
    DO UPDATE SET
        balance    = customer_debt.balance + p_amount,
        updated_at = NOW();

    -- Log the movement
    INSERT INTO public.customer_debt_movements
        (kiosk_id, customer_id, sale_id, type, amount, created_by)
    VALUES
        (p_kiosk_id, p_customer_id, p_sale_id, 'charge', p_amount, p_user_id);
END;
$$;

-- 6. RPC: registrar pago (abono a la deuda)
CREATE OR REPLACE FUNCTION public.record_debt_payment(
    p_kiosk_id    UUID,
    p_customer_id UUID,
    p_amount      NUMERIC,
    p_notes       TEXT,
    p_user_id     UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Reduce balance (can go negative = customer has credit)
    UPDATE public.customer_debt
    SET
        balance    = balance - p_amount,
        updated_at = NOW()
    WHERE kiosk_id = p_kiosk_id AND customer_id = p_customer_id;

    -- Log the movement
    INSERT INTO public.customer_debt_movements
        (kiosk_id, customer_id, type, amount, notes, created_by)
    VALUES
        (p_kiosk_id, p_customer_id, 'payment', p_amount, p_notes, p_user_id);
END;
$$;

-- 7. RLS: customers visible solo a miembros del kiosko
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debt_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kiosk_members_can_view_customers"
ON public.customers FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.kiosk_members km
        WHERE km.kiosk_id = customers.kiosk_id
          AND km.user_id = auth.uid()
    )
);

CREATE POLICY "kiosk_members_can_manage_customers"
ON public.customers FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.kiosk_members km
        WHERE km.kiosk_id = customers.kiosk_id
          AND km.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.kiosk_members km
        WHERE km.kiosk_id = customers.kiosk_id
          AND km.user_id = auth.uid()
    )
);

CREATE POLICY "kiosk_members_can_view_debt"
ON public.customer_debt FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.kiosk_members km
        WHERE km.kiosk_id = customer_debt.kiosk_id
          AND km.user_id = auth.uid()
    )
);

CREATE POLICY "kiosk_members_can_view_movements"
ON public.customer_debt_movements FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.kiosk_members km
        WHERE km.kiosk_id = customer_debt_movements.kiosk_id
          AND km.user_id = auth.uid()
    )
);

-- Grants for RPC
GRANT EXECUTE ON FUNCTION public.record_debt_charge(UUID, UUID, UUID, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;
