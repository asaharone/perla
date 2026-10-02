-- Perla Helsa · e-com витрины · 01 · ecom_orders
-- Одна строка = одна сделка Zoho (заказ) B2C/Service/Socials/Messengers UA, с 2026-01-01.
-- Ключ: order_id (zoho_deals.id). Блоки ТЗ: 1, 2, 4, 5, 6, 7.
-- Источники: crm_data.zoho_deals (статус, оплата, устройство, cookie GA), crm_data.zoho_invoices (доставка, выкуп, отгрузка),
--   analytics.orders_with_upsell (позиции: платные / апсел / подарки, суммы), analytics.orders (order_num = первый/повторный, revenue_uah оплаченная),
--   analytics.ga_events_ua (сессия заказа: purchase.transaction_id = номер заказа; запасной ключ — cookie GA_Client_id + session id).
-- Правило связи с GA4: сначала по номеру заказа (Deal_Name «Замовлення UA4047193» → 4047193 = GA transaction_id), иначе по cookie.
--   Проверка на сентябре 2026: наложка 97%, предоплата 83% по номеру; с cookie — 96% всех заказов Checkout.
-- Деньги: revenue_uah — оплаченная выручка (analytics.orders, та же база что Financial Overview); billed_uah — сумма сделки.
-- Две базы статусов: status_group ('successful' — деньги; всё кроме 'canceled' — «создано», для конверсий).

