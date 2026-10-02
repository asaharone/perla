-- Блок 5 · где нажимают «купить в 1 клик» (страница события buy_1_click) × месяц, GA4.
WITH e AS (
  SELECT event_date, real_session_id, REGEXP_REPLACE(page_path, r'\?.*$', '') pp FROM `perla-holistic-com.analytics.ga_events_ua`
  WHERE event_name='buy_1_click' AND event_date BETWEEN '2026-01-01' AND '2026-09-30'
)
SELECT FORMAT_DATE('%Y-%m', event_date) month,
  CASE WHEN pp IN ('', '/', '/ru', '/ru/') THEN 'home' WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/store') THEN 'catalog' WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/category/') THEN 'category'
       WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/cart') THEN 'checkout' WHEN REGEXP_CONTAINS(pp, r'^(/ru)?/blog') THEN 'blog' WHEN pp IS NULL THEN 'n/a' ELSE 'pdp' END click_place,
  COUNT(*) events, COUNT(DISTINCT real_session_id) sessions
FROM e GROUP BY 1, 2 ORDER BY 1, 3 DESC
