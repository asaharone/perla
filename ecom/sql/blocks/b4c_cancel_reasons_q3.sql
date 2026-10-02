-- Блок 4/5 · причины отмен (Canceled) и отказов (Terminated) B2C UA, июль–сентябрь 2026.
WITH d AS (
  SELECT FORMAT_DATE('%Y-%m', DATE(Deal_Time, 'Europe/Kyiv')) month, IF(Stage='Canceled', 'canceled', 'refused') stage_group,
    IFNULL(NULLIF(TRIM(Reason_B2C_Cancel), ''), '(не указана)') reason, Payment_Scheme ps
  FROM `perla-holistic-com.crm_data.zoho_deals`
  WHERE Region='UA' AND NOT IFNULL(deleted, FALSE) AND Stage IN ('Canceled', 'Terminated') AND IFNULL(Channel_Group, '') NOT IN ('B2B','PR','Employees','Service')
    AND DATE(Deal_Time, 'Europe/Kyiv') BETWEEN '2026-07-01' AND '2026-09-30'
)
SELECT stage_group, reason, COUNTIF(month='2026-07') jul, COUNTIF(month='2026-08') aug, COUNTIF(month='2026-09') sep, COUNT(*) total,
  COUNTIF(ps='Cash On Delivery') cod, COUNTIF(ps='Buyout') prepaid
FROM d GROUP BY 1, 2 QUALIFY ROW_NUMBER() OVER (PARTITION BY stage_group ORDER BY total DESC) <= 10 ORDER BY 1, total DESC
