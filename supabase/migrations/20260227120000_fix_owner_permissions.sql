-- Fix: Ensure all owner rows in kiosk_members have full permissions set
-- This backfills any existing rows where permissions was null or partially empty
UPDATE kiosk_members
SET permissions = jsonb_build_object(
    'view_dashboard', true,
    'view_finance', true,
    'manage_products', true,
    'view_costs', true,
    'manage_stock', true,
    'manage_members', true,
    'view_reports', true
)
WHERE role = 'owner'
  AND (
    permissions IS NULL
    OR NOT (permissions ? 'manage_products')
    OR NOT (permissions ? 'view_finance')
  );
