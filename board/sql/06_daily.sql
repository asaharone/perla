-- 06 · B2C UA по днях, останні 42 дні (пульс): виручка, замовлення, маркетинг, CM3, знижка. Неділі без відгрузок — рев ≈ 0.
WITH params AS (SELECT DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) d_to),
cal AS (SELECT d date FROM params, UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(d_to, INTERVAL 41 DAY), d_to)) d),
kpi AS (
  SELECT k.date, SUM(IF(k.metric_name='Revenue', k.value, 0)) rev, SUM(IF(k.metric_name='Orders', k.value, 0)) orders,
    SUM(IF(k.metric_name='Marketing Budget', k.value, 0)) mkt, SUM(IF(k.metric_name='Gross Profit', k.value, 0)) gp,
    MAX(IF(k.metric_name='Effective Discount %', k.value, NULL)) disc_pct
  FROM `perla-holistic-com.analytics.daily_kpi_metrics` k JOIN cal USING(date) WHERE k.region='UA' AND k.segment='B2C' GROUP BY 1
),
ads AS (
  SELECT a.date, SUM(a.spend_uah/fx.rate_USD) ads_total
  FROM `perla-holistic-com.analytics.fct_ad_stats` a JOIN cal USING(date)
  LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(a.date)=fx.month WHERE a.market='UA' GROUP BY 1
)
SELECT FORMAT_DATE('%Y-%m-%d', c.date) date, k.date IS NULL kpi_missing,
  ROUND(IFNULL(k.rev,0)) revenue, CAST(IFNULL(k.orders,0) AS INT64) orders,
  ROUND(IF(k.date IS NULL, IFNULL(a.ads_total,0), k.mkt)) marketing,
  ROUND(IF(k.date IS NULL, -IFNULL(a.ads_total,0), k.gp)) cm3,
  ROUND(k.disc_pct,1) disc_pct
FROM cal c LEFT JOIN kpi k ON k.date=c.date LEFT JOIN ads a ON a.date=c.date ORDER BY c.date
