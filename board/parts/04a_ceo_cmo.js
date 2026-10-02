
/* ================= CEO ================= */
function growthYoY() {
  // B2C, created-date basis (analytics.orders): Jan..selected month of this year vs same months last year
  const f = F(), y = +f.month.slice(0, 4), m = mi(f);
  let cur = 0, prev = 0, newCur = 0, newPrev = 0, ok = true;
  for (let k = 0; k <= m; k++) {
    const a = custAt(ymOf(y, k)), b = custAt(ymOf(y - 1, k));
    if (!a || !b) { ok = false; break; }
    cur += a.revenue_usd; prev += b.revenue_usd; newCur += a.first_orders; newPrev += b.first_orders;
  }
  if (!ok) return null;
  const a = custAt(f.month), b = custAt(ymOf(y - 1, m));
  return { rev: rel(cur, prev), newc: rel(newCur, newPrev), monthNew: a && b ? rel(a.first_orders, b.first_orders) : null, monthRev: a && b ? rel(a.revenue_usd, b.revenue_usd) : null, cur, prev, newCur, newPrev };
}
function manualState() {
  // inputs doc for the selected month (db) → fallback seed from manual_inputs.json
  const d = INPUTS[F().month];
  const seed = MAN;
  const g = (k, s) => (d && d[k] != null && d[k] !== '') ? d[k] : s;
  return {
    cash: g('cash_usd', seed.cash.verified_usd), cash_date: g('cash_date', seed.cash.verified_date), liab: g('liabilities_uah', seed.cash.liabilities_uah),
    ar: g('ar_uah', seed.ar.total_uah), overdue: g('overdue_pct', seed.ar.overdue_pct), dso: g('dso_days', seed.ar.dso_days),
    stock_ua: g('stock_ua_usd', seed.inventory.stock_ua_usd), stock_pl: g('stock_pl_usd', seed.inventory.stock_pl_usd), transit: g('transit_usd', seed.inventory.in_transit_usd),
    note: g('note', ''), updated: d && d.updated ? d.updated : null, fromDb: !!d, as_of: d && d.updated ? d.updated.slice(0, 10) : seed.as_of
  };
}
function flagsFor(i) {
  const f = M[i], m = mi(f), out = [];
  const R = scaleRule(i), lim = limitAt(f), g = growthYoY(), ms = manualState();
  const push = (cls, text, who, tab) => out.push({ cls, text, who, tab });
  if (R.st.cls !== 'ok') push(R.st.cls, `NC / маркетинг ${fmt.x(R.r)} при тригері 2,5x — бюджет ${MG[(m + 1) % 12]} не вище ${fmt.usd(f.marketing)}.`, 'CEO · CMO', 'cmo');
  if (lim && f.marketing > lim) push('alert', `Маркетинг ${fmt.usd(f.marketing)} понад ліміт ${fmt.usd(lim)} (${ps(rel(f.marketing, lim))}).`, 'CMO', 'cmo');
  const sm = st('mkt_share', f.mkt_share); if (sm && sm.cls !== 'ok') push(sm.cls, `Маркетинг ${fmt.pct(f.mkt_share)} виручки B2C при орієнтирі ≤ ${fmt.pct0(T.mkt_share_b2c)}; CPO ${fmt.usd2(f.cpo)} при цілі ≤ ${fmt.usd0(T.cpo)}.`, 'CMO', 'cmo');
  const sd = st('disc', f.discount_eff); if (sd && sd.cls !== 'ok') push(sd.cls, `Ефективна знижка ${fmt.pct(f.discount_eff)} при плані ${fmt.pct0(T.discount)}: знижка + маркетинг на замовлення ${fmt.usd2(f.disc_mkt_per_order)} при AOV ${fmt.usd2(f.aov)}.`, 'CMO · CEO', 'cmo');
  const sc = st('cm3', f.cm3_share); if (sc && sc.cls !== 'ok') push(sc.cls, `CM3 ${fmt.pct(f.cm3_share)} виручки при цілі ≥ ${fmt.pct0(T.cm3_share)}.`, 'CMO · CFO', 'cfo');
  if (g && g.newc != null && g.newc < -0.1) push('alert', `Нових клієнтів ${ps(g.newc)} р/р за січень–${MG[m]} (${fmt.int(g.newCur)} проти ${fmt.int(g.newPrev)}); повторні тримають виручку.`, 'CMO', 'cmo');
  const bm = S.benchmarks.items.find(b => b.key === 'market_growth');
  if (g && g.rev != null && bm && g.rev < bm.market.median - 0.1) push('watch', `Виручка B2C ${ps(g.rev)} р/р при рості ринку добавок ≈ ${ps(bm.market.median)}: втрачаємо частку.`, 'CEO', 'bench');
  const c90 = lastMature('rep90'); if (c90 && c90.rep90 < T.rep90 - 0.03) push('watch', `Повтор за 90 днів у когорті ${c90.cohort} — ${fmt.pct(c90.rep90)} проти ${fmt.pct(S.cohorts[2].rep90)} у ${S.cohorts[2].cohort}: нові когорти повертаються рідше.`, 'CMO', 'cmo');
  if (ms.cash == null) push('alert', `Немає звіреного з банком залишку кешу. ${esc(MAN.cash.note.split('.')[1] || '')}`, 'CFO', 'cfo');
  else if (ms.cash < T.cash_min_usd) push('alert', `Кеш ${fmt.usd(ms.cash)} нижче порогу ${fmt.usd(T.cash_min_usd)} (звірка ${fmt.date(ms.cash_date)}).`, 'CFO', 'cfo');
  const so = st('overdue', ms.overdue); if (so && so.cls !== 'ok') push(so.cls, `Просрочка дебіторки ${fmt.pct(ms.overdue)} при KPI ≤ ${fmt.pct0(T.overdue)}; ДЗ ${fmt.uah(ms.ar)}, DSO ${ms.dso} дн. при цілі ≤ ${T.dso}.`, 'B2B · CFO', 'cfo');
  const top2 = S.b2b_clients.slice(0, 2).reduce((a, c) => a + (c.share_of_b2b_rev || 0), 0);
  if (top2 > 0.35) push('watch', `${S.b2b_clients[0].name} і ${S.b2b_clients[1].name} — ${fmt.pct0(top2)} рахунків B2B 2026: ріст B2B тримається на двох мережах і дебіторці.`, 'B2B', 'cfo');
  if (MAN.inventory.oos_skus.length) push('alert', `Немає в наявності або менше тижня запасу: ${MAN.inventory.oos_skus.join(', ')}. Частина поставок чекає оплати.`, 'Закупівлі · CFO', 'cfo');
  if (ms.transit > 2 * (ms.stock_ua + ms.stock_pl)) push('watch', `Товар у дорозі ${fmt.usd(ms.transit)} проти ${fmt.usd(ms.stock_ua + ms.stock_pl)} на складах: гроші пішли зі складу в замовлення і передоплати.`, 'Закупівлі · CFO', 'cfo');
  if (!f.complete) push('watch', 'Місяць не закритий: маркетинг за останні дні довантажується, CPO і маржу не цитувати.', 'Аналітик', 'clust');
  out.sort((a, b) => sevOrder[a.cls] - sevOrder[b.cls]);
  return out;
}
function renderCEO() {
  const i = sel, f = F(), p = P(), m = mi(f), pl = planAt(m), g = growthYoY(), ms = manualState();
  const R = scaleRule(i);
  // verdict: three statements
  const sentences = [];
  sentences.push(R.allowed ? `Правило скейлу виконано: NC / маркетинг ${fmt.x(R.r)} — бюджет ${MG[(m + 1) % 12]} можна збільшувати.` : `Правило скейлу не виконано: NC / маркетинг ${fmt.x(R.r)} при тригері 2,5x — бюджет ${MG[(m + 1) % 12]} не вище ${fmt.usd(f.marketing)}.`);
  if (g) sentences.push(`B2C ${ps(g.rev)} р/р за січень–${MG[m]}, нових клієнтів ${ps(g.newc)}, повторних замовлень ${ps(rel(custAt(f.month).repeat_orders, custAt(ymOf(+f.month.slice(0, 4) - 1, m)).repeat_orders))}: базу тримаємо, залучення падає.`);
  sentences.push(ms.cash == null ? 'Кеш: звіреного залишку немає — перший пункт для фінансів.' : `Кеш: ${fmt.usd(ms.cash)} на ${fmt.date(ms.cash_date)}${ms.cash < T.cash_min_usd ? ' — нижче порогу ' + fmt.usd(T.cash_min_usd) : ''}.`);
  const cls = ms.cash == null || !R.allowed ? (R.st.cls === 'alert' || ms.cash == null ? 'alert' : 'watch') : 'ok';
  const vb = document.getElementById('ceo-verdict'); vb.className = 'card verdict ' + cls;
  vb.innerHTML = `${chip(cls === 'ok' ? { cls: 'ok', label: 'стабільно', icon: '✓' } : cls === 'watch' ? { cls: 'watch', label: 'зона уваги', icon: '!' } : { cls: 'alert', label: 'потрібні рішення', icon: '✕' })}<p class="vt">${sentences[0]}</p><p class="vd">${sentences.slice(1).join(' ')}</p>`;

  const lyR = lyAt(LY.revenue, m), d = rel;
  const tiles = [];
  tiles.push(tile({ label: 'Виручка, всі сегменти', value: fmt.usd(f.revenue_total), hint: `B2C ${fmt.usd(f.revenue)} · B2B ${fmt.usd(f.revenue_b2b)} · ${fmt.int(f.orders)} замовлень B2C`,
    deltas: [p && dl(prevLbl(), ps(d(f.revenue_total, p.revenue_total)), good(d(f.revenue_total, p.revenue_total), 'up')), lyR && dl('B2C р/р', ps(d(f.revenue, lyR)), good(d(f.revenue, lyR), 'up')), dl('B2C ' + pl.to, ps(d(f.revenue, pl.revenue)), good(d(f.revenue, pl.revenue), 'up'))],
    spark: spark(series('revenue_total', i)) }));
  tiles.push(tile({ label: 'NC компанії / маркетинг', value: fmt.x(f.nc_total_per_mkt), chip: chip(st('nc', f.nc_total_per_mkt)), hint: `NC ${fmt.usd(f.nc_total)} = CM3 B2C ${fmt.usd(f.cm3)} + GP B2B ${fmt.usd(f.gp_b2b)} · тригер 2,5x`,
    deltas: [p && dl(prevLbl(), px(f.nc_total_per_mkt - p.nc_total_per_mkt), good(f.nc_total_per_mkt - p.nc_total_per_mkt, 'up'))], spark: spark(series('nc_total_per_mkt', i), T.nc_watch) }));
  tiles.push(tile({ label: 'Маржа після маркетингу (CM3 B2C)', value: fmt.pct(f.cm3_share), chip: chip(st('cm3', f.cm3_share)), hint: `${fmt.usd(f.cm3)} · до маркетингу (CM2) ${fmt.pct(f.cm2_share)} · ціль ≥ ${fmt.pct0(T.cm3_share)}`,
    deltas: [p && dl(prevLbl(), pp(f.cm3_share - p.cm3_share), good(f.cm3_share - p.cm3_share, 'up'))], spark: spark(series('cm3_share', i), T.cm3_share) }));
  tiles.push(tile({ label: 'Маркетинг, % виручки B2C', value: fmt.pct(f.mkt_share), chip: chip(st('mkt_share', f.mkt_share)), hint: `${fmt.usd(f.marketing)} · CPO ${fmt.usd2(f.cpo)} · ${limitAt(f) ? 'ліміт ' + fmt.usd(limitAt(f)) : pl.src + ' ' + fmt.usd(pl.marketing)}`,
    deltas: [p && dl(prevLbl(), pp(f.mkt_share - p.mkt_share), good(f.mkt_share - p.mkt_share, 'down')), lyR && dl('2025', fmt.pct(lyAt(LY.marketing, m) / lyR))], spark: spark(series('mkt_share', i), T.mkt_share_b2c) }));
  const c = custAt(f.month), cly = custAt(ymOf(+f.month.slice(0, 4) - 1, m));
  tiles.push(tile({ label: 'Нові клієнти', value: fmt.int(f.new_customers), chip: chip(st('cac', f.cac)), hint: `${fmt.pct(f.new_share)} замовлень · CAC ${fmt.usd2(f.cac)} при цілі ≤ ${fmt.usd0(T.cac)}`,
    deltas: [p && dl(prevLbl(), ps(d(f.new_customers, p.new_customers)), good(d(f.new_customers, p.new_customers), 'up')), c && cly && dl('р/р', ps(d(c.first_orders, cly.first_orders)), good(d(c.first_orders, cly.first_orders), 'up'))], spark: spark(series('new_customers', i)) }));
  tiles.push(tile({ label: 'Ефективна знижка', value: fmt.pct(f.discount_eff), chip: chip(st('disc', f.discount_eff)), hint: `знижка + маркетинг на замовлення ${fmt.usd2(f.disc_mkt_per_order)} · AOV ${fmt.usd2(f.aov)}`,
    deltas: [p && dl(prevLbl(), pp(f.discount_eff - p.discount_eff), good(f.discount_eff - p.discount_eff, 'down'))], spark: spark(series('discount_eff', i), T.discount) }));
  const c90 = lastMature('rep90');
  tiles.push(tile({ label: 'Повтор за 90 днів', value: c90 ? fmt.pct(c90.rep90) : '—', chip: c90 ? chip(st('rep90', c90.rep90)) : '', hint: c90 ? `когорта ${c90.cohort}, ${fmt.int(c90.clients)} нових · 2024-Q3: ${fmt.pct(S.cohorts[2].rep90)}` : '',
    deltas: [c90 && dl('до 2024-Q3', pp(c90.rep90 - S.cohorts[2].rep90), good(c90.rep90 - S.cohorts[2].rep90, 'up'))], spark: spark(S.cohorts.filter(x => x.mature90).map(x => x.rep90), T.rep90) }));
  tiles.push(tile({ label: 'Кеш і дебіторка', value: ms.cash == null ? '<span class="muted">не звірено</span>' : fmt.usd(ms.cash), chip: ms.cash == null ? chipNa('немає даних') : chip(ms.cash >= T.cash_min_usd ? { cls: 'ok', label: 'вище порогу', icon: '✓' } : { cls: 'alert', label: 'нижче порогу', icon: '✕' }),
    hint: `ДЗ B2B ${fmt.uah(ms.ar)} (${fmt.usd(ms.ar / T.fx_usd)}) · просрочка ${fmt.pct(ms.overdue)} · DSO ${ms.dso} дн. · на ${fmt.date(ms.as_of)}`,
    deltas: [dl('зобов\'язання', ms.liab ? fmt.uah(ms.liab) : '—'), dl('запаси', fmt.usd(ms.stock_ua + ms.stock_pl)), dl('у дорозі', fmt.usd(ms.transit))] }));
  document.getElementById('ceo-tiles').innerHTML = tiles.join('');

  const FL = flagsFor(i), flagLi = x => `<li>${chip({ cls: x.cls, label: x.cls === 'alert' ? 'рішення' : x.cls === 'watch' ? 'увага' : 'ок', icon: x.cls === 'alert' ? '✕' : x.cls === 'watch' ? '!' : '✓' })}<span>${x.text}</span><span class="who">${esc(x.who)} · <a href="#${x.tab}" data-tab="${x.tab}">вкладка</a></span></li>`;
  const flEl = document.getElementById('ceo-flags');
  flEl.innerHTML = (FL.slice(0, 8).map(flagLi).join('') || '<li>Прапорців немає</li>') + (FL.length > 8 ? `<li style="background:transparent;padding:0"><button class="btn" type="button" id="more-flags">Показати ще ${FL.length - 8}</button></li>` : '');
  const mf = document.getElementById('more-flags'); if (mf) mf.addEventListener('click', () => { flEl.innerHTML = FL.map(flagLi).join(''); });

  // pulse (daily)
  const D = S.daily, labels = D.map(x => fmt.dm(x.date));
  const avg7 = D.map((x, k) => { const w = D.slice(Math.max(0, k - 6), k + 1); return w.length < 7 ? null : w.reduce((a, b) => a + b.revenue, 0) / 7; });
  barChart(document.getElementById('pulse'), { labels, series: [{ name: 'Виручка B2C за день', color: 'var(--s1)', values: D.map(x => x.revenue) }], muted: D.map(x => x.no_ship), fmt: v => fmt.usd(v), line: { name: 'Середнє за 7 днів', color: 'var(--ref)', values: avg7 }, height: 200, aria: 'Виручка по днях',
    extra: k => `<div class="r"><i></i><em>Замовлень</em><b>${fmt.int(D[k].orders)}</b></div><div class="r"><i></i><em>Маркетинг</em><b>${fmt.usd(D[k].marketing)}</b></div><div class="r"><i></i><em>Знижка</em><b>${D[k].disc_pct == null ? '—' : dec(D[k].disc_pct, 1) + '%'}</b></div>` });
  legend(document.getElementById('pulse-legend'), [{ name: 'Виручка за день', color: 'var(--s1)', box: true }, { name: 'Середнє за 7 днів', color: 'var(--ref)' }]);
  lineChart(document.getElementById('pulse2'), { labels, series: [{ name: 'Маркетинг за день', color: 'var(--s2)', values: D.map(x => x.marketing) }, { name: 'Знижка, %', color: 'var(--s4)', values: [], dash: false }].slice(0, 1), fmt: v => fmt.usd(v), height: 150, ymin0: true, aria: 'Маркетинг по днях' });
  legend(document.getElementById('pulse2-legend'), [{ name: 'Маркетинг за день (fct_ad_stats + daily_kpi_metrics)', color: 'var(--s2)' }]);

  // facts
  const L = [];
  if (p) L.push(`Виручка B2C ${fmt.usd(f.revenue)}: ${ps(d(f.revenue, p.revenue))} ${prevLbl()}, ${ps(d(f.revenue, pl.revenue))} ${pl.to} (${fmt.usd(pl.revenue)})${lyR ? ', ' + ps(d(f.revenue, lyR)) + ' р/р' : ''}.`);
  L.push(`Маркетинг ${fmt.usd(f.marketing)} (${fmt.pct(f.mkt_share)} виручки): Meta ${fmt.usd(f.meta)}, Google ${fmt.usd(f.google)}, блогери ${fmt.usd(f.influence)}, інше ${fmt.usd(f.other)}. CPO ${fmt.usd2(f.cpo)}, CAC ${fmt.usd2(f.cac)}.`);
  L.push(`Маржа: CM2 ${fmt.pct(f.cm2_share)}, CM3 ${fmt.usd(f.cm3)} (${fmt.pct(f.cm3_share)}); NC компанії ${fmt.usd(f.nc_total)} = ${fmt.x(f.nc_total_per_mkt)} на $1 маркетингу${p ? ', ' + px(f.nc_total_per_mkt - p.nc_total_per_mkt) + ' ' + prevLbl() : ''}.`);
  L.push(`Знижка ${fmt.pct(f.discount_eff)} від повної ціни (${fmt.usd(f.discount_usd)} за місяць); замовлень з промокодом ${fmt.pct(f.promo_share)}; знижка + маркетинг на замовлення ${fmt.usd2(f.disc_mkt_per_order)}.`);
  L.push(`B2B: відвантажено ${fmt.usd(f.revenue_b2b)}, GP ${fmt.pct(f.gp_b2b_share)}; отримано грошей ${fmt.usd((S.b2b_collections.find(x => x.month === f.month) || {}).collected_usd)} за місяць.`);
  const u = utmAt(f.month); if (u) L.push(`Джерела замовлень: платні Meta + Google ${fmt.pct(u.paid_share)}, CRM (email, Viber) ${fmt.pct(u.crm_share)}, органіка ${fmt.pct(u.organic_search / u.total)}, офлайн і сервіс ${fmt.pct(u.offline / u.total)}.`);
  if (f.days_missing) L.push(`У daily_kpi_metrics бракує ${f.days_missing} дн.; додано ${fmt.usd(f.mkt_missing_days)} реклами з fct_ad_stats.`);
  document.getElementById('ceo-facts').innerHTML = L.map(x => `<li>${x}</li>`).join('');
}

