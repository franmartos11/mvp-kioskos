-- ==============================================================================
-- SECURITY FIXES: Invitations System
-- 2026-03-11
-- ==============================================================================

-- ==============================================================================
-- FIX 3: Tighten RLS on kiosk_invitations
-- Problem: The "Anyone can view pending invitations by token" policy exposed
-- ALL pending invitations (with emails, kiosk_ids, roles) to any authenticated
-- or anonymous user. An attacker could enumerate invitations directly via API.
-- Solution: Drop the open policy and expose invitations only via a SECURITY
-- DEFINER RPC that requires the exact token, enforcing token-gated access.
-- ==============================================================================

DROP POLICY IF EXISTS "Anyone can view pending invitations by token" ON public.kiosk_invitations;

-- New policy: only the kiosk owner can read invitations directly.
-- Public token validation is handled by the validate_invitation_by_token() RPC below.
-- No additional SELECT policy needed for anonymous users.

-- RPC: validate_invitation_by_token
-- Allows the invite landing page to retrieve invitation details ONLY when the
-- caller knows the exact token. Returns null if not found/expired/invalid.
CREATE OR REPLACE FUNCTION public.validate_invitation_by_token(p_token TEXT)
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
    WHERE i.token = p_token
      AND i.status = 'pending'
      AND i.expires_at > NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invitation_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation_by_token(TEXT) TO authenticated;

-- ==============================================================================
-- FIX 5: Revoke anon access to create_initial_kiosk
-- Problem: Any anonymous visitor could call this RPC and create kiosks,
-- wasting DB resources and creating noise.
-- Solution: Restrict execution to authenticated users only.
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.create_initial_kiosk(TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_initial_kiosk(TEXT, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.create_initial_kiosk(TEXT, UUID) TO authenticated;

-- ==============================================================================
-- FIX 6: Prevent duplicate pending invitations for the same email+kiosk
-- Problem: Multiple calls to inviteUser() created multiple pending tokens for
-- the same email/kiosk, causing confusion and token sprawl in the DB.
-- Solution: Create a unique partial index so only one pending invitation
-- can exist per (kiosk_id, email) pair.
-- If a new invitation is sent, the old pending one must be revoked first
-- (handled in the application layer in invitations.ts).
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitation
ON public.kiosk_invitations (kiosk_id, email)
WHERE status = 'pending';
