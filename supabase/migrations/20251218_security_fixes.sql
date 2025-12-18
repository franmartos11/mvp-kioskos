-- ==============================================================================
-- 1. FIX CONCURRENCY (Atomic Stock Update)
-- ==============================================================================
create or replace function public.decrement_stock(p_product_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
as $$
declare
  current_stock integer;
begin
  select stock into current_stock from public.products where id = p_product_id for update;
  
  if not found then
    raise exception 'Product not found';
  end if;

  update public.products
  set stock = stock - p_quantity
  where id = p_product_id;
end;
$$;


-- ==============================================================================
-- 2. ENFORCE GRANULAR PERMISSIONS
-- ==============================================================================

-- Helper function to check JSONB permissions
-- Returns true if user is owner OR has the specific permission bit set to true
create or replace function public.check_permission(p_kiosk_id uuid, p_permission text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.kiosk_members
    where user_id = auth.uid()
    and kiosk_id = p_kiosk_id
    and (
        role = 'owner' -- Owners always have access
        OR 
        (permissions->>p_permission)::boolean = true
    )
  );
end;
$$;

-- Drop loose policies
drop policy if exists "Kiosk Access Products" on public.products;
drop policy if exists "Kiosk Access Categories" on public.categories;
drop policy if exists "Users can manage their kiosk price lists" on public.price_lists;

-- Drop new policies if they already exist (Idempotency)
drop policy if exists "Kiosk Members View Products" on public.products;
drop policy if exists "Authorized Users Manage Products" on public.products;
drop policy if exists "Owners Manage Products" on public.products; -- Cleanup old name if exists

drop policy if exists "Kiosk Members View Categories" on public.categories;
drop policy if exists "Authorized Users Manage Categories" on public.categories;
drop policy if exists "Owners Manage Categories" on public.categories; -- Cleanup old name if exists

drop policy if exists "Kiosk Members View Price Lists" on public.price_lists;
drop policy if exists "Authorized Users Manage Price Lists" on public.price_lists;
drop policy if exists "Owners Manage Price Lists" on public.price_lists; -- Cleanup old name if exists

-- ------------------------------------------------------------------
-- PRODUCTS: Strict Policies
-- ------------------------------------------------------------------
-- VIEW: All members can view products (needed for selling)
create policy "Kiosk Members View Products" on public.products for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = products.kiosk_id)
);
-- MANAGE: Only with 'manage_products' permission
create policy "Authorized Users Manage Products" on public.products for all using (
  public.check_permission(products.kiosk_id, 'manage_products')
);

-- ------------------------------------------------------------------
-- CATEGORIES: Strict Policies
-- ------------------------------------------------------------------
-- VIEW: All members
create policy "Kiosk Members View Categories" on public.categories for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = categories.kiosk_id)
);
-- MANAGE: Only with 'manage_products' permission
create policy "Authorized Users Manage Categories" on public.categories for all using (
  public.check_permission(categories.kiosk_id, 'manage_products')
);

-- ------------------------------------------------------------------
-- PRICE LISTS: Strict Policies
-- ------------------------------------------------------------------
-- VIEW: All members
create policy "Kiosk Members View Price Lists" on public.price_lists for select using (
  exists (select 1 from public.kiosk_members where kiosk_members.user_id = auth.uid() and kiosk_members.kiosk_id = price_lists.kiosk_id)
);

-- MANAGE: Only with 'manage_products' (or could be 'view_finance'?) - sticking to products for catalog mgmt
create policy "Authorized Users Manage Price Lists" on public.price_lists for all using (
  public.check_permission(price_lists.kiosk_id, 'manage_products')
);
