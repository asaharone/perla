-- 03 · Когорти нових клієнтів B2C UA по кварталу першого оплаченого замовлення: повтор за 90 / 180 / 365 днів
-- mature90 = false, якщо з кінця кварталу ще не минуло 90 днів (показник недозрілий)
WITH o AS (
  SELECT client_id, created_at, order_num
  FROM `perla-holistic-com.analytics.orders`
  WHERE market='UA' AND channel_group_with_b2c='B2C' AND is_paid=1 AND client_id IS NOT NULL
),
f AS (SELECT client_id, created_at AS d0 FROM o WHERE order_num=1),
s AS (SELECT client_id, MIN(created_at) d1 FROM o WHERE order_num>1 GROUP BY 1)
SELECT FORMAT_DATE('%Y-Q%Q', d0) cohort,
  COUNT(*) clients,
  ROUND(COUNTIF(d1 IS NOT NULL AND DATE_DIFF(d1,d0,DAY)<=90)/COUNT(*),4) rep90,
  ROUND(COUNTIF(d1 IS NOT NULL AND DATE_DIFF(d1,d0,DAY)<=180)/COUNT(*),4) rep180,
  ROUND(COUNTIF(d1 IS NOT NULL AND DATE_DIFF(d1,d0,DAY)<=365)/COUNT(*),4) rep365,
  DATE_ADD(MAX(d0), INTERVAL 90 DAY) <= DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) mature90
FROM f LEFT JOIN s USING(client_id)
WHERE d0 >= '2024-01-01'
GROUP BY 1 ORDER BY 1
