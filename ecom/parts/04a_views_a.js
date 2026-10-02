
/* ================= 1 · ОГЛЯД ================= */
const ENTRY_L = { pdp: 'Картка товару', pdp_meta: 'Картка товару · Meta-лендинг', catalog: 'Каталог', category_promo: 'Акційна категорія', category_product: 'Категорія-продукт', category_need: 'Категорія-потреба', home: 'Головна', checkout: 'Кошик / чекаут', blog: 'Блог', search: 'Пошук', quiz_funnel: 'Квіз / воронка', service: 'Сервісні сторінки', other: 'Інше' };
const ENTRY_ORDER = ['pdp', 'pdp_meta', 'catalog', 'category_promo', 'category_product', 'home', 'checkout', 'blog', 'other'];
const ENTRY_C = { pdp: C.s1, pdp_meta: C.s6, catalog: C.s3, category_promo: C.s4, category_product: C.s2, home: C.s5, checkout: C.acc, blog: C.ly, other: 'var(--line-2)' };
const PLACE_L = { pdp: 'Картка товару', catalog: 'Каталог', category: 'Категорія', home: 'Головна', cart: 'Сторінка кошика', blog: 'Блог', search: 'Пошук', reco_cart: 'Віджет у кошику', reco_product: 'Віджет на картці', reco_search: 'Віджет у пошуку', reco: 'Віджет рекомендацій' };
const PLACE_ORDER = ['pdp', 'catalog', 'category', 'reco', 'home', 'cart', 'blog'];
const PLACE_C = { pdp: C.s1, catalog: C.s3, category: C.s2, reco: C.s6, home: C.s5, cart: C.s4, blog: C.ly };
const entryKey = t => ENTRY_ORDER.includes(t) ? t : 'other';
const placeKey = p => p.startsWith('reco_') ? 'reco' : (PLACE_ORDER.includes(p) ? p : 'blog');
const dPct = (a, b) => a == null || b == null ? null : a - b;
const sumRows = (rows, k) => rows.length ? sumBy(rows, k) : null;

function verdictOverview(b, f, fp) {
  const plan = div(b.kpi_revenue_uah, b.plan_revenue_uah);
  const cr = div(f.purchase_s, f.sessions), crp = fp ? div(fp.purchase_s, fp.sessions) : null;
  const refused = div(b.refused, b.created), cancel = div(b.canceled, b.created + b.canceled);
  const s = plan == null ? null : plan >= 0.95 ? { cls: 'ok', label: 'у плані', icon: '✓' } : plan >= 0.85 ? { cls: 'watch', label: 'нижче плану', icon: '!' } : { cls: 'alert', label: 'суттєво нижче плану', icon: '✕' };
  const head = plan == null ? `Виручка ${MG[mi(YM())]}: ${fmt.uahM(b.kpi_revenue_uah)}`
    : `Виручка ${MG[mi(YM())]} за відвантаженням ${fmt.uahM(b.kpi_revenue_uah)} — ${fmt.pct0(plan)} плану (${fmt.uahM(b.plan_revenue_uah)})${isLast() ? ', місяць ще дозріває' : ''}`;
  const detail = `Конверсія сесія → покупка ${fmt.pct(cr)}${crp != null ? ' (' + pp(dPct(cr, crp)) + ' до попереднього місяця)' : ''}. ` +
    `Створено ${fmt.int(b.created)} замовлень, скасовано до відправки ${fmt.pct(cancel)}, відмов при отриманні ${fmt.pct(refused)} (наложка: ${fmt.pct(div(b.cod_refused, b.cod_created))}). ` +
    `Маркетинг ${fmt.pct(div(b.kpi_marketing_uah, b.kpi_revenue_uah))} виручки, валовий прибуток після маркетингу ${fmt.uahM(b.kpi_gp_after_mkt_uah)}.`;
  return { cls: s ? s.cls : 'watch', html: `${s ? chip(s) : ''}<p class="vt">${esc(head)}</p><p class="vd">${esc(detail)}</p>` };
}

