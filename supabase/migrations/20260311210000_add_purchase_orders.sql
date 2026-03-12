-- ==============================================================================
-- PURCHASE ORDERS (Órdenes de Compra a Proveedores)
-- Created: 2026-03-11
-- ==============================================================================

-- 1. Tabla principal de órdenes de compra
create table if not exists public.purchase_orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  kiosk_id uuid references public.kiosks(id) on delete cascade not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'draft'        -- draft | sent | received | cancelled
    check (status in ('draft', 'sent', 'received', 'cancelled')),
  notes text,
  total decimal(12,2) default 0,
  received_at timestamp with time zone,       -- when status → received
  created_by uuid references public.profiles(id) on delete set null
);

-- 2. Items de la orden
create table if not exists public.purchase_order_items (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  order_id uuid references public.purchase_orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,               -- snapshot in case product is deleted
  quantity integer not null default 1 check (quantity > 0),
  unit_cost decimal(12,2) not null default 0,
  subtotal decimal(12,2) generated always as (quantity * unit_cost) stored
);

-- 3. RLS
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

-- View: all kiosk members
create policy "Kiosk members can view purchase orders"
  on public.purchase_orders for select
  using (
    exists (
      select 1 from public.kiosk_members
      where kiosk_members.user_id = auth.uid()
        and kiosk_members.kiosk_id = purchase_orders.kiosk_id
    )
  );

-- Manage: owners only
create policy "Owners can manage purchase orders"
  on public.purchase_orders for all
  using (public.is_kiosk_owner(kiosk_id));

create policy "Kiosk members can view purchase order items"
  on public.purchase_order_items for select
  using (
    exists (
      select 1 from public.purchase_orders po
      join public.kiosk_members km on km.kiosk_id = po.kiosk_id
      where po.id = purchase_order_items.order_id
        and km.user_id = auth.uid()
    )
  );

create policy "Owners can manage purchase order items"
  on public.purchase_order_items for all
  using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_items.order_id
        and public.is_kiosk_owner(po.kiosk_id)
    )
  );

-- 4. Índices
create index if not exists idx_purchase_orders_kiosk on public.purchase_orders(kiosk_id);
create index if not exists idx_purchase_orders_supplier on public.purchase_orders(supplier_id);
create index if not exists idx_purchase_order_items_order on public.purchase_order_items(order_id);

-- 5. RPC: receive_purchase_order
--    Marks the order as 'received' and increments stock for each item.
create or replace function public.receive_purchase_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kiosk_id uuid;
  rec record;
begin
  -- Get kiosk_id and validate ownership
  select kiosk_id into v_kiosk_id
  from public.purchase_orders
  where id = p_order_id;

  if not public.is_kiosk_owner(v_kiosk_id) then
    raise exception 'No autorizado';
  end if;

  -- Update order status
  update public.purchase_orders
  set status = 'received', received_at = now(), updated_at = now()
  where id = p_order_id;

  -- Increment stock for each item
  for rec in
    select product_id, quantity
    from public.purchase_order_items
    where order_id = p_order_id and product_id is not null
  loop
    update public.products
    set stock = stock + rec.quantity
    where id = rec.product_id;
  end loop;
end;
$$;
