-- ==============================================================================
-- ADD INVITE CODE to kiosk_invitations
-- 2026-03-11
-- Adds a short human-readable invite code (e.g. K3X9QA) alongside the UUID token.
-- Allows owners to share the code verbally/WhatsApp without a long URL.
-- ==============================================================================

-- 1. Add the column (nullable first to not break existing rows)
ALTER TABLE public.kiosk_invitations
ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- 2. Create unique index (partial — only enforce uniqueness on pending invitations)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invite_code
ON public.kiosk_invitations (invite_code)
WHERE status = 'pending' AND invite_code IS NOT NULL;

-- 3. Helper function to generate a unique 6-char alphanumeric code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I to avoid confusion
    v_code  TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_code := '';
        FOR i IN 1..6 LOOP
            v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        END LOOP;

        SELECT EXISTS (
            SELECT 1 FROM public.kiosk_invitations
            WHERE invite_code = v_code AND status = 'pending'
        ) INTO v_exists;

        EXIT WHEN NOT v_exists;
    END LOOP;

    RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;

-- 4. RPC: validate_invitation_by_code
-- Like validate_invitation_by_token but matches on invite_code instead.
-- SECURITY DEFINER so non-owners can call it without RLS issues.
CREATE OR REPLACE FUNCTION public.validate_invitation_by_code(p_code TEXT)
RETURNS TABLE (
    id UUID,
    kiosk_id UUID,
    kiosk_name TEXT,
    email TEXT,
    role TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.kiosk_id,
        k.name AS kiosk_name,
        i.email,
        i.role,
        i.expires_at
    FROM public.kiosk_invitations i
    JOIN public.kiosks k ON k.id = i.kiosk_id
    WHERE upper(trim(i.invite_code)) = upper(trim(p_code))
      AND i.status = 'pending'
      AND i.expires_at > NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invitation_by_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation_by_code(TEXT) TO authenticated;