function renderOverview() {
  const ym = YM(), pm = PM();
  const b = oneM('b1a_monthly_business', ym), p = pm ? oneM('b1a_monthly_business', pm) : null;
  const f = oneM('b1c_monthly_funnel', ym), fp = pm ? oneM('b1c_monthly_funnel', pm) : null;
  const nr = byM('b1d_new_returning_monthly', ym), nrNew = nr.find(r => r.user_type === 'new') || {}, nrRet = nr.find(r => r.user_type === 'returning') || {};
  const v = verdictOverview(b, f, fp);
  const vd = document.getElementById('ov-verdict'); vd.className = 'card verdict ' + v.cls; vd.innerHTML = v.html;
  const aov = div(b.revenue_successful_uah, b.successful), aovP = p ? div(p.revenue_successful_uah, p.successful) : null;
  const cr = div(f.purchase_s, f.sessions), crP = fp ? div(fp.purchase_s, fp.sessions) : null;
  const atc7 = div(f.atc_purchased_7d_s, f.atc_s), atc7P = fp ? div(fp.atc_purchased_7d_s, fp.atc_s) : null;
  const gp = b.kpi_revenue_uah - b.kpi_cogs_uah, gpP = p ? p.kpi_revenue_uah - p.kpi_cogs_uah : null;
  const newShare = div(nrNew.sessions, (nrNew.sessions || 0) + (nrRet.sessions || 0));
  const mkt = div(b.kpi_marketing_uah, b.kpi_revenue_uah), mktP = p ? div(p.kpi_marketing_uah, p.kpi_revenue_uah) : null;
  const sp = (name, key, fn) => spark(MONTHS.slice(0, sel + 1).map(m => { const r = oneM(name, m); return r ? (fn ? fn(r) : r[key]) : null; }));
  document.getElementById('ov-tiles').innerHTML = [
    tile({ label: 'Виручка успішних замовлень', value: fmt.uahM(b.revenue_successful_uah), hint: `за відвантаженням ${fmt.uahM(b.kpi_revenue_uah)} · план ${fmt.uahM(b.plan_revenue_uah)} (${fmt.pct0(div(b.kpi_revenue_uah, b.plan_revenue_uah))})`, deltas: [dl('до попер. місяця', ps(rel(b.revenue_successful_uah, p && p.revenue_successful_uah)), good(rel(b.revenue_successful_uah, p && p.revenue_successful_uah), 'up'))], spark: sp('b1a_monthly_business', 'revenue_successful_uah') }),
    tile({ label: 'Створені замовлення', value: fmt.int(b.created), hint: `успішних ${fmt.int(b.successful)} (${fmt.pct0(div(b.successful, b.created))}) · у доставці ${fmt.int(b.in_progress)} · відмов ${fmt.pct(div(b.refused, b.created))}`, deltas: [dl('до попер. місяця', ps(rel(b.created, p && p.created)), good(rel(b.created, p && p.created), 'up'))], spark: sp('b1a_monthly_business', 'created') }),
    tile({ label: 'Валовий прибуток', value: fmt.uahM(gp), hint: `${fmt.pct(div(gp, b.kpi_revenue_uah))} виручки · після маркетингу ${fmt.uahM(b.kpi_gp_after_mkt_uah)}`, deltas: [dl('до попер. місяця', ps(rel(gp, gpP)), good(rel(gp, gpP), 'up'))], spark: sp('b1a_monthly_business', null, r => r.kpi_revenue_uah - r.kpi_cogs_uah) }),
    tile({ label: 'Середній чек успішних', value: fmt.uah0(aov), hint: `UPO ${fmt.n2(b.upo_successful)} · позицій ${fmt.n2(b.lines_successful)} · одна позиція у ${fmt.pct0(div(b.single_line_successful, b.successful))}`, deltas: [dl('до попер. місяця', ps(rel(aov, aovP)), good(rel(aov, aovP), 'up'))], spark: sp('b1a_monthly_business', null, r => div(r.revenue_successful_uah, r.successful)) }),
    tile({ label: 'Конверсія сесія → покупка', value: fmt.pct2(cr), hint: `${fmt.int(f.sessions)} сесій · ${fmt.int(f.purchase_s)} сесій з покупкою · без ATC у сесії ${fmt.pct0(div(f.purchase_without_atc_s, f.purchase_s))}`, deltas: [dl('до попер. місяця', pp(dPct(cr, crP)), good(dPct(cr, crP), 'up'))], spark: sp('b1c_monthly_funnel', null, r => div(r.purchase_s, r.sessions)) }),
    tile({ label: 'Кошик → покупка за 7 днів', value: fmt.pct(atc7), hint: `${fmt.int(f.atc_s)} сесій з додаванням · ${fmt.int(f.atc_events)} додавань`, deltas: [dl('до попер. місяця', pp(dPct(atc7, atc7P)), good(dPct(atc7, atc7P), 'up'))], spark: sp('b1c_monthly_funnel', null, r => div(r.atc_purchased_7d_s, r.atc_s)) }),
    tile({ label: 'Нові відвідувачі', value: fmt.pct0(newShare), hint: `конверсія нових ${fmt.pct2(div(nrNew.purchase_s, nrNew.sessions))} · постійних ${fmt.pct2(div(nrRet.purchase_s, nrRet.sessions))}`, spark: spark(MONTHS.slice(0, sel + 1).map(m => { const rs = byM('b1d_new_returning_monthly', m); const nn = rs.find(x => x.user_type === 'new') || {}; return div(nn.sessions, sumBy(rs, 'sessions')); })) }),
    tile({ label: 'Маркетинг / виручка', value: fmt.pct(mkt), hint: `${fmt.uahM(b.kpi_marketing_uah)} маркетингу · курс ${fmt.n2(b.rate_usd)} ₴/$`, deltas: [dl('до попер. місяця', pp(dPct(mkt, mktP)), good(dPct(mkt, mktP), 'down'))], spark: sp('b1a_monthly_business', null, r => div(r.kpi_marketing_uah, r.kpi_revenue_uah)) })
  ].join('');
  // weekly
  const W = T.b1e_weekly_kpi.filter(w => w.week_start >= '2026-01-05');
  barChart(document.getElementById('ov-weekly'), { labels: W.map(w => fmt.dm(w.week_start)), tipLabels: W.map(w => 'Тиждень з ' + fmt.date(w.week_start) + (w.days < 7 ? ' · ' + w.days + ' дн.' : '')), series: [{ name: 'Виручка', color: C.s1, values: W.map(w => w.revenue_uah) }], line: { name: 'Валовий прибуток', color: C.s3, values: W.map(w => w.gp_uah) }, fmt: (v, t) => t ? fmt.uahK(v) : fmt.uahM(v), muted: W.map(w => w.days < 5), extra: k => `<div class="r"><i></i><em>Замовлень</em><b>${fmt.int(W[k].orders)}</b></div><div class="r"><i></i><em>Маркетинг</em><b>${fmt.uahM(W[k].marketing_uah)}</b></div>` });
  legend(document.getElementById('ov-weekly-legend'), [{ name: 'Виручка за тиждень', color: C.s1, box: true }, { name: 'Валовий прибуток (до маркетингу)', color: C.s3 }]);
  // daily
  const D = T.b1b_sept_daily_fact_plan.filter(d => d.date.slice(0, 7) === ym);
  document.getElementById('ov-daily-h').textContent = `${cap(MN[mi(ym)])}: факт і план по днях`;
  if (D.length) {
    let cf = 0, cp = 0, ce = 0;
    const fact = D.map(d => (cf += d.rev_uah) && cf), plan = D.map(d => (cp += d.plan_rev_uah) && cp), even = D.map(d => (ce += d.plan_rev_even_uah) && ce);
    const lastD = D.filter(d => d.rev_uah > 0).length;
    lineChart(document.getElementById('ov-daily'), { labels: D.map(d => d.date.slice(8, 10)), tipLabels: D.map(d => fmt.date(d.date)), series: [{ name: 'Факт', color: C.s1, values: fact.map((v, k) => k < lastD ? v : null) }, { name: 'План за днями тижня', color: C.ref, dash: true, values: plan }, { name: 'План порівну', color: C.ly, dash: true, values: even }], fmt: (v, t) => t ? fmt.uahK(v) : fmt.uahM(v), ymin0: true });
    legend(document.getElementById('ov-daily-legend'), [{ name: 'Факт (накопичено)', color: C.s1 }, { name: 'План за днями тижня', color: C.ref, dash: true }, { name: 'План порівну', color: C.ly, dash: true }]);
    document.getElementById('ov-daily-sub').textContent = `Накопичена виручка за відвантаженням проти плану ${fmt.uahM(cp)}: за днями тижня (ваги з попередніх 8 тижнів) і порівну. Факт на кінець місяця ${fmt.uahM(cf)}.`;
  } else {
    document.getElementById('ov-daily').innerHTML = '<p class="note">Розбивка по днях є лише за поточний місяць (блок 1b); для минулих місяців — таблиця нижче.</p>';
    document.getElementById('ov-daily-legend').innerHTML = '';
  }
  // funnel
  document.getElementById('ov-funnel-h').textContent = `Воронка GA4 · ${mname(ym)}`;
  funnel(document.getElementById('ov-funnel'), [
    { name: 'Сесії', value: f.sessions }, { name: 'Перегляд товару', value: f.view_item_s }, { name: 'Додавання в кошик', value: f.atc_s }, { name: 'Перегляд кошика', value: f.view_cart_s },
    { name: 'Початок оформлення', value: f.checkout_s }, { name: 'Контакт', value: f.contact_s }, { name: 'Оплата', value: f.payment_s }, { name: 'Покупка', value: f.purchase_s, color: C.acc }
  ]);
  document.getElementById('ov-funnel').insertAdjacentHTML('beforeend', `<div class="note" style="margin-top:6px">Окремо: «купити в 1 клік» — ${fmt.int(f.one_click_s)} сесій (${fmt.pct2(div(f.one_click_s, f.sessions))}). Покупок без ATC у тій самій сесії — ${fmt.pct0(div(f.purchase_without_atc_s, f.purchase_s))}: кошик зібрано раніше або 1 клік.</div>`);
  // new vs returning
  const NR = T.b1d_new_returning_monthly;
  const vals = t => MONTHS.map(m => (NR.find(r => r.month === m && r.user_type === t) || {}).sessions || null);
  barChart(document.getElementById('ov-newret'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: [{ name: 'Нові', color: C.s1, values: vals('new') }, { name: 'Постійні', color: C.s6, values: vals('returning') }], fmt: (v, t) => t ? fmt.k0(v) + ' тис.' : fmt.int(v), extra: k => { const n = NR.find(r => r.month === MONTHS[k] && r.user_type === 'new') || {}, r = NR.find(x => x.month === MONTHS[k] && x.user_type === 'returning') || {}; return `<div class="r"><i></i><em>CR нових</em><b>${fmt.pct2(div(n.purchase_s, n.sessions))}</b></div><div class="r"><i></i><em>CR постійних</em><b>${fmt.pct2(div(r.purchase_s, r.sessions))}</b></div>`; } });
  legend(document.getElementById('ov-newret-legend'), [{ name: 'Перша сесія користувача', color: C.s1, box: true }, { name: 'Повторні сесії', color: C.s6, box: true }]);
  pills(document.getElementById('ov-newret-pills'), [[`${mlbl(ym)} · CR нових`, fmt.pct2(div(nrNew.purchase_s, nrNew.sessions))], ['CR постійних', fmt.pct2(div(nrRet.purchase_s, nrRet.sessions))], ['ATC нових', fmt.pct(div(nrNew.atc_s, nrNew.sessions))], ['ATC постійних', fmt.pct(div(nrRet.atc_s, nrRet.sessions))]]);
  // month table
  const cols = [th('Місяць'), th('Створені'), th('Успішні'), th('Скасовано'), th('Відмови'), th('Виручка успішних'), th('За відвантаж.'), th('До плану'), th('GP'), th('Сер. чек'), th('UPO'), th('Сесії'), th('CR'), th('1 клік'), th('Апсейл')];
  const rows = MONTHS.map(m => {
    const r = oneM('b1a_monthly_business', m), q = oneM('b1c_monthly_funnel', m); const g = r.kpi_revenue_uah - r.kpi_cogs_uah;
    const planR = div(r.kpi_revenue_uah, r.plan_revenue_uah);
    return { cls: m === ym ? 'sel' : '', cells: [{ html: `<b>${esc(cap(mname(m)))}</b>${m === MONTHS[MONTHS.length - 1] ? ' <span class="muted small">дозріває</span>' : ''}` }, { text: fmt.int(r.created) }, { text: fmt.int(r.successful) }, { text: fmt.pct(div(r.canceled, r.created + r.canceled)) }, { text: fmt.pct(div(r.refused, r.created)) }, { text: fmt.uahM(r.revenue_successful_uah) }, { text: fmt.uahM(r.kpi_revenue_uah) }, { text: fmt.pct0(planR), cls: planR == null ? '' : planR >= 0.95 ? 'okc' : planR >= 0.85 ? 'watch' : 'bad' }, { text: fmt.pct0(div(g, r.kpi_revenue_uah)) }, { text: fmt.uah0(div(r.revenue_successful_uah, r.successful)) }, { text: fmt.n2(r.upo_successful) }, { text: fmt.int(q.sessions) }, { text: fmt.pct2(div(q.purchase_s, q.sessions)) }, { text: fmt.int(r.one_click_created) }, { text: fmt.pct(div(r.upsell_uah_successful, r.revenue_successful_uah)) }] };
  });
  document.getElementById('ov-table').innerHTML = tableHTML(cols, rows);
}