/* ================= CMO ================= */
function renderCMO() {
  const i = sel, f = F(), p = P(), m = mi(f), pl = planAt(m), lim = limitAt(f), d = rel;
  const v = verdictScale(i); const vb = document.getElementById('cmo-verdict'); vb.className = 'card verdict ' + v.cls; vb.innerHTML = v.html;
  const lyR = lyAt(LY.revenue, m), lyM = lyAt(LY.marketing, m);
  const tiles = [];
  const limSt = lim ? st('limit', f.marketing / lim) : null;
  tiles.push(tile({ label: 'Маркетинг', value: fmt.usd(f.marketing), chip: chip(limSt), hint: lim ? `ліміт ${fmt.usd(lim)} · ${pl.src} ${fmt.usd(pl.marketing)}` : `${pl.src}: ${fmt.usd(pl.marketing)}`,
    deltas: [p && dl(prevLbl(), ps(d(f.marketing, p.marketing))), dl(pl.to, ps(d(f.marketing, pl.marketing)), good(d(f.marketing, pl.marketing), 'down')), lyM && dl('р/р', ps(d(f.marketing, lyM)))], spark: spark(series('marketing', i)) }));
  tiles.push(tile({ label: 'Маркетинг, % виручки', value: fmt.pct(f.mkt_share), chip: chip(st('mkt_share', f.mkt_share)), hint: `орієнтир ≤ ${fmt.pct0(T.mkt_share_b2c)} виручки B2C · ${fmt.pct(f.mkt_share_total)} від усіх сегментів (стеля ${fmt.pct0(T.mkt_share_total)})`,
    deltas: [p && dl(prevLbl(), pp(f.mkt_share - p.mkt_share), good(f.mkt_share - p.mkt_share, 'down')), lyR && dl('2025', fmt.pct(lyM / lyR))], spark: spark(series('mkt_share', i), T.mkt_share_b2c) }));
  const plCpo = pl.marketing / pl.orders;
  tiles.push(tile({ label: 'CPO · вартість замовлення', value: fmt.usd2(f.cpo), chip: chip(st('cpo', f.cpo)), hint: `маркетинг / замовлення · ціль ≤ ${fmt.usd0(T.cpo)} · ${pl.src} ${fmt.usd2(plCpo)}`,
    deltas: [p && dl(prevLbl(), ps(d(f.cpo, p.cpo)), good(d(f.cpo, p.cpo), 'down')), dl(pl.to, ps(d(f.cpo, plCpo)), good(d(f.cpo, plCpo), 'down'))], spark: spark(series('cpo', i), T.cpo) }));
  tiles.push(tile({ label: 'CAC · вартість нового клієнта', value: fmt.usd2(f.cac), chip: chip(st('cac', f.cac)), hint: `${fmt.int(f.new_customers)} нових (${fmt.pct(f.new_share)} замовлень) · ціль ≤ ${fmt.usd0(T.cac)} · CAC / AOV ${fmt.pct0(f.cac / f.aov)}`,
    deltas: [p && dl(prevLbl(), ps(d(f.cac, p.cac)), good(d(f.cac, p.cac), 'down'))], spark: spark(series('cac', i), T.cac) }));
  tiles.push(tile({ label: 'Знижка + маркетинг на замовлення', value: fmt.usd2(f.disc_mkt_per_order), chip: chip(st('disc', f.discount_eff)), hint: `знижка ${fmt.usd2(f.disc_per_order)} (${fmt.pct(f.discount_eff)}) + CPO ${fmt.usd2(f.cpo)} при AOV ${fmt.usd2(f.aov)}`,
    deltas: [p && dl(prevLbl(), ps(d(f.disc_mkt_per_order, p.disc_mkt_per_order)), good(d(f.disc_mkt_per_order, p.disc_mkt_per_order), 'down')), p && dl('AOV', ps(d(f.aov, p.aov)), good(d(f.aov, p.aov), 'up'))], spark: spark(series('disc_mkt_per_order', i)) }));
  tiles.push(tile({ label: 'Meta: витрата на покупку за кабінетом', value: fmt.usd2(f.meta_cpp), hint: `${fmt.usd(f.meta)} / ${fmt.int(f.meta_purchases)} покупок · ${fmt.pct0(f.meta_cpp / f.aov)} чека · кабінет розходиться з CRM на ≈14%`,
    deltas: [p && dl(prevLbl(), ps(d(f.meta_cpp, p.meta_cpp)), good(d(f.meta_cpp, p.meta_cpp), 'down')), p && dl('витрата', ps(d(f.meta, p.meta)))], spark: spark(series('meta_cpp', i)) }));
  tiles.push(tile({ label: 'Google: витрата на покупку за кабінетом', value: fmt.usd2(f.google_cpp), hint: `${fmt.usd(f.google)} / ${fmt.int(f.google_purchases)} покупок · з ПДВ · канал №1 за витратою у вересні`,
    deltas: [p && dl(prevLbl(), ps(d(f.google_cpp, p.google_cpp)), good(d(f.google_cpp, p.google_cpp), 'down')), p && dl('витрата', ps(d(f.google, p.google)))], spark: spark(series('google_cpp', i)) }));
  const u = utmAt(f.month), up = p ? utmAt(p.month) : null;
  tiles.push(tile({ label: 'Замовлення з email / Viber', value: u ? fmt.pct(u.crm_share) : '—', hint: u ? `${fmt.int(u.crm)} замовлень, ${fmt.usd(u.crm_rev)} · блогери ${fmt.pct(u.blogger / u.total)} · ринок ≈27% виручки` : '',
    deltas: [u && up && dl(prevLbl(), pp(u.crm_share - up.crm_share), good(u.crm_share - up.crm_share, 'up'))], spark: spark(S.utm.filter(x => x.month <= f.month).map(x => x.crm_share)) }));
  document.getElementById('cmo-tiles').innerHTML = tiles.join('');

  // channels chart (since 2025)
  const CH = S.channels.filter(x => x.month <= f.month && S.months.length);
  const lab = CH.map(x => MS[+x.month.slice(5, 7) - 1] + (x.month.slice(5, 7) === '01' ? ' ' + x.month.slice(2, 4) : ''));
  const tipL = CH.map(x => cap(MN[+x.month.slice(5, 7) - 1]) + ' ' + x.month.slice(0, 4));
  barChart(document.getElementById('ch-chart'), { labels: lab, tipLabels: tipL, stacked: true, fmt: (v, ax) => ax ? fmt.k0(v) : fmt.usd(v), aria: 'Маркетинг по каналах',
    series: [{ name: 'Meta', color: 'var(--s1)', values: CH.map(x => x.meta) }, { name: 'Google Ads', color: 'var(--s2)', values: CH.map(x => x.google) }, { name: 'Блогери', color: 'var(--s3)', values: CH.map(x => x.influence) }, { name: 'Інше (TikTok, Instagram)', color: 'var(--s4)', values: CH.map(x => x.other + x.tiktok) }],
    extra: k => `<div class="r"><i></i><em>Meta $/покупку</em><b>${fmt.usd2(CH[k].meta_cpp)}</b></div><div class="r"><i></i><em>Google $/покупку</em><b>${fmt.usd2(CH[k].google_cpp)}</b></div>` });
  legend(document.getElementById('ch-legend'), [{ name: 'Meta', color: 'var(--s1)', box: true }, { name: 'Google Ads', color: 'var(--s2)', box: true }, { name: 'Блогери', color: 'var(--s3)', box: true }, { name: 'Інше', color: 'var(--s4)', box: true }]);

  // share chart: 2026 fact vs 2025 P&L, with 20% ref
  const upto = M.slice(0, i + 1);
  lineChart(document.getElementById('share-chart'), { labels: MS.slice(0, 12), fmt: (v) => fmt.pct(v), ymin0: true, refs: [{ value: T.mkt_share_b2c, label: 'орієнтир 20%' }], aria: 'Маркетинг у % виручки',
    series: [{ name: `${YEAR} факт`, color: 'var(--s1)', values: MS.map((_, k) => k <= i && M[k] ? M[k].mkt_share : null) },
             { name: `${YEAR} RF CLUST`, color: 'var(--s1)', dash: true, values: MS.map((_, k) => PL.rf.marketing[k] != null ? PL.rf.marketing[k] / PL.rf.revenue[k] : null) },
             { name: '2025 P&L', color: 'var(--ly)', values: MS.map((_, k) => LY.revenue[k] ? LY.marketing[k] / LY.revenue[k] : null) }] });
  legend(document.getElementById('share-legend'), [{ name: YEAR + ' факт', color: 'var(--s1)' }, { name: 'RF CLUST', color: 'var(--s1)', dash: true }, { name: '2025 P&L', color: 'var(--ly)' }, { name: 'орієнтир', color: 'var(--ref)', dash: true }]);

  // weekly table
  const Wk = S.weekly, wc = [{ label: 'Тиждень' }, { label: 'Виручка, $k' }, { label: 'Замовл.' }, { label: 'AOV' }, { label: 'Маркетинг, $k' }, { label: '% виручки' }, { label: 'CPO' }, { label: 'CM3, $k' }, { label: 'CM3 %' }, { label: 'Знижка' }, { label: 'Meta, $k' }, { label: 'Google, $k' }, { label: 'Блогери, $k' }, { label: 'Meta $/покупку' }, { label: 'Нові' }, { label: '% нових' }, { label: '% промо' }];
  const wrows = Wk.map(w => { const fc = w.partial ? 'fut' : ''; const c = t => ({ text: t, cls: fc }); return { cells: [
    { text: fmt.dm(w.week_start) + (w.partial ? ` (${w.days} дн.)` : ''), cls: fc }, c(fmt.k(w.revenue)), c(fmt.int(w.orders)), c(fmt.usd2(w.aov)), c(fmt.k(w.marketing)),
    { text: fmt.pct(w.mkt_share), cls: fc + ' ' + (w.partial ? '' : cellCls(st('mkt_share', w.mkt_share))) }, { text: fmt.usd2(w.cpo), cls: fc + ' ' + (w.partial ? '' : cellCls(st('cpo', w.cpo))) },
    c(fmt.k(w.cm3)), { text: fmt.pct(w.cm3_share), cls: fc + ' ' + (w.partial ? '' : cellCls(st('cm3', w.cm3_share))) }, { text: fmt.pct(w.discount_eff), cls: fc + ' ' + cellCls(st('disc', w.discount_eff)) },
    c(fmt.k(w.meta)), c(fmt.k(w.google)), c(fmt.k(w.influence)), c(fmt.usd2(w.meta_cpp)), c(fmt.int(w.new_customers)), c(fmt.pct(w.new_share)), c(fmt.pct(w.promo_share))] }; });
  document.getElementById('tbl-w').innerHTML = tableHTML(wc, wrows);

  // new vs repeat (created basis), since 2024
  const C = S.customers.filter(x => x.month <= f.month);
  barChart(document.getElementById('nr-chart'), { labels: C.map(x => MS[+x.month.slice(5, 7) - 1] + (x.month.slice(5, 7) === '01' ? ' ' + x.month.slice(2, 4) : '')), tipLabels: C.map(x => cap(MN[+x.month.slice(5, 7) - 1]) + ' ' + x.month.slice(0, 4)), stacked: true, fmt: (v) => fmt.int(v), aria: 'Нові та повторні замовлення',
    series: [{ name: 'Перші замовлення (нові клієнти)', color: 'var(--s1)', values: C.map(x => x.first_orders) }, { name: 'Повторні', color: 'var(--s3)', values: C.map(x => x.repeat_orders) }],
    extra: k => `<div class="r"><i></i><em>Частка нових</em><b>${fmt.pct(C[k].new_share)}</b></div><div class="r"><i></i><em>З промокодом</em><b>${fmt.pct(C[k].promo_share)}</b></div>` });
  legend(document.getElementById('nr-legend'), [{ name: 'Нові клієнти', color: 'var(--s1)', box: true }, { name: 'Повторні замовлення', color: 'var(--s3)', box: true }]);

  // cohorts table
  const cc = [{ label: 'Когорта' }, { label: 'Нових' }, { label: '90 дн.' }, { label: '180 дн.' }, { label: '365 дн.' }];
  const crow = S.cohorts.filter(c => c.clients > 500).map(c => ({ cells: [{ text: c.cohort }, { text: fmt.int(c.clients) },
    { text: c.mature90 ? fmt.pct(c.rep90) : '—', cls: c.mature90 ? cellCls(st('rep90', c.rep90)) : 'fut' }, { text: c.mature180 ? fmt.pct(c.rep180) : '—', cls: c.mature180 ? '' : 'fut' }, { text: c.mature365 ? fmt.pct(c.rep365) : '—', cls: c.mature365 ? '' : 'fut' }] }));
  document.getElementById('tbl-coh').innerHTML = tableHTML(cc, crow);

  // utm share chart
  const U = S.utm.filter(x => x.month >= '2025-06' && x.month <= f.month);
  const sh = k => U.map(x => x[k] / x.total);
  barChart(document.getElementById('utm-chart'), { labels: U.map(x => MS[+x.month.slice(5, 7) - 1] + (x.month.slice(5, 7) === '01' ? ' ' + x.month.slice(2, 4) : '')), tipLabels: U.map(x => cap(MN[+x.month.slice(5, 7) - 1]) + ' ' + x.month.slice(0, 4)), stacked: true, fmt: (v) => fmt.pct0(v), ymax: 1, aria: 'Замовлення за джерелом',
    series: [{ name: 'Google Ads', color: 'var(--s2)', values: sh('paid_google') }, { name: 'Meta', color: 'var(--s1)', values: sh('paid_meta') }, { name: 'Органіка', color: 'var(--s3)', values: sh('organic_search') },
             { name: 'Власні соцмережі', color: 'var(--s4)', values: sh('social_own') }, { name: 'CRM (email, Viber)', color: 'var(--s5)', values: sh('crm') }, { name: 'Офлайн і сервіс', color: 'var(--s6)', values: sh('offline') }, { name: 'Блогери, пряме, інше', color: 'var(--ly)', values: U.map(x => (x.blogger + x.direct + x.other) / x.total) }],
    extra: k => `<div class="r"><i></i><em>Усього замовлень</em><b>${fmt.int(U[k].total)}</b></div>` });
  legend(document.getElementById('utm-legend'), [{ name: 'Google Ads', color: 'var(--s2)', box: true }, { name: 'Meta', color: 'var(--s1)', box: true }, { name: 'Органіка', color: 'var(--s3)', box: true }, { name: 'Власні соцмережі', color: 'var(--s4)', box: true }, { name: 'CRM', color: 'var(--s5)', box: true }, { name: 'Офлайн і сервіс', color: 'var(--s6)', box: true }, { name: 'Інше', color: 'var(--ly)', box: true }]);

  // discount history
  const DH = S.discount_history.filter(x => x.month <= f.month);
  lineChart(document.getElementById('disc-chart'), { labels: DH.map(x => MS[+x.month.slice(5, 7) - 1] + (x.month.slice(5, 7) === '01' ? ' ' + x.month.slice(2, 4) : '')), tipLabels: DH.map(x => cap(MN[+x.month.slice(5, 7) - 1]) + ' ' + x.month.slice(0, 4)), fmt: v => fmt.pct(v), ymin0: true, refs: [{ value: T.discount, label: 'план 25%' }], aria: 'Ефективна знижка',
    series: [{ name: 'За датою створення (orders)', color: 'var(--s2)', values: DH.map(x => x.disc_eff) }, { name: 'За датою відвантаження (daily_kpi_metrics)', color: 'var(--s1)', values: DH.map(x => { const mm = M.find(y => y.month === x.month); return mm ? mm.discount_eff : null; }) }] });
  legend(document.getElementById('disc-legend'), [{ name: 'За датою створення', color: 'var(--s2)' }, { name: 'За датою відвантаження (2026)', color: 'var(--s1)' }, { name: 'план', color: 'var(--ref)', dash: true }]);

  document.getElementById('c-q3-label').textContent = `3. План і бюджет на ${MN[(m + 1) % 12]} за правилом скейлу, по каналах.`;
  document.getElementById('cmo-form-sub').textContent = `${cap(MN[m])} ${f.month.slice(0, 4)}. Коментар зберігається на цій сторінці і потрапляє у Board Pack.`;
  renderInputs();
}
