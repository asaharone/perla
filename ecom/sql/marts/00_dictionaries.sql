-- Perla Helsa · e-com витрины · 00 · Справочники (общие правила для всех витрин)
-- BigQuery-вьюхи не могут делить CTE, поэтому эти CASE повторяются в витринах дословно.
-- Шаг 2 (после согласования 10.10): вынести в persistent UDF `perla-holistic-com.udf.*`, чтобы правило жило в одном месте.
--
-- 1) ТИП ВХОДА (entry_type) — по landing_page_path сессии GA4 (ga_events_ua.landing_page_path, без query-string).
--    Правила подобраны по фактическим посадочным за апрель–сентябрь 2026; категории разделены на
--    «за продуктом», «за потребностью» и «промо-подборка». Новые слаги попадают в category_promo, пока их не внесут сюда.
--    Когда фронтенд добавит page_type в page_view (трекинг P2), эта логика заменяется на параметр события.
CREATE TEMP FUNCTION entry_type(p STRING) AS (
  CASE
    WHEN p IS NULL THEN 'other'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/?$') THEN 'home'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/category/(collagen|vitamin-d3|omega-3|dobavki|kompleksy)(/|$)') THEN 'category_product'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/category/(sleep|immune-support|skin-revival|sport-and-recovery|energy-recovery|cleansing-and-protection|beauty-and-care|self-care|daily-base|daily-balance|focus-and-recovery|dlya-detej|food-and-drinks|accessories)(/|$)') THEN 'category_need'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/category/(vse)(/|$)') THEN 'catalog'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/category/') THEN 'category_promo'       -- spring-essentials-40, new, bestseller, summer-*, 2 …
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/store(/|$)') THEN 'catalog'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/blog(/|$)') THEN 'blog'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/search') THEN 'search'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/(quiz|funnel|lp|landing|test)') THEN 'quiz_funnel'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/cart') THEN 'checkout'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/(personal-account|contacts|job-opportunities|about|ordering|sertifikaty|reviews|policy|oferta|delivery|faq)') THEN 'service'
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/[a-z0-9-]+-meta(/|$)') THEN 'pdp_meta'   -- лендинги карточек для Meta-трафика (/collagen-meta)
    WHEN REGEXP_CONTAINS(p, r'^(/ru)?/[a-zA-Z0-9-]+(/|$)') THEN 'pdp'
    ELSE 'other'
  END
);

-- 2) КАНАЛ (channel_group) — один справочник = каналы целей маркетинга («Цілі маркетингу Q3»):
--    Google · Meta e-com · Meta funnels · SMM · Organic · Direct · Influence · CRM · Referral · Other.
--    Канал заказа = канал ЕГО сессии GA4 (source_lnd/medium_lnd/campaign_lnd), а не UTM из cookie Zoho (живёт до 2 месяцев).
CREATE TEMP FUNCTION channel_group(src STRING, med STRING, camp STRING) AS (
  CASE
    WHEN LOWER(src) IN ('facebook.com','instagram.com','facebook','instagram','ig','fb','meta') AND LOWER(IFNULL(med,'')) IN ('cpc','paid','paid_social','ppc')
      THEN IF(REGEXP_CONTAINS(LOWER(IFNULL(camp,'')), r'funnel|quiz|voronk|lp_'), 'Meta funnels', 'Meta e-com')
    WHEN LOWER(src) = 'google' AND LOWER(IFNULL(med,'')) IN ('cpc','ppc','paid','cpm','display','pmax') THEN 'Google'
    WHEN LOWER(IFNULL(med,'')) = 'organic' THEN 'Organic'
    WHEN LOWER(IFNULL(src,'')) IN ('email','viber','promo','trigger','esputnik','esputnik-promo','sms') OR LOWER(IFNULL(med,'')) IN ('email','viber','sms','trigger','promo') THEN 'CRM'
    WHEN LOWER(IFNULL(med,'')) = 'blogger' OR LOWER(IFNULL(src,'')) IN ('youtube','blogger','bloggers','influence') THEN 'Influence'
    WHEN LOWER(IFNULL(src,'')) IN ('instagram.com','instagram','facebook','facebook.com','instagram.viral','facebook.viral','igshopping','tiktok','tiktok.com','threads','telegram','t.me') THEN 'SMM'
    WHEN src IS NULL OR LOWER(src) IN ('(direct)','direct','(none)') THEN 'Direct'
    WHEN LOWER(IFNULL(med,'')) = 'referral' THEN 'Referral'
    ELSE 'Other'
  END
);

-- 3) СТАТУС ЗАКАЗА — две базы по методологии (решение CLUST 10.10):
--    «создано»  — все сделки сайта/соцсетей/мессенджеров, кроме Canceled (для конверсий сайта);
--    «успешно»  — Stage IN ('Successful','Successful/Deferred Shipment') (для денег и GP);
--    «в пути»   — Delivery, Deferred Shipment, Out for Delivery (ещё не решено);
--    «невыкуп»  — Terminated (наложка, посылку не забрали); «отмена» — Canceled (до отправки).
CREATE TEMP FUNCTION status_group(stage STRING) AS (
  CASE
    WHEN stage IN ('Successful','Successful/Deferred Shipment') THEN 'successful'
    WHEN stage IN ('Delivery','Deferred Shipment','Out for Delivery') THEN 'in_progress'
    WHEN stage = 'Terminated' THEN 'refused'
    WHEN stage = 'Canceled' THEN 'canceled'
    ELSE 'other'
  END
);

-- 4) ПОЗИЦИЯ — платная строка SKU (invoice_source IN ('Order','Upsell Online','Upsell Manager')); подарки (Gift) считаются отдельно;
--    набор (Complexes) — одна позиция в заказе, для GP раскладывается по составу (fct_sku_revenue это уже делает).
-- 5) НОВЫЙ / ПОВТОРНЫЙ — по истории оплаченных сделок контакта (analytics.orders.order_num = 1 → первый), после дедупликации
--    контактов по телефону (03_ecom_customers). На сайте — параметр add_contact_info.type (new_customer / returning_customer).
-- 6) ОКНО ВОРОНКИ — 7 дней от add_to_cart до purchase по user_pseudo_id (7,7% покупок происходят в сессии без ATC).
-- 7) ПОРОГ БЕСПЛАТНОЙ ДОСТАВКИ — параметр с датами действия: 2300 ₴ до 24.09.2026, 2100 ₴ с 25.09.2026 (подтвердить у e-com PM);
--    подарок — от 4000 ₴ (Gift Sample Kit).
CREATE TEMP FUNCTION free_delivery_threshold(d DATE) AS (
  CASE WHEN d >= DATE '2026-09-25' THEN 2100 ELSE 2300 END
);

-- 8) GA4 item_id (id товара на сайте) → товар Zoho. Временный справочник на 36 позиций (ecom/data/ga_item_map.json);
--    заменить на поле Product_Code в items, когда фронтенд передаст его в dataLayer (трекинг P2).
SELECT 'dictionaries loaded' AS note;
