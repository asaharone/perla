-- Perla Helsa · e-com витрины · 02 · ecom_order_items
-- Одна строка = одна позиция заказа (строка инвойса Zoho) B2C UA с 2026-01-01.
-- Ключ: line_id (invoice_line_item_id). Блоки ТЗ: 3, 4, 6, 8.
-- Источники: analytics.orders_with_upsell (позиции с источником: Order / Upsell Online / Upsell Manager / Gift),
--   crm_data.zoho_products (код, тип, категория, курс приёма), analytics.fct_sku_revenue (GP по SKU: себестоимость,
--   доставка, фулфилмент, комиссии, маркетинг — наборы уже разложены по составу).
-- Определения: позиция = платная строка SKU; подарки отдельно (is_gift); UPO = сумма платных единиц.
--   GP (gross profit по SKU) берём из fct_sku_revenue: sku_gp_uah = выручка − net cost − доставка − фулфилмент − комиссии − маркетинг (по UTM-дню).
--   CM2 (до маркетинга) = sku_gp_uah + sku_marketing_uah. Пока себестоимость — по последним поставкам, не FIFO (мастер-таблица к 09.10).
-- Примечание: fct_sku_revenue даёт строки по SKU внутри набора, поэтому для набора GP суммируется по составу (bundle_sku_rows > 1).
-- Связь с fct_sku_revenue: (id заказа, offer = Product_Name справочника Zoho). Позиции «Upsell Manager/Online» с тем же товаром, что и основная
--   строка, получают GP всего оффера (ограничение v1 — в fct_sku_revenue нет invoice_source).

WITH params AS (
  SELECT DATE '2026-01-01' AS d_from, DATE_SUB(CURRENT_DATE('Europe/Kyiv'), INTERVAL 1 DAY) AS d_to
),
items AS (
  SELECT
    o.invoice_line_item_id AS line_id,
    CAST(o.order_id AS INT64) AS order_id,
    o.order_date, o.order_status, o.channel, o.channel_group, o.payment_scheme,
    CAST(o.client_id AS INT64) AS client_id,
    o.invoice_id, o.invoice_date,
    o.product_id, o.product_name,
    o.quantity, o.product_price, o.full_price_sku_invoice_sum AS full_price_uah, o.discount_percent, o.discount_sum AS discount_uah,
    o.quantity * o.product_price AS line_revenue_uah,
    o.invoice_source,
    o.invoice_source = 'Gift' AS is_gift,
    o.invoice_source IN ('Upsell Online', 'Upsell Manager') AS is_upsell,
    CASE o.invoice_source WHEN 'Order' THEN 'order' WHEN 'Upsell Online' THEN 'upsell_online' WHEN 'Upsell Manager' THEN 'upsell_manager' WHEN 'Gift' THEN 'gift' ELSE 'other' END AS line_source,
    o.sku_upsell_sum AS upsell_uah,
    o.manager, o.manager_role
  FROM `perla-holistic-com.analytics.orders_with_upsell` o, params
  WHERE o.market = 'UA' AND o.order_date BETWEEN params.d_from AND params.d_to
    AND IFNULL(o.channel_group, '') NOT IN ('B2B', 'PR', 'Employees')
),
prod AS (
  SELECT id AS product_id, Product_Code AS product_code, Product_Name AS product_name_zoho, Product_Type AS product_type,
    Product_Categories AS product_category, SAFE_CAST(Application_Period_Days AS INT64) AS application_days, Intended_For AS intended_for
  FROM `perla-holistic-com.crm_data.zoho_products` WHERE Region = 'UA'
),
gp AS (
  -- GP по SKU внутри заказа; для наборов строк несколько — суммируем на уровень (заказ, оффер)
  SELECT id AS order_id, offer,
    SUM(sku_revenue_uah) AS sku_revenue_uah,
    SUM(sku_net_cost_uah) AS sku_net_cost_uah,
    SUM(sku_delivery_uah + sku_fullfillment_uah + sku_comission_for_seller_uah + sku_bank_commission_uah) AS sku_fulfilment_uah,
    SUM(sku_marketing_costs_total_uah) AS sku_marketing_uah,
    SUM(sku_gross_profit_uah) AS sku_gp_uah,
    COUNT(*) AS bundle_sku_rows
  FROM `perla-holistic-com.analytics.fct_sku_revenue`, params
  WHERE market = 'UA' AND created_at BETWEEN params.d_from AND params.d_to
  GROUP BY 1, 2
)
SELECT
  it.*,
  pr.product_code, pr.product_type, pr.product_category, pr.application_days, pr.intended_for,
  pr.product_type = 'Complexes' AS is_bundle,
  -- тип позиции для UPO: платная / подарок / сервис (курсы, сертификаты, пакеты)
  CASE
    WHEN it.is_gift THEN 'gift'
    WHEN pr.product_type IN ('Services', 'Certificates', 'Marketing Materials') OR pr.product_category IN ('Package UA') THEN 'service'
    ELSE 'paid' END AS unit_type,
  -- GP по SKU (из fct_sku_revenue), только для оплаченных заказов
  g.sku_revenue_uah, g.sku_net_cost_uah, g.sku_fulfilment_uah, g.sku_marketing_uah, g.sku_gp_uah,
  g.sku_gp_uah + IFNULL(g.sku_marketing_uah, 0) AS sku_cm2_uah,
  g.bundle_sku_rows,
  -- место добавления в корзину (v1: неизвестно до релиза item_list_name; заполняется из 05_ecom_atc_items по (user, item, 7 дней) на шаге 2)
  CAST(NULL AS STRING) AS atc_place
FROM items it
LEFT JOIN prod pr ON pr.product_id = it.product_id
-- fct_sku_revenue.offer = Product_Name из Zoho («UA Triple Magnesium №60»), а product_name инвойса — «Дієтична добавка - "Triple Magnesium №60" UA», поэтому связь через справочник товаров
LEFT JOIN gp g ON g.order_id = it.order_id AND g.offer = pr.product_name_zoho
