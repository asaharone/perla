-- Блок 2 · типы входа (по посадочной странице) × месяц: сессии, ATC, покупки GA4, связанные заказы Zoho и их выручка.
WITH ev AS (
  SELECT real_session_id, event_name, event_date, transaction_id, REGEXP_REPLACE(landing_page_path, r'\?.*$', '') lp
  FROM `perla-holistic-com.analytics.ga_events_ua` WHERE event_date BETWEEN '2026-01-01' AND '2026-09-30'
),
s AS (
  SELECT real_session_id sid, MIN(event_date) sd, ANY_VALUE(lp) lp, LOGICAL_OR(event_name='view_item') vi, LOGICAL_OR(event_name='add_to_cart') atc,
    LOGICAL_OR(event_name='begin_checkout') bc, LOGICAL_OR(event_name='purchase') pu, ARRAY_AGG(DISTINCT IF(event_name='purchase', transaction_id, NULL) IGNORE NULLS) tids
  FROM ev GROUP BY 1
),
deals AS (
  SELECT REGEXP_EXTRACT(d.Deal_Name, r'(\d+)$') order_no, d.Stage stage, d.Billed_Amount billed, o.revenue_uah
  FROM `perla-holistic-com.crm_data.zoho_deals` d LEFT JOIN `perla-holistic-com.analytics.orders` o ON o.id = d.id AND o.market='UA'
  WHERE d.Region='UA' AND NOT IFNULL(d.deleted, FALSE) AND DATE(d.Deal_Time, 'Europe/Kyiv') BETWEEN '2026-01-01' AND '2026-10-07'
),
sl AS (
  SELECT s.sid, s.sd, s.lp, s.vi, s.atc, s.bc, s.pu,
    COUNT(d.order_no) zoho_orders, COUNTIF(d.stage <> 'Canceled') zoho_created, SUM(IF(d.stage <> 'Canceled', d.billed, 0)) zoho_billed,
    COUNTIF(d.stage IN ('Successful','Successful/Deferred Shipment')) zoho_successful, SUM(IF(d.stage IN ('Successful','Successful/Deferred Shipment'), d.revenue_uah, 0)) zoho_revenue
  FROM s LEFT JOIN UNNEST(s.tids) t LEFT JOIN deals d ON d.order_no = t GROUP BY 1,2,3,4,5,6,7
)
SELECT FORMAT_DATE('%Y-%m', sd) month, CASE
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/?$') THEN 'home'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/category/(collagen|vitamin-d3|omega-3|dobavki|kompleksy)(/|$)') THEN 'category_product'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/category/(sleep|immune-support|skin-revival|sport-and-recovery|energy-recovery|cleansing-and-protection|beauty-and-care|self-care|daily-base|daily-balance|focus-and-recovery|dlya-detej|food-and-drinks|accessories)(/|$)') THEN 'category_need'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/category/(vse)(/|$)') THEN 'catalog'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/category/') THEN 'category_promo'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/store(/|$)') THEN 'catalog'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/blog(/|$)') THEN 'blog'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/search') THEN 'search'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/(quiz|funnel|lp|landing|test)') THEN 'quiz_funnel'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/cart') THEN 'checkout'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/(personal-account|contacts|job-opportunities|about|ordering|sertifikaty|reviews|policy|oferta|delivery|faq)') THEN 'service'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/[a-z0-9-]+-meta(/|$)') THEN 'pdp_meta'
    WHEN REGEXP_CONTAINS(lp, r'^(/ru)?/[a-zA-Z0-9-]+(/|$)') THEN 'pdp'
    ELSE 'other' END entry_type,
  COUNT(*) sessions, COUNTIF(vi) view_item_s, COUNTIF(atc) atc_s, COUNTIF(bc) checkout_s, COUNTIF(pu) purchase_s,
  SUM(zoho_orders) zoho_orders, SUM(zoho_created) zoho_created, ROUND(SUM(zoho_billed)) zoho_billed_uah, SUM(zoho_successful) zoho_successful, ROUND(SUM(zoho_revenue)) zoho_revenue_uah
FROM sl GROUP BY 1, 2 ORDER BY 1, 3 DESC
