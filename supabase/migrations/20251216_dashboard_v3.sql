create or replace function get_dashboard_stats_v3(
  p_user_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns json language plpgsql security definer as $$
declare
  v_user_kiosks uuid[];
  v_total_sales bigint;
  v_total_revenue decimal;
  v_total_cost decimal;
  v_total_expenses decimal;
  v_gross_profit decimal;
  v_net_income decimal;
  v_ticket_avg decimal;
  v_margin decimal;
  v_trend json;
  v_pie json;
  v_top_products json;
  v_stock_alerts bigint;
begin
  -- 1. Get User Kiosks
  select array_agg(kiosk_id) into v_user_kiosks from kiosk_members where user_id = p_user_id;

  -- 2. Financial Aggregates
  -- Using Sales + SaleItems to ensure accuracy (Net Revenue vs Items)
  select
    count(distinct s.id),
    coalesce(sum(si.subtotal), 0),
    coalesce(sum(si.quantity * coalesce(si.cost, 0)), 0)
  into v_total_sales, v_total_revenue, v_total_cost
  from sales s
  join sale_items si on s.id = si.sale_id
  where s.created_at >= p_start_date
    and s.created_at <= p_end_date
    and s.kiosk_id = any(v_user_kiosks);

  -- 3. Expenses
  select coalesce(sum(amount), 0) into v_total_expenses
  from expenses
  where date >= p_start_date
    and date <= p_end_date
    and kiosk_id = any(v_user_kiosks);

  -- 4. Derived Metrics
  v_gross_profit := v_total_revenue - v_total_cost;
  v_net_income := v_gross_profit - v_total_expenses;
  
  if v_total_sales > 0 then
    v_ticket_avg := v_total_revenue / v_total_sales;
  else
    v_ticket_avg := 0;
  end if;

  if v_total_revenue > 0 then
    v_margin := (v_gross_profit / v_total_revenue) * 100;
  else
    v_margin := 0;
  end if;

  -- 5. Trend (Daily Sales)
  select json_agg(t) into v_trend from (
    select date(s.created_at) as date, sum(s.total) as amount
    from sales s
    where s.created_at >= p_start_date
      and s.created_at <= p_end_date
      and s.kiosk_id = any(v_user_kiosks)
    group by date(s.created_at)
    order by date(s.created_at)
  ) t;

  -- 6. Pie (Sales by Kiosk)
  select json_agg(t) into v_pie from (
    select k.name, sum(s.total) as value
    from sales s
    join kiosks k on s.kiosk_id = k.id
    where s.created_at >= p_start_date
      and s.created_at <= p_end_date
      and s.kiosk_id = any(v_user_kiosks)
    group by k.name
  ) t;

  -- 7. Top Products
  -- Requires join with products table via sale_items
  -- Attempting to use product name from products table. 
  -- If sale_items has product_id, this works.
  select json_agg(t) into v_top_products from (
    select p.name, sum(si.quantity) as quantity, sum(si.subtotal) as revenue
    from sale_items si
    join sales s on si.sale_id = s.id
    join products p on si.product_id = p.id
    where s.created_at >= p_start_date
      and s.created_at <= p_end_date
      and s.kiosk_id = any(v_user_kiosks)
    group by p.name
    order by quantity desc
    limit 5
  ) t;

  -- 8. Stock Alerts (Global across all user kiosks)
  select count(*) into v_stock_alerts
  from products
  where kiosk_id = any(v_user_kiosks)
    and stock <= min_stock;

  return json_build_object(
    'totalSales', v_total_sales,
    'totalRevenue', v_total_revenue,
    'totalCost', v_total_cost,
    'totalExpenses', v_total_expenses,
    'grossProfit', v_gross_profit,
    'netIncome', v_net_income,
    'ticketAvg', v_ticket_avg,
    'margin', v_margin,
    'trend', coalesce(v_trend, '[]'::json),
    'pie', coalesce(v_pie, '[]'::json),
    'topProducts', coalesce(v_top_products, '[]'::json),
    'stockAlerts', v_stock_alerts
  );
end;
$$;
