WITH k AS (
  SELECT k.date, SUM(IF(metric_name='Revenue', value,0))*ANY_VALUE(fx.rate_USD) rev, SUM(IF(metric_name='COGS', value,0))*ANY_VALUE(fx.rate_USD) cogs, SUM(IF(metric_name='Gross Profit', value,0))*ANY_VALUE(fx.rate_USD) gp_after, SUM(IF(metric_name='Orders', value,0)) orders
  FROM `perla-holistic-com.analytics.daily_kpi_metrics` k LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(k.date)=fx.month
  WHERE region='UA' AND segment='B2C' AND k.date BETWEEN '2026-09-01' AND '2026-09-30' GROUP BY 1
),
plan AS (SELECT SUM(plan_revenue_uah) rev, SUM(plan_gross_profit_uah) gp, SUM(plan_orders) ord FROM `perla-holistic-com.analytics.monthly_revenue_plan_by_sku` WHERE channel='B2C' AND month_start='2026-09-01'),
w AS (SELECT EXTRACT(DAYOFWEEK FROM date) dow, SUM(value) rev FROM `perla-holistic-com.analytics.daily_kpi_metrics` WHERE region='UA' AND segment='B2C' AND metric_name='Revenue' AND date BETWEEN '2026-07-07' AND '2026-08-31' GROUP BY 1),
days AS (SELECT d, EXTRACT(DAYOFWEEK FROM d) dow FROM UNNEST(GENERATE_DATE_ARRAY('2026-09-01','2026-09-30')) d),
wd AS (SELECT d.d, IFNULL(w.rev,0) wt, SUM(IFNULL(w.rev,0)) OVER () tot FROM days d LEFT JOIN w USING(dow))
SELECT FORMAT_DATE('%Y-%m-%d', wd.d) date, ROUND(IFNULL(k.rev,0)) rev_uah, ROUND(IFNULL(k.rev - k.cogs,0)) gp_uah, ROUND(IFNULL(k.gp_after,0)) gp_after_mkt_uah, CAST(IFNULL(k.orders,0) AS INT64) orders,
  ROUND(plan.rev * wd.wt/wd.tot) plan_rev_uah, ROUND(plan.rev/30) plan_rev_even_uah, ROUND(plan.gp * wd.wt/wd.tot) plan_gp_uah, ROUND(plan.ord * wd.wt/wd.tot,1) plan_orders
FROM wd CROSS JOIN plan LEFT JOIN k ON k.date=wd.d ORDER BY 1
