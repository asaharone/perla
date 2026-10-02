-- 07 · Історія знижки і середнього чека B2C UA з 2024 (база: дата створення, оплачені). Для 2024–2025, де daily_kpi_metrics немає.
-- disc_eff = 1 − сума чеків / сума повних цін (fact_price_without_discount)
SELECT FORMAT_DATE('%Y-%m', o.created_at) month,
  COUNT(*) orders,
  ROUND(SUM(o.order_fact/fx.rate_USD)) billed_usd,
  ROUND(SUM(o.order_fact/fx.rate_USD)/COUNT(*),2) aov,
  ROUND(1 - SAFE_DIVIDE(SUM(IF(o.fact_price_without_discount_uah>0, o.order_fact, 0)), SUM(IF(o.fact_price_without_discount_uah>0, o.fact_price_without_discount_uah, 0))),4) disc_eff,
  ROUND(COUNTIF(o.fact_price_without_discount_uah>0)/COUNT(*),3) disc_coverage
FROM `perla-holistic-com.analytics.orders` o
LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(o.created_at)=fx.month
WHERE o.market='UA' AND o.channel_group_with_b2c='B2C' AND o.is_paid=1 AND o.created_at >= '2024-01-01' AND o.created_at < CURRENT_DATE('Europe/Kyiv')
GROUP BY 1 ORDER BY 1
