#!/usr/bin/env python3
"""Perla Helsa · E-com dashboard · сборка.

Читает data/raw/*.json (результаты запросов ecom/sql/blocks/*.sql в формате
{"fields":[...],"rows":[[...]]} либо в формате ответа BigQuery API
{"schema":{"fields":[...]},"rows":[{"f":[{"v":...}]}]} либо `bq --format=json`),
добавляет справочники data/definitions.json и data/ga_item_map.json и пишет:
  data/snapshot.json — все данные страницы
  template.html      — шаблон из parts/* (плейсхолдеры /*__DATA__*/ и /*__SQL__*/)
  index.html         — страница с встроенным снимком

Запуск: python3 ecom/build.py
"""
import json, re, sys, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW, DATA, PARTS, SQLB = ROOT / "data" / "raw", ROOT / "data", ROOT / "parts", ROOT / "sql" / "blocks"

def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float, bool)):
        return v
    s = str(v)
    if s in ("true", "false"):
        return s == "true"
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    try:
        return float(s)
    except ValueError:
        return s

def load_raw(p):
    d = json.load(open(p, encoding="utf-8"))
    if isinstance(d, list):                                   # bq --format=json
        return [{k: num(v) for k, v in row.items()} for row in d], {}
    if "schema" in d:                                         # BigQuery API
        fields = [f["name"] for f in d["schema"]["fields"]]
        rows = [{f: num(c["v"]) for f, c in zip(fields, row["f"])} for row in d.get("rows", [])]
    else:                                                     # {"fields","rows"}
        fields = d["fields"]
        rows = [{f: num(v) for f, v in zip(fields, row)} for row in d["rows"]]
    meta = {k: v for k, v in d.items() if k.startswith("_")}
    return rows, meta

def main():
    tables, meta = {}, {}
    for p in sorted(RAW.glob("*.json")):
        rows, m = load_raw(p)
        tables[p.stem] = rows
        meta[p.stem] = m
        print(f"  {p.stem}: {len(rows)} рядків")
    months = sorted({r["month"] for r in tables.get("b1a_monthly_business", []) if r.get("month")})
    if not months:
        sys.exit("нет b1a_monthly_business — нечего собирать")
    data_through = max(r["date"] for r in tables.get("b1b_sept_daily_fact_plan", [{"date": months[-1] + "-01"}]) if r.get("rev_uah"))
    item_map = json.load(open(DATA / "ga_item_map.json", encoding="utf-8")).get("items", {})
    defs = json.load(open(DATA / "definitions.json", encoding="utf-8"))
    snapshot = {
        "generated": dt.date.today().isoformat(),
        "data_through": data_through,
        "source": "BigQuery perla-holistic-com — analytics (orders, orders_with_upsell, daily_kpi_metrics, monthly_revenue_plan_by_sku, ga_events_ua, calls, email_messages, fct_sku_revenue), analytics_267506323 (сирі події GA4), crm_data (zoho_deals, zoho_products, zoho_contacts, zoho_payments, billing_wayforpay_transaction_history)",
        "months": months,
        "tables": tables,
        "meta": meta,
        "item_map": item_map,
        "defs": defs,
    }
    json.dump(snapshot, open(DATA / "snapshot.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    sql = {p.stem: p.read_text(encoding="utf-8") for p in sorted(SQLB.glob("*.sql"))}
    parts = [p.read_text(encoding="utf-8") for p in sorted(PARTS.iterdir())]
    head, body, core, *views = parts
    template = (head + body +
                '<script type="application/json" id="data">/*__DATA__*/</script>\n'
                '<script type="application/json" id="sql">/*__SQL__*/</script>\n' +
                core + "".join(views))
    (ROOT / "template.html").write_text(template, encoding="utf-8")
    safe = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = template.replace("/*__DATA__*/", safe(snapshot)).replace("/*__SQL__*/", safe(sql))
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print(f"index.html: {len(html.encode()) / 1024:.0f} KB · місяці {months[0]}…{months[-1]} · дані по {data_through}")

if __name__ == "__main__":
    main()
