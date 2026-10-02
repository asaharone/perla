-- Блок 6 · структура успешных заказов B2C UA × месяц: число платных позиций, кол-во >1, наборы (Complexes), подарки, скидки.
WITH o AS (
  SELECT o.order_id, o.order_date, COUNTIF(o.invoice_source<>'Gift') lines, SUM(IF(o.invoice_source<>'Gift', o.quantity, 0)) units,
    MAX(IF(o.invoice_source<>'Gift' AND o.quantity>1, 1, 0)) qty_gt1, MAX(IF(p.Product_Type='Complexes', 1, 0)) bundle, MAX(IF(o.invoice_source='Gift', 1, 0)) gift,
    MAX(IF(o.discount_percent > 0 OR o.discount_sum > 0, 1, 0)) discounted, MAX(o.revenue_uah) revenue_uah
  FROM `perla-holistic-com.analytics.orders_with_upsell` o LEFT JOIN `perla-holistic-com.crm_data.zoho_products` p ON p.id = o.product_id
  WHERE o.market='UA' AND IFNULL(o.channel_group,'') NOT IN ('B2B','PR','Employees','Service') AND o.order_date BETWEEN '2026-01-01' AND '2026-09-30' AND o.order_status IN ('Successful','Successful/Deferred Shipment')
  GROUP BY 1, 2
)
SELECT FORMAT_DATE('%Y-%m', order_date) month, COUNT(*) orders, COUNTIF(lines=1) lines_1, COUNTIF(lines=2) lines_2, COUNTIF(lines=3) lines_3, COUNTIF(lines>=4) lines_4plus,
  COUNTIF(qty_gt1=1) with_qty_gt1, COUNTIF(bundle=1) with_bundle, COUNTIF(gift=1) with_gift, COUNTIF(discounted=1) with_discount,
  ROUND(AVG(IF(lines=1, revenue_uah, NULL))) aov_lines_1, ROUND(AVG(IF(lines=2, revenue_uah, NULL))) aov_lines_2, ROUND(AVG(IF(lines>=3, revenue_uah, NULL))) aov_lines_3plus, ROUND(AVG(units), 3) upo
FROM o GROUP BY 1 ORDER BY 1
