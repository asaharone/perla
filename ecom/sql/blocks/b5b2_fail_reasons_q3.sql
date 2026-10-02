-- Блок 5 · причины неуспешных попыток оплаты WayForPay (Declined/Expired), июль–сентябрь 2026, по онлайн-заказам B2C UA.
WITH deals AS (
  SELECT d.id order_id FROM `perla-holistic-com.crm_data.zoho_deals` d
  WHERE d.Region='UA' AND NOT IFNULL(d.deleted,FALSE) AND DATE(d.Deal_Time,'Europe/Kyiv') BETWEEN '2026-07-01' AND '2026-09-30' AND IFNULL(d.Channel_Group,'') NOT IN ('B2B','PR','Employees','Service') AND d.Payment_Scheme IN ('Buyout','Mixed')
),
wfp AS (
  SELECT COALESCE(zp.Deal_Name, SAFE_CAST(REGEXP_EXTRACT(w.order_reference, r'^(\d{18})') AS INT64)) order_id, w.status, w.reason_code, w.reason_message, w.created_date
  FROM `perla-holistic-com.crm_data.billing_wayforpay_transaction_history` w LEFT JOIN `perla-holistic-com.crm_data.zoho_payments` zp ON zp.Reference_id=w.order_reference AND NOT IFNULL(zp.deleted,FALSE) WHERE w.type='PURCHASE'
),
x AS (SELECT w.* FROM wfp w JOIN deals USING (order_id) WHERE w.status IN ('Declined','Expired')),
tot AS (SELECT COUNT(*) n, COUNT(DISTINCT order_id) o FROM x)
SELECT x.status, IFNULL(CAST(x.reason_code AS STRING), '') reason_code, IFNULL(x.reason_message, '(пусто)') reason_message, COUNT(*) attempts, COUNT(DISTINCT x.order_id) orders,
  ROUND(COUNT(*) / tot.n, 4) share_attempts, FORMAT_DATE('%Y-%m-%d', DATE(MAX(x.created_date))) last_seen
FROM x, tot GROUP BY 1, 2, 3, tot.n ORDER BY attempts DESC LIMIT 15
