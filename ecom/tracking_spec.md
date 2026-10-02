# Perla Helsa · ТЗ на трекинг e-com (GA4 / GTM dataLayer)

Версия 1 · 02.10.2026 · для e-com PM, разработки сайта perlahelsa.ua и маркетинг-аналитика.
Цель: закрыть разрывы, из-за которых блоки 3–5 ТЗ на e-com аналитику сегодня считаются оценкой по URL,
а не по событиям. Приоритеты: **P1** — без этого дашборд остаётся оценкой; **P2** — качество и сшивка
с Zoho; **P3** — гигиена потока.

Общие правила
- Все события — через `dataLayer.push` в GTM Web → GA4 (и sGTM, когда появится владелец).
- Параметры в snake_case; суммы — число в UAH без валюты; `currency: "UAH"` в e-commerce событиях.
- `items[].item_id` = **Product_Code из Zoho** (например `UA0008S`), не внутренний id сайта (P2); до релиза —
  временный словарь `ecom/data/ga_item_map.json`.
- Каждый релиз трекинга фиксируется в `dataLayer_version` (строка, P3) и проверяется на стейдже до выката.
- Не передавать персональные данные (телефон, e-mail) в чистом виде: только SHA-256 хеш телефона в `user_id`.

## P1 — место действия и платёжные события

### 1. Списки товаров (место добавления в корзину)
Добавить `item_list_id` / `item_list_name` в **view_item_list, select_item, add_to_cart, purchase** (у purchase —
на уровне каждого item: откуда он попал в корзину).

| item_list_id | item_list_name | Где |
|---|---|---|
| `catalog` | Каталог | /store, /category/vse |
| `category_<slug>` | Категория: <slug> | /category/<slug> (продуктовые, по потребности, акционные) |
| `search` | Поиск | результаты поиска |
| `home_<block>` | Главная: <блок> | блоки главной (хиты, новинки, акции) |
| `pdp` | Карточка товара | кнопка «в кошик» на карточке |
| `reco_cart` / `reco_product` / `reco_search` | Виджет рекомендаций: корзина / карточка / поиск | текущие `location` виджета |
| `post_purchase` | Предложение после покупки | экран «спасибо» / апсейл после оплаты |
| `blog_<post>` | Блог | кнопки в статьях |

```js
dataLayer.push({ event: 'add_to_cart', ecommerce: { currency: 'UAH', value: 1195,
  items: [{ item_id: 'UA0008S', item_name: 'Triple Magnesium №60', price: 1195, quantity: 1,
            item_list_id: 'category_sleep', item_list_name: 'Категорія: sleep', index: 3 }] } });
```

### 2. Виджет рекомендаций и предложение после покупки
- `upsell` (показ) — добавить `location` (`cart` / `product` / `search` / `post_purchase`) и `items[]` показанных товаров
  (сейчас показ без места — блок 4 считает показы «всего»).
- `upsell_select_product`, `upsell_add_product` — оставить, добавить `item_list_id` как в п. 1.
- Новые: `post_purchase_offer_view` (показ предложения после оплаты, `items[]`, `order_id`) и
  `post_purchase_offer_accept` (`item_id`, `order_id`, `value`).

### 3. Кнопка «купить в 1 клик»
`buy_1_click` — добавить `location` (`home` / `pdp` / `catalog` / `category` / `cart` / `blog`), `item_id`,
`stage` (`open` — открыл форму, `contact` — ввёл телефон, `submitted` — отправил). Сейчас место определяется по URL,
а связка заявки Zoho с сессией через cookie срабатывает редко — поэтому в `submitted` передавать `order_id`,
который возвращает бэкенд (номер заказа Zoho), как `transaction_id`.

### 4. Платёжные события (вместо оценки «без попытки» по данным WayForPay)
- `payment_redirect` — переход в WayForPay: `transaction_id` (номер заказа), `value`, `payment_type` (`card` / `apple_pay` / `google_pay` / `bnpl`).
- `payment_result` — возврат из WayForPay: `transaction_id`, `status` (`approved` / `declined` / `expired` / `pending`),
  `reason_code` (код WFP, например 1124), `attempt` (номер попытки).
- `purchase` отправлять **один раз** на подтверждённую оплату или оформленную наложку; `payment_type` в параметрах.

## P2 — качество и сшивка с Zoho
- `user_id` = SHA-256(телефон в формате 380XXXXXXXXX) после авторизации или ввода телефона в чекауте; `customer_type`
  (`new` / `returning`, как сейчас в `add_contact_info.type`) — во все события после определения.
- `page_type` в `page_view`: `home` / `pdp` / `pdp_meta` / `catalog` / `category_product` / `category_need` / `category_promo` /
  `search` / `blog` / `cart` / `checkout` / `account` / `service` / `quiz`. Это заменит правила по URL в словаре типов входа.
- `items[].item_id` = Product_Code Zoho; `item_category` (линейка), `item_variant` (вкус / объём), `item_brand`.
- `coupon` в `purchase` — строка кода (сейчас приходит `[object Object]`), `discount` на уровне item.
- В Zoho: источник строки инвойса `Upsell Online` разделить по месту (`cart` / `product` / `search` / `post_purchase`) —
  поле на строке инвойса или суффикс в `invoice_source`.
- `transaction_id` в `purchase` = номер заказа Zoho (как сейчас, `UA4047193` без префикса → `4047193`): не менять формат.

## P3 — гигиена потока
- Исключить стейдж- и дев-хосты из потока GA4 (фильтр по `hostname`), чтобы они не попадали в сессии и конверсии.
- Назначить владельца sGTM (контейнер, доступы, дата миграции тегов).
- Consent Mode v2: дата внедрения и режим по умолчанию для UA; событие `consent_update`.
- Версионирование: параметр `dataLayer_version` в каждом событии; чек-лист релиза (стейдж → прод → проверка в DebugView →
  сверка `purchase` с Zoho за первый день).

## Приёмка
1. На стейдже: все события P1 видны в GA4 DebugView с нужными параметрами; `transaction_id` совпадает с номером заказа Zoho.
2. На проде через 7 дней: доля `add_to_cart` с `item_list_id` ≥ 95%; `payment_result` есть у ≥ 95% онлайн-заказов
   (сверка с WayForPay); `buy_1_click.submitted` сшивается с заявками Zoho ≥ 90%.
3. Переключение вітрин: `05_ecom_atc_items.atc_place` → `item_list_name`; `07_ecom_one_click.click_place` → `location`;
   `06_ecom_payments.payment_outcome = 'no_attempt'` → по `payment_redirect`.
