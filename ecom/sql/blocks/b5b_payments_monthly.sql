WITH deals AS (
  SELECT d.id order_id, DATE(d.Deal_Time,'Europe/Kyiv') order_date, d.Stage stage, d.Channel channel_crm, d.Consultation_Reason cr, d.Billed_Amount billed, d.Phone phone
  FROM `perla-holistic-com.crm_data.zoho_deals` d WHERE d.Region='UA' AND NOT IFNULL(d.deleted,FALSE) AND DATE(d.Deal_Time,'Europe/Kyiv') BETWEEN '2026-01-01' AND '2026-09-30' AND IFNULL(d.Channel_Group,'') NOT IN ('B2B','PR','Employees','Service') AND d.Payment_Scheme IN ('Buyout','Mixed')
),
wfp AS (
  SELECT COALESCE(zp.Deal_Name, SAFE_CAST(REGEXP_EXTRACT(w.order_reference, r'^(\d{18})') AS INT64)) order_id, w.status, w.created_date, w.reason_message
  FROM `perla-holistic-com.crm_data.billing_wayforpay_transaction_history` w LEFT JOIN `perla-holistic-com.crm_data.zoho_payments` zp ON zp.Reference_id=w.order_reference AND NOT IFNULL(zp.deleted,FALSE) WHERE w.type='PURCHASE'
),
tx AS (SELECT order_id, COUNTIF(status='Approved') approved_cnt, COUNTIF(status IN ('Declined','Expired')) fail_cnt, COUNTIF(status='InProcessing') proc_cnt, MIN(IF(status IN ('Declined','Expired'), created_date, NULL)) first_fail_ts, COUNT(*) attempts FROM wfp WHERE order_id IS NOT NULL GROUP BY 1),
calls AS (SELECT REGEXP_REPLACE(customer_number, r'\D','') pd, call_date_time_utc FROM `perla-holistic-com.analytics.calls` WHERE DATE(call_date_time_kyiv) BETWEEN '2026-01-01' AND '2026-10-07' AND call_type='outgoing' AND bill_sec>0),
cc AS (SELECT d.order_id, MIN(c.call_date_time_utc) ts FROM deals d JOIN tx t USING(order_id) JOIN calls c ON RIGHT(c.pd,9)=RIGHT(REGEXP_REPLACE(IFNULL(d.phone,''), r'\D',''),9) AND c.call_date_time_utc >= t.first_fail_ts AND c.call_date_time_utc < TIMESTAMP_ADD(t.first_fail_ts, INTERVAL 7 DAY) WHERE t.first_fail_ts IS NOT NULL GROUP BY 1),
esp AS (
  SELECT d.order_id, MIN(m.date) dt FROM deals d JOIN tx t USING(order_id)
  JOIN `perla-holistic-com.analytics.email_messages` m ON RIGHT(m.phone_norm,9)=RIGHT(REGEXP_REPLACE(IFNULL(d.phone,''), r'\D',''),9) AND m.medium_source='trigger' AND m.activity_status='Delivered' AND m.date BETWEEN DATE(t.first_fail_ts) AND DATE_ADD(DATE(t.first_fail_ts), INTERVAL 7 DAY)
    AND (LOWER(m.utm_campaign) LIKE '%pay%' OR LOWER(m.utm_campaign) LIKE '%oplat%' OR LOWER(m.utm_campaign) LIKE '%abcart%' OR LOWER(m.utm_campaign) LIKE '%abandoned_cart%')
  WHERE t.first_fail_ts IS NOT NULL GROUP BY 1
),
m AS (
  SELECT d.*, t.first_fail_ts, IFNULL(t.attempts,0) attempts,
    CASE WHEN t.order_id IS NULL THEN 'no_attempt' WHEN t.approved_cnt>0 AND t.first_fail_ts IS NULL THEN 'approved_first_try' WHEN t.approved_cnt>0 THEN 'approved_after_fail' WHEN t.proc_cnt>0 AND t.fail_cnt=0 THEN 'in_processing' ELSE 'failed_only' END outcome,
    d.cr='Неуспішна оплата' OR cc.ts IS NOT NULL AS cc_contacted, esp.dt IS NOT NULL AS esp_trig,
    d.stage IN ('Successful','Successful/Deferred Shipment','Delivery','Deferred Shipment','Out for Delivery') went_through
  FROM deals d LEFT JOIN tx t USING(order_id) LEFT JOIN cc USING(order_id) LEFT JOIN esp USING(order_id)
)
SELECT FORMAT_DATE('%Y-%m', order_date) month, COUNT(*) online_orders, COUNTIF(outcome='approved_first_try') approved_first, COUNTIF(outcome='approved_after_fail') approved_after_fail, COUNTIF(outcome='failed_only') failed_only, COUNTIF(outcome='no_attempt') no_attempt, COUNTIF(outcome='in_processing') in_processing,
  COUNTIF(outcome='failed_only' AND stage='Canceled') failed_canceled, COUNTIF(outcome='failed_only' AND went_through) failed_went_through, COUNTIF(first_fail_ts IS NOT NULL) with_any_fail, COUNTIF(first_fail_ts IS NOT NULL AND cc_contacted) cc_contacted, COUNTIF(first_fail_ts IS NOT NULL AND esp_trig) esputnik,
  COUNTIF(first_fail_ts IS NOT NULL AND (cc_contacted OR esp_trig) AND (outcome='approved_after_fail' OR went_through)) rescued, ROUND(SUM(IF(outcome='failed_only' AND stage='Canceled', billed,0))) lost_billed_uah, ROUND(AVG(attempts),2) avg_attempts
FROM m GROUP BY 1 ORDER BY 1
