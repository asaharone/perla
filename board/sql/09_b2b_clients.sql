-- 09 · B2B 2026: виставлені рахунки по клієнтах (Zoho, без повернень) — концентрація; топ-12
SELECT b2b_client_name,
  ROUND(SUM(order_fact / fx.rate_USD)) invoiced_usd_2026,
  ROUND(SUM(IF(created_at >= '2026-06-01', order_fact / fx.rate_USD, 0))) invoiced_usd_jun_sep,
  COUNT(*) deals
FROM `perla-holistic-com.analytics.orders` o
LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(o.created_at)=fx.month
WHERE market='UA' AND channel_group_with_b2c='B2B' AND created_at >= '2026-01-01' AND status <> 'Canceled'
GROUP BY 1 ORDER BY 2 DESC LIMIT 12
