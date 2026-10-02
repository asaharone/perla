WITH o AS (
  SELECT CAST(order_id AS INT64) order_id, order_date, MAX(revenue_uah) revenue_uah, SUM(IF(invoice_source<>'Gift', quantity,0)) paid_units, COUNTIF(invoice_source<>'Gift') paid_lines, SUM(IF(invoice_source IN ('Upsell Online','Upsell Manager'), sku_upsell_sum,0)) upsell_uah
  FROM `perla-holistic-com.analytics.orders_with_upsell` WHERE market='UA' AND IFNULL(channel_group,'') NOT IN ('B2B','PR','Employees','Service') AND order_date BETWEEN '2026-01-01' AND '2026-09-30' AND order_status IN ('Successful','Successful/Deferred Shipment') GROUP BY 1,2
),
p AS (SELECT id order_id, order_num FROM `perla-holistic-com.analytics.orders` WHERE market='UA' AND is_paid=1)
SELECT FORMAT_DATE('%Y-%m', o.order_date) month, CASE WHEN p.order_num=1 THEN 'new' WHEN p.order_num>1 THEN 'repeat' ELSE 'unknown' END ctype, COUNT(*) orders, ROUND(SUM(revenue_uah)) revenue_uah, ROUND(AVG(revenue_uah),1) aov, ROUND(AVG(paid_units),3) upo, ROUND(AVG(paid_lines),3) lines, COUNTIF(paid_lines=1) single_line, ROUND(SUM(upsell_uah)) upsell_uah
FROM o LEFT JOIN p USING(order_id) GROUP BY 1,2 ORDER BY 1,2
