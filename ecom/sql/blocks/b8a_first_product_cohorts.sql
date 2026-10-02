-- Блок 8 · товар первой покупки → повтор за 90 дней (когорта первых заказов 01.2026–06.2026, дедупликация клиентов по телефону).
WITH contacts AS (SELECT id client_id, REGEXP_REPLACE(IFNULL(Phone, ''), r'\D', '') pd FROM `perla-holistic-com.crm_data.zoho_contacts` WHERE Region='UA' AND NOT IFNULL(deleted, FALSE)),
dedup AS (SELECT client_id, CASE WHEN LENGTH(pd) >= 9 THEN MIN(client_id) OVER (PARTITION BY RIGHT(pd, 9)) ELSE client_id END customer_id FROM contacts),
orders AS (
  SELECT o.id order_id, o.created_at order_date, o.revenue_uah, IFNULL(d.customer_id, o.client_id) customer_id
  FROM `perla-holistic-com.analytics.orders` o LEFT JOIN dedup d ON d.client_id = o.client_id
  WHERE o.market='UA' AND o.is_paid=1 AND o.client_id IS NOT NULL AND IFNULL(o.channel_group,'') NOT IN ('B2B','PR','Employees')
),
ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) rk FROM orders),
first AS (SELECT customer_id, order_id first_order_id, order_date first_date, revenue_uah first_rev FROM ranked WHERE rk = 1 AND order_date BETWEEN '2026-01-01' AND '2026-06-30'),
fp AS (
  SELECT f.customer_id, f.first_date, f.first_rev, p.Product_Name product, COUNT(*) OVER (PARTITION BY f.customer_id) n_products
  FROM first f JOIN `perla-holistic-com.analytics.orders_with_upsell` i ON CAST(i.order_id AS INT64) = f.first_order_id AND i.invoice_source <> 'Gift'
  JOIN `perla-holistic-com.crm_data.zoho_products` p ON p.id = i.product_id
  GROUP BY 1, 2, 3, 4
),
rep AS (
  SELECT f.customer_id,
    LOGICAL_OR(r.order_date > f.first_date AND r.order_date <= DATE_ADD(f.first_date, INTERVAL 90 DAY)) rep90,
    LOGICAL_OR(r.order_date > f.first_date AND r.order_date <= DATE_ADD(f.first_date, INTERVAL 180 DAY)) rep180,
    SUM(IF(r.order_date > f.first_date AND r.order_date <= DATE_ADD(f.first_date, INTERVAL 180 DAY), r.revenue_uah, 0)) rev180_repeat
  FROM first f LEFT JOIN ranked r ON r.customer_id = f.customer_id AND r.rk > 1 GROUP BY 1
)
SELECT fp.product first_product, COUNT(DISTINCT fp.customer_id) customers, COUNTIF(fp.n_products = 1) solo_customers,
  ROUND(AVG(fp.first_rev)) avg_first_order_uah, ROUND(COUNTIF(rep.rep90) / COUNT(*), 4) repeat_90,
  ROUND(COUNTIF(fp.first_date <= '2026-03-31' AND rep.rep180) / NULLIF(COUNTIF(fp.first_date <= '2026-03-31'), 0), 4) repeat_180_q1,
  ROUND(AVG(IF(fp.first_date <= '2026-03-31', rep.rev180_repeat, NULL))) avg_repeat_rev_180_q1
FROM fp JOIN rep USING (customer_id) GROUP BY 1 HAVING customers >= 100 ORDER BY customers DESC LIMIT 25
