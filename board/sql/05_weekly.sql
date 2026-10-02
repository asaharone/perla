-- 05 · B2C UA по тижнях (пн–нд), останні 16 тижнів: виручка, замовлення, маркетинг, CM3, знижка, канали, нові клієнти
-- Та сама логіка виправлень, що в 01. Останній тиждень неповний (days < 7).
WITH params AS (SELECT DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) d_to),
cal AS (SELECT d date FROM params, UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(DATE_TRUNC(d_to, WEEK(MONDAY)), INTERVAL 15 WEEK), d_to)) d),
kpi_day AS (
  SELECT k.date,
    SUM(IF(k.metric_name='Revenue', k.value, 0)) rev, SUM(IF(k.metric_name='Orders', k.value, 0)) orders,
    SUM(IF(k.metric_name='COGS', k.value, 0)) cogs, SUM(IF(k.metric_name='Marketing Budget', k.value, 0)) mkt,
    SUM(IF(k.metric_name='Gross Profit', k.value, 0)) gp, MAX(IF(k.metric_name='Effective Discount %', k.value, NULL)) disc_pct
  FROM `perla-holistic-com.analytics.daily_kpi_metrics` k JOIN cal USING(date)
  WHERE k.region='UA' AND k.segment='B2C' GROUP BY 1
),
ad_day AS (
  SELECT a.date,
    SUM(IF(a.source IN ('facebook.com','instagram.com'), a.spend_uah, 0)/fx.rate_USD) meta,
    SUM(IF(a.source='google' AND a.medium='cpc', a.spend_uah, 0)/fx.rate_USD) google,
    SUM(IF((a.source='(direct)' AND a.medium='(none)') OR (a.source='google' AND a.medium='organic'), a.spend_uah, 0)/fx.rate_USD) influence,
    SUM(a.spend_uah/fx.rate_USD) ads_total,
    SUM(IF(a.source='facebook.com', a.purchase, 0)) meta_purchases
  FROM `perla-holistic-com.analytics.fct_ad_stats` a JOIN cal USING(date)
  LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(a.date)=fx.month
  WHERE a.market='UA' GROUP BY 1
),
daily AS (
  SELECT c.date, k.date IS NULL kpi_missing, IFNULL(k.rev,0) rev, IFNULL(k.orders,0) orders, IFNULL(k.cogs,0) cogs,
    IFNULL(k.mkt,0) mkt_kpi, IFNULL(k.gp,0) gp_kpi, k.disc_pct,
    IFNULL(a.meta,0) meta, IFNULL(a.google,0) google, IFNULL(a.influence,0) influence, IFNULL(a.ads_total,0) ads_total, IFNULL(a.meta_purchases,0) meta_purchases
  FROM cal c LEFT JOIN kpi_day k ON k.date=c.date LEFT JOIN ad_day a ON a.date=c.date
),
ship AS (
  SELECT DATE_TRUNC(o.created_at, WEEK(MONDAY)) week,
    COUNT(DISTINCT IF(o.order_num=1, o.client_id, NULL)) new_customers, COUNT(*) orders_ship,
    COUNTIF(o.promocode IS NOT NULL AND o.promocode<>'') promo_orders
  FROM `perla-holistic-com.analytics.orders_by_shipment_date` o JOIN cal ON o.created_at=cal.date
  WHERE o.market='UA' AND o.channel_group_with_b2c='B2C' AND o.is_terminated=0 GROUP BY 1
)
SELECT FORMAT_DATE('%Y-%m-%d', w.week) week_start, w.days, w.days_missing,
  ROUND(w.revenue) revenue, CAST(w.orders AS INT64) orders, ROUND(w.cogs) cogs, ROUND(w.marketing) marketing, ROUND(w.cm3) cm3,
  ROUND(w.discount_eff,4) discount_eff, ROUND(w.meta) meta, ROUND(w.google) google, ROUND(w.influence) influence,
  CAST(w.meta_purchases AS INT64) meta_purchases, s.new_customers, s.orders_ship, s.promo_orders
FROM (
  SELECT DATE_TRUNC(date, WEEK(MONDAY)) week, COUNT(*) days, COUNTIF(kpi_missing) days_missing,
    SUM(rev) revenue, SUM(orders) orders, SUM(cogs) cogs,
    SUM(mkt_kpi)+SUM(IF(kpi_missing, ads_total,0)) marketing,
    SUM(gp_kpi)-SUM(IF(kpi_missing, ads_total,0)) cm3,
    SAFE_DIVIDE(SUM(IF(disc_pct<100, rev*disc_pct/(100-disc_pct),0)), SUM(IF(disc_pct<100, rev*100/(100-disc_pct),0))) discount_eff,
    SUM(meta) meta, SUM(google) google, SUM(influence) influence, SUM(meta_purchases) meta_purchases
  FROM daily GROUP BY 1
) w LEFT JOIN ship s USING(week) ORDER BY w.week
