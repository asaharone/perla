
/* ================= CFO ================= */
function renderCFO() {
  const i = sel, f = F(), p = P(), m = mi(f), d = rel, ms = manualState();
  const col = S.b2b_collections.find(x => x.month === f.month) || {};
  const up = closedUpTo();
  const colYtd = sum(S.b2b_collections.filter(x => x.month >= M[0].month && x.month <= f.month && M.find(y => y.month === x.month && y.complete)), 'collected_usd');
  const tiles = [];
  tiles.push(tile({ label: 'Виручка, всі сегменти', value: fmt.usd(f.revenue_total), hint: `B2C ${fmt.usd(f.revenue)} · B2B ${fmt.usd(f.revenue_b2b)} · інше ${fmt.usd(f.revenue_other)}`,
    deltas: [p && dl(prevLbl(), ps(d(f.revenue_total, p.revenue_total)), good(d(f.revenue_total, p.revenue_total), 'up')), dl('YTD', fmt.usd(sum(up, 'revenue_total')))], spark: spark(series('revenue_total', i)) }));
  tiles.push(tile({ label: 'NC компанії (після COGS і маркетингу)', value: fmt.usd(f.nc_total), chip: chip(st('nc', f.nc_total_per_mkt)), hint: `${fmt.pct(f.nc_total / f.revenue_total)} виручки · ${fmt.x(f.nc_total_per_mkt)} на $1 маркетингу`,
    deltas: [p && dl(prevLbl(), ps(d(f.nc_total, p.nc_total)), good(d(f.nc_total, p.nc_total), 'up')), dl('YTD', fmt.usd(sum(up, 'nc_total')))], spark: spark(series('nc_total', i)) }));
  tiles.push(tile({ label: 'B2B: відвантажено', value: fmt.usd(f.revenue_b2b), hint: `GP ${fmt.pct(f.gp_b2b_share)} до ретро-бонусів і відстрочки · ${fmt.int(f.orders_b2b)} відвантажень`,
    deltas: [p && dl(prevLbl(), ps(d(f.revenue_b2b, p.revenue_b2b)), good(d(f.revenue_b2b, p.revenue_b2b), 'up')), dl('YTD', fmt.usd(sum(up, 'revenue_b2b')))], spark: spark(series('revenue_b2b', i)) }));
  tiles.push(tile({ label: 'B2B: отримано грошей', value: fmt.usd(col.collected_usd), hint: `${fmt.pct0(col.collected_usd / f.revenue_b2b)} від відвантажень місяця · YTD ${fmt.usd(colYtd)} проти ${fmt.usd(sum(up, 'revenue_b2b'))} відвантажено`,
    deltas: [dl('YTD інкасація', fmt.pct0(colYtd / sum(up, 'revenue_b2b')), colYtd / sum(up, 'revenue_b2b') < 0.85 ? 'up-bad' : 'neutral')], spark: spark(S.b2b_collections.filter(x => x.month >= M[0].month && x.month <= f.month).map(x => x.collected_usd)) }));
  tiles.push(tile({ label: 'Дебіторка B2B', value: fmt.uah(ms.ar), chip: chip(st('overdue', ms.overdue)), hint: `≈ ${fmt.usd(ms.ar / T.fx_usd)} · просрочка ${fmt.pct(ms.overdue)} (KPI ≤ ${fmt.pct0(T.overdue)}) · DSO ${ms.dso} дн. (ціль ≤ ${T.dso}) · на ${fmt.date(ms.as_of)}`,
    deltas: [dl('топ-2 клієнти', fmt.pct0(MAN.ar.top2_share) + ' ДЗ')] }));
  const cogsDay = MAN.inventory.cogs_month_usd / 30;
  tiles.push(tile({ label: 'Запаси', value: fmt.usd(ms.stock_ua + ms.stock_pl), hint: `UA ${fmt.usd(ms.stock_ua)} · PL ${fmt.usd(ms.stock_pl)} · ≈ ${dec((ms.stock_ua + ms.stock_pl) / cogsDay, 0)} днів собівартості; з товаром у дорозі (${fmt.usd(ms.transit)}) — ${dec((ms.stock_ua + ms.stock_pl + ms.transit) / cogsDay, 0)} дн.`,
    deltas: [dl('OOS SKU', String(MAN.inventory.oos_skus.length), 'up-bad'), dl('платежі за закупівлі до 03.01', fmt.usd(MAN.inventory.payments_plan_q4_usd))] }));
  tiles.push(tile({ label: 'Кеш', value: ms.cash == null ? '<span class="muted">не звірено</span>' : fmt.usd(ms.cash), chip: ms.cash == null ? chipNa('немає даних') : chip(ms.cash >= T.cash_min_usd ? { cls: 'ok', label: 'вище порогу', icon: '✓' } : { cls: 'alert', label: 'нижче порогу', icon: '✕' }),
    hint: ms.cash == null ? 'Поріг CLUST ≥ $300k на 13 тижнів. Потрібні: залишок по кожному рахунку, реєстр зобов\'язань, графік повернень' : `звірка ${fmt.date(ms.cash_date)} · зобов'язання ${fmt.uah(ms.liab)}`,
    deltas: [dl('план платежів / тиждень', fmt.uah(MAN.cash.weekly_payments_plan_uah)), dl('надходження / тиждень', fmt.uah(MAN.cash.weekly_receipts_uah))] }));
  const PF = S.pnl_fd.rows, npRow = PF.find(x => x.key === 'np'), revRow = PF.find(x => x.key === 'revenue');
  tiles.push(tile({ label: 'Чистий прибуток за FD', value: fmt.usd(npRow.values[4] * 1000), hint: `січень–серпень, ${fmt.pct(npRow.values[4] / revRow.values[4])} виручки · серпень ${fmt.usd(npRow.values[3] * 1000)} (${fmt.pct(npRow.values[3] / revRow.values[3])}) · вересень прогноз ${fmt.usd(npRow.values[5] * 1000)}`,
    deltas: [dl('EBITDA YTD', fmt.pct(PF.find(x => x.key === 'ebitda').values[4] / revRow.values[4])), dl('ціль IV кв.', fmt.usd(T.np_q4_usd))] }));
  document.getElementById('cfo-tiles').innerHTML = tiles.join('');

  // P&L FD table
  const pc = [{ label: '$ тис.' }].concat(S.pnl_fd.columns.map(c => ({ label: c })));
  const prow = PF.map(r => ({ cls: r.indent ? 'ind' : '', cells: [{ text: r.label }].concat(r.values.map(v => ({ text: r.pct ? fmt.pct(v) : fmt.int(v) }))) }));
  document.getElementById('tbl-pnl').innerHTML = tableHTML(pc, prow);
  document.getElementById('pnl-sub').textContent = S.pnl_fd._source;
  document.getElementById('pnl-note').textContent = S.pnl_fd.plan_note + ' ' + S.pnl_fd.eu_note;

  // reconciliation BQ vs FD
  const q = (a, b, k) => M.slice(a, b + 1).filter(x => x.complete).reduce((s, x) => s + x[k], 0) / 1000;
  const fdv = key => PF.find(x => x.key === key).values;
  const recRows = [];
  const periods = [{ label: 'I кв.', col: 0, bq: k => q(0, 2, k) }, { label: 'II кв.', col: 1, bq: k => q(3, 5, k) }, { label: 'Липень', col: 2, bq: k => q(6, 6, k) }, { label: 'Серпень', col: 3, bq: k => q(7, 7, k) }, { label: 'Вересень (FD — прогноз)', col: 5, bq: k => q(8, 8, k), fc: true }];
  [['B2C UA, виручка', 'revenue', 'b2c_ua'], ['B2B, виручка', 'revenue_b2b', 'b2b'], ['Маркетинг UA', 'marketing', 'marketing']].forEach(([lab, bk, fk]) => {
    recRows.push({ section: lab });
    periods.forEach(pr => {
      const bq = pr.bq(bk), fd = fdv(fk)[pr.col], dd = rel(bq, fd), s = pr.fc ? null : (Math.abs(dd) <= 0.02 ? { cls: 'ok', label: 'сходиться', icon: '✓' } : Math.abs(dd) <= 0.03 ? { cls: 'watch', label: 'до 3%', icon: '!' } : { cls: 'alert', label: 'пояснити', icon: '✕' });
      recRows.push({ cls: 'ind', cells: [{ text: pr.label }, { text: fmt.int(bq) }, { text: fmt.int(fd) }, { text: ps(dd), cls: cellCls(s) }, { html: s ? chip(s) : chipNa('прогноз') }] });
    });
  });
  document.getElementById('tbl-rec').innerHTML = tableHTML([{ label: 'Період' }, { label: 'BigQuery, $k' }, { label: 'FD, $k' }, { label: 'Δ' }, { label: 'Статус' }], recRows);

  // segments table
  const sc = [{ label: '$ тис.' }].concat(M.map(x => ({ label: MS[mi(x)], cls: x.complete ? '' : 'fut' }))).concat([{ label: 'YTD', cls: 'ytd' }]);
  const srow = (label, k, f_, cls) => ({ cls: cls || '', cells: [{ text: label }].concat(M.map(x => ({ text: f_(x[k]), cls: x.complete ? '' : 'fut' }))).concat([{ text: k.endsWith('_share') || k === 'nc_total_per_mkt' ? '—' : f_(sum(up, k)), cls: 'ytd' }]) });
  const srows = [
    { section: 'Виручка' }, srow('B2C', 'revenue', fmt.k0, 'ind'), srow('B2B', 'revenue_b2b', fmt.k0, 'ind'), srow('Інше (PR, працівники)', 'revenue_other', fmt.k0, 'ind'), srow('Разом', 'revenue_total', fmt.k0),
    { section: 'Собівартість і маржа B2C' }, srow('COGS B2C (з доставкою, фулфілментом)', 'cogs', fmt.k0, 'ind'), srow('Net Cost B2C (лише продукт)', 'net_cost', fmt.k0, 'ind'), srow('CM2 B2C', 'cm2', fmt.k0), srow('CM2, % виручки', 'cm2_share', fmt.pct, 'ind'), srow('Маркетинг B2C', 'marketing', fmt.k0), srow('CM3 B2C', 'cm3', fmt.k0), srow('CM3, % виручки', 'cm3_share', fmt.pct, 'ind'),
    { section: 'B2B і NC' }, srow('COGS B2B', 'cogs_b2b', fmt.k0, 'ind'), srow('GP B2B', 'gp_b2b', fmt.k0), srow('GP B2B, %', 'gp_b2b_share', fmt.pct, 'ind'), srow('GP інше', 'gp_other', fmt.k0, 'ind'), srow('NC компанії', 'nc_total', fmt.k0), srow('NC / маркетинг', 'nc_total_per_mkt', fmt.x, 'ind'),
    { section: 'Знижка' }, srow('Сума знижки B2C', 'discount_usd', fmt.k0, 'ind'), srow('Ефективна знижка', 'discount_eff', fmt.pct, 'ind')
  ];
  document.getElementById('tbl-seg').innerHTML = tableHTML(sc, srows);

  // b2b chart
  const BC = M.filter(x => x.complete);
  barChart(document.getElementById('b2b-chart'), { labels: BC.map(x => MS[mi(x)]), tipLabels: BC.map(x => cap(MN[mi(x)]) + ' ' + x.month.slice(0, 4)), stacked: false, fmt: (v, ax) => ax ? fmt.k0(v) : fmt.usd(v), aria: 'B2B відвантажено і отримано',
    series: [{ name: 'Відвантажено', color: 'var(--s1)', values: BC.map(x => x.revenue_b2b) }, { name: 'Отримано грошей', color: 'var(--s3)', values: BC.map(x => (S.b2b_collections.find(y => y.month === x.month) || {}).collected_usd || 0) }] });
  legend(document.getElementById('b2b-legend'), [{ name: 'Відвантажено (daily_kpi_metrics)', color: 'var(--s1)', box: true }, { name: 'Отримано грошей (fct_b2b_payments)', color: 'var(--s3)', box: true }]);
  const BCl = S.b2b_clients, mx = BCl[0].invoiced_2026;
  document.getElementById('b2b-sub').textContent = `Рахунки Zoho 2026 без повернень; частка — від відвантажень B2B YTD ${fmt.usd(S.b2b_rev_ytd)}. Топ-2 — ${fmt.pct0(BCl[0].share_of_b2b_rev + BCl[1].share_of_b2b_rev)} виручки і ${fmt.pct0(MAN.ar.top2_share)} дебіторки.`;
  document.getElementById('b2b-clients').innerHTML = BCl.map((c, k) => `<div class="nm"><i class="sw" style="background:${k < 2 ? 'var(--s2)' : 'var(--s1)'}"></i>${esc(c.name)}</div><div class="bar" aria-hidden="true"><span style="width:${(c.invoiced_2026 / mx * 100).toFixed(1)}%;background:${k < 2 ? 'var(--s2)' : 'var(--s1)'}"></span></div><div class="v num">${fmt.usd(c.invoiced_2026)}<small>${fmt.pct0(c.share_of_b2b_rev)}</small></div><div class="v num"><small style="margin:0">черв–вер ${fmt.usd(c.invoiced_jun_sep)}</small></div>`).join('');

  // cash kv + debt
  document.getElementById('cash-kv').innerHTML = [
    ['Звірений залишок', ms.cash == null ? 'немає — ' + esc(MAN.cash.note) : fmt.usd(ms.cash) + ' на ' + fmt.date(ms.cash_date)],
    ['План платежів / тиждень', fmt.uah(MAN.cash.weekly_payments_plan_uah) + ' при надходженнях ' + fmt.uah(MAN.cash.weekly_receipts_uah) + ' (25.09)'],
    ['Зобов\'язання', ms.liab ? fmt.uah(ms.liab) + ' (усно, реєстру немає)' : '—'],
    ['Платежі за закупівлі 28.09–03.01', fmt.uah(MAN.inventory.payments_plan_q4_uah) + ' ≈ ' + fmt.usd(MAN.inventory.payments_plan_q4_usd) + ', з них товар ' + fmt.usd(MAN.inventory.payments_goods_usd)],
    ['Відкриті замовлення виробникам', '≈ €' + dec(MAN.inventory.open_po_eur / 1e6, 2) + 'M, без ціни ' + MAN.inventory.open_po_no_price_rows + ' рядків'],
    ['EU', 'збиток ' + fmt.usd(MAN.eu.loss_8m_usd) + ' за 8 міс., ' + fmt.usd(MAN.eu.loss_monthly_usd) + ' на місяць з травня'],
    ['Затоварення', esc(MAN.inventory.overstock_note)]
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  document.getElementById('tbl-debt').innerHTML = tableHTML([{ label: 'Борг і фінансування' }, { label: 'Сума і умови', cls: 'txt' }, { label: 'Статус', cls: 'txt' }], MAN.debt.map(x => ({ cells: [{ text: x.name }, { text: x.amount }, { text: x.status }] })));
  document.getElementById('cfo-form-sub').textContent = `${cap(MN[m])} ${f.month.slice(0, 4)}. Стартові значення — зріз ${fmt.date(MAN.as_of)} з діагностики; зберігайте раз на тиждень після кеш-комітету.`;
}

/* ================= CLUST: Board Pack ================= */
function renderCLUST() {
  const f = F(), up = closedUpTo();
  const cols = [{ label: '' }].concat(MS.map((s, k) => ({ label: s + ' ' + String(YEAR).slice(2), cls: (M[k] && M[k].complete ? '' : 'fut') + (M[k] && M[k].month === f.month ? ' sel' : '') }))).concat([{ label: 'YTD', cls: 'ytd' }]);
  const cell = (k, v, s) => ({ text: v, cls: (M[k] && M[k].complete ? '' : 'fut') + (M[k] && M[k].month === f.month ? ' sel' : '') + ' ' + (s ? cellCls(s) : '') });
  const row = (label, get, f_, kind, cls, ytdFn) => ({ cls: cls || '', cells: [{ text: label }].concat(MS.map((_, k) => { const x = M[k]; const v = x ? get(x) : null; return cell(k, v == null ? '' : f_(v), x && x.complete && kind ? st(kind, v) : null); })).concat([{ text: ytdFn ? f_(ytdFn()) : '', cls: 'ytd' }]) });
  const refRow = (label, arr, f_) => ({ cls: 'ref', cells: [{ text: label }].concat(MS.map((_, k) => ({ text: arr[k] == null ? '' : f_(arr[k]) }))).concat([{ text: f_(arr.slice(0, up.length).reduce((a, b) => a + (b || 0), 0)), cls: 'ytd' }]) });
  const Y = k => sum(up, k);
  const rows = [
    { section: 'Виручка і замовлення' },
    row('Виручка B2C, $k', x => x.revenue, fmt.k0, null, '', () => Y('revenue')),
    refRow('  бюджет 2026', PL.budget.revenue, fmt.k0), refRow('  RF CLUST', PL.rf.revenue, fmt.k0), refRow('  2025 (P&L)', LY.revenue, fmt.k0),
    row('Виручка B2B, $k', x => x.revenue_b2b, fmt.k0, null, '', () => Y('revenue_b2b')),
    row('Замовлення B2C', x => x.orders, fmt.int, null, '', () => Y('orders')),
    row('AOV, $', x => x.aov, fmt.usd2, null, '', () => Y('revenue') / Y('orders')),
    { section: 'Маркетинг' },
    row('Маркетинг B2C, $k', x => x.marketing, fmt.k0, null, '', () => Y('marketing')),
    refRow('  бюджет 2026', PL.budget.marketing, fmt.k0), refRow('  RF CLUST', PL.rf.marketing, fmt.k0), refRow('  2025 (P&L)', LY.marketing, fmt.k0),
    row('Маркетинг, % виручки B2C', x => x.mkt_share, fmt.pct, 'mkt_share', 'ind', () => Y('marketing') / Y('revenue')),
    row('CPO, $', x => x.cpo, fmt.usd2, 'cpo', 'ind', () => Y('marketing') / Y('orders')),
    row('Нові клієнти', x => x.new_customers, fmt.int, null, '', () => Y('new_customers')),
    row('CAC, $', x => x.cac, fmt.usd2, 'cac', 'ind', () => Y('marketing') / Y('new_customers')),
    row('Частка повторних замовлень', x => x.repeat_share, fmt.pct, null, 'ind', () => Y('repeat_orders') / Y('orders_ship')),
    { section: 'Маржа' },
    row('CM2, % виручки', x => x.cm2_share, fmt.pct, null, '', () => Y('cm2') / Y('revenue')),
    row('CM3 B2C, $k', x => x.cm3, fmt.k0, null, '', () => Y('cm3')),
    row('CM3, % виручки', x => x.cm3_share, fmt.pct, 'cm3', 'ind', () => Y('cm3') / Y('revenue')),
    row('GP B2B, $k', x => x.gp_b2b, fmt.k0, null, '', () => Y('gp_b2b')),
    row('NC компанії, $k', x => x.nc_total, fmt.k0, null, '', () => Y('nc_total')),
    row('NC / маркетинг', x => x.nc_total_per_mkt, fmt.x, 'nc', 'ind', () => Y('nc_total') / Y('marketing')),
    { section: 'Знижка' },
    row('Ефективна знижка', x => x.discount_eff, fmt.pct, 'disc', '', () => Y('discount_usd') / (Y('revenue') + Y('discount_usd'))),
    row('Знижка + маркетинг на замовлення, $', x => x.disc_mkt_per_order, fmt.usd2, null, 'ind', () => (Y('discount_usd') + Y('marketing')) / Y('orders'))
  ];
  document.getElementById('tbl-bp').innerHTML = tableHTML(cols, rows);

  // sources of truth
  const src = [
    ['P&L за місяць: виручка, GP, EBITDA, NP', 'Finance Dashboard, лист Finresult_recalculated_EBITDA', 'Фінанси', 'закриття до 10-го', 'Лист вірний; вітрина Analytical dashboard 2026 подвоює B2B; Board Pack CLUST — лише UA'],
    ['Виручка і маржа всередині місяця', 'BigQuery daily_kpi_metrics (та сама база, що Power BI Financial Overview)', 'Аналітика', 'щодня', 'З FD за липень сходиться, серпень −1%; звіт маркетингу за датою замовлення — лише з поміткою'],
    ['Нові і повторні клієнти, когорти, B2B по клієнтах', 'BigQuery orders', 'Аналітика', 'щодня', 'У Board Pack цих метрик не було — тепер є'],
    ['Реклама', 'BigQuery fct_ad_stats', 'Маркетинг', 'щодня', 'Покупки розходяться з кабінетом Meta на 14%'],
    ['План', 'Plan PnL UA, лист «FinModel 2025-2026 по факту»; RF CLUST', 'Фінанси', 'при перегляді', 'Три версії плану серпня; вересень–грудень перезбирається'],
    ['Залишок грошей', 'немає → ручний ввід на вкладці CFO після звірки з банком', 'Фінанси', 'щотижня', 'Останній розрахунок — 30.04 з Finmap, не звірено'],
    ['Рух грошей', 'CashFlow_Perla.xlsx (Finmap)', 'Фінанси', 'щомісяця', 'Залишки з лютого порожні, курс 2026 заморожений, серпень не розмічений'],
    ['Дебіторка B2B', 'Дебіторська заборгованість.xlsx, Zoho; дашборд pages.helsa.ai/debitorka-dashboard', 'Фінанси + B2B', 'щотижня', 'У АНЦ-90 немає формули просрочки'],
    ['Склад Україна', 'Inventory Tracking; по локаціях — «Номера контрагентов», лист «учёт»', 'Фулфілмент', 'щодня', 'Надійно; є від\'ємні залишки, початок дня перезаписується'],
    ['Склад Польща', 'Material&FG Stock Planning (Frisbo)', 'Закупівлі', 'автоматично', 'Поріг OOS один для всіх SKU — 500 шт.'],
    ['Замовлення виробникам і план закупівель', 'Purchase Orders (PO List); S&OP September 2026, Q4', 'Закупівлі', 'за подією / щотижня', 'У 37% відкритих штук немає ціни; рішення зустрічей не внесені'],
    ['Платежі за закупівлі', 'Planing Operation Dep.', 'Фінанси + закупівлі', 'щотижня', 'TOTAL рахує товар лише до 18.10'],
    ['Рішення і задачі', 'лог рішень на вкладці CEO цієї сторінки (замість Improving Net Profit, Follow up, ClickUp)', '—', 'щотижня', '']
  ];
  document.getElementById('tbl-src').innerHTML = tableHTML([{ label: 'Що рахуємо' }, { label: 'Джерело правди', cls: 'txt' }, { label: 'Власник' }, { label: 'Оновлення' }, { label: 'Що зараз не так', cls: 'txt' }], src.map(r => ({ cells: r.map(t => ({ text: t })) })));

  document.getElementById('sql-list').innerHTML = Object.keys(SQL).map(k => `<details><summary>${esc(k)}</summary><pre><code>${esc(SQL[k])}</code></pre></details>`).join('');
}

/* ================= BENCHMARKS ================= */
function benchValue(key) {
  const f = F(), up = closedUpTo(), Y = k => sum(up, k), ms = manualState();
  switch (key) {
    case 'mkt_share': return { m: f.mkt_share, y: Y('marketing') / Y('revenue') };
    case 'cm3_share': return { m: f.cm3_share, y: Y('cm3') / Y('revenue') };
    case 'cm2_share': return { m: f.cm2_share, y: Y('cm2') / Y('revenue'), mLabel: 'CM2; лише продукт: ' + fmt.pct(f.product_margin_share) };
    case 'cac_aov': return { m: f.cac / f.aov, y: (Y('marketing') / Y('new_customers')) / (Y('revenue') / Y('orders')), mLabel: `CAC ${fmt.usd2(f.cac)} / AOV ${fmt.usd2(f.aov)}` };
    case 'rep90': { const c = lastMature('rep90'); const arr = S.cohorts.filter(x => x.mature90 && x.cohort.startsWith(String(YEAR))); return { m: c ? c.rep90 : null, mLabel: c ? 'когорта ' + c.cohort : '', y: avg(arr.map(x => x.rep90)), yLabel: 'середнє когорт ' + YEAR }; }
    case 'rep365': { const c = lastMature('rep365'); const b = S.cohorts[2]; return { m: c ? c.rep365 : null, mLabel: c ? 'когорта ' + c.cohort : '', y: b.rep365, yLabel: 'когорта ' + b.cohort }; }
    case 'repeat_share': return { m: f.repeat_share, y: Y('repeat_orders') / Y('orders_ship') };
    case 'discount_eff': return { m: f.discount_eff, y: Y('discount_usd') / (Y('revenue') + Y('discount_usd')) };
    case 'crm_share': { const u = utmAt(f.month), uu = S.utm.filter(x => x.month.startsWith(String(YEAR)) && x.month <= f.month); return { m: u ? u.crm_share : null, y: sum(uu, 'crm') / sum(uu, 'total') }; }
    case 'meta_cpp_aov': return { m: f.meta_cpp / f.aov, y: (Y('meta') / Y('meta_purchases')) / (Y('revenue') / Y('orders')), mLabel: `${fmt.usd2(f.meta_cpp)} на покупку` };
    case 'aov': return { m: f.aov, y: Y('revenue') / Y('orders') };
    case 'ebitda': { const r = S.pnl_fd.rows, e = r.find(x => x.key === 'ebitda').values, rv = r.find(x => x.key === 'revenue').values; const ci = { '2026-07': 2, '2026-08': 3, '2026-09': 5 }[f.month]; return { m: ci != null ? e[ci] / rv[ci] : null, mLabel: ci === 5 ? 'прогноз FD 16.09' : 'за FD', y: e[4] / rv[4], yLabel: 'січень–серпень, FD' }; }
    case 'dso': return { m: ms.dso, mLabel: 'на ' + fmt.date(ms.as_of), y: null };
    case 'dio': { const cd = MAN.inventory.cogs_month_usd / 30; return { m: (ms.stock_ua + ms.stock_pl) / cd, mLabel: 'на складах UA + PL', y: (ms.stock_ua + ms.stock_pl + ms.transit) / cd, yLabel: 'з товаром у дорозі' }; }
    case 'market_growth': { const g = growthYoY(); return { m: g ? g.rev : null, mLabel: g ? 'B2C р/р, січень–' + MG[mi(f)] : '', y: g ? g.newc : null, yLabel: 'нові клієнти р/р' }; }
  }
  return { m: null, y: null };
}
const bfmt = (u, v) => v == null ? '—' : u === 'pct' ? fmt.pct(v) : u === 'usd' ? fmt.usd2(v) : u === 'days' ? dec(v, 0) + ' дн.' : dec(v, 2);
function benchVerdict(b, v) {
  if (v == null) return { cls: 'na', label: 'немає даних', icon: '?' };
  if (b.better === 'ctx') return { cls: 'na', label: 'контекст', icon: '·' };
  const med = b.market.median, top = b.market.top;
  if (b.better === 'low') return top != null && v <= top ? { cls: 'ok', label: 'верхній квартиль', icon: '✓' } : v <= med ? { cls: 'ok', label: 'краще медіани', icon: '✓' } : v <= med * 1.15 ? { cls: 'watch', label: 'біля медіани', icon: '!' } : { cls: 'alert', label: 'гірше медіани', icon: '✕' };
  return top != null && v >= top ? { cls: 'ok', label: 'верхній квартиль', icon: '✓' } : v >= med ? { cls: 'ok', label: 'краще медіани', icon: '✓' } : v >= med * 0.85 ? { cls: 'watch', label: 'біля медіани', icon: '!' } : { cls: 'alert', label: 'гірше медіани', icon: '✕' };
}
function posBar(b, v, vd) {
  const pts = [v, b.market.median, b.market.top, b.internal ? b.internal.value : null].filter(x => x != null);
  if (pts.length < 2 || v == null) return '';
  let lo = Math.min(...pts), hi = Math.max(...pts); const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.2 || 1; lo -= pad; hi += pad;
  const W = 240, H = 34, x = u => 8 + (W - 16) * (u - lo) / (hi - lo);
  const col = vd.cls === 'ok' ? 'var(--good)' : vd.cls === 'watch' ? 'var(--warn)' : vd.cls === 'alert' ? 'var(--crit)' : 'var(--line-2)';
  let g = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><line x1="8" x2="${W - 8}" y1="20" y2="20" stroke="var(--line-2)" stroke-width="2"/>`;
  const tick = (u, c, lab, up) => u == null ? '' : `<line x1="${x(u).toFixed(1)}" x2="${x(u).toFixed(1)}" y1="13" y2="27" stroke="${c}" stroke-width="2"/><text x="${x(u).toFixed(1)}" y="${up ? 9 : 33}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${lab}</text>`;
  g += tick(b.market.median, 'var(--ref)', 'медіана', true) + tick(b.market.top, 'var(--s3)', 'топ', false) + (b.internal ? tick(b.internal.value, 'var(--accent)', 'CLUST', b.market.top == null) : '');
  g += `<circle cx="${x(v).toFixed(1)}" cy="20" r="6" fill="${col}" stroke="var(--surface)" stroke-width="2"/></svg>`;
  return g;
}
function renderBench() {
  const f = F(), items = S.benchmarks.items;
  let worse = 0, better = 0;
  const rows = items.map(b => {
    const v = benchValue(b.key), vd = benchVerdict(b, v.m);
    if (vd.cls === 'alert') worse++; else if (vd.cls === 'ok') better++;
    return `<div class="brow"><div class="m">${esc(b.metric)}<small>${esc(b.market.text)}${b.internal ? ' · ' + esc(b.internal.text) : ''}</small></div>` +
      `<div class="pv num">${bfmt(b.unit, v.m)}<small>${esc(v.mLabel || cap(MN[mi(f)]))}${v.y != null ? ' · ' + bfmt(b.unit, v.y) + ' ' + esc(v.yLabel || 'YTD') : ''}</small></div>` +
      `<div class="mk">медіана <b>${bfmt(b.unit, b.market.median)}</b>${b.market.top != null ? ' · верхній квартиль <b>' + bfmt(b.unit, b.market.top) + '</b>' : ''}${b.internal ? ' · CLUST <b>' + bfmt(b.unit, b.internal.value) + '</b>' : ''}<div class="src">${b.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' · ')}</div></div>` +
      `<div class="pos">${posBar(b, v.m, vd)}</div><div>${chip(vd)}</div></div>`;
  });
  document.getElementById('bench').innerHTML = `<div class="brow head"><div>Метрика · ринок</div><div>Perla</div><div>Ринок і ціль</div><div>Позиція</div><div>Висновок</div></div>` + rows.join('');
  const vb = document.getElementById('bench-verdict'); vb.className = 'card verdict ' + (worse >= 4 ? 'alert' : worse >= 2 ? 'watch' : 'ok');
  const mk = benchValue('mkt_share'), cm = benchValue('cm3_share'), dc = benchValue('discount_eff'), r9 = benchValue('rep90');
  vb.innerHTML = `${chip(worse >= 4 ? { cls: 'alert', label: worse + ' гірше медіани', icon: '✕' } : { cls: 'watch', label: worse + ' гірше медіани', icon: '!' })}<p class="vt">За ${MN[mi(f)]}: ${better} метрик краще ринкової медіани, ${worse} гірше. Знижка ${fmt.pct(dc.m)} — вище середньої знижки ринку у пік Black Friday; маркетинг ${fmt.pct(mk.m)} і CM3 ${fmt.pct(cm.m)} — на рівні медіани DTC, але не там, де має бути бренд із 60% повторних замовлень.</p>` +
    `<p class="vd">Сильні сторони проти ринку: маржа до маркетингу, частка повторних, вартість покупки у Meta і Google відносно чека (медіа в Україні дешевша). Слабкі: глибина знижки, повтор нових когорт за 90 днів (${fmt.pct(r9.m)}), DSO B2B, темп росту проти ринку.</p>`;
  document.getElementById('bench-note').textContent = S.benchmarks._source;
}

/* ================= FLOW (static) ================= */
function renderFlow() {
  document.getElementById('tbl-rhythm').innerHTML = tableHTML([{ label: 'Коли' }, { label: 'Що', cls: 'txt' }, { label: 'Хто' }], [
    ['Щодня, ранок', 'KPI-алерти B2C у Slack: виручка, замовлення, маржа, маркетинг %, знижка. Планові значення перерахувати разом із планом Q4 — зараз 891 замовлення/день при факті 300–600.', 'Аналітик'],
    ['Середа, 45 хв', 'Кеш-комітет: залишок по банку, реєстр зобов\'язань, 13-тижневий прогноз, черговість платежів (A-SKU за валовим прибутком на долар закупівлі).', 'Альона · валідує Марина'],
    ['П\'ятниця', 'Звіт «знижка + маркетинг на замовлення» і юніт-економіка на одній сторінці (вкладка CMO, тижнева таблиця).', 'Олексій · валідує Артём'],
    ['Щотижня', 'Дзвінок з CLUST: рішення з власником і терміном на місці, у лог рішень.', 'CEO · CLUST'],
    ['1-ше число', 'Автоматичний знімок цієї сторінки.', 'Claude'],
    ['До 3-го робочого дня', 'Коментар CMO (вкладка Маркетинг).', 'CMO'],
    ['До 10-го', 'Звірка BigQuery ↔ FD, ручні вводи кешу, ДЗ, запасів (вкладка Фінанси). Місяць заморожується: правки лише рядком Correction.', 'Фінанси'],
    ['За 3 дні до Борду', 'Board Pack зібрано без ручних правок (вкладка CLUST + коментар CMO + звірка).', 'CLUST']
  ].map(r => ({ cells: r.map(t => ({ text: t })) })));
  document.getElementById('tbl-owners').innerHTML = tableHTML([{ label: 'Область', cls: 'txt' }, { label: 'Власник' }, { label: 'Валідація' }, { label: 'Частота' }], [
    ['Залишок по банку, реєстр зобов\'язань, 13-тижневий прогноз кешу', 'Альона', 'Марина', 'щотижня, середа'],
    ['Словник метрик і звірки джерел', 'Артём (CLUST) + Катя', 'Марина', 'щомісяця'],
    ['Виправлення вітрин FD і матеріалів борду', 'Альона', 'Артём', 'до 10.10'],
    ['Знижки + маркетинг на замовлення', 'Олексій', 'Артём', 'щотижня, п\'ятниця'],
    ['Закупівлі під кеш: PO List, S&OP, план платежів по SKU', 'власник закупівель (призначити)', 'Альона', 'щотижня'],
    ['Склад: залишки, від\'ємні залишки, строки', 'фулфілмент', 'закупівлі', 'щодня'],
    ['B2B: дебіторка, ліміти, ретро-бонуси', 'Ліна', 'Альона', 'щотижня'],
    ['Цей знімок: SQL, збірка, публікація', 'Claude (авто) + аналітик', 'CEO', '1-ше число'],
    ['Пороги і план у data/targets.json, data/plan.json', 'CLUST', 'Борд', 'за рішенням Борду']
  ].map(r => ({ cells: r.map(t => ({ text: t })) })));
}