/* ================= 2 · ВХІД ================= */
function renderEntry() {
  const ym = YM(), E = T.b2_entry_types_monthly, rowsM = byM('b2_entry_types_monthly', ym);
  const tot = sumBy(rowsM, 'sessions'), pur = sumBy(rowsM, 'purchase_s'), crAll = div(pur, tot);
  const agg = {}; rowsM.forEach(r => { const k = entryKey(r.entry_type); const a = agg[k] = agg[k] || { k, sessions: 0, view_item_s: 0, atc_s: 0, checkout_s: 0, purchase_s: 0, zoho_orders: 0, zoho_created: 0, zoho_billed_uah: 0, zoho_successful: 0, zoho_revenue_uah: 0 }; Object.keys(a).forEach(f => { if (f !== 'k') a[f] += r[f] || 0; }); });
  const A = ENTRY_ORDER.map(k => agg[k]).filter(Boolean);
  const pdpShare = div(((agg.pdp || {}).sessions || 0) + ((agg.pdp_meta || {}).sessions || 0), tot);
  const best = A.filter(a => a.sessions >= 1000).sort((x, y) => div(y.purchase_s, y.sessions) - div(x.purchase_s, x.sessions))[0];
  const b1 = oneM('b1a_monthly_business', ym);
  document.getElementById('en-tiles').innerHTML = [
    tile({ label: `Сесії · ${mlbl(ym)}`, value: fmt.int(tot), hint: `конверсія в покупку ${fmt.pct2(crAll)}` }),
    tile({ label: 'Вхід через картку товару', value: fmt.pct0(pdpShare), hint: `з них Meta-лендинги ${fmt.pct(div((agg.pdp_meta || {}).sessions, tot))} · каталог ${fmt.pct(div((agg.catalog || {}).sessions, tot))} · головна ${fmt.pct(div((agg.home || {}).sessions, tot))}` }),
    tile({ label: 'Найвища конверсія', value: best ? fmt.pct2(div(best.purchase_s, best.sessions)) : '—', hint: best ? `${ENTRY_L[best.k]} (${fmt.int(best.sessions)} сесій, без кошика/чекауту)` : '' }),
    tile({ label: 'Виручка Zoho, прив’язана до сесій', value: fmt.pct0(div(sumBy(rowsM, 'zoho_billed_uah'), b1.revenue_created_uah)), hint: `${fmt.uahM(sumBy(rowsM, 'zoho_billed_uah'))} створених замовлень з ${fmt.uahM(b1.revenue_created_uah)}; решта — без purchase у GA4 (1 клік, менеджер, блокувальники)` })
  ].join('');
  // share stacked 100%
  const share = k => MONTHS.map(m => { const rs = byM('b2_entry_types_monthly', m); const t = sumBy(rs, 'sessions'); return div(sumBy(rs.filter(r => entryKey(r.entry_type) === k), 'sessions'), t); });
  barChart(document.getElementById('en-share'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: ENTRY_ORDER.map(k => ({ name: ENTRY_L[k], color: ENTRY_C[k], values: share(k) })), fmt: (v, t) => t ? fmt.pct0(v) : fmt.pct(v) });
  legend(document.getElementById('en-share-legend'), ENTRY_ORDER.map(k => ({ name: ENTRY_L[k], color: ENTRY_C[k], box: true })));
  // CR rows
  document.getElementById('en-cr-h').textContent = `Конверсія в покупку за типом входу · ${mname(ym)}`;
  const crRows = A.filter(a => a.sessions >= 200 && !['checkout', 'other'].includes(a.k)).map(a => ({ name: ENTRY_L[a.k], value: div(a.purchase_s, a.sessions), share: div(a.purchase_s, a.sessions), extra: fmt.int(a.sessions) + ' сесій', color: ENTRY_C[a.k] })).sort((x, y) => y.value - x.value);
  rowsChart(document.getElementById('en-cr'), { rows: crRows, fmt: fmt.pct2, ref: { share: crAll, label: 'середнє по всіх сесіях ' + fmt.pct2(crAll) } });
  // table (raw types, not grouped)
  document.getElementById('en-table-h').textContent = `Типи входу · ${mname(ym)}`;
  const cols = [th('Тип входу'), th('Сесії'), th('Частка'), th('Перегляд товару'), th('ATC'), th('Чекаут'), th('CR покупка'), th('Замовлень Zoho'), th('Успішних'), th('Виручка успішних'), th('₴ на сесію')];
  const rows = rowsM.slice().sort((x, y) => y.sessions - x.sessions).map(r => ({ cells: [{ text: ENTRY_L[r.entry_type] || r.entry_type }, { text: fmt.int(r.sessions) }, { text: fmt.pct(div(r.sessions, tot)) }, { text: fmt.pct(div(r.view_item_s, r.sessions)) }, { text: fmt.pct(div(r.atc_s, r.sessions)) }, { text: fmt.pct(div(r.checkout_s, r.sessions)) }, { text: fmt.pct2(div(r.purchase_s, r.sessions)) }, { text: fmt.int(r.zoho_created) }, { text: fmt.int(r.zoho_successful) }, { text: fmt.uahM(r.zoho_revenue_uah) }, { text: fmt.uah0(div(r.zoho_revenue_uah, r.sessions)) }] }));
  rows.push({ cls: 'ref', cells: [{ text: 'Разом' }, { text: fmt.int(tot) }, { text: '100%' }, { text: fmt.pct(div(sumBy(rowsM, 'view_item_s'), tot)) }, { text: fmt.pct(div(sumBy(rowsM, 'atc_s'), tot)) }, { text: fmt.pct(div(sumBy(rowsM, 'checkout_s'), tot)) }, { text: fmt.pct2(crAll) }, { text: fmt.int(sumBy(rowsM, 'zoho_created')) }, { text: fmt.int(sumBy(rowsM, 'zoho_successful')) }, { text: fmt.uahM(sumBy(rowsM, 'zoho_revenue_uah')) }, { text: fmt.uah0(div(sumBy(rowsM, 'zoho_revenue_uah'), tot)) }] });
  document.getElementById('en-table').innerHTML = tableHTML(cols, rows);
}

