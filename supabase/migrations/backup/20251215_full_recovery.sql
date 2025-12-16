-- FINAL RECOVERY SCRIPT (Corrected Columns)
-- Problem: We cannot insert into kiosk_members because the user (owner) has no profile.
-- Solution: Create the profile first.

-- 1. Insert missing profiles for Kiosk Owners
-- Any user in 'kiosks.owner_id' who is NOT in 'profiles' needs a profile.
-- REMOVED created_at, updated_at as they caused errors.
INSERT INTO profiles (id, email, full_name)
SELECT 
    owner_id, 
    'recovered_user_' || substr(owner_id::text, 1, 8) || '@example.com', -- Placeholder email
    'Recovered Owner' -- Placeholder name
FROM kiosks
WHERE owner_id IS NOT NULL 
  AND owner_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. NOW we can safely restore the kiosk_members record
INSERT INTO kiosk_members (kiosk_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM kiosks
WHERE id NOT IN (SELECT kiosk_id FROM kiosk_members WHERE role = 'owner')
AND owner_id IS NOT NULL
ON CONFLICT DO NOTHING;
