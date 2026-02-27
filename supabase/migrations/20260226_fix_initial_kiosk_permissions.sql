-- Fix create_initial_kiosk to assign permissions
create or replace function public.create_initial_kiosk(
  p_kiosk_name text,
  p_owner_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_kiosk_id uuid;
  v_kiosk_data json;
begin
  insert into public.kiosks (name, owner_id)
  values (p_kiosk_name, p_owner_id)
  returning id into v_kiosk_id;

  insert into public.kiosk_members (user_id, kiosk_id, role, permissions)
  values (
    p_owner_id, 
    v_kiosk_id, 
    'owner',
    '{
        "view_dashboard": true,
        "view_finance": true,
        "manage_products": true,
        "view_costs": true,
        "manage_stock": true,
        "manage_members": true,
        "view_reports": true
    }'::jsonb
  );
  
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

grant execute on function public.create_initial_kiosk to public;
grant execute on function public.create_initial_kiosk to anon;
grant execute on function public.create_initial_kiosk to authenticated;

-- Backfill missing permissions for existing owners
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
