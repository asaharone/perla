-- Блок 1 · новые vs вернувшиеся пользователи (GA4): сессии и конверсия по месяцам. new = ga_session_number = 1.
WITH ev AS (
  SELECT real_session_id sid, MIN(event_date) sd, ANY_VALUE(ga_session_number) sn,
    LOGICAL_OR(event_name='add_to_cart') atc, LOGICAL_OR(event_name='begin_checkout') bc, LOGICAL_OR(event_name='purchase') pu
  FROM `perla-holistic-com.analytics.ga_events_ua`
  WHERE event_date BETWEEN '2026-01-01' AND '2026-09-30' GROUP BY 1
)
SELECT FORMAT_DATE('%Y-%m', sd) month, IF(sn = 1, 'new', 'returning') user_type, COUNT(*) sessions, COUNTIF(atc) atc_s, COUNTIF(bc) checkout_s, COUNTIF(pu) purchase_s
FROM ev GROUP BY 1, 2 ORDER BY 1, 2
