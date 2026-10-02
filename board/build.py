#!/usr/bin/env python3
"""Perla Helsa · Board Cockpit · збірка знімка.

Читає data/raw/*.json (результати SQL із папки sql/, у форматі BigQuery API
{"fields":[...],"rows":[{"f":[{"v":...}]}]} або у форматі `bq --format=json`
[{"col": val, ...}]), додає статичні довідники з data/*.json, рахує похідні
показники і пише:
  data/snapshot.json  — один файл з усіма даними для сторінки
  index.html          — template.html із вбудованим знімком

Запуск:  python3 build.py            (з папки board/)
"""
import json, os, re, sys, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw"
DATA = ROOT / "data"

def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float, bool)):
        return v
    s = str(v)
    if s in ("true", "false"):
        return s == "true"
    try:
        if re.fullmatch(r"-?\d+", s):
            return int(s)
        return float(s)
    except ValueError:
        return s

def load_raw(name):
    p = RAW / f"{name}.json"
    if not p.exists():
        print(f"  ! немає {p.name}", file=sys.stderr)
        return []
    d = json.load(open(p, encoding="utf-8"))
    if isinstance(d, list):                      # bq --format=json
        return [{k: num(v) for k, v in row.items()} for row in d]
    fields = d["fields"]
    return [{f: num(c["v"]) for f, c in zip(fields, row["f"])} for row in d["rows"]]

def load(name):
    return json.load(open(DATA / f"{name}.json", encoding="utf-8"))

def div(a, b):
    try:
        return a / b if b else None
    except TypeError:
        return None

def r(x, d=4):
    return None if x is None else round(x, d)

def month_end(ym):
    y, m = int(ym[:4]), int(ym[5:7])
    nxt = dt.date(y + (m == 12), (m % 12) + 1, 1)
    return nxt - dt.timedelta(days=1)

def quarter_end(q):   # "2026-Q3"
    y, qn = int(q[:4]), int(q[-1])
    return month_end(f"{y}-{qn*3:02d}")

# ---------------------------------------------------------------- monthly B2C
raw_m = load_raw("monthly_b2c")
months = []
for x in raw_m:
    rev, orders, mkt = x["revenue"], x["orders"], x["marketing"]
    cm2 = rev - x["cogs"]
    cm3 = x["cm3"]
    nc_total = cm3 + x["gp_b2b"] + x["gp_other"]
    rev_total = rev + x["revenue_b2b"] + x["revenue_other"]
    other = mkt - x["meta"] - x["google"] - x["influence"] - x["tiktok"]
    disc_per_order = div(x["discount_usd"], orders)
    cpo = div(mkt, orders)
    months.append({
        "month": x["month"], "complete": bool(x["complete"]), "days": x["days"], "days_missing": x["days_missing"],
        "revenue": rev, "orders": orders, "aov": r(div(rev, orders), 2),
        "cogs": x["cogs"], "net_cost": x["net_cost"],
        "marketing": mkt, "mkt_missing_days": x["mkt_missing_days"],
        "mkt_share": r(div(mkt, rev)), "cpo": r(cpo, 2),
        "cm2": r(cm2, 0), "cm2_share": r(div(cm2, rev)),
        "product_margin_share": r(div(rev - x["net_cost"], rev)),
        "cm3": cm3, "cm3_share": r(div(cm3, rev)), "cm3_per_mkt": r(div(cm3, mkt), 2),
        "nc_total": r(nc_total, 0), "nc_total_per_mkt": r(div(nc_total, mkt), 2),
        "discount_eff": x["discount_eff"], "discount_usd": x["discount_usd"],
        "disc_per_order": r(disc_per_order, 2),
        "disc_mkt_per_order": r((disc_per_order or 0) + (cpo or 0), 2),
        "new_customers": x["new_customers"], "new_share": r(div(x["new_customers"], x["orders_ship"])),
        "cac": r(div(mkt, x["new_customers"]), 2),
        "repeat_orders": x["repeat_orders"], "repeat_share": r(div(x["repeat_orders"], x["orders_ship"])),
        "orders_ship": x["orders_ship"],
        "promo_orders": x["promo_orders"], "promo_share": r(div(x["promo_orders"], x["orders_ship"])),
        "meta": x["meta"], "google": x["google"], "influence": x["influence"], "tiktok": x["tiktok"], "other": r(other, 0),
        "meta_purchases": x["meta_purchases"], "meta_cpp": r(div(x["meta"], x["meta_purchases"]), 2),
        "google_purchases": x["google_purchases"], "google_cpp": r(div(x["google"], x["google_purchases"]), 2),
        "revenue_b2b": x["revenue_b2b"], "orders_b2b": x["orders_b2b"], "cogs_b2b": x["cogs_b2b"],
        "gp_b2b": x["gp_b2b"], "gp_b2b_share": r(div(x["gp_b2b"], x["revenue_b2b"])),
        "revenue_other": x["revenue_other"], "gp_other": x["gp_other"],
        "revenue_total": r(rev_total, 0), "mkt_share_total": r(div(mkt, rev_total)),
    })

data_through = None
for x in load_raw("daily"):
    data_through = x["date"]

