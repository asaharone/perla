WITH o AS (
  SELECT order_id, order_date, order_status, payment_scheme, channel, MAX(revenue_uah) revenue_uah,
    COUNTIF(invoice_source IN ('Order','Upsell Online','Upsell Manager')) paid_lines, COUNTIF(invoice_source='Gift') gift_lines,
    SUM(IF(invoice_source<>'Gift', quantity, 0)) paid_units, MAX(IF(invoice_source<>'Gift' AND quantity>1, 1, 0)) has_qty_gt1,
    SUM(IF(invoice_source IN ('Upsell Online','Upsell Manager'), sku_upsell_sum,0)) upsell_uah, MAX(final_invoice_sum) invoice_sum
  FROM `perla-holistic-com.analytics.orders_with_upsell`
  WHERE market='UA' AND IFNULL(channel_group,'') NOT IN ('B2B','PR','Employees','Service') AND order_date BETWEEN '2026-01-01' AND '2026-09-30'
  GROUP BY 1,2,3,4,5
),
z AS (
  SELECT FORMAT_DATE('%Y-%m', order_date) month,
    COUNTIF(order_status<>'Canceled') created, COUNTIF(order_status IN ('Successful','Successful/Deferred Shipment')) successful,
    COUNTIF(order_status IN ('Delivery','Deferred Shipment','Out for Delivery')) in_progress, COUNTIF(order_status='Canceled') canceled, COUNTIF(order_status='Terminated') refused,
    COUNTIF(payment_scheme='Cash On Delivery' AND order_status<>'Canceled') cod_created, COUNTIF(payment_scheme='Cash On Delivery' AND order_status IN ('Successful','Successful/Deferred Shipment')) cod_successful, COUNTIF(payment_scheme='Cash On Delivery' AND order_status='Terminated') cod_refused,
    COUNTIF(payment_scheme='Buyout' AND order_status<>'Canceled') prepaid_created, COUNTIF(payment_scheme='Buyout' AND order_status IN ('Successful','Successful/Deferred Shipment')) prepaid_successful,
    COUNTIF(channel='Fast Order' AND order_status<>'Canceled') one_click_created,
    ROUND(SUM(IF(order_status IN ('Successful','Successful/Deferred Shipment'), revenue_uah, 0))) revenue_successful_uah,
    ROUND(SUM(IF(order_status<>'Canceled', IFNULL(invoice_sum, revenue_uah), 0))) revenue_created_uah,
    ROUND(AVG(IF(order_status IN ('Successful','Successful/Deferred Shipment'), paid_units, NULL)),3) upo_successful,
    ROUND(AVG(IF(order_status IN ('Successful','Successful/Deferred Shipment'), paid_lines, NULL)),3) lines_successful,
    COUNTIF(order_status IN ('Successful','Successful/Deferred Shipment') AND paid_lines=1) single_line_successful,
    COUNTIF(order_status IN ('Successful','Successful/Deferred Shipment') AND gift_lines>0) with_gift_successful,
    COUNTIF(order_status IN ('Successful','Successful/Deferred Shipment') AND has_qty_gt1=1) with_qty_gt1_successful,
    ROUND(SUM(IF(order_status IN ('Successful','Successful/Deferred Shipment'), upsell_uah, 0))) upsell_uah_successful
  FROM o GROUP BY 1
),
k AS (
  SELECT FORMAT_DATE('%Y-%m', k.date) month,
    ROUND(SUM(IF(metric_name='Revenue', value, 0) * fx.rate_USD)) kpi_revenue_uah, ROUND(SUM(IF(metric_name='COGS', value, 0) * fx.rate_USD)) kpi_cogs_uah,
    ROUND(SUM(IF(metric_name='Net Cost', value, 0) * fx.rate_USD)) kpi_net_cost_uah, ROUND(SUM(IF(metric_name='Marketing Budget', value, 0) * fx.rate_USD)) kpi_marketing_uah,
    ROUND(SUM(IF(metric_name='Gross Profit', value, 0) * fx.rate_USD)) kpi_gp_after_mkt_uah, CAST(SUM(IF(metric_name='Orders', value, 0)) AS INT64) kpi_orders, ROUND(ANY_VALUE(fx.rate_USD),2) rate_usd
  FROM `perla-holistic-com.analytics.daily_kpi_metrics` k LEFT JOIN `perla-holistic-com.analytics.month_exchange_rates` fx ON LAST_DAY(k.date)=fx.month
  WHERE region='UA' AND segment='B2C' AND k.date BETWEEN '2026-01-01' AND '2026-09-30' GROUP BY 1
),
p AS (SELECT FORMAT_DATE('%Y-%m', month_start) month, ROUND(SUM(plan_revenue_uah)) plan_revenue_uah, ROUND(SUM(plan_gross_profit_uah)) plan_gp_uah, SUM(plan_orders) plan_orders FROM `perla-holistic-com.analytics.monthly_revenue_plan_by_sku` WHERE channel='B2C' GROUP BY 1)
SELECT z.*, k.* EXCEPT(month), p.* EXCEPT(month) FROM z LEFT JOIN k USING(month) LEFT JOIN p USING(month) ORDER BY month
