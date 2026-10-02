-- Perla Helsa · e-com витрины · 07 · ecom_one_click
-- Одна строка = одна заявка «купить в 1 клик» (сделка Zoho с Channel = 'Fast Order') UA с 2026-01-01. Блок ТЗ: 5.
-- Ключ: order_id. Источники: crm_data.zoho_deals (заявка, стадия, оплата), analytics.calls (звонок КЦ по телефону в течение 48 часов),
--   analytics.ga_events_ua (событие buy_1_click: страница и stage — add_contact_info / add_shipping_info).
-- Место кнопки «1 клик» (home / pdp / catalog / checkout) — пока по URL страницы события buy_1_click, сопоставленного с сессией заявки
--   (по cookie GA_Client_id + session id); после релиза трекинга P1 — параметр location события.
-- Вторая часть витрины (отдельный SELECT ниже) — агрегат событий buy_1_click по страницам и стадиям для верхней воронки.

WITH params AS (
  SELECT DATE '2026-01-01' AS d_from, DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) AS d_to
),
deals AS (
  SELECT d.id AS order_id, DATE(d.Deal_Time, 'Europe/Kyiv') AS order_date, d.Deal_Time AS order_ts, d.Contact_Name AS client_id,
    d.Stage AS stage, d.Payment_Scheme AS payment_scheme, d.Billed_Amount AS billed_uah, d.Consultation_Reason AS consultation_reason,
    d.Reason_B2C_Cancel AS cancel_reason, d.Call_Happened AS call_happened, d.Device AS device, d.Phone AS phone,
    COALESCE(REGEXP_EXTRACT(d.GA_Session_id, r'\.s(\d{10})'), SPLIT(d.GA_Session_id, '.')[SAFE_OFFSET(2)]) AS ga_sid_cookie,
    REGEXP_REPLACE(d.GA_Client_id, r'^GA\d\.\d\.', '') AS ga_cid_cookie
  FROM `perla-holistic-com.crm_data.zoho_deals` d, params
  WHERE d.Region = 'UA' AND NOT IFNULL(d.deleted, FALSE) AND d.Channel = 'Fast Order'
    AND DATE(d.Deal_Time, 'Europe/Kyiv') BETWEEN params.d_from AND params.d_to
),
clicks AS (
  SELECT user_pseudo_id, SPLIT(real_session_id, '_')[SAFE_OFFSET(0)] AS ga_sid, real_session_id, event_timestamp,
    REGEXP_REPLACE(page_path, r'\?.*$', '') AS page_path
  FROM `perla-holistic-com.analytics.ga_events_ua`, params
  WHERE event_name = 'buy_1_click' AND event_date BETWEEN params.d_from AND DATE_ADD(params.d_to, INTERVAL 1 DAY)
),
calls AS (
  SELECT REGEXP_REPLACE(customer_number, r'\D', '') AS phone_digits, call_date_time_utc, bill_sec, disposition
  FROM `perla-holistic-com.analytics.calls`, params
  WHERE DATE(call_date_time_kyiv) BETWEEN params.d_from AND DATE_ADD(params.d_to, INTERVAL 2 DAY) AND call_type = 'outgoing'
),
cc AS (
  SELECT d.order_id,
    MIN(c.call_date_time_utc) AS first_call_ts,
    COUNTIF(c.bill_sec > 0) AS answered_calls,
    COUNT(*) AS call_attempts
  FROM deals d
  JOIN calls c ON RIGHT(c.phone_digits, 9) = RIGHT(REGEXP_REPLACE(IFNULL(d.phone, ''), r'\D', ''), 9)
    AND c.call_date_time_utc >= d.order_ts AND c.call_date_time_utc < TIMESTAMP_ADD(d.order_ts, INTERVAL 48 HOUR)
  GROUP BY 1
),
paid AS (SELECT id AS order_id, order_num, is_paid, revenue_uah FROM `perla-holistic-com.analytics.orders` WHERE market = 'UA')
SELECT
  d.order_id, d.order_date, d.client_id, d.stage,
  CASE WHEN d.stage IN ('Successful', 'Successful/Deferred Shipment') THEN 'successful'
       WHEN d.stage IN ('Delivery', 'Deferred Shipment', 'Out for Delivery') THEN 'in_progress'
       WHEN d.stage = 'Terminated' THEN 'refused' WHEN d.stage = 'Canceled' THEN 'canceled' ELSE 'other' END AS status_group,
  d.payment_scheme,
  CASE d.payment_scheme WHEN 'Buyout' THEN 'prepaid' WHEN 'Cash On Delivery' THEN 'cod' WHEN 'Mixed' THEN 'mixed' ELSE 'unknown' END AS payment_type,
  d.billed_uah, p.revenue_uah, p.order_num, CASE WHEN p.order_num = 1 THEN 'new' WHEN p.order_num > 1 THEN 'repeat' END AS customer_type,
  d.consultation_reason, d.cancel_reason, d.call_happened, d.device,
  cc.first_call_ts, IFNULL(cc.call_attempts, 0) AS call_attempts, IFNULL(cc.answered_calls, 0) AS answered_calls,
  cc.answered_calls > 0 AS reached_by_cc,
  TIMESTAMP_DIFF(cc.first_call_ts, d.order_ts, MINUTE) AS minutes_to_first_call,
  c.real_session_id AS session_id,
  CASE
    WHEN c.page_path IS NULL THEN NULL
    WHEN c.page_path IN ('', '/', '/ru', '/ru/') THEN 'home'
    WHEN REGEXP_CONTAINS(c.page_path, r'^(/ru)?/store') THEN 'catalog'
    WHEN REGEXP_CONTAINS(c.page_path, r'^(/ru)?/category/') THEN 'category'
    WHEN REGEXP_CONTAINS(c.page_path, r'^(/ru)?/cart') THEN 'checkout'
    WHEN REGEXP_CONTAINS(c.page_path, r'^(/ru)?/blog') THEN 'blog'
    ELSE 'pdp' END AS click_place
FROM deals d
LEFT JOIN paid p USING (order_id)
LEFT JOIN cc USING (order_id)
LEFT JOIN clicks c ON c.user_pseudo_id = d.ga_cid_cookie AND c.ga_sid = d.ga_sid_cookie
