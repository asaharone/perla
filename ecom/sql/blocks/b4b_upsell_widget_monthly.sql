-- Блок 4 · события виджета рекомендаций (upsell / upsell_select_product / upsell_add_product) по месту показа × месяц.
SELECT FORMAT_DATE('%Y-%m', PARSE_DATE('%Y%m%d', event_date)) month, event_name,
  IFNULL((SELECT LOWER(ep.value.string_value) FROM UNNEST(event_params) ep WHERE ep.key = 'location'), 'n/a') location,
  COUNT(*) events, COUNT(DISTINCT user_pseudo_id) users,
  COUNT(DISTINCT CONCAT(user_pseudo_id, '_', CAST((SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'ga_session_id') AS STRING))) sessions
FROM `perla-holistic-com.analytics_267506323.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260101' AND '20260930' AND event_name IN ('upsell', 'upsell_select_product', 'upsell_add_product', 'upsell_view', 'view_promotion', 'select_promotion')
GROUP BY 1, 2, 3 ORDER BY 1, 2, 4 DESC