WITH params AS (
  SELECT DATE '2026-01-01' AS d_from, DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) AS d_to
),
deals AS (
  SELECT
    d.id AS order_id,
    d.Deal_Name AS deal_name,
    REGEXP_EXTRACT(d.Deal_Name, r'(\d+)$') AS order_no,
    DATE(d.Deal_Time, 'Europe/Kyiv') AS order_date,
    d.Deal_Time AS order_ts,
    d.Contact_Name AS client_id,
    d.Channel_Group AS channel_group_crm,
    d.Channel AS channel_crm,
    d.Stage AS stage,
    d.Payment_Scheme AS payment_scheme,
    d.Device AS device,
    d.Platform AS platform,
    d.Consultation_Reason AS consultation_reason,
    d.Reason_B2C_Cancel AS cancel_reason,
    d.Promocode AS promocode,
    d.Billed_Amount AS billed_uah,
    d.Paid_Amount AS paid_uah,
    d.Discount_Percent AS discount_percent,
    d.AB_Test_Feature AS ab_test_feature,
    d.AB_Test_Value AS ab_test_value,
    d.Unable_To_Upsell AS unable_to_upsell,
    d.UTM_Source AS utm_source_crm, d.UTM_Medium AS utm_medium_crm, d.UTM_Campaign AS utm_campaign_crm,
    COALESCE(REGEXP_EXTRACT(d.GA_Session_id, r'\.s(\d{10})'), SPLIT(d.GA_Session_id, '.')[SAFE_OFFSET(2)]) AS ga_sid_cookie,
    REGEXP_REPLACE(d.GA_Client_id, r'^GA\d\.\d\.', '') AS ga_cid_cookie
  FROM `perla-holistic-com.crm_data.zoho_deals` d, params
  WHERE d.Region = 'UA' AND NOT IFNULL(d.deleted, FALSE)
    AND DATE(d.Deal_Time, 'Europe/Kyiv') BETWEEN params.d_from AND params.d_to
    AND IFNULL(d.Channel_Group, '') NOT IN ('B2B', 'PR', 'Employees')
),
inv AS (
  SELECT Deal_Name AS order_id,
    ARRAY_AGG(STRUCT(id AS invoice_id, Status AS invoice_status, Shipping_Status AS shipping_status, Grand_Total AS grand_total_uah,
                     Delivery_Cost AS delivery_cost_uah, Free_Delivery AS free_delivery, Shipped_Date_Time AS shipped_ts,
                     Payment_Time AS payment_ts, Return_Amount AS return_uah, Delivery_Method AS delivery_method)
              ORDER BY Created_Time DESC LIMIT 1)[OFFSET(0)] AS i
  FROM `perla-holistic-com.crm_data.zoho_invoices`
  WHERE Region = 'UA' AND NOT IFNULL(deleted, FALSE) AND Deal_Name IS NOT NULL
  GROUP BY 1
),
lines AS (
  SELECT CAST(order_id AS INT64) AS order_id,
    COUNTIF(invoice_source = 'Order') AS paid_lines,
    COUNTIF(invoice_source IN ('Upsell Online', 'Upsell Manager')) AS upsell_lines,
    COUNTIF(invoice_source = 'Gift') AS gift_lines,
    SUM(IF(invoice_source <> 'Gift', quantity, 0)) AS paid_units,
    SUM(IF(invoice_source = 'Gift', quantity, 0)) AS gift_units,
    SUM(IF(invoice_source = 'Upsell Online', sku_upsell_sum, 0)) AS upsell_online_uah,
    SUM(IF(invoice_source = 'Upsell Manager', sku_upsell_sum, 0)) AS upsell_manager_uah,
    SUM(full_price_sku_invoice_sum) AS full_price_uah,
    SUM(discount_sum) AS discount_uah,
    MAX(final_invoice_sum) AS invoice_sum_uah
  FROM `perla-holistic-com.analytics.orders_with_upsell`
  WHERE market = 'UA'
  GROUP BY 1
),
paid AS (
  SELECT id AS order_id, order_num, is_paid, revenue_uah, promo_name
  FROM `perla-holistic-com.analytics.orders` WHERE market = 'UA'
),
ga_purchase AS (
  SELECT transaction_id AS order_no,
    ARRAY_AGG(STRUCT(real_session_id, user_pseudo_id, event_date) ORDER BY event_timestamp LIMIT 1)[OFFSET(0)] AS g
  FROM `perla-holistic-com.analytics.ga_events_ua`, params
  WHERE event_name = 'purchase' AND transaction_id IS NOT NULL
    AND event_date BETWEEN params.d_from AND DATE_ADD(params.d_to, INTERVAL 1 DAY)
  GROUP BY 1
),
sess AS (
  SELECT real_session_id,
    ANY_VALUE(user_pseudo_id) AS user_pseudo_id,
    SPLIT(real_session_id, '_')[SAFE_OFFSET(0)] AS ga_sid,
    MIN(event_date) AS session_date,
    ANY_VALUE(REGEXP_REPLACE(landing_page_path, r'\?.*$', '')) AS landing_page_path,
    ANY_VALUE(source_lnd) AS source, ANY_VALUE(medium_lnd) AS medium, ANY_VALUE(campaign_lnd) AS campaign,
    MAX(is_paid) AS is_paid_traffic,
    LOGICAL_OR(event_name = 'add_to_cart') AS has_atc
  FROM `perla-holistic-com.analytics.ga_events_ua`, params
  WHERE event_date BETWEEN DATE_SUB(params.d_from, INTERVAL 7 DAY) AND DATE_ADD(params.d_to, INTERVAL 1 DAY)
  GROUP BY 1
),
linked AS (
  SELECT d.*,
    COALESCE(gp.g.real_session_id, sc.real_session_id) AS session_id,
    CASE WHEN gp.g.real_session_id IS NOT NULL THEN 'order_no' WHEN sc.real_session_id IS NOT NULL THEN 'cookie' END AS session_link_method
  FROM deals d
  LEFT JOIN ga_purchase gp ON gp.order_no = d.order_no
  LEFT JOIN sess sc ON sc.user_pseudo_id = d.ga_cid_cookie AND sc.ga_sid = d.ga_sid_cookie
)
SELECT
  l.order_id, l.deal_name, l.order_no, l.order_date, l.order_ts, l.client_id,
  l.channel_group_crm, l.channel_crm, l.stage,
  CASE
    WHEN l.stage IN ('Successful', 'Successful/Deferred Shipment') THEN 'successful'
    WHEN l.stage IN ('Delivery', 'Deferred Shipment', 'Out for Delivery') THEN 'in_progress'
    WHEN l.stage = 'Terminated' THEN 'refused'
    WHEN l.stage = 'Canceled' THEN 'canceled'
    ELSE 'other' END AS status_group,
  l.stage <> 'Canceled' AS is_created,
  l.stage IN ('Successful', 'Successful/Deferred Shipment') AS is_successful,
  l.payment_scheme,
  CASE l.payment_scheme WHEN 'Buyout' THEN 'prepaid' WHEN 'Cash On Delivery' THEN 'cod' WHEN 'Mixed' THEN 'mixed' ELSE 'unknown' END AS payment_type,
  l.channel_crm = 'Fast Order' AS is_one_click,
  l.device, l.platform, l.consultation_reason, l.cancel_reason, l.promocode, p.promo_name,
  l.ab_test_feature, l.ab_test_value, l.unable_to_upsell,
  -- деньги
  l.billed_uah, l.paid_uah, p.revenue_uah, i.i.grand_total_uah, i.i.delivery_cost_uah, i.i.free_delivery, i.i.return_uah,
  l.discount_percent, ln.full_price_uah, ln.discount_uah,
  -- позиции
  IFNULL(ln.paid_lines, 0) + IFNULL(ln.upsell_lines, 0) AS paid_lines,
  IFNULL(ln.paid_lines, 0) AS base_lines, IFNULL(ln.upsell_lines, 0) AS upsell_lines, IFNULL(ln.gift_lines, 0) AS gift_lines,
  IFNULL(ln.paid_units, 0) AS paid_units, IFNULL(ln.gift_units, 0) AS gift_units,
  IFNULL(ln.upsell_online_uah, 0) AS upsell_online_uah, IFNULL(ln.upsell_manager_uah, 0) AS upsell_manager_uah,
  ln.upsell_online_uah > 0 AS has_upsell_online, ln.upsell_manager_uah > 0 AS has_upsell_manager, ln.gift_lines > 0 AS has_gift,
  -- клиент
  p.order_num, p.is_paid,
  CASE WHEN p.order_num = 1 THEN 'new' WHEN p.order_num > 1 THEN 'repeat' END AS customer_type,
  -- доставка и выкуп
  i.i.invoice_id, i.i.invoice_status, i.i.shipping_status, i.i.delivery_method, DATE(i.i.shipped_ts, 'Europe/Kyiv') AS shipped_date, i.i.payment_ts,
  i.i.shipping_status = 'Refused Delivery' AS is_refused_delivery,
  -- сессия GA4 и тип входа
  l.session_id, l.session_link_method, s.session_date, s.landing_page_path, s.source AS session_source, s.medium AS session_medium, s.campaign AS session_campaign, s.is_paid_traffic,
  CASE
    WHEN s.landing_page_path IS NULL THEN NULL
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/?$') THEN 'home'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/category/(collagen|vitamin-d3|omega-3|dobavki|kompleksy)(/|$)') THEN 'category_product'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/category/(sleep|immune-support|skin-revival|sport-and-recovery|energy-recovery|cleansing-and-protection|beauty-and-care|self-care|daily-base|daily-balance|focus-and-recovery|dlya-detej|food-and-drinks|accessories)(/|$)') THEN 'category_need'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/category/(vse)(/|$)') THEN 'catalog'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/category/') THEN 'category_promo'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/store(/|$)') THEN 'catalog'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/blog(/|$)') THEN 'blog'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/search') THEN 'search'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/(quiz|funnel|lp|landing|test)') THEN 'quiz_funnel'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/cart') THEN 'checkout'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/(personal-account|contacts|job-opportunities|about|ordering|sertifikaty|reviews|policy|oferta|delivery|faq)') THEN 'service'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/[a-z0-9-]+-meta(/|$)') THEN 'pdp_meta'
    WHEN REGEXP_CONTAINS(s.landing_page_path, r'^(/ru)?/[a-zA-Z0-9-]+(/|$)') THEN 'pdp'
    ELSE 'other' END AS entry_type,
  CASE
    WHEN LOWER(s.source) IN ('facebook.com','instagram.com','facebook','instagram','ig','fb','meta') AND LOWER(IFNULL(s.medium,'')) IN ('cpc','paid','paid_social','ppc')
      THEN IF(REGEXP_CONTAINS(LOWER(IFNULL(s.campaign,'')), r'funnel|quiz|voronk|lp_'), 'Meta funnels', 'Meta e-com')
    WHEN LOWER(s.source) = 'google' AND LOWER(IFNULL(s.medium,'')) IN ('cpc','ppc','paid','cpm','display','pmax') THEN 'Google'
    WHEN LOWER(IFNULL(s.medium,'')) = 'organic' THEN 'Organic'
    WHEN LOWER(IFNULL(s.source,'')) IN ('email','viber','promo','trigger','esputnik','esputnik-promo','sms') OR LOWER(IFNULL(s.medium,'')) IN ('email','viber','sms','trigger','promo') THEN 'CRM'
    WHEN LOWER(IFNULL(s.medium,'')) = 'blogger' OR LOWER(IFNULL(s.source,'')) IN ('youtube','blogger','bloggers','influence') THEN 'Influence'
    WHEN LOWER(IFNULL(s.source,'')) IN ('instagram.com','instagram','facebook','facebook.com','instagram.viral','facebook.viral','igshopping','tiktok','tiktok.com','threads','telegram','t.me') THEN 'SMM'
    WHEN s.source IS NULL OR LOWER(s.source) IN ('(direct)','direct','(none)') THEN 'Direct'
    WHEN LOWER(IFNULL(s.medium,'')) = 'referral' THEN 'Referral'
    ELSE 'Other' END AS channel_group,
  s.has_atc AS session_has_atc
FROM linked l
LEFT JOIN inv i ON i.order_id = l.order_id
LEFT JOIN lines ln ON ln.order_id = l.order_id
LEFT JOIN paid p ON p.order_id = l.order_id
LEFT JOIN sess s ON s.real_session_id = l.session_id
