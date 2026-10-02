-- 08 · Відвантажені замовлення B2C UA за джерелом (last-click UTM) по місяцях: платні, органіка, власні соцмережі, блогери, CRM (email/Viber), офлайн
-- Джерело: analytics.orders_by_shipment_date (є з травня 2025). offline = замовлення не з сайту (месенджери, сервіс, кол-центр).
WITH o AS (
  SELECT FORMAT_DATE('%Y-%m', created_at) month,
    CASE
      WHEN utm_source='facebook.com' AND utm_medium='cpc' THEN 'paid_meta'
      WHEN utm_source='google' AND utm_medium='cpc' THEN 'paid_google'
      WHEN utm_medium='organic' THEN 'organic_search'
      WHEN utm_source IN ('instagram.com','instagram','instagram.viral','IGShopping','facebook','facebook.viral') AND (utm_medium IS NULL OR utm_medium<>'blogger') THEN 'social_own'
      WHEN utm_medium='blogger' OR utm_source IN ('youtube','YouTube') THEN 'blogger'
      WHEN utm_source IN ('viber','email','promo','trigger') OR LOWER(utm_source) LIKE 'esputnik%' OR utm_medium IN ('email','viber','sms') THEN 'crm'
      WHEN utm_source='offline' THEN 'offline'
      WHEN utm_source='(direct)' THEN 'direct'
      ELSE 'other' END bucket,
    revenue_uah / fx.rate_USD rev_usd
  FROM `perla-holistic-com.analytics.orders_by_shipment_date` o
  LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(o.created_at)=fx.month
  WHERE o.market='UA' AND o.channel_group_with_b2c='B2C' AND o.is_terminated=0 AND o.created_at >= '2025-01-01' AND o.created_at < CURRENT_DATE('Europe/Kyiv')
)
SELECT month,
  COUNTIF(bucket='paid_meta') paid_meta, COUNTIF(bucket='paid_google') paid_google, COUNTIF(bucket='organic_search') organic_search,
  COUNTIF(bucket='social_own') social_own, COUNTIF(bucket='blogger') blogger, COUNTIF(bucket='crm') crm,
  COUNTIF(bucket='offline') offline, COUNTIF(bucket='direct') direct, COUNTIF(bucket='other') other, COUNT(*) total,
  ROUND(SUM(IF(bucket='crm', rev_usd, 0))) crm_rev, ROUND(SUM(rev_usd)) total_rev
FROM o GROUP BY 1 ORDER BY 1
