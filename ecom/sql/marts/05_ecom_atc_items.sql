-- Perla Helsa · e-com витрины · 05 · ecom_atc_items
-- Одна строка = одно добавление товара в корзину (событие GA4 add_to_cart × items) UA с 2025-10-01 (полная разметка воронки).
-- Ключ: (user_pseudo_id, event_timestamp, item_id). Блоки ТЗ: 3, 5.
-- Источник: сырой экспорт GA4 analytics_267506323.events_* (нужны items и page_location), плюс события виджета рекомендаций
--   upsell_add_product (location = Product / Cart / Search / Home) для дедупликации «добавил из рекомендаций».
-- Поля: место добавления (page_type по URL страницы; v2 — item_list_name после релиза трекинга P1), был ли просмотр PDP этого товара
--   в сессии до добавления, куплен ли товар этим пользователем в течение 7 дней (purchase.items), сумма.
-- Дедупликация: добавление из виджета пишется и как upsell_add_product, и как add_to_cart; если за ±5 секунд у пользователя есть
--   upsell_add_product, место = 'reco_<location>'.

WITH params AS (
  SELECT '20260901' AS sfx_from, FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY)) AS sfx_to
),
raw AS (
  SELECT event_name, event_timestamp, PARSE_DATE('%Y%m%d', event_date) AS event_date, user_pseudo_id,
    (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'ga_session_id') AS ga_session_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'page_location') AS page_location,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'location') AS reco_location,
    items
  FROM `perla-holistic-com.analytics_267506323.events_*`, params
  WHERE _TABLE_SUFFIX BETWEEN params.sfx_from AND params.sfx_to
    AND event_name IN ('add_to_cart', 'view_item', 'purchase', 'upsell_add_product')
),
atc AS (
  SELECT r.event_timestamp, r.event_date, r.user_pseudo_id, r.ga_session_id,
    REGEXP_REPLACE(REGEXP_REPLACE(r.page_location, r'^https?://[^/]+', ''), r'\?.*$', '') AS page_path,
    it.item_id, it.item_name, it.price, IFNULL(it.quantity, 1) AS quantity
  FROM raw r, UNNEST(r.items) it
  WHERE r.event_name = 'add_to_cart'
),
reco AS (
  SELECT user_pseudo_id, event_timestamp, reco_location FROM raw WHERE event_name = 'upsell_add_product'
),
views AS (
  SELECT r.user_pseudo_id, r.ga_session_id, it.item_id, r.event_timestamp AS view_ts
  FROM raw r, UNNEST(r.items) it WHERE r.event_name = 'view_item'
),
purch AS (
  SELECT r.user_pseudo_id, it.item_id, r.event_timestamp AS purchase_ts
  FROM raw r, UNNEST(r.items) it WHERE r.event_name = 'purchase'
)
SELECT
  a.user_pseudo_id, a.ga_session_id, a.event_date, a.event_timestamp, a.item_id, a.item_name, a.price, a.quantity, a.page_path,
  CASE
    WHEN rc.reco_location IS NOT NULL THEN CONCAT('reco_', LOWER(rc.reco_location))
    WHEN a.page_path IN ('', '/', '/ru', '/ru/') THEN 'home'
    WHEN REGEXP_CONTAINS(a.page_path, r'^(/ru)?/store') THEN 'catalog'
    WHEN REGEXP_CONTAINS(a.page_path, r'^(/ru)?/category/') THEN 'category'
    WHEN REGEXP_CONTAINS(a.page_path, r'^(/ru)?/cart') THEN 'cart'
    WHEN REGEXP_CONTAINS(a.page_path, r'^(/ru)?/blog') THEN 'blog'
    WHEN REGEXP_CONTAINS(a.page_path, r'^(/ru)?/search') THEN 'search'
    ELSE 'pdp' END AS atc_place,
  rc.reco_location IS NOT NULL AS from_reco,
  EXISTS (SELECT 1 FROM views v WHERE v.user_pseudo_id = a.user_pseudo_id AND v.ga_session_id = a.ga_session_id AND v.item_id = a.item_id AND v.view_ts <= a.event_timestamp) AS viewed_pdp_before,
  EXISTS (SELECT 1 FROM purch p WHERE p.user_pseudo_id = a.user_pseudo_id AND p.item_id = a.item_id AND p.purchase_ts >= a.event_timestamp AND p.purchase_ts < a.event_timestamp + 7 * 24 * 3600 * 1000000) AS purchased_7d,
  EXISTS (SELECT 1 FROM purch p WHERE p.user_pseudo_id = a.user_pseudo_id AND p.item_id = a.item_id AND p.purchase_ts >= a.event_timestamp AND p.purchase_ts < a.event_timestamp + 7 * 24 * 3600 * 1000000) AS purchased_same_session_or_7d
FROM atc a
LEFT JOIN reco rc ON rc.user_pseudo_id = a.user_pseudo_id AND ABS(rc.event_timestamp - a.event_timestamp) <= 5 * 1000000
