-- Perla Helsa · e-com витрины · 06 · ecom_payments
-- Одна строка = один онлайн-заказ (сделка Zoho с Payment_Scheme = Buyout / Mixed) UA с 2026-01-01: дерево оплат WayForPay и «спасение».
-- Ключ: order_id. Блок ТЗ: 5 (оплаты).
-- Источники: crm_data.billing_wayforpay_transaction_history (транзакции с 30.09.2025, статусы и reason_code),
--   crm_data.zoho_payments (Reference_id = order_reference WFP → Deal_Name; связь 99%), crm_data.zoho_deals (стадия, причина консультации),
--   analytics.calls + crm_data.zoho_deals.Consultation_Reason = 'Неуспішна оплата' (контакт КЦ), analytics.email_messages (триггеры eSputnik).
-- Определения:
--   attempts — попытки оплаты (type = PURCHASE); approved — хотя бы одна Approved; declined_only — были Declined/Expired и ни одной Approved;
--   no_attempt — онлайн-заказ без транзакции WFP (не дошёл до WFP: косвенная оценка до появления событий payment_redirect / payment_result);
--   rescued — после неуспешной попытки в течение 7 дней был контакт КЦ (Consultation_Reason 'Неуспішна оплата' или звонок) либо триггер eSputnik,
--             и заказ в итоге оплачен (Approved) или успешно доставлен (в т.ч. переведён на наложку).

