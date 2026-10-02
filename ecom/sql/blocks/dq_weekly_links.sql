-- Качество данных · сверка GA4 ↔ Zoho ↔ WayForPay по неделям (последние 13 недель): покупки GA4, заказы Zoho, связка по номеру заказа, транзакции WFP.
WITH ga AS (
  SELECT DATE_TRUNC(event_date, WEEK(MONDAY)) wk, COUNT(*) ga_purchases, COUNT(DISTINCT transaction_id) ga_transactions,
    ARRAY_AGG(DISTINCT transaction_id IGNORE NULLS) tids
  FROM `perla-holistic-com.analytics.ga_events_ua` WHERE event_name='purchase' AND event_date BETWEEN '2026-06-29' AND '2026-09-30' GROUP BY 1
),
z AS (
  SELECT DATE_TRUNC(DATE(Deal_Time, 'Europe/Kyiv'), WEEK(MONDAY)) wk, REGEXP_EXTRACT(Deal_Name, r'(\d+)$') order_no, id, Stage, Payment_Scheme, GA_Session_id IS NOT NULL AND GA_Session_id <> '' has_ga_cookie
  FROM `perla-holistic-com.crm_data.zoho_deals`
  WHERE Region='UA' AND NOT IFNULL(deleted, FALSE) AND IFNULL(Channel_Group,'') NOT IN ('B2B','PR','Employees','Service') AND DATE(Deal_Time, 'Europe/Kyiv') BETWEEN '2026-06-29' AND '2026-09-30'
),
zl AS (
  SELECT z.wk, COUNT(*) zoho_orders, COUNTIF(z.Stage <> 'Canceled') zoho_created, COUNTIF(z.Stage IN ('Successful','Successful/Deferred Shipment')) zoho_successful,
    COUNTIF(z.has_ga_cookie) zoho_with_ga_cookie, COUNTIF(g.tid IS NOT NULL) zoho_linked_ga, COUNTIF(z.Payment_Scheme IN ('Buyout','Mixed')) zoho_online
  FROM z LEFT JOIN (SELECT DISTINCT tid FROM ga, UNNEST(tids) tid) g ON g.tid = z.order_no GROUP BY 1
),
w AS (
  SELECT DATE_TRUNC(DATE(w.created_date, 'Europe/Kyiv'), WEEK(MONDAY)) wk, COUNT(*) wfp_attempts, COUNTIF(w.status='Approved') wfp_approved,
    COUNTIF(zp.Deal_Name IS NOT NULL OR REGEXP_CONTAINS(w.order_reference, r'^\d{18}')) wfp_linked
  FROM `perla-holistic-com.crm_data.billing_wayforpay_transaction_history` w LEFT JOIN `perla-holistic-com.crm_data.zoho_payments` zp ON zp.Reference_id=w.order_reference AND NOT IFNULL(zp.deleted,FALSE)
  WHERE w.type='PURCHASE' AND DATE(w.created_date, 'Europe/Kyiv') BETWEEN '2026-06-29' AND '2026-09-30' GROUP BY 1
)
SELECT FORMAT_DATE('%Y-%m-%d', zl.wk) week_start, zl.zoho_orders, zl.zoho_created, zl.zoho_successful, zl.zoho_online, zl.zoho_with_ga_cookie, zl.zoho_linked_ga, ga.ga_purchases, ga.ga_transactions, w.wfp_attempts, w.wfp_approved, w.wfp_linked
FROM zl LEFT JOIN ga USING (wk) LEFT JOIN w USING (wk) ORDER BY 1
