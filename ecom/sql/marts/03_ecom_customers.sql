-- Perla Helsa · e-com витрины · 03 · ecom_customers
-- Одна строка = один клиент B2C UA после дедупликации контактов по телефону. Блоки ТЗ: 7, 8.
-- Ключ: customer_id (минимальный client_id среди контактов с одним нормализованным телефоном).
-- Источники: crm_data.zoho_contacts (телефон → ключ дедупликации), analytics.orders (оплаченные сделки с 2022, order_num),
--   analytics.orders_with_upsell (продукты первого заказа), analytics.fct_sku_revenue (GP первого заказа и за 180 дней).
-- Определения: первый заказ — первая оплаченная сделка клиента (после дедупликации) за всю историю;
--   продукт первой покупки — КАЖДЫЙ платный продукт первого заказа (без подарков) — поэтому один клиент может входить в несколько строк
--   витрины 08 (products as entry points); здесь хранится массив first_products.
--   Горизонты: повтор за 30/60/90/180 дней от первого заказа; GP за 180 дней — только у клиентов, у которых 180 дней уже прошло (matured_180).
--   Телефоны в витрине не хранятся — только хеш (phone_hash) для сверок.

WITH contacts AS (
  SELECT id AS client_id,
    REGEXP_REPLACE(IFNULL(Phone, ''), r'\D', '') AS phone_digits
  FROM `perla-holistic-com.crm_data.zoho_contacts`
  WHERE Region = 'UA' AND NOT IFNULL(deleted, FALSE)
),
dedup AS (
  SELECT client_id,
    CASE WHEN LENGTH(phone_digits) >= 9 THEN MIN(client_id) OVER (PARTITION BY RIGHT(phone_digits, 9)) ELSE client_id END AS customer_id,
    CASE WHEN LENGTH(phone_digits) >= 9 THEN TO_HEX(SHA256(RIGHT(phone_digits, 9))) END AS phone_hash
  FROM contacts
),
orders AS (
  SELECT o.id AS order_id, o.created_at AS order_date, o.revenue_uah, o.channel_group, o.utm_source, o.utm_medium,
    IFNULL(d.customer_id, o.client_id) AS customer_id
  FROM `perla-holistic-com.analytics.orders` o
  LEFT JOIN dedup d ON d.client_id = o.client_id
  WHERE o.market = 'UA' AND o.is_paid = 1 AND o.client_id IS NOT NULL
    AND IFNULL(o.channel_group, '') NOT IN ('B2B', 'PR', 'Employees')
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS order_rank
  FROM orders
),
first_order AS (
  SELECT customer_id, order_id AS first_order_id, order_date AS first_order_date, revenue_uah AS first_order_revenue_uah,
    channel_group AS first_channel_group, utm_source AS first_utm_source, utm_medium AS first_utm_medium
  FROM ranked WHERE order_rank = 1
),
first_products AS (
  SELECT f.customer_id,
    ARRAY_AGG(DISTINCT i.product_name IGNORE NULLS) AS first_products,
    COUNT(DISTINCT i.product_name) AS first_products_cnt,
    SUM(i.quantity) AS first_paid_units
  FROM first_order f
  JOIN `perla-holistic-com.analytics.orders_with_upsell` i ON CAST(i.order_id AS INT64) = f.first_order_id AND i.invoice_source <> 'Gift'
  GROUP BY 1
),
first_gp AS (
  SELECT f.customer_id, SUM(s.sku_gross_profit_uah) AS first_order_gp_uah, SUM(s.sku_gross_profit_uah + s.sku_marketing_costs_total_uah) AS first_order_cm2_uah
  FROM first_order f
  JOIN `perla-holistic-com.analytics.fct_sku_revenue` s ON s.id = f.first_order_id
  GROUP BY 1
),
later AS (
  SELECT r.customer_id,
    MIN(IF(r.order_rank = 2, r.order_date, NULL)) AS second_order_date,
    COUNTIF(r.order_rank > 1) AS repeat_orders,
    COUNTIF(r.order_rank > 1 AND r.order_date <= DATE_ADD(f.first_order_date, INTERVAL 180 DAY)) AS orders_180d_repeat,
    SUM(IF(r.order_date <= DATE_ADD(f.first_order_date, INTERVAL 180 DAY), r.revenue_uah, 0)) AS revenue_180d_uah,
    SUM(r.revenue_uah) AS revenue_total_uah,
    MAX(r.order_date) AS last_order_date,
    COUNT(*) AS orders_total
  FROM ranked r JOIN first_order f USING (customer_id)
  GROUP BY 1
),
gp_180 AS (
  SELECT r.customer_id, SUM(s.sku_gross_profit_uah) AS gp_180d_uah
  FROM ranked r JOIN first_order f USING (customer_id)
  JOIN `perla-holistic-com.analytics.fct_sku_revenue` s ON s.id = r.order_id
  WHERE r.order_date <= DATE_ADD(f.first_order_date, INTERVAL 180 DAY)
  GROUP BY 1
)
SELECT
  f.customer_id,
  ANY_VALUE(d.phone_hash) AS phone_hash,
  f.first_order_id, f.first_order_date, f.first_channel_group, f.first_utm_source, f.first_utm_medium,
  f.first_order_revenue_uah, fg.first_order_gp_uah, fg.first_order_cm2_uah,
  fp.first_products, fp.first_products_cnt, fp.first_paid_units,
  l.second_order_date,
  DATE_DIFF(l.second_order_date, f.first_order_date, DAY) AS days_to_second,
  l.second_order_date IS NOT NULL AND DATE_DIFF(l.second_order_date, f.first_order_date, DAY) <= 30 AS repeat_30d,
  l.second_order_date IS NOT NULL AND DATE_DIFF(l.second_order_date, f.first_order_date, DAY) <= 60 AS repeat_60d,
  l.second_order_date IS NOT NULL AND DATE_DIFF(l.second_order_date, f.first_order_date, DAY) <= 90 AS repeat_90d,
  l.second_order_date IS NOT NULL AND DATE_DIFF(l.second_order_date, f.first_order_date, DAY) <= 180 AS repeat_180d,
  l.repeat_orders, l.orders_total, l.orders_180d_repeat + 1 AS orders_180d, l.revenue_180d_uah, g.gp_180d_uah, l.revenue_total_uah, l.last_order_date,
  DATE_DIFF(CURRENT_DATE('Europe/Kyiv'), f.first_order_date, DAY) >= 90 AS matured_90,
  DATE_DIFF(CURRENT_DATE('Europe/Kyiv'), f.first_order_date, DAY) >= 180 AS matured_180
FROM first_order f
LEFT JOIN dedup d ON d.client_id = f.customer_id
LEFT JOIN first_products fp USING (customer_id)
LEFT JOIN first_gp fg USING (customer_id)
LEFT JOIN later l USING (customer_id)
LEFT JOIN gp_180 g USING (customer_id)
GROUP BY f.customer_id, f.first_order_id, f.first_order_date, f.first_channel_group, f.first_utm_source, f.first_utm_medium, f.first_order_revenue_uah,
  fg.first_order_gp_uah, fg.first_order_cm2_uah, fp.first_products, fp.first_products_cnt, fp.first_paid_units, l.second_order_date, l.repeat_orders, l.orders_total,
  l.orders_180d_repeat, l.revenue_180d_uah, g.gp_180d_uah, l.revenue_total_uah, l.last_order_date
