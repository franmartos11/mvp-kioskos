-- ==============================================================================
-- FIX: RLS Policies for Kiosk Creation & Management
-- Run this in your Supabase SQL Editor to resolve the "new row violates RLS" error.
-- ==============================================================================

-- 1. KIOSKS POLICIES
-- Enable RLS (just in case)
alter table public.kiosks enable row level security;

-- Allow any authenticated user to create a new kiosk
create policy "Users can create kiosks"
on public.kiosks for insert
to authenticated
with check (true);

-- Allow users to select (view) kiosks they own or are members of
create policy "Users can view their kiosks"
on public.kiosks for select
using (
  auth.uid() = owner_id 
  or 
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = kiosks.id
  )
);

-- Allow owners to update their kiosks
create policy "Owners can update their kiosks"
on public.kiosks for update
using ( auth.uid() = owner_id );

-- Allow owners to delete their kiosks
create policy "Owners can delete their kiosks"
on public.kiosks for delete
using ( auth.uid() = owner_id );


-- 2. KIOSK MEMBERS POLICIES
-- Enable RLS
alter table public.kiosk_members enable row level security;

-- Allow users to insert themselves (during registration) OR owners to add others
create policy "Manage kiosk members"
on public.kiosk_members for insert
with check (
   -- Allow inserting self (needed for registration flow)
   auth.uid() = user_id
   OR
   -- Allow owner to insert others
   exists (
     select 1 from public.kiosks
     where kiosks.id = kiosk_members.kiosk_id
     and kiosks.owner_id = auth.uid()
   )
);

-- Allow reading members if you are the user or the owner of the kiosk
create policy "View kiosk members"
on public.kiosk_members for select
using (
   auth.uid() = user_id
   OR
   exists (
     select 1 from public.kiosks
     where kiosks.id = kiosk_members.kiosk_id
     and kiosks.owner_id = auth.uid()
   )
);
