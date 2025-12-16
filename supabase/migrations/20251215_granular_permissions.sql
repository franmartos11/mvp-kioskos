-- Add permissions column to kiosk_members
ALTER TABLE public.kiosk_members 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Migrate Existing Owners (Full Access)
UPDATE public.kiosk_members
SET permissions = '{
    "view_dashboard": true,
    "view_finance": true,
    "manage_products": true,
    "view_costs": true,
    "manage_stock": true,
    "manage_members": true,
    "view_reports": true
}'::jsonb
WHERE role = 'owner';

-- Migrate Existing Sellers (Restricted Access - POS Only by default)
UPDATE public.kiosk_members
SET permissions = '{
    "view_dashboard": false,
    "view_finance": false,
    "manage_products": false,
    "view_costs": false,
    "manage_stock": true,
    "manage_members": false,
    "view_reports": false
}'::jsonb
WHERE role = 'seller' OR role IS NULL;
