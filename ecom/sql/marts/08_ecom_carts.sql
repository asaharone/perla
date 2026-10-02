-- Perla Helsa · e-com витрины · 08 · ecom_carts
-- Одна строка = одна корзина пользователя GA4 (user_pseudo_id × день последнего view_cart / begin_checkout) UA. Блок ТЗ: 5 (брошенные корзины).
-- Ключ: (user_pseudo_id, cart_date). Источник: сырой экспорт GA4 analytics_267506323.events_* (view_cart с items и value, begin_checkout,
--   add_contact_info с type new/returning, purchase). Сущности «корзина» в системах нет, восстанавливаем из событий.
-- Определения (на согласование): брошенная корзина — нет purchase у пользователя в течение 7 дней после последнего view_cart/begin_checkout этого дня;
--   «контакт известен» — пользователь дошёл до add_contact_info в этой корзине; customer_type — параметр type события (new_customer / returning_customer);
--   сумма корзины — Σ price×quantity по items последнего view_cart (параметр value события — цена последнего товара, не сумма); порог бесплатной доставки — 2300 ₴ до 24.09.2026, 2100 ₴ с 25.09.2026 (подтвердить у e-com PM);
--   matured_7d — с даты корзины прошло ≥ 7 дней (иначе признак abandoned_7d ещё не окончательный).
--   Индекс брошенности SKU считается на 05_ecom_atc_items (доля SKU без покупки за 7 дней / средняя доля).

WITH params AS (
  SELECT '20260901' AS sfx_from,
         FORMAT_DATE('%Y%m%d', CURRENT_DATE('Europe/Kyiv')) AS sfx_to,
         DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) AS d_to
),
raw AS (
  SELECT event_name, event_timestamp, PARSE_DATE('%Y%m%d', event_date) AS event_date, user_pseudo_id,
    (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'ga_session_id') AS ga_session_id,
    -- параметр value события view_cart = цена последнего добавленного товара (проверено 15–20.09.2026), поэтому сумма корзины считается по items
    (SELECT SUM(IFNULL(it.quantity, 1) * it.price) FROM UNNEST(items) it) AS value_uah,
    (SELECT COALESCE(ep.value.double_value, CAST(ep.value.int_value AS FLOAT64)) FROM UNNEST(event_params) ep WHERE ep.key = 'value') AS ga_value_param,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'type') AS customer_type_param,
    ARRAY(SELECT AS STRUCT it.item_id, it.item_name, IFNULL(it.quantity, 1) AS quantity, it.price FROM UNNEST(items) it) AS cart_items
  FROM `perla-holistic-com.analytics_267506323.events_*`, params
  WHERE _TABLE_SUFFIX BETWEEN params.sfx_from AND params.sfx_to
    AND event_name IN ('view_cart', 'begin_checkout', 'add_contact_info', 'purchase')
),
carts AS (
  SELECT user_pseudo_id, event_date AS cart_date,
    MAX(event_timestamp) AS last_cart_ts,
    ARRAY_AGG(IF(event_name = 'view_cart', value_uah, NULL) IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS cart_value_uah,
    ARRAY_AGG(IF(event_name = 'view_cart', STRUCT(cart_items AS items), NULL) IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)].items AS cart_items,
    LOGICAL_OR(event_name = 'begin_checkout') AS reached_checkout,
    LOGICAL_OR(event_name = 'add_contact_info') AS contact_known,
    ARRAY_AGG(IF(event_name = 'add_contact_info', customer_type_param, NULL) IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS customer_type
  FROM raw, params
  WHERE event_name IN ('view_cart', 'begin_checkout', 'add_contact_info') AND event_date <= params.d_to
  GROUP BY 1, 2
),
purch AS (SELECT user_pseudo_id, event_timestamp AS purchase_ts FROM raw WHERE event_name = 'purchase')
SELECT
  c.user_pseudo_id, c.cart_date, c.last_cart_ts, c.cart_value_uah,
  ARRAY_LENGTH(c.cart_items) AS cart_lines,
  (SELECT SUM(quantity) FROM UNNEST(c.cart_items)) AS cart_units,
  c.cart_items,
  c.reached_checkout, c.contact_known, c.customer_type,
  CASE WHEN c.cart_date >= DATE '2026-09-25' THEN 2100 ELSE 2300 END AS free_delivery_threshold_uah,
  c.cart_value_uah >= CASE WHEN c.cart_date >= DATE '2026-09-25' THEN 2100 ELSE 2300 END AS above_threshold,
  c.cart_date <= DATE_SUB(p.d_to, INTERVAL 7 DAY) AS matured_7d,
  EXISTS (SELECT 1 FROM purch x WHERE x.user_pseudo_id = c.user_pseudo_id AND x.purchase_ts >= c.last_cart_ts AND x.purchase_ts < c.last_cart_ts + 7 * 24 * 3600 * 1000000) AS purchased_7d,
  NOT EXISTS (SELECT 1 FROM purch x WHERE x.user_pseudo_id = c.user_pseudo_id AND x.purchase_ts >= c.last_cart_ts AND x.purchase_ts < c.last_cart_ts + 7 * 24 * 3600 * 1000000) AS abandoned_7d
FROM carts c, params p
