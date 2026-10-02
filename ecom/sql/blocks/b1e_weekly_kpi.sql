-- Блок 1 · недельный тренд B2C UA: выручка, GP, маркетинг, заказы (daily_kpi_metrics, USD → UAH по курсу месяца).
SELECT FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(k.date, WEEK(MONDAY))) week_start,
  ROUND(SUM(IF(metric_name='Revenue', value, 0) * fx.rate_USD)) revenue_uah,
  ROUND(SUM(IF(metric_name='Revenue', value, 0) * fx.rate_USD) - SUM(IF(metric_name='COGS', value, 0) * fx.rate_USD)) gp_uah,
  ROUND(SUM(IF(metric_name='Marketing Budget', value, 0) * fx.rate_USD)) marketing_uah,
  ROUND(SUM(IF(metric_name='Gross Profit', value, 0) * fx.rate_USD)) gp_after_mkt_uah,
  CAST(SUM(IF(metric_name='Orders', value, 0)) AS INT64) orders, COUNT(DISTINCT k.date) days
FROM `perla-holistic-com.analytics.daily_kpi_metrics` k LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(k.date)=fx.month
WHERE region='UA' AND segment='B2C' AND k.date BETWEEN '2025-12-29' AND '2026-10-01' GROUP BY 1 ORDER BY 1
