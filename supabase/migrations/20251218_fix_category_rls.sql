-- EMERGENCY FIX: Allow Viewing Categories
drop policy if exists "Kiosk Members View Categories" on public.categories;

create policy "Kiosk Members View Categories" on public.categories for select using (
  true
);
-- Note: we use "true" temporarily to verify if it's RLS blocking. 
-- In production this should be: kiosk_id = (select kiosk_id from kiosk_members where user_id = auth.uid())
