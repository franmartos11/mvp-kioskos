-- First, remove orphaned records that violate the constraint we want to add
DELETE FROM kiosk_members
WHERE user_id NOT IN (SELECT id FROM profiles);

-- Now we can safely add the constraint
ALTER TABLE kiosk_members
ADD CONSTRAINT fk_kiosk_members_profiles
FOREIGN KEY (user_id)
REFERENCES public.profiles (id);
