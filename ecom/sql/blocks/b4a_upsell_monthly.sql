WITH o AS (
  SELECT order_id, order_date, MAX(revenue_uah) revenue_uah, SUM(IF(invoice_source<>'Gift', quantity, 0)) paid_units, COUNTIF(invoice_source<>'Gift') paid_lines,
    SUM(IF(invoice_source='Upsell Online', sku_upsell_sum,0)) up_online, SUM(IF(invoice_source='Upsell Manager', sku_upsell_sum,0)) up_manager, COUNTIF(invoice_source='Gift') gift_lines,
    SUM(IF(invoice_source='Upsell Online', quantity*product_price,0)) up_online_rev, SUM(IF(invoice_source='Upsell Manager', quantity*product_price,0)) up_manager_rev
  FROM `perla-holistic-com.analytics.orders_with_upsell`
  WHERE market='UA' AND IFNULL(channel_group,'') NOT IN ('B2B','PR','Employees','Service') AND order_date BETWEEN '2026-01-01' AND '2026-09-30' AND order_status IN ('Successful','Successful/Deferred Shipment')
  GROUP BY 1,2
)
SELECT FORMAT_DATE('%Y-%m', order_date) month, COUNT(*) orders, COUNTIF(up_online>0) with_upsell_online, COUNTIF(up_manager>0) with_upsell_manager, COUNTIF(up_online>0 OR up_manager>0) with_any_upsell, COUNTIF(gift_lines>0) with_gift,
  ROUND(SUM(up_online)) upsell_online_uah, ROUND(SUM(up_manager)) upsell_manager_uah, ROUND(SUM(up_online_rev)) upsell_online_rev_uah, ROUND(SUM(up_manager_rev)) upsell_manager_rev_uah, ROUND(SUM(revenue_uah)) revenue_uah,
  ROUND(AVG(IF(up_online>0 OR up_manager>0, revenue_uah, NULL)),1) aov_with_upsell, ROUND(AVG(IF(up_online>0 OR up_manager>0, NULL, revenue_uah)),1) aov_without_upsell,
  ROUND(AVG(IF(up_manager>0, revenue_uah, NULL)),1) aov_with_manager, ROUND(AVG(IF(up_online>0, revenue_uah, NULL)),1) aov_with_online,
  ROUND(AVG(IF(up_online>0 OR up_manager>0, paid_units, NULL)),3) upo_with_upsell, ROUND(AVG(IF(up_online>0 OR up_manager>0, NULL, paid_units)),3) upo_without_upsell
FROM o GROUP BY 1 ORDER BY 1
