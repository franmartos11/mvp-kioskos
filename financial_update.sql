-- 1. Agregar columna de Costo a Sale Items (Para historial de rentabilidad)
-- Esto permite saber cuánto costó el producto en el momento exacto de la venta.
alter table public.sale_items 
add column if not exists cost decimal(10,2) not null default 0;

-- 2. Actualizar función de estadísticas para calcular Ganancia Bruta Real
-- Net Income = (Ventas Totales) - (Costo de Mercadería Vendida) - (Gastos Operativos)
create or replace function get_dashboard_stats_v2(
  p_user_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  v_total_sales bigint;
  v_total_revenue decimal;   -- Total facturado (Price * Qty)
  v_total_cogs decimal;      -- Cost of Goods Sold (Cost * Qty)
  v_gross_profit decimal;    -- Revenue - COGS
  v_total_expenses decimal;  -- Gastos operativos (Luz, Alquiler, etc)
  v_net_income decimal;      -- Gross Profit - Expenses
  
  v_top_kiosk text;
  v_user_kiosks uuid[];
begin
  -- Get user's kiosks
  select array_agg(kiosk_id) into v_user_kiosks
  from kiosk_members
  where user_id = p_user_id;

  -- 1. Sales, Revenue & COGS
  select 
    count(distinct s.id), 
    coalesce(sum(si.subtotal), 0),
    coalesce(sum(si.quantity * si.cost), 0)
  into v_total_sales, v_total_revenue, v_total_cogs
  from sales s
  join sale_items si on s.id = si.sale_id
  where s.created_at >= p_start_date 
    and s.created_at <= p_end_date
    and s.kiosk_id = any(v_user_kiosks);

  v_gross_profit := v_total_revenue - v_total_cogs;

  -- 2. Expenses (Operational)
  -- Nota: Aquí asumimos que todos los registros en 'expenses' son operativos.
  -- Si en el futuro diferenciamos "Compra de Mercadería" vs "Luz", deberíamos filtrar.
  -- Por ahora, la compra de mercadería (stock) NO debería ir a 'expenses' si queremos llevar un P&L contable estricto,
  -- PERO para un kiosco simple, a veces se mezcla. 
  -- Con este nuevo modelo de COGS, lo ideal es que 'expenses' sean salarios, servicios, etc.
  select 
    coalesce(sum(amount), 0)
  into v_total_expenses
  from expenses
  where date >= p_start_date 
    and date <= p_end_date
    and kiosk_id = any(v_user_kiosks);

  v_net_income := v_gross_profit - v_total_expenses;

  -- 3. Top Kiosk
  select k.name into v_top_kiosk
  from sales s
  join kiosks k on s.kiosk_id = k.id
  where s.created_at >= p_start_date 
    and s.created_at <= p_end_date
    and s.kiosk_id = any(v_user_kiosks)
  group by k.name
  order by sum(s.total) desc
  limit 1;

  return json_build_object(
    'totalSales', v_total_sales,
    'totalRevenue', v_total_revenue,
    'totalCost', v_total_cogs,
    'grossProfit', v_gross_profit,
    'totalExpenses', v_total_expenses,
    'netIncome', v_net_income,
    'topKiosk', coalesce(v_top_kiosk, 'N/A'),
    'trend', '[]'::json, -- Placeholder
    'pie', '[]'::json    -- Placeholder
  );
end;
$$;
