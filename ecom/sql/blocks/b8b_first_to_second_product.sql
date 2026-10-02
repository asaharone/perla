-- Блок 8 · переходы «товар первого заказа → товар второго заказа» (когорта первых заказов 01.2026–06.2026, повтор в течение 180 дней).
WITH contacts AS (SELECT id client_id, REGEXP_REPLACE(IFNULL(Phone, ''), r'\D', '') pd FROM `perla-holistic-com.crm_data.zoho_contacts` WHERE Region='UA' AND NOT IFNULL(deleted, FALSE)),
dedup AS (SELECT client_id, CASE WHEN LENGTH(pd) >= 9 THEN MIN(client_id) OVER (PARTITION BY RIGHT(pd, 9)) ELSE client_id END customer_id FROM contacts),
orders AS (
  SELECT o.id order_id, o.created_at order_date, IFNULL(d.customer_id, o.client_id) customer_id
  FROM `perla-holistic-com.analytics.orders` o LEFT JOIN dedup d ON d.client_id = o.client_id
  WHERE o.market='UA' AND o.is_paid=1 AND o.client_id IS NOT NULL AND IFNULL(o.channel_group,'') NOT IN ('B2B','PR','Employees')
),
ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) rk FROM orders),
first AS (SELECT customer_id, order_id o1, order_date d1 FROM ranked WHERE rk = 1 AND order_date BETWEEN '2026-01-01' AND '2026-06-30'),
second AS (SELECT r.customer_id, r.order_id o2 FROM ranked r JOIN first f USING (customer_id) WHERE r.rk = 2 AND r.order_date <= DATE_ADD(f.d1, INTERVAL 180 DAY)),
items AS (
  SELECT CAST(i.order_id AS INT64) order_id, p.Product_Name product FROM `perla-holistic-com.analytics.orders_with_upsell` i JOIN `perla-holistic-com.crm_data.zoho_products` p ON p.id = i.product_id
  WHERE i.market='UA' AND i.invoice_source <> 'Gift' AND i.order_date >= '2026-01-01' GROUP BY 1, 2
),
tr AS (
  SELECT f.customer_id, a.product p1, b.product p2
  FROM first f JOIN second s USING (customer_id) JOIN items a ON a.order_id = f.o1 JOIN items b ON b.order_id = s.o2
),
p1c AS (SELECT p1, COUNT(DISTINCT customer_id) c1 FROM tr GROUP BY 1)
SELECT tr.p1 first_product, tr.p2 second_product, COUNT(DISTINCT tr.customer_id) customers, p1c.c1 customers_with_first, ROUND(COUNT(DISTINCT tr.customer_id) / p1c.c1, 3) share, tr.p1 = tr.p2 same_product
FROM tr JOIN p1c USING (p1) GROUP BY 1, 2, 4 ORDER BY customers DESC LIMIT 40
