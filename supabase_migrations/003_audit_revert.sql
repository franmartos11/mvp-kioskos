-- ==============================================================================
-- MIGRATION 003: AUDIT REVERT
-- ==============================================================================

create or replace function public.revert_stock_audit(
  p_audit_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_audit_record record;
  v_item record;
  v_diff integer;
begin
  -- 1. Get Audit and verify it is completed
  select * into v_audit_record
  from public.stock_audits
  where id = p_audit_id;
  
  if v_audit_record.status != 'completed' then
    raise exception 'Solo se pueden cancelar auditorías completadas';
  end if;
  
  -- 2. Iterate items and revert changes
  for v_item in select * from public.stock_audit_items where audit_id = p_audit_id
  loop
     -- difference is (counted - expected). 
     -- If diff was -2, we subtracted 2. To revert, add 2.
     -- if diff was +5, we added 5. To revert, subtract 5.
     -- So we apply (-1 * difference).
     
     -- Note: generated column 'difference' might not be available in older postgres versions in PL/pgSQL record loop directly if stored?
     -- It should be fine. If not, calc manually: v_item.counted_stock - v_item.expected_stock.
     
     v_diff := v_item.counted_stock - v_item.expected_stock;
     
     if v_diff != 0 then
         perform public.register_stock_adjustment(
            v_item.product_id,
            v_audit_record.kiosk_id,
            'correction',
            -1 * v_diff, -- Reverse the adjustment
            'Audit Revert',
            'Reverting Audit #' || p_audit_id::text
         );
     end if;
  end loop;

  -- 3. Update Audit Status
  update public.stock_audits
  set status = 'cancelled',
      notes = coalesce(notes, '') || ' [Cancelled/Reverted]'
  where id = p_audit_id;

end;
$$;