WITH params AS (
  SELECT DATE '2026-01-01' AS d_from, DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) AS d_to
),
deals AS (
  SELECT d.id AS order_id, REGEXP_EXTRACT(d.Deal_Name, r'(\d+)$') AS order_no, DATE(d.Deal_Time, 'Europe/Kyiv') AS order_date, d.Deal_Time AS order_ts,
    d.Contact_Name AS client_id, d.Stage AS stage, d.Payment_Scheme AS payment_scheme, d.Channel AS channel_crm, d.Consultation_Reason AS consultation_reason, d.Billed_Amount AS billed_uah,
    d.Phone AS phone
  FROM `perla-holistic-com.crm_data.zoho_deals` d, params
  WHERE d.Region = 'UA' AND NOT IFNULL(d.deleted, FALSE) AND DATE(d.Deal_Time, 'Europe/Kyiv') BETWEEN params.d_from AND params.d_to
    AND IFNULL(d.Channel_Group, '') NOT IN ('B2B', 'PR', 'Employees') AND d.Payment_Scheme IN ('Buyout', 'Mixed')
),
wfp AS (
  SELECT w.order_reference, w.type, w.status, w.reason_code, w.reason_message, w.amount, w.created_date,
    COALESCE(zp.Deal_Name, SAFE_CAST(REGEXP_EXTRACT(w.order_reference, r'^(\d{18})') AS INT64)) AS order_id
  FROM `perla-holistic-com.crm_data.billing_wayforpay_transaction_history` w
  LEFT JOIN `perla-holistic-com.crm_data.zoho_payments` zp ON zp.Reference_id = w.order_reference AND NOT IFNULL(zp.deleted, FALSE)
  WHERE w.type = 'PURCHASE'
),
tx AS (
  SELECT order_id,
    COUNT(*) AS attempts,
    COUNTIF(status = 'Approved') AS approved_cnt,
    COUNTIF(status = 'Declined') AS declined_cnt,
    COUNTIF(status = 'Expired') AS expired_cnt,
    COUNTIF(status = 'InProcessing') AS in_processing_cnt,
    MIN(created_date) AS first_attempt_ts,
    MIN(IF(status = 'Approved', created_date, NULL)) AS approved_ts,
    MIN(IF(status IN ('Declined', 'Expired'), created_date, NULL)) AS first_fail_ts,
    ARRAY_AGG(DISTINCT IF(status IN ('Declined', 'Expired'), reason_message, NULL) IGNORE NULLS) AS fail_reasons,
    MAX(IF(status = 'Approved', amount, NULL)) AS approved_amount_uah
  FROM wfp WHERE order_id IS NOT NULL
  GROUP BY 1
),
calls AS (
  SELECT REGEXP_REPLACE(customer_number, r'\D', '') AS phone_digits, call_date_time_utc
  FROM `perla-holistic-com.analytics.calls`, params
  WHERE DATE(call_date_time_kyiv) BETWEEN params.d_from AND DATE_ADD(params.d_to, INTERVAL 7 DAY) AND call_type = 'outgoing' AND bill_sec > 0
),
cc AS (
  SELECT d.order_id, MIN(c.call_date_time_utc) AS first_cc_call_ts
  FROM deals d
  JOIN tx t USING (order_id)
  JOIN calls c ON RIGHT(c.phone_digits, 9) = RIGHT(REGEXP_REPLACE(IFNULL(d.phone, ''), r'\D', ''), 9)
    AND c.call_date_time_utc >= t.first_fail_ts AND c.call_date_time_utc < TIMESTAMP_ADD(t.first_fail_ts, INTERVAL 7 DAY)
  WHERE t.first_fail_ts IS NOT NULL
  GROUP BY 1
),
esp AS (
  SELECT d.order_id, MIN(m.date) AS first_trigger_date
  FROM deals d
  JOIN tx t USING (order_id)
  JOIN `perla-holistic-com.analytics.email_messages` m ON RIGHT(m.phone_norm, 9) = RIGHT(REGEXP_REPLACE(IFNULL(d.phone, ''), r'\D', ''), 9)
    AND m.medium_source = 'trigger' AND m.activity_status = 'Delivered'
    AND m.date BETWEEN DATE(t.first_fail_ts) AND DATE_ADD(DATE(t.first_fail_ts), INTERVAL 7 DAY)
    AND (LOWER(m.utm_campaign) LIKE '%pay%' OR LOWER(m.utm_campaign) LIKE '%oplat%' OR LOWER(m.utm_campaign) LIKE '%abcart%' OR LOWER(m.utm_campaign) LIKE '%abandoned_cart%')
  WHERE t.first_fail_ts IS NOT NULL
  GROUP BY 1
)
SELECT
  d.order_id, d.order_no, d.order_date, d.client_id, d.stage, d.payment_scheme, d.channel_crm, d.billed_uah, d.consultation_reason,
  IFNULL(t.attempts, 0) AS attempts, IFNULL(t.approved_cnt, 0) AS approved_cnt, IFNULL(t.declined_cnt, 0) AS declined_cnt, IFNULL(t.expired_cnt, 0) AS expired_cnt,
  t.first_attempt_ts, t.approved_ts, t.first_fail_ts, t.fail_reasons, t.approved_amount_uah,
  CASE
    WHEN t.order_id IS NULL THEN 'no_attempt'
    WHEN t.approved_cnt > 0 AND t.first_fail_ts IS NULL THEN 'approved_first_try'
    WHEN t.approved_cnt > 0 THEN 'approved_after_fail'
    WHEN t.in_processing_cnt > 0 AND t.declined_cnt + t.expired_cnt = 0 THEN 'in_processing'
    ELSE 'failed_only' END AS payment_outcome,
  d.consultation_reason = 'Неуспішна оплата' OR cc.first_cc_call_ts IS NOT NULL AS cc_contacted,
  esp.first_trigger_date IS NOT NULL AS esputnik_triggered,
  d.stage IN ('Successful', 'Successful/Deferred Shipment', 'Delivery', 'Deferred Shipment', 'Out for Delivery') AS order_went_through,
  t.first_fail_ts IS NOT NULL
    AND (d.consultation_reason = 'Неуспішна оплата' OR cc.first_cc_call_ts IS NOT NULL OR esp.first_trigger_date IS NOT NULL)
    AND (t.approved_cnt > 0 OR d.stage IN ('Successful', 'Successful/Deferred Shipment', 'Delivery', 'Deferred Shipment', 'Out for Delivery')) AS rescued
FROM deals d
LEFT JOIN tx t USING (order_id)
LEFT JOIN cc USING (order_id)
LEFT JOIN esp USING (order_id)
