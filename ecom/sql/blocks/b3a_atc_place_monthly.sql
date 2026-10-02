-- Блок 3 · добавления в корзину по месту (страница события; reco_* — виджет рекомендаций) × месяц; покупка товара тем же пользователем за 7 дней.
WITH raw AS (
  SELECT event_name, event_timestamp, PARSE_DATE('%Y%m%d', event_date) event_date, user_pseudo_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'page_location') page_location,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'location') reco_location, items
  FROM `perla-holistic-com.analytics_267506323.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20260101' AND '20261007' AND event_name IN ('add_to_cart', 'purchase', 'upsell_add_product')
),
atc AS (
  SELECT r.event_timestamp, r.event_date, r.user_pseudo_id, REGEXP_REPLACE(REGEXP_REPLACE(r.page_location, r'^https?://[^/]+', ''), r'\?.*$', '') pp, it.item_id, IFNULL(it.quantity,1) qty, it.price
  FROM raw r, UNNEST(r.items) it WHERE r.event_name = 'add_to_cart' AND r.event_date <= '2026-09-30'
),
reco AS (SELECT user_pseudo_id, event_timestamp, reco_location FROM raw WHERE event_name = 'upsell_add_product'),
purch AS (SELECT r.user_pseudo_id, it.item_id, r.event_timestamp purchase_ts FROM raw r, UNNEST(r.items) it WHERE r.event_name = 'purchase'),
a AS (
  SELECT a.event_date, a.user_pseudo_id, a.item_id, a.event_timestamp, a.qty, a.price,
    CASE WHEN rc.reco_location IS NOT NULL THEN CONCAT('reco_', LOWER(rc.reco_location)) ELSE CASE
    WHEN pp IN ('', '/', '/ru', '/ru/') THEN 'home'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/store') THEN 'catalog'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/category/') THEN 'category'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/cart') THEN 'cart'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/blog') THEN 'blog'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/search') THEN 'search'
    ELSE 'pdp' END END atc_place,
    LOGICAL_OR(p.purchase_ts IS NOT NULL) purchased_7d
  FROM atc a
  LEFT JOIN reco rc ON rc.user_pseudo_id = a.user_pseudo_id AND ABS(rc.event_timestamp - a.event_timestamp) <= 5 * 1000000
  LEFT JOIN purch p ON p.user_pseudo_id = a.user_pseudo_id AND p.item_id = a.item_id AND p.purchase_ts >= a.event_timestamp AND p.purchase_ts < a.event_timestamp + 7 * 24 * 3600 * 1000000
  GROUP BY 1,2,3,4,5,6,7
)
SELECT FORMAT_DATE('%Y-%m', event_date) month, atc_place, COUNT(*) atc_items, COUNT(DISTINCT user_pseudo_id) users, COUNTIF(purchased_7d) purchased_7d, ROUND(SUM(qty * price)) atc_value_uah
FROM a GROUP BY 1, 2 ORDER BY 1, 3 DESC
