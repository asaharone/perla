-- Блок 3 · топ товаров по добавлениям в корзину за сентябрь 2026: места добавления, покупка за 7 дней.
WITH raw AS (
  SELECT event_name, event_timestamp, user_pseudo_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'page_location') page_location,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'location') reco_location, items
  FROM `perla-holistic-com.analytics_267506323.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20260901' AND '20261007' AND event_name IN ('add_to_cart', 'purchase', 'upsell_add_product')
),
atc AS (
  SELECT r.event_timestamp, r.user_pseudo_id, REGEXP_REPLACE(REGEXP_REPLACE(r.page_location, r'^https?://[^/]+', ''), r'\?.*$', '') pp, it.item_id, it.item_name, it.price
  FROM raw r, UNNEST(r.items) it WHERE r.event_name = 'add_to_cart' AND PARSE_DATE('%Y%m%d', FORMAT_TIMESTAMP('%Y%m%d', TIMESTAMP_MICROS(r.event_timestamp), 'Europe/Kyiv')) <= '2026-09-30'
),
reco AS (SELECT user_pseudo_id, event_timestamp, reco_location FROM raw WHERE event_name = 'upsell_add_product'),
purch AS (SELECT r.user_pseudo_id, it.item_id, r.event_timestamp purchase_ts FROM raw r, UNNEST(r.items) it WHERE r.event_name = 'purchase'),
a AS (
  SELECT a.user_pseudo_id, a.item_id, ANY_VALUE(a.item_name) item_name, a.event_timestamp, ANY_VALUE(a.price) price,
    ANY_VALUE(CASE WHEN rc.reco_location IS NOT NULL THEN 'reco' ELSE CASE
    WHEN pp IN ('', '/', '/ru', '/ru/') THEN 'home'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/store') THEN 'catalog'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/category/') THEN 'category'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/cart') THEN 'cart'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/blog') THEN 'blog'
    WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/search') THEN 'search'
    ELSE 'pdp' END END) atc_place,
    LOGICAL_OR(p.purchase_ts IS NOT NULL) purchased_7d
  FROM atc a
  LEFT JOIN reco rc ON rc.user_pseudo_id = a.user_pseudo_id AND ABS(rc.event_timestamp - a.event_timestamp) <= 5 * 1000000
  LEFT JOIN purch p ON p.user_pseudo_id = a.user_pseudo_id AND p.item_id = a.item_id AND p.purchase_ts >= a.event_timestamp AND p.purchase_ts < a.event_timestamp + 7 * 24 * 3600 * 1000000
  GROUP BY 1,2,4
)
SELECT item_id, ANY_VALUE(item_name) item_name, ROUND(AVG(price)) price, COUNT(*) atc_items, COUNT(DISTINCT user_pseudo_id) users, COUNTIF(purchased_7d) purchased_7d,
  COUNTIF(atc_place='pdp') pdp, COUNTIF(atc_place='catalog') catalog, COUNTIF(atc_place='category') category, COUNTIF(atc_place='cart') cart, COUNTIF(atc_place='home') home, COUNTIF(atc_place='reco') reco
FROM a GROUP BY 1 ORDER BY atc_items DESC LIMIT 30
