-- 02 · Нові та повторні замовлення B2C UA по місяцях з 2024 (база: дата створення, оплачені)
-- Джерело: analytics.orders (order_num = порядковий номер оплаченого замовлення клієнта в CRM)
WITH o AS (
  SELECT DATE_TRUNC(created_at, MONTH) m, order_num, client_id, revenue_uah, Promocode
  FROM `perla-holistic-com.analytics.orders`
  WHERE market='UA' AND channel_group_with_b2c='B2C' AND is_paid=1
    AND created_at BETWEEN '2024-01-01' AND DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY)
)
SELECT FORMAT_DATE('%Y-%m', m) month,
  COUNTIF(order_num=1) first_orders,
  COUNTIF(order_num>1) repeat_orders,
  COUNT(*) orders,
  COUNT(DISTINCT client_id) clients,
  ROUND(SUM(revenue_uah/fx.rate_USD)) revenue_usd,
  COUNTIF(Promocode IS NOT NULL AND Promocode<>'') promo_orders
FROM o LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(o.m)=fx.month
GROUP BY m ORDER BY m
