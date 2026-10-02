WITH ev AS (
  SELECT real_session_id, user_pseudo_id, event_name, event_date, event_timestamp FROM `perla-holistic-com.analytics.ga_events_ua`
  WHERE event_date BETWEEN '2026-01-01' AND '2026-10-07' AND event_name IN ('session_start','view_item','add_to_cart','view_cart','begin_checkout','add_contact_info','add_payment_info','purchase','buy_1_click')
),
s AS (
  SELECT real_session_id sid, ANY_VALUE(user_pseudo_id) uid, MIN(event_date) sd, LOGICAL_OR(event_name='view_item') vi, LOGICAL_OR(event_name='add_to_cart') atc, LOGICAL_OR(event_name='view_cart') vc, LOGICAL_OR(event_name='begin_checkout') bc,
    LOGICAL_OR(event_name='add_contact_info') ci, LOGICAL_OR(event_name='add_payment_info') pi, LOGICAL_OR(event_name='purchase') pu, LOGICAL_OR(event_name='buy_1_click') oc,
    MIN(IF(event_name='add_to_cart', event_timestamp, NULL)) atc_ts, COUNTIF(event_name='add_to_cart') atc_n, COUNTIF(event_name='purchase') pu_n
  FROM ev GROUP BY 1
),
purch AS (SELECT user_pseudo_id uid, event_timestamp ts FROM ev WHERE event_name='purchase'),
w7 AS (SELECT s.sid, LOGICAL_OR(p.ts IS NOT NULL) p7 FROM s LEFT JOIN purch p ON p.uid=s.uid AND p.ts>=s.atc_ts AND p.ts < s.atc_ts + 7*24*3600*1000000 WHERE s.atc GROUP BY 1)
SELECT FORMAT_DATE('%Y-%m', sd) month, COUNT(*) sessions, COUNT(DISTINCT uid) users, COUNTIF(vi) view_item_s, COUNTIF(atc) atc_s, COUNTIF(vc) view_cart_s, COUNTIF(bc) checkout_s, COUNTIF(ci) contact_s, COUNTIF(pi) payment_s, COUNTIF(pu) purchase_s, COUNTIF(oc) one_click_s,
  SUM(atc_n) atc_events, SUM(pu_n) purchase_events, COUNTIF(w7.p7) atc_purchased_7d_s, COUNTIF(pu AND NOT atc) purchase_without_atc_s
FROM s LEFT JOIN w7 USING(sid) WHERE sd <= '2026-09-30' GROUP BY 1 ORDER BY 1
