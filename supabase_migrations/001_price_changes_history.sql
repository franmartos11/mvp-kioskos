-- Create table for tracking price changes
create table if not exists price_changes_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  action_type text not null, -- 'BULK_MANUAL', 'BULK_SUPPLIER', 'REVERT'
  description text,
  affected_products jsonb -- Stores array of { id, name, old_price, new_price }
);

-- Add policy to allow authenticated users to view/insert
alter table price_changes_history enable row level security;

drop policy if exists "Users can view history" on price_changes_history;
create policy "Users can view history"
  on price_changes_history for select
  to authenticated
  using (true);

drop policy if exists "Users can insert history" on price_changes_history;
create policy "Users can insert history"
  on price_changes_history for insert
  to authenticated
  with check (auth.uid() = user_id);
