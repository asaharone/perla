-- Блок 5 · корзины GA4 (user × день последнего view_cart/begin_checkout) × месяц: брошенные за 7 дней, выше порога бесплатной доставки, известный контакт.
WITH raw AS (
  SELECT event_name, event_timestamp, PARSE_DATE('%Y%m%d', event_date) event_date, user_pseudo_id,
    (SELECT SUM(IFNULL(it.quantity, 1) * it.price) FROM UNNEST(items) it) value_uah, -- параметр value события = цена последнего товара, поэтому сумма по items
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'type') ctype,
    ARRAY_LENGTH(items) n_items
  FROM `perla-holistic-com.analytics_267506323.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20260101' AND '20261007' AND event_name IN ('view_cart', 'begin_checkout', 'add_contact_info', 'purchase')
),
carts AS (
  SELECT user_pseudo_id, event_date cart_date, MAX(event_timestamp) last_ts,
    ARRAY_AGG(IF(event_name='view_cart', value_uah, NULL) IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] cart_value,
    ARRAY_AGG(IF(event_name='view_cart', n_items, NULL) IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] cart_lines,
    LOGICAL_OR(event_name='begin_checkout') bc, LOGICAL_OR(event_name='add_contact_info') ci,
    ARRAY_AGG(IF(event_name='add_contact_info', ctype, NULL) IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] ctype
  FROM raw WHERE event_name IN ('view_cart','begin_checkout','add_contact_info') AND event_date <= '2026-09-30' GROUP BY 1, 2
),
purch AS (SELECT user_pseudo_id, event_timestamp ts FROM raw WHERE event_name='purchase'),
c AS (
  SELECT c.*, LOGICAL_OR(p.ts IS NOT NULL) purchased_7d, CASE WHEN c.cart_date >= '2026-09-25' THEN 2100 ELSE 2300 END thr
  FROM carts c LEFT JOIN purch p ON p.user_pseudo_id = c.user_pseudo_id AND p.ts >= c.last_ts AND p.ts < c.last_ts + 7*24*3600*1000000
  GROUP BY c.user_pseudo_id, c.cart_date, c.last_ts, c.cart_value, c.cart_lines, c.bc, c.ci, c.ctype
)
SELECT FORMAT_DATE('%Y-%m', cart_date) month, COUNT(*) carts, COUNTIF(bc) reached_checkout, COUNTIF(ci) contact_known, COUNTIF(ctype='returning_customer') returning_known, COUNTIF(ctype='new_customer') new_known,
  COUNTIF(NOT purchased_7d) abandoned_7d, COUNTIF(NOT purchased_7d AND ci) abandoned_with_contact, COUNTIF(NOT purchased_7d AND bc) abandoned_after_checkout,
  COUNTIF(cart_value >= thr) above_threshold, COUNTIF(cart_value IS NOT NULL) with_value, ROUND(AVG(cart_value)) avg_cart_value_uah, ROUND(AVG(cart_lines), 2) avg_cart_lines,
  ROUND(SUM(IF(NOT purchased_7d, cart_value, 0))) abandoned_value_uah, ROUND(AVG(IF(NOT purchased_7d, cart_value, NULL))) avg_abandoned_value_uah,
  COUNTIF(NOT purchased_7d AND cart_value >= thr) abandoned_above_threshold, COUNTIF(NOT purchased_7d AND cart_value < thr) abandoned_below_threshold
FROM c GROUP BY 1 ORDER BY 1
