-- ==============================================================================
-- FIX: Circular Dependency in RLS Policies
-- ==============================================================================

-- 1. Create a Helper Function to Check Ownership (Bypassing RLS)
-- This function runs as SECURITY DEFINER, meaning it uses the privileges of the creator (superuser/service role),
-- effectively bypassing the RLS on the 'kiosks' table that causes the recursion.

create or replace function public.is_kiosk_owner(p_kiosk_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.kiosks
    where id = p_kiosk_id
    and owner_id = auth.uid()
  );
end;
$$;

-- Grant execution to authenticated and anon users
grant execute on function public.is_kiosk_owner to authenticated;
grant execute on function public.is_kiosk_owner to anon;


-- 2. Update 'View kiosk members' Policy to use the helper function
-- This breaks the loop: kiosk_members -> kiosks -> kiosk_members

drop policy if exists "View kiosk members" on public.kiosk_members;

create policy "View kiosk members"
on public.kiosk_members for select
using (
   -- Users can view their own membership
   auth.uid() = user_id
   OR
   -- Owners can view members of their kiosks (using the safe function)
   public.is_kiosk_owner(kiosk_id)
);
