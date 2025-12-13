-- ==============================================================================
-- RPC: Create Initial Kiosk
-- Securely creates a Kiosk and inserts the Owner member in a single transaction.
-- Bypass RLS by using SECURITY DEFINER.
-- ==============================================================================

create or replace function public.create_initial_kiosk(
  p_kiosk_name text,
  p_owner_id uuid
)
returns json
language plpgsql
security definer -- Runs with privileges of the creator (postgres/service_role)
as $$
declare
  v_kiosk_id uuid;
  v_kiosk_data json;
begin
  -- 1. Insert Kiosk
  insert into public.kiosks (name, owner_id)
  values (p_kiosk_name, p_owner_id)
  returning id into v_kiosk_id;

  -- 2. Insert Member (Owner)
  insert into public.kiosk_members (user_id, kiosk_id, role)
  values (p_owner_id, v_kiosk_id, 'owner');
  
  -- 3. Return the new Kiosk data
  select json_build_object(
    'id', id,
    'name', name,
    'owner_id', owner_id,
    'created_at', created_at
  ) into v_kiosk_data
  from public.kiosks
  where id = v_kiosk_id;

  return v_kiosk_data;
end;
$$;

-- Grant execute to everyone (public) so it can be called even if RLS blocks standard tables
-- Note: In a stricter environment, you might limit this, but for "sign up -> create" flow, public is standard.
grant execute on function public.create_initial_kiosk to public;
grant execute on function public.create_initial_kiosk to anon;
grant execute on function public.create_initial_kiosk to authenticated;
