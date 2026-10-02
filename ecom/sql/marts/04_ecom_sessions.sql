-- Perla Helsa · e-com витрины · 04 · ecom_sessions
-- Одна строка = одна сессия GA4 (UA, analytics.ga_events_ua) с 2026-01-01. Блоки ТЗ: 1, 2, 5.
-- Ключ: session_id (real_session_id). Деньги заказа — из Zoho (01_ecom_orders по session_id), поведение — из GA4.
-- Поля: канал (единый справочник), тип входа (по посадочной), пройденные шаги воронки, покупка в сессии,
--   покупка пользователем в течение 7 дней после ATC (окно воронки), номера заказов.
-- Ограничения v1: устройство в ga_events_ua отсутствует (берётся из Zoho на уровне заказа); page_type — по URL до релиза трекинга P2.

WITH params AS (
  SELECT DATE '2026-01-01' AS d_from, DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) AS d_to
),
ev AS (
  SELECT real_session_id, user_pseudo_id, event_name, event_date, event_timestamp, transaction_id,
    REGEXP_REPLACE(landing_page_path, r'\?.*$', '') AS landing_page_path,
    source_lnd, medium_lnd, campaign_lnd, is_paid, ga_session_number, session_engaged, session_duration_sec
  FROM `perla-holistic-com.analytics.ga_events_ua`, params
  WHERE event_date BETWEEN params.d_from AND DATE_ADD(params.d_to, INTERVAL 7 DAY)
),
s AS (
  SELECT real_session_id AS session_id,
    ANY_VALUE(user_pseudo_id) AS user_pseudo_id,
    MIN(event_date) AS session_date,
    MIN(event_timestamp) AS session_start_ts,
    ANY_VALUE(ga_session_number) AS session_number,
    ANY_VALUE(landing_page_path) AS landing_page_path,
    ANY_VALUE(source_lnd) AS source, ANY_VALUE(medium_lnd) AS medium, ANY_VALUE(campaign_lnd) AS campaign,
    MAX(is_paid) AS is_paid_traffic,
    MAX(session_engaged = '1') AS engaged,
    MAX(session_duration_sec) AS duration_sec,
    LOGICAL_OR(event_name = 'view_item') AS has_view_item,
    LOGICAL_OR(event_name = 'add_to_cart') AS has_atc,
    LOGICAL_OR(event_name = 'view_cart') AS has_view_cart,
    LOGICAL_OR(event_name = 'begin_checkout') AS has_begin_checkout,
    LOGICAL_OR(event_name = 'add_contact_info') AS has_contact_info,
    LOGICAL_OR(event_name = 'add_payment_info') AS has_payment_info,
    LOGICAL_OR(event_name = 'purchase') AS has_purchase,
    LOGICAL_OR(event_name = 'buy_1_click') AS has_one_click,
    LOGICAL_OR(event_name IN ('upsell', 'upsell_add_product', 'upsell_select_product')) AS has_upsell_widget,
    MIN(IF(event_name = 'add_to_cart', event_timestamp, NULL)) AS first_atc_ts,
    ARRAY_AGG(DISTINCT IF(event_name = 'purchase', transaction_id, NULL) IGNORE NULLS) AS order_nos,
    COUNTIF(event_name = 'page_view') AS page_views
  FROM ev
  GROUP BY 1
),
-- покупка пользователем в течение 7 дней после первого ATC этой сессии (в любой сессии)
purch AS (
  SELECT user_pseudo_id, event_timestamp AS purchase_ts, transaction_id FROM ev WHERE event_name = 'purchase'
),
window7 AS (
  SELECT s.session_id,
    LOGICAL_OR(p.purchase_ts IS NOT NULL) AS purchased_7d,
    MIN(p.transaction_id) AS order_no_7d
  FROM s
  LEFT JOIN purch p ON p.user_pseudo_id = s.user_pseudo_id
    AND p.purchase_ts >= s.first_atc_ts AND p.purchase_ts < s.first_atc_ts + 7 * 24 * 3600 * 1000000
  WHERE s.has_atc
  GROUP BY 1
)
SELECT
  s.*,
  w.purchased_7d, w.order_no_7d,
  CASE
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
    ELSE 'Other' END AS channel_group
FROM s
LEFT JOIN window7 w USING (session_id)
WHERE s.session_date <= (SELECT d_to FROM params)
