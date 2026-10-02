-- Perla Helsa · e-com витрины · 09 · ecom_plan_daily
-- Одна строка = один день × канал (B2C / B2B): план выручки, GP, заказов и штук после разбивки месячного плана по дням. Блок ТЗ: 1.
-- Источник: analytics.monthly_revenue_plan_by_sku (план 2026 по SKU и месяцам, UAH).
-- Правило разбивки (v1, на согласование с финансами): веса дней = фактическая выручка B2C того же дня недели в предыдущих 8 неделях
--   (daily_kpi_metrics), нормированная внутри месяца; воскресенья без отгрузок получают вес ≈ 0. Пока правило не утверждено —
--   альтернатива `even` (поровну по дням) оставлена рядом, чтобы на графике было видно обе кривые.

WITH plan_m AS (
  SELECT channel, month_start, LAST_DAY(month_start) AS month_end,
    SUM(plan_revenue_uah) AS plan_revenue_uah, SUM(plan_gross_profit_uah) AS plan_gp_uah, SUM(plan_orders) AS plan_orders, SUM(plan_quantity) AS plan_units
  FROM `perla-holistic-com.analytics.monthly_revenue_plan_by_sku`
  GROUP BY 1, 2
),
days AS (
  SELECT p.channel, p.month_start, d AS plan_date, p.plan_revenue_uah, p.plan_gp_uah, p.plan_orders, p.plan_units,
    DATE_DIFF(p.month_end, p.month_start, DAY) + 1 AS days_in_month
  FROM plan_m p, UNNEST(GENERATE_DATE_ARRAY(p.month_start, p.month_end)) AS d
),
-- вес дня недели по факту B2C за 8 недель до начала месяца
dow_weight AS (
  SELECT m.month_start, EXTRACT(DAYOFWEEK FROM k.date) AS dow, SUM(k.value) AS rev
  FROM (SELECT DISTINCT month_start FROM plan_m) m
  JOIN `perla-holistic-com.analytics.daily_kpi_metrics` k
    ON k.date >= DATE_SUB(m.month_start, INTERVAL 56 DAY) AND k.date < m.month_start
  WHERE k.region = 'UA' AND k.segment = 'B2C' AND k.metric_name = 'Revenue'
  GROUP BY 1, 2
),
weighted AS (
  SELECT d.*,
    IFNULL(w.rev, 0) AS dow_rev,
    SUM(IFNULL(w.rev, 0)) OVER (PARTITION BY d.channel, d.month_start) AS month_rev_weight
  FROM days d
  LEFT JOIN dow_weight w ON w.month_start = d.month_start AND w.dow = EXTRACT(DAYOFWEEK FROM d.plan_date)
)
SELECT
  channel, plan_date, month_start,
  -- v1 (по дням недели); если истории нет (первые месяцы) — поровну
  CASE WHEN month_rev_weight > 0 THEN plan_revenue_uah * dow_rev / month_rev_weight ELSE plan_revenue_uah / days_in_month END AS plan_revenue_uah,
  CASE WHEN month_rev_weight > 0 THEN plan_gp_uah * dow_rev / month_rev_weight ELSE plan_gp_uah / days_in_month END AS plan_gp_uah,
  CASE WHEN month_rev_weight > 0 THEN plan_orders * dow_rev / month_rev_weight ELSE plan_orders / days_in_month END AS plan_orders,
  CASE WHEN month_rev_weight > 0 THEN plan_units * dow_rev / month_rev_weight ELSE plan_units / days_in_month END AS plan_units,
  -- альтернатива: поровну
  plan_revenue_uah / days_in_month AS plan_revenue_uah_even,
  plan_gp_uah / days_in_month AS plan_gp_uah_even,
  SUM(CASE WHEN month_rev_weight > 0 THEN plan_revenue_uah * dow_rev / month_rev_weight ELSE plan_revenue_uah / days_in_month END)
    OVER (PARTITION BY channel, month_start ORDER BY plan_date) AS plan_revenue_cum_uah,
  SUM(CASE WHEN month_rev_weight > 0 THEN plan_gp_uah * dow_rev / month_rev_weight ELSE plan_gp_uah / days_in_month END)
    OVER (PARTITION BY channel, month_start ORDER BY plan_date) AS plan_gp_cum_uah
FROM weighted
ORDER BY channel, plan_date
