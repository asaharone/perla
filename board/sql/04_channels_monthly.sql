-- 04 · Рекламні витрати UA по каналах з 2025, USD за курсом місяця; покупки за кабінетами Meta і Google
-- Джерело: analytics.fct_ad_stats. Google включає ПДВ (у P&L нижче). Блогери = (direct)/(none) + google/organic.
SELECT FORMAT_DATE('%Y-%m', a.date) month,
  ROUND(SUM(IF(a.source IN ('facebook.com','instagram.com'), a.spend_uah, 0)/fx.rate_USD)) meta,
  ROUND(SUM(IF(a.source='google' AND a.medium='cpc', a.spend_uah, 0)/fx.rate_USD)) google,
  ROUND(SUM(IF((a.source='(direct)' AND a.medium='(none)') OR (a.source='google' AND a.medium='organic'), a.spend_uah, 0)/fx.rate_USD)) influence,
  ROUND(SUM(IF(a.source='tiktok', a.spend_uah, 0)/fx.rate_USD)) tiktok,
  ROUND(SUM(a.spend_uah/fx.rate_USD)) ads_total,
  CAST(SUM(IF(a.source='facebook.com', a.purchase, 0)) AS INT64) meta_purchases,
  ROUND(SUM(IF(a.source='facebook.com', a.purchase_value_uah, 0)/fx.rate_USD)) meta_purchase_value,
  CAST(SUM(IF(a.source='google' AND a.medium='cpc', a.purchase, 0)) AS INT64) google_purchases,
  ROUND(SUM(IF(a.source='google' AND a.medium='cpc', a.purchase_value_uah, 0)/fx.rate_USD)) google_purchase_value
FROM `perla-holistic-com.analytics.fct_ad_stats` a
LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(a.date)=fx.month
WHERE a.market='UA' AND a.date >= '2025-01-01' AND a.date < CURRENT_DATE('Europe/Kyiv')
GROUP BY 1 ORDER BY 1
