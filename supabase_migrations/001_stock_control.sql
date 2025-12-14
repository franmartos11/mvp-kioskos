-- ==============================================================================
-- MIGRATION 001: STOCK CONTROL
-- ==============================================================================

-- 1. Create stock_movements table
create table if not exists public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  product_id uuid references public.products(id) on delete cascade not null,
  kiosk_id uuid references public.kiosks(id) not null,
  user_id uuid references auth.users(id) not null,
  
  type text not null check (type in ('sale', 'restock', 'correction', 'loss', 'return')),
  quantity integer not null, -- Positive adds to stock, negative removes
  reason text, -- For corrections/losses e.g. "Expired", "Stolen"
  notes text,
  
  -- Snapshot of cost/price at the time of movement (Optional but good for auditing)
  cost_at_time decimal(10,2),
  price_at_time decimal(10,2)
);

-- 2. Enable RLS
alter table public.stock_movements enable row level security;

create policy "Users can view movements of their kiosk"
on public.stock_movements for select
using (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = stock_movements.kiosk_id
  )
);

create policy "Users can insert movements for their kiosk"
on public.stock_movements for insert
with check (
  exists (
    select 1 from public.kiosk_members
    where kiosk_members.user_id = auth.uid()
    and kiosk_members.kiosk_id = stock_movements.kiosk_id
  )
);

-- 3. RPC: Register Stock Adjustment
-- This function handles the atomic update of the product stock AND the creation of the movement record
create or replace function public.register_stock_adjustment(
  p_product_id uuid,
  p_kiosk_id uuid,
  p_type text, -- 'restock', 'correction', 'loss', 'return'
  p_quantity integer, -- Absolute Value. Logic will handle sign.
  p_reason text,
  p_notes text
)
returns void
language plpgsql
security definer
as $$
declare
  v_final_quantity integer;
  v_current_stock integer;
begin
  -- Determine sign based on type
  -- Restock/Return = Add
  -- Correction/Loss = Remove (Usually, but corrections can be positive too. simpler to pass actual change)
  -- Let's simplify: The UI should pass the SIGNED quantity? 
  -- Risk: User might pass +5 for a loss.
  -- Better: Logic here.
  
  if p_type = 'loss' or p_type = 'sale' then
     v_final_quantity := -1 * abs(p_quantity);
  else
     -- restock, return, correction (assume correction is passed as signed? No, usually corrections are "I found 5 more" or "I am missing 5")
     -- Let's assume for this RPC, if type is 'correction', the quantity can be pos or neg. 
     -- If type is 'loss', it must be negative.
     -- If type is 'restock', it must be positive.
     
     if p_type = 'restock' or p_type = 'return' then
        v_final_quantity := abs(p_quantity);
     elsif p_type = 'loss' then
        v_final_quantity := -1 * abs(p_quantity);
     else 
        -- Correction: Trust the input sign? Or take explicit action?
        -- Let's trust input sign for correction.
        v_final_quantity := p_quantity; 
     end if;
  end if;

  -- 1. Insert Movement
  insert into public.stock_movements (
    product_id, kiosk_id, user_id, type, quantity, reason, notes
  ) values (
    p_product_id, p_kiosk_id, auth.uid(), p_type, v_final_quantity, p_reason, p_notes
  );

  -- 2. Update Product Stock
  update public.products
  set stock = stock + v_final_quantity
  where id = p_product_id;
  
end;
$$;
