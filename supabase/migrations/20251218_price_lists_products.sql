-- Add excluded_product_ids to price_lists
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'price_lists' and column_name = 'excluded_product_ids') then 
        alter table public.price_lists add column excluded_product_ids UUID[] DEFAULT '{}';
    end if; 
end $$;
