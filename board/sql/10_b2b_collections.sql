-- 10 · B2B: отримані оплати по місяцях (дата надходження грошей) — для порівняння з відгрузками B2B
-- Джерело: analytics.fct_b2b_payments
SELECT FORMAT_DATE('%Y-%m', p.created_at) month, ROUND(SUM(p.revenue_uah/fx.rate_USD)) collected_usd, COUNT(DISTINCT p.deal_name) deals
FROM `perla-holistic-com.analytics.fct_b2b_payments` p
LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(p.created_at)=fx.month
WHERE p.market='UA' AND p.created_at >= '2025-01-01' AND p.created_at < CURRENT_DATE('Europe/Kyiv')
GROUP BY 1 ORDER BY 1
