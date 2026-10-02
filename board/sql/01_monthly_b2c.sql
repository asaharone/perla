-- Perla Helsa · Board Cockpit · 01 · B2C Україна помісячно (знімок)
-- База: дата відвантаження (як Finance Overview / daily_kpi_metrics). Валюта: USD.
-- Джерела: analytics.daily_kpi_metrics (виручка, замовлення, COGS, Net Cost, маркетинг, GP, знижка — B2C, B2B, Other),
--          analytics.fct_ad_stats (розбивка маркетингу по каналах + дні, яких немає в daily_kpi_metrics),
--          analytics.orders_by_shipment_date (нові клієнти = перше замовлення клієнта в CRM; повторні; промокоди).
-- Виправлення, вбудовані в запит:
--  1) У daily_kpi_metrics бракує неділь без відгрузок (березень–липень 2026): рекламні витрати цих днів туди не потрапили.
--     Додаємо їх із fct_ad_stats і віднімаємо з GP.
--  2) Бюджет блогерів у fct_ad_stats записаний двома половинами: google/organic і (direct)/(none). Обидві — інфлюенс.
-- Останній рядок (поточний місяць) — неповний: complete = false.
WITH params AS (
  SELECT DATE '2026-01-01' AS d_from, DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) AS d_to
),
cal AS (SELECT d AS date FROM params, UNNEST(GENERATE_DATE_ARRAY(d_from, d_to)) AS d),
kpi_day AS (
  SELECT k.date,
    SUM(IF(k.segment='B2C' AND k.metric_name='Revenue', k.value, 0)) rev,
    SUM(IF(k.segment='B2C' AND k.metric_name='Orders', k.value, 0)) orders,
    SUM(IF(k.segment='B2C' AND k.metric_name='COGS', k.value, 0)) cogs,
    SUM(IF(k.segment='B2C' AND k.metric_name='Net Cost', k.value, 0)) net_cost,
    SUM(IF(k.segment='B2C' AND k.metric_name='Marketing Budget', k.value, 0)) mkt,
    SUM(IF(k.segment='B2C' AND k.metric_name='Gross Profit', k.value, 0)) gp,
    MAX(IF(k.segment='B2C' AND k.metric_name='Effective Discount %', k.value, NULL)) disc_pct,
    SUM(IF(k.segment='B2B' AND k.metric_name='Revenue', k.value, 0)) rev_b2b,
    SUM(IF(k.segment='B2B' AND k.metric_name='Orders', k.value, 0)) orders_b2b,
    SUM(IF(k.segment='B2B' AND k.metric_name='COGS', k.value, 0)) cogs_b2b,
    SUM(IF(k.segment='B2B' AND k.metric_name='Gross Profit', k.value, 0)) gp_b2b,
    SUM(IF(k.segment='Other' AND k.metric_name='Revenue', k.value, 0)) rev_other,
    SUM(IF(k.segment='Other' AND k.metric_name='Gross Profit', k.value, 0)) gp_other
  FROM `perla-holistic-com.analytics.daily_kpi_metrics` k, params
  WHERE k.region='UA' AND k.date BETWEEN params.d_from AND params.d_to
  GROUP BY k.date
),
ad_day AS (
  SELECT a.date,
    SUM(IF(a.source IN ('facebook.com','instagram.com'), a.spend_uah, 0)/fx.rate_USD) meta,
    SUM(IF(a.source='google' AND a.medium='cpc', a.spend_uah, 0)/fx.rate_USD) google,
    SUM(IF((a.source='(direct)' AND a.medium='(none)') OR (a.source='google' AND a.medium='organic'), a.spend_uah, 0)/fx.rate_USD) influence,
    SUM(IF(a.source='tiktok', a.spend_uah, 0)/fx.rate_USD) tiktok,
    SUM(a.spend_uah/fx.rate_USD) ads_total,
    SUM(IF(a.source='facebook.com', a.purchase, 0)) meta_purchases,
    SUM(IF(a.source='google' AND a.medium='cpc', a.purchase, 0)) google_purchases
  FROM `perla-holistic-com.analytics.fct_ad_stats` a
  JOIN params ON a.date BETWEEN params.d_from AND params.d_to
  LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(a.date)=fx.month
  WHERE a.market='UA'
  GROUP BY a.date
),
daily AS (
  SELECT c.date, k.date IS NULL AS kpi_missing,
    IFNULL(k.rev,0) rev, IFNULL(k.orders,0) orders, IFNULL(k.cogs,0) cogs, IFNULL(k.net_cost,0) net_cost,
    IFNULL(k.mkt,0) mkt_kpi, IFNULL(k.gp,0) gp_kpi, k.disc_pct,
    IFNULL(k.rev_b2b,0) rev_b2b, IFNULL(k.orders_b2b,0) orders_b2b, IFNULL(k.cogs_b2b,0) cogs_b2b, IFNULL(k.gp_b2b,0) gp_b2b,
    IFNULL(k.rev_other,0) rev_other, IFNULL(k.gp_other,0) gp_other,
    IFNULL(a.meta,0) meta, IFNULL(a.google,0) google, IFNULL(a.influence,0) influence, IFNULL(a.tiktok,0) tiktok, IFNULL(a.ads_total,0) ads_total,
    IFNULL(a.meta_purchases,0) meta_purchases, IFNULL(a.google_purchases,0) google_purchases
  FROM cal c LEFT JOIN kpi_day k ON k.date=c.date LEFT JOIN ad_day a ON a.date=c.date
),
by_month AS (
  SELECT DATE_TRUNC(date, MONTH) month,
    COUNT(*) days, COUNTIF(kpi_missing) days_missing,
    SUM(rev) revenue, SUM(orders) orders, SUM(cogs) cogs, SUM(net_cost) net_cost,
    SUM(mkt_kpi) + SUM(IF(kpi_missing, ads_total, 0)) marketing,
    SUM(IF(kpi_missing, ads_total, 0)) mkt_missing_days,
    SUM(gp_kpi) - SUM(IF(kpi_missing, ads_total, 0)) cm3,
    SUM(rev_b2b) revenue_b2b, SUM(orders_b2b) orders_b2b, SUM(cogs_b2b) cogs_b2b, SUM(gp_b2b) gp_b2b,
    SUM(rev_other) revenue_other, SUM(gp_other) gp_other,
    SUM(meta) meta, SUM(google) google, SUM(influence) influence, SUM(tiktok) tiktok,
    SUM(meta_purchases) meta_purchases, SUM(google_purchases) google_purchases,
    SAFE_DIVIDE(SUM(IF(disc_pct<100, rev*disc_pct/(100-disc_pct),0)), SUM(IF(disc_pct<100, rev*100/(100-disc_pct),0))) discount_eff,
    SUM(IF(disc_pct<100, rev*disc_pct/(100-disc_pct),0)) discount_usd
  FROM daily GROUP BY month
),
ship AS (
  SELECT DATE_TRUNC(o.created_at, MONTH) month,
    COUNT(DISTINCT IF(o.order_num=1, o.client_id, NULL)) new_customers,
    COUNTIF(o.order_num>1) repeat_orders,
    COUNT(*) orders_ship,
    COUNTIF(o.promocode IS NOT NULL AND o.promocode<>'') promo_orders
  FROM `perla-holistic-com.analytics.orders_by_shipment_date` o, params
  WHERE o.market='UA' AND o.channel_group_with_b2c='B2C' AND o.is_terminated=0
    AND o.created_at BETWEEN params.d_from AND params.d_to
  GROUP BY month
)
SELECT FORMAT_DATE('%Y-%m', m.month) month,
  LAST_DAY(m.month) <= (SELECT d_to FROM params) complete,
  m.days, m.days_missing,
  ROUND(m.revenue) revenue, CAST(m.orders AS INT64) orders, ROUND(m.cogs) cogs, ROUND(m.net_cost) net_cost,
  ROUND(m.marketing) marketing, ROUND(m.mkt_missing_days) mkt_missing_days, ROUND(m.cm3) cm3,
  ROUND(m.discount_eff,4) discount_eff, ROUND(m.discount_usd) discount_usd,
  ROUND(m.revenue_b2b) revenue_b2b, CAST(m.orders_b2b AS INT64) orders_b2b, ROUND(m.cogs_b2b) cogs_b2b, ROUND(m.gp_b2b) gp_b2b,
  ROUND(m.revenue_other) revenue_other, ROUND(m.gp_other) gp_other,
  ROUND(m.meta) meta, ROUND(m.google) google, ROUND(m.influence) influence, ROUND(m.tiktok) tiktok,
  CAST(m.meta_purchases AS INT64) meta_purchases, CAST(m.google_purchases AS INT64) google_purchases,
  s.new_customers, s.repeat_orders, s.orders_ship, s.promo_orders
FROM by_month m LEFT JOIN ship s USING(month) ORDER BY m.month
