# Perla Helsa Cockpit — щомісячний знімок для Борду

Одна сторінка для чотирьох ролей: **CEO** (стан компанії), **CMO** (маркетинг B2C), **CFO** (фінанси, звірка, кеш), **CLUST** (Board Pack ≤ 15 метрик), плюс вкладки **Бенчмарки** (Perla проти ринку DTC-добавок) і **Процес** (цикл, власники, як оновити).

Опублікована версія (claude.ai): https://claude.ai/artifact/NcxzZ4dozRDuNuttH2Hg17. Там працюють ручні вводи: коментар CMO, кеш/дебіторка/запаси від фінансів, лог рішень.
`index.html` у цій папці — та сама сторінка без вводів (стартові значення зі знімка).

## Що всередині

```
board/
  sql/             10 запитів до BigQuery (perla-holistic-com.analytics), запускаються 1-го числа
  data/raw/        результати запитів (формат BigQuery API або `bq --format=json`)
  data/plan.json        бюджет 2026, RF CLUST, ліміти маркетингу        ← міняє Борд / CLUST
  data/targets.json     пороги (маркетинг ≤ 20%, CPO ≤ $10, NC/мкт ≥ 2.5x, знижка ≤ 25%, CM3 ≥ 35%, DSO ≤ 60 …)
  data/ly_2025.json     2025 помісячно з P&L Finance Dashboard (B2C UA)
  data/pnl_fd_2026.json P&L 2026 з Finance Dashboard (квартали, липень, серпень, прогноз вересня)
  data/manual_inputs.json  стартові ручні дані: кеш, дебіторка, запаси, борг (зріз 25.09)
  data/benchmarks.json  ринкові орієнтири з джерелами
  data/snapshot.json    зібраний знімок (вихід build.py)
  build.py         збирає snapshot.json і index.html з template.html
  template.html    сторінка з маркерами /*__DATA__*/ і /*__SQL__*/
  parts/           template.html по частинах (CSS, розмітка, JS); зібрати: див. нижче
  refresh.sh       повний цикл через `bq` (потрібен gcloud з доступом до проєкту)
  index.html       зібрана сторінка
```

## Місячний цикл

| Коли | Що | Хто |
|---|---|---|
| 1-ше число, 11:00 Київ | Автоматичний знімок: 10 запитів → `data/raw` → `build.py` → нова версія сторінки → коміт | Claude (рутина) · сповіщення CEO |
| до 3-го робочого дня | Коментар CMO (три відповіді) на вкладці «Маркетинг» | CMO |
| до 10-го | Звірка BigQuery ↔ Finance Dashboard (вкладка «Фінанси»), ручні вводи: звірений залишок, реєстр зобов'язань, дебіторка, запаси | Фінанси |
| за 3 дні до Борду | Board Pack без ручних правок: вкладка CLUST + коментар CMO + звірка | CLUST |
| Борд | Рішення по бюджету за правилом скейлу (NC / маркетинг ≥ 2.5x і ≥ $1 NC на додатковий $1 маркетингу) → лог рішень | CEO · Борд |

Тижневий ритм (середа — кеш-комітет, п'ятниця — «знижка + маркетинг на замовлення», щотижневий дзвінок з CLUST) описано на вкладці «Процес».

## Як оновити вручну

1. Запустити запити з `sql/` у BigQuery. У сесії Claude — коннектором BigQuery (`execute_sql_readonly`), результат зберегти як `data/raw/<назва без префікса NN_>.json` у форматі `{"fields":[...], "rows":[...]}` (як повертає API) або як список об'єктів (`bq --format=json`). З локальної машини з `gcloud auth login` — просто `./refresh.sh`.
2. `python3 build.py` — перераховує похідні показники (AOV, CPO, CAC, CM2/CM3, NC, знижка + маркетинг на замовлення, когорти, інкасація B2B…) і збирає `index.html`.
3. Опублікувати `index.html` як нову версію тієї самої сторінки на claude.ai (щоб збереглися ручні вводи і посилання) і закомітити.

Якщо міняли `parts/`, спершу зібрати `template.html`:

```python
# з папки board/
from pathlib import Path
P = Path('parts'); core = P.joinpath('03_core.js').read_text().rstrip()[:-len('</script>')]
Path('template.html').write_text(P.joinpath('01_head.html').read_text() + P.joinpath('02_body.html').read_text() + core
  + P.joinpath('04a_ceo_cmo.js').read_text() + P.joinpath('04b_cfo_clust_bench_flow.js').read_text() + P.joinpath('05_db_init.js').read_text())
```

## Визначення і виправлення в даних

База всіх таблиць — **дата відвантаження** (як Financial Overview і Finance Dashboard), валюта USD за курсом місяця (`month_exchange_rates`).

- У `daily_kpi_metrics` немає неділь без відвантажень (березень–липень 2026): реклама цих днів береться з `fct_ad_stats` і віднімається з GP.
- Бюджет блогерів у `fct_ad_stats` записаний двома половинами (google/organic і (direct)/(none)) — обидві віднесено до інфлюенсу.
- Нові клієнти — перше оплачене замовлення клієнта в CRM (`order_num = 1`); когорти — за кварталом першого замовлення.
- 2025 береться з P&L (у BigQuery рахунки до середини 2025 неповні). Розбіжність BigQuery ↔ FD по 2026 — 1–2% (маркетинг липня −6%, потребує звірки).
- Net Cost (лише продукт) і COGS (з доставкою, фулфілментом, еквайрингом) — різні рядки; CM2 рахується за COGS.

Повний словник — на вкладці CLUST.

## Ручні вводи (база сторінки на claude.ai)

Колекція `inputs`, документ на місяць (`inputs/2026-09`): `cmo_q1..cmo_q3`, `cmo_updated`, `cash_usd`, `cash_date`, `liabilities_uah`, `ar_uah`, `overdue_pct` (частка), `dso_days`, `stock_ua_usd`, `stock_pl_usd`, `transit_usd`, `note`, `updated`.
Колекція `decisions`: `text`, `owner`, `due`, `status` (`open`/`done`), `created`, `month`.
Писати можуть учасники з рівнем Contributor і вище; усі з посиланням читають. Стартові значення для вересня — з `data/manual_inputs.json`.
