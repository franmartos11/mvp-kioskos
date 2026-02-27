-- ==============================================================================
-- FIX: Products RLS - Separate SELECT policy from MANAGE policy
-- Problem: Having both "FOR SELECT" and "FOR ALL" policies caused conflicts
-- where a fresh SELECT from Inventory returned empty due to RLS row filtering.
-- Solution: Drop the "FOR ALL" policy, replace with explicit INSERT/UPDATE/DELETE.
-- ==============================================================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "Authorized Users Manage Products" ON public.products;
DROP POLICY IF EXISTS "Kiosk Members View Products" ON public.products;

-- VIEW: All kiosk members can SELECT products (needed for both POS and Inventory)
CREATE POLICY "Kiosk Members View Products" ON public.products
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.kiosk_members
    WHERE kiosk_members.user_id = auth.uid()
    AND kiosk_members.kiosk_id = products.kiosk_id
  )
);

-- INSERT: Only users with manage_products permission
CREATE POLICY "Authorized Users Insert Products" ON public.products
FOR INSERT WITH CHECK (
  public.check_permission(kiosk_id, 'manage_products')
);

-- UPDATE: Only users with manage_products permission
CREATE POLICY "Authorized Users Update Products" ON public.products
FOR UPDATE USING (
  public.check_permission(kiosk_id, 'manage_products')
) WITH CHECK (
  public.check_permission(kiosk_id, 'manage_products')
);

-- DELETE: Only users with manage_products permission
CREATE POLICY "Authorized Users Delete Products" ON public.products
FOR DELETE USING (
  public.check_permission(kiosk_id, 'manage_products')
);