/* ================= 3 · КОШИК ================= */
function renderCart() {
  const ym = YM(), rowsM = byM('b3a_atc_place_monthly', ym), pm = PM(), rowsP = pm ? byM('b3a_atc_place_monthly', pm) : [];
  const tot = sumBy(rowsM, 'atc_items'), pur = sumBy(rowsM, 'purchased_7d'), rate = div(pur, tot), rateP = rowsP.length ? div(sumBy(rowsP, 'purchased_7d'), sumBy(rowsP, 'atc_items')) : null;
  const agg = {}; rowsM.forEach(r => { const k = placeKey(r.atc_place); const a = agg[k] = agg[k] || { k, atc_items: 0, users: 0, purchased_7d: 0, atc_value_uah: 0 }; ['atc_items', 'users', 'purchased_7d', 'atc_value_uah'].forEach(f => a[f] += r[f] || 0); });
  const carts = oneM('b5d_carts_monthly', ym) || {};
  document.getElementById('ca-tiles').innerHTML = [
    tile({ label: `Додавань у кошик · ${mlbl(ym)}`, value: fmt.int(tot), hint: `${fmt.uahM(sumBy(rowsM, 'atc_value_uah'))} вартості товарів у додаваннях`, deltas: [dl('до попер. місяця', ps(rel(tot, rowsP.length ? sumBy(rowsP, 'atc_items') : null)), 'neutral')] }),
    tile({ label: 'Куплено за 7 днів', value: fmt.pct(rate), hint: 'частка додавань, після яких той самий користувач купив цей товар', deltas: [dl('до попер. місяця', pp(dPct(rate, rateP)), good(dPct(rate, rateP), 'up'))] }),
    tile({ label: 'Додають з каталогу та категорій', value: fmt.pct0(div(((agg.catalog || {}).atc_items || 0) + ((agg.category || {}).atc_items || 0), tot)), hint: `з картки товару ${fmt.pct0(div((agg.pdp || {}).atc_items, tot))} · з віджета рекомендацій ${fmt.pct(div((agg.reco || {}).atc_items, tot))}` }),
    tile({ label: 'Покинуті кошики', value: fmt.pct0(div(carts.abandoned_7d, carts.carts)), hint: `${fmt.int(carts.carts)} кошиків · ${fmt.int(carts.abandoned_7d)} без покупки за 7 днів · середній кошик ${fmt.uah0(carts.avg_cart_value_uah)}` })
  ].join('');
  const vals = k => MONTHS.map(m => { const rs = byM('b3a_atc_place_monthly', m).filter(r => placeKey(r.atc_place) === k); return rs.length ? sumBy(rs, 'atc_items') : null; });
  barChart(document.getElementById('ca-place'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: PLACE_ORDER.map(k => ({ name: PLACE_L[k], color: PLACE_C[k], values: vals(k) })), fmt: (v, t) => t ? fmt.k0(v) + ' тис.' : fmt.int(v) });
  legend(document.getElementById('ca-place-legend'), PLACE_ORDER.map(k => ({ name: PLACE_L[k], color: PLACE_C[k], box: true })));
  document.getElementById('ca-cr-h').textContent = `Купили цей товар за 7 днів після додавання · ${mname(ym)}`;
  const rr = rowsM.filter(r => r.atc_items >= 100).map(r => ({ name: PLACE_L[r.atc_place] || r.atc_place, value: div(r.purchased_7d, r.atc_items), share: div(r.purchased_7d, r.atc_items), extra: fmt.int(r.atc_items) + ' додавань', color: PLACE_C[placeKey(r.atc_place)] })).sort((x, y) => y.value - x.value);
  rowsChart(document.getElementById('ca-cr'), { rows: rr, fmt: fmt.pct, ref: { share: rate, label: 'усі місця ' + fmt.pct(rate) } });
  const IM = S.item_map || {};
  const cols = [th('Товар (GA4)'), th('Zoho'), th('Ціна'), th('Додавань'), th('Користувачів'), th('Куплено за 7 дн.'), th('Картка'), th('Каталог'), th('Категорія'), th('Кошик'), th('Головна'), th('Віджет')];
  const rows = T.b3b_atc_items_sept.map(r => { const m = IM[r.item_id]; return { cells: [{ text: r.item_name }, { html: m ? `<span class="small muted">${esc(m.zoho)}</span>` : '<span class="small muted">—</span>' }, { text: fmt.uah0(r.price) }, { text: fmt.int(r.atc_items) }, { text: fmt.int(r.users) }, { text: fmt.pct(div(r.purchased_7d, r.atc_items)) }, { text: fmt.pct0(div(r.pdp, r.atc_items)) }, { text: fmt.pct0(div(r.catalog, r.atc_items)) }, { text: fmt.pct0(div(r.category, r.atc_items)) }, { text: fmt.pct0(div(r.cart, r.atc_items)) }, { text: fmt.pct0(div(r.home, r.atc_items)) }, { text: fmt.pct0(div(r.reco, r.atc_items)) }] }; });
  document.getElementById('ca-items').innerHTML = tableHTML(cols, rows);
}
