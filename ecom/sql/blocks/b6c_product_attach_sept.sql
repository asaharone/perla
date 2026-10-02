-- Блок 6 · товары в успешных заказах сентября 2026: доля заказов «только этот товар», среднее число позиций рядом, подарки и скидки.
WITH l AS (
  SELECT o.order_id, p.Product_Name product, p.Product_Type ptype, o.quantity, o.product_price, o.invoice_source, MAX(o.revenue_uah) OVER (PARTITION BY o.order_id) revenue_uah,
    COUNT(DISTINCT IF(o.invoice_source<>'Gift', o.product_id, NULL)) OVER (PARTITION BY o.order_id) order_lines
  FROM `perla-holistic-com.analytics.orders_with_upsell` o JOIN `perla-holistic-com.crm_data.zoho_products` p ON p.id = o.product_id
  WHERE o.market='UA' AND IFNULL(o.channel_group,'') NOT IN ('B2B','PR','Employees','Service') AND o.order_date BETWEEN '2026-09-01' AND '2026-09-30' AND o.order_status IN ('Successful','Successful/Deferred Shipment')
)
SELECT product, ANY_VALUE(ptype) product_type, COUNT(DISTINCT order_id) orders, SUM(IF(invoice_source<>'Gift', quantity, 0)) units, ROUND(SUM(IF(invoice_source<>'Gift', quantity*product_price, 0))) revenue_lines_uah,
  COUNTIF(invoice_source<>'Gift' AND order_lines = 1) alone_orders, ROUND(AVG(IF(invoice_source<>'Gift', order_lines, NULL)), 2) avg_lines_with, ROUND(AVG(IF(invoice_source<>'Gift', revenue_uah, NULL))) avg_order_value_uah,
  COUNTIF(invoice_source IN ('Upsell Online','Upsell Manager')) as_upsell, COUNTIF(invoice_source='Gift') as_gift, COUNTIF(invoice_source<>'Gift' AND quantity > 1) qty_gt1
FROM l GROUP BY 1 ORDER BY orders DESC LIMIT 40