# ---------------------------------------------------------------- customers (created-date basis)
customers = []
for x in load_raw("customers_monthly"):
    customers.append({**x, "new_share": r(div(x["first_orders"], x["orders"])), "promo_share": r(div(x["promo_orders"], x["orders"]))})

# ---------------------------------------------------------------- cohorts
through = dt.date.fromisoformat(data_through) if data_through else dt.date.today()
cohorts = []
for x in load_raw("cohorts"):
    qe = quarter_end(x["cohort"])
    cohorts.append({**x,
        "mature90": qe + dt.timedelta(days=90) <= through,
        "mature180": qe + dt.timedelta(days=180) <= through,
        "mature365": qe + dt.timedelta(days=365) <= through})

# ---------------------------------------------------------------- channels since 2025
channels = []
for x in load_raw("channels_monthly"):
    other = x["ads_total"] - x["meta"] - x["google"] - x["influence"] - x["tiktok"]
    channels.append({**x, "other": r(other, 0),
        "meta_cpp": r(div(x["meta"], x["meta_purchases"]), 2),
        "meta_roas_cabinet": r(div(x["meta_purchase_value"], x["meta"]), 2),
        "google_cpp": r(div(x["google"], x["google_purchases"]), 2),
        "google_roas_cabinet": r(div(x["google_purchase_value"], x["google"]), 2)})

# ---------------------------------------------------------------- weekly
weekly = []
for x in load_raw("weekly"):
    weekly.append({**x, "partial": x["days"] < 7,
        "aov": r(div(x["revenue"], x["orders"]), 2), "mkt_share": r(div(x["marketing"], x["revenue"])),
        "cpo": r(div(x["marketing"], x["orders"]), 2), "cm3_share": r(div(x["cm3"], x["revenue"])),
        "meta_cpp": r(div(x["meta"], x["meta_purchases"]), 2),
        "new_share": r(div(x["new_customers"], x["orders_ship"])), "promo_share": r(div(x["promo_orders"], x["orders_ship"]))})

# ---------------------------------------------------------------- daily
daily = []
for x in load_raw("daily"):
    d = dt.date.fromisoformat(x["date"])
    daily.append({**x, "dow": d.isoweekday(), "no_ship": (x["orders"] or 0) < 10})

# ---------------------------------------------------------------- discount history, utm, b2b
discount_history = load_raw("discount_history")
utm = []
for x in load_raw("utm_monthly"):
    utm.append({**x, "crm_share": r(div(x["crm"], x["total"])), "paid_share": r(div(x["paid_meta"] + x["paid_google"], x["total"])),
                "crm_rev_share": r(div(x["crm_rev"], x["total_rev"]))})
b2b_clients_raw = load_raw("b2b_clients")
b2b_collections = load_raw("b2b_collections")

static = {k: load(k) for k in ["plan", "ly_2025", "pnl_fd_2026", "targets", "manual_inputs", "benchmarks"]}

# B2B concentration: total invoiced 2026 = sum of all B2B invoices; we only have top-12, so take revenue_b2b YTD from months as denominator
b2b_rev_ytd = sum(m["revenue_b2b"] for m in months if m["complete"])
b2b_clients = [{"name": x["b2b_client_name"], "invoiced_2026": x["invoiced_usd_2026"], "invoiced_jun_sep": x["invoiced_usd_jun_sep"],
                "deals": x["deals"], "share_of_b2b_rev": r(div(x["invoiced_usd_2026"], b2b_rev_ytd))} for x in b2b_clients_raw]

snapshot = {
    "generated": dt.date.today().isoformat(),
    "data_through": data_through,
    "source": "BigQuery perla-holistic-com.analytics: daily_kpi_metrics, fct_ad_stats, orders, orders_by_shipment_date, fct_b2b_payments, month_exchange_rates",
    "months": months, "customers": customers, "cohorts": cohorts, "channels": channels, "weekly": weekly, "daily": daily,
    "discount_history": discount_history, "utm": utm, "b2b_clients": b2b_clients, "b2b_rev_ytd": r(b2b_rev_ytd, 0),
    "b2b_collections": b2b_collections,
    "plan": static["plan"], "ly": static["ly_2025"], "pnl_fd": static["pnl_fd_2026"], "targets": static["targets"],
    "manual": static["manual_inputs"], "benchmarks": static["benchmarks"],
}

out = DATA / "snapshot.json"
json.dump(snapshot, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"snapshot: {out} ({out.stat().st_size//1024} KB), місяців {len(months)}, дані по {data_through}")

tpl = ROOT / "template.html"
if tpl.exists():
    html = tpl.read_text(encoding="utf-8")
    payload = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    if "/*__DATA__*/" not in html:
        sys.exit("template.html: немає маркера /*__DATA__*/")
    html = html.replace("/*__DATA__*/", payload, 1)
    sqls = {f.name: f.read_text(encoding="utf-8") for f in sorted((ROOT / "sql").glob("*.sql"))}
    html = html.replace("/*__SQL__*/", json.dumps(sqls, ensure_ascii=False).replace("</", "<\\/"), 1)
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print(f"index.html: {len(html)//1024} KB")
else:
    print("template.html ще немає — зібрано лише snapshot.json")
