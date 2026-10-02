-- Блок 6 · пары товаров в одном успешном заказе (июль–сентябрь 2026): поддержка и lift относительно независимой покупки.
WITH l AS (
  SELECT DISTINCT o.order_id, p.Product_Name product
  FROM `perla-holistic-com.analytics.orders_with_upsell` o JOIN `perla-holistic-com.crm_data.zoho_products` p ON p.id = o.product_id
  WHERE o.market='UA' AND IFNULL(o.channel_group,'') NOT IN ('B2B','PR','Employees','Service') AND o.order_date BETWEEN '2026-07-01' AND '2026-09-30'
    AND o.order_status IN ('Successful','Successful/Deferred Shipment') AND o.invoice_source <> 'Gift' AND p.Product_Type NOT IN ('Services','Certificates','Marketing Materials')
),
n AS (SELECT COUNT(DISTINCT order_id) orders FROM l),
pc AS (SELECT product, COUNT(*) orders FROM l GROUP BY 1)
SELECT a.product product_a, b.product product_b, COUNT(*) pair_orders, pa.orders orders_a, pb.orders orders_b,
  ROUND(COUNT(*) / n.orders, 4) support, ROUND(COUNT(*) / pa.orders, 3) p_b_given_a, ROUND(COUNT(*) * n.orders / (pa.orders * pb.orders), 2) lift
FROM l a JOIN l b ON a.order_id = b.order_id AND a.product < b.product JOIN pc pa ON pa.product = a.product JOIN pc pb ON pb.product = b.product, n
GROUP BY 1, 2, 4, 5, n.orders ORDER BY pair_orders DESC LIMIT 30
