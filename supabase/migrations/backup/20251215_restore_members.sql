-- Recovery Migration (Corrected)
-- The kiosks table uses 'owner_id' to store the owner.
-- We must restore the owner record into kiosk_members.

INSERT INTO kiosk_members (kiosk_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM kiosks
WHERE id NOT IN (SELECT kiosk_id FROM kiosk_members WHERE role = 'owner')
AND owner_id IS NOT NULL; -- Ensure we don't insert nulls
