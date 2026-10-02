
/* ================= 4 · АПСЕЙЛ ================= */
const LOC_L = { cart: 'Кошик', product: 'Картка товару', search: 'Пошук', 'n/a': 'Без місця' };
function renderUpsell() {
  const ym = YM(), pm = PM(), u = oneM('b4a_upsell_monthly', ym), up = pm ? oneM('b4a_upsell_monthly', pm) : null;
  const share = div(u.with_any_upsell, u.orders), shareP = up ? div(up.with_any_upsell, up.orders) : null;
  const sum = u.upsell_online_uah + u.upsell_manager_uah, sumP = up ? up.upsell_online_uah + up.upsell_manager_uah : null;
  const reco = byM('b3a_atc_place_monthly', ym).filter(r => r.atc_place.startsWith('reco_'));
  const recoRate = div(sumBy(reco, 'purchased_7d'), sumBy(reco, 'atc_items'));
  const W = byM('b4b_upsell_widget_monthly', ym);
  const ws = (ev, loc) => sumBy(W.filter(r => r.event_name === ev && (loc == null || r.location === loc)), 'sessions');
  document.getElementById('up-tiles').innerHTML = [
    tile({ label: `Успішні замовлення з апсейлом · ${mlbl(ym)}`, value: fmt.pct(share), hint: `менеджер ${fmt.pct(div(u.with_upsell_manager, u.orders))} · онлайн ${fmt.pct(div(u.with_upsell_online, u.orders))} · з подарунком ${fmt.pct(div(u.with_gift, u.orders))}`, deltas: [dl('до попер. місяця', pp(dPct(share, shareP)), good(dPct(share, shareP), 'up'))] }),
    tile({ label: 'Сума апсейлу', value: fmt.uahM(sum), hint: `${fmt.pct(div(sum, u.revenue_uah))} виручки успішних · менеджер ${fmt.uahM(u.upsell_manager_uah)}, онлайн ${fmt.uahM(u.upsell_online_uah)}`, deltas: [dl('до попер. місяця', ps(rel(sum, sumP)), good(rel(sum, sumP), 'up'))] }),
    tile({ label: 'Середній чек з апсейлом / без', value: `${fmt.uah0(u.aov_with_upsell)}<small>/ ${fmt.uah0(u.aov_without_upsell)}</small>`, hint: `різниця ${fmt.uah0(u.aov_with_upsell - u.aov_without_upsell)} · UPO ${fmt.n2(u.upo_with_upsell)} проти ${fmt.n2(u.upo_without_upsell)}` }),
    tile({ label: 'Віджет рекомендацій', value: fmt.pct(div(ws('upsell_add_product'), ws('upsell_select_product'))), hint: `клік → додавання · показів ${fmt.int(ws('upsell'))} сесій, кліків ${fmt.int(ws('upsell_select_product'))}, додавань ${fmt.int(ws('upsell_add_product'))} · куплено за 7 дн. ${fmt.pct(recoRate)}` })
  ].join('');
  const U = T.b4a_upsell_monthly;
  barChart(document.getElementById('up-month'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: [{ name: 'Апсейл менеджера', color: C.s2, values: MONTHS.map(m => { const r = oneM('b4a_upsell_monthly', m); return r ? div(r.with_upsell_manager, r.orders) : null; }) }, { name: 'Апсейл онлайн', color: C.s1, values: MONTHS.map(m => { const r = oneM('b4a_upsell_monthly', m); return r ? div(r.with_upsell_online, r.orders) : null; }) }], fmt: (v, t) => t ? fmt.pct0(v) : fmt.pct(v), extra: k => { const r = U[k]; return r ? `<div class="r"><i></i><em>Сума апсейлу</em><b>${fmt.uahM(r.upsell_online_uah + r.upsell_manager_uah)}</b></div><div class="r"><i></i><em>Замовлень</em><b>${fmt.int(r.orders)}</b></div>` : ''; } });
  legend(document.getElementById('up-month-legend'), [{ name: 'З апсейлом менеджера (кол-центр)', color: C.s2, box: true }, { name: 'З апсейлом онлайн (сайт)', color: C.s1, box: true }]);
  document.getElementById('up-widget-h').textContent = `Віджет рекомендацій · ${mname(ym)}`;
  funnel(document.getElementById('up-widget'), [{ name: 'Показ віджета', value: ws('upsell') }, { name: 'Клік по товару', value: ws('upsell_select_product') }, { name: 'Додавання в кошик', value: ws('upsell_add_product'), color: C.acc }]);
  document.getElementById('up-widget').insertAdjacentHTML('beforeend', `<div class="pill-row">${['cart', 'product', 'search'].map(l => `<span class="pill">${LOC_L[l]}: клік ${fmt.int(ws('upsell_select_product', l))} → додавання <b>${fmt.int(ws('upsell_add_product', l))}</b>${div(ws('upsell_add_product', l), ws('upsell_select_product', l)) > 1 ? ' · додають без кліку по картці' : ' (' + fmt.pct0(div(ws('upsell_add_product', l), ws('upsell_select_product', l))) + ')'}</span>`).join('')}</div>`);
  lineChart(document.getElementById('up-aov'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), series: [{ name: 'Чек з апсейлом', color: C.s2, values: MONTHS.map(m => (oneM('b4a_upsell_monthly', m) || {}).aov_with_upsell) }, { name: 'Чек без апсейлу', color: C.s1, values: MONTHS.map(m => (oneM('b4a_upsell_monthly', m) || {}).aov_without_upsell) }], fmt: (v, t) => t ? fmt.k(v) + ' тис.' : fmt.uah0(v), ymin0: true });
  legend(document.getElementById('up-aov-legend'), [{ name: 'Середній чек з апсейлом', color: C.s2 }, { name: 'Без апсейлу', color: C.s1 }]);
  const CR = T.b4c_cancel_reasons_q3;
  const cols = [th('Причина'), th('Лип'), th('Сер'), th('Вер'), th('Разом'), th('Наложка'), th('Передоплата')];
  const rows = [];
  ['canceled', 'refused'].forEach(g => { rows.push({ section: g === 'canceled' ? 'Скасовані до відправки (Canceled)' : 'Відмови при отриманні (Terminated)' }); CR.filter(r => r.stage_group === g).forEach(r => rows.push({ cells: [{ text: r.reason }, { text: fmt.int(r.jul) }, { text: fmt.int(r.aug) }, { text: fmt.int(r.sep) }, { text: fmt.int(r.total) }, { text: fmt.pct0(div(r.cod, r.total)) }, { text: fmt.pct0(div(r.prepaid, r.total)) }] })); });
  document.getElementById('up-cancel').innerHTML = tableHTML(cols, rows);
}

/* ================= 5 · ОПЛАТИ ================= */
const OC_L = { pdp: 'Картка товару', checkout: 'Кошик / чекаут', home: 'Головна', catalog: 'Каталог', category: 'Категорія', blog: 'Блог', 'n/a': 'Невідомо' };
function renderPay() {
  const ym = YM(), pm = PM(), p = oneM('b5b_payments_monthly', ym), pp_ = pm ? oneM('b5b_payments_monthly', pm) : null;
  const o = oneM('b5c_one_click_monthly', ym), op = pm ? oneM('b5c_one_click_monthly', pm) : null;
  const c = oneM('b5d_carts_monthly', ym), cp = pm ? oneM('b5d_carts_monthly', pm) : null;
  const first = div(p.approved_first, p.online_orders), firstP = pp_ ? div(pp_.approved_first, pp_.online_orders) : null;
  const failed = div(p.failed_only, p.online_orders), failedP = pp_ ? div(pp_.failed_only, pp_.online_orders) : null;
  const resc = div(p.rescued, p.with_any_fail), rescP = pp_ ? div(pp_.rescued, pp_.with_any_fail) : null;
  const reach = div(o.reached, o.requests), reachP = op ? div(op.reached, op.requests) : null;
  const ab = div(c.abandoned_7d, c.carts), abP = cp ? div(cp.abandoned_7d, cp.carts) : null;
  document.getElementById('pa-tiles').innerHTML = [
    tile({ label: `Онлайн-замовлення · ${mlbl(ym)}`, value: fmt.int(p.online_orders), hint: `передоплата або змішана схема · у середньому ${fmt.n2(p.avg_attempts)} спроб на замовлення зі спробою` }),
    tile({ label: 'Оплачено з першої спроби', value: fmt.pct(first), hint: `після невдалої ${fmt.pct(div(p.approved_after_fail, p.online_orders))} · без спроби у WFP ${fmt.pct(div(p.no_attempt, p.online_orders))}`, deltas: [dl('до попер. місяця', pp(dPct(first, firstP)), good(dPct(first, firstP), 'up'))] }),
    tile({ label: 'Лише невдалі спроби', value: fmt.pct(failed), hint: `${fmt.int(p.failed_only)} замовлень · з них скасовано ${fmt.int(p.failed_canceled)}, доставлено (переведено на наложку) ${fmt.int(p.failed_went_through)}`, deltas: [dl('до попер. місяця', pp(dPct(failed, failedP)), good(dPct(failed, failedP), 'down'))] }),
    tile({ label: 'Врятовано після невдалої спроби', value: fmt.pct(resc), hint: `${fmt.int(p.rescued)} з ${fmt.int(p.with_any_fail)} · контакт КЦ ${fmt.int(p.cc_contacted)}, тригер eSputnik ${fmt.int(p.esputnik)} · втрачено ${fmt.uahM(p.lost_billed_uah)}`, deltas: [dl('до попер. місяця', pp(dPct(resc, rescP)), good(dPct(resc, rescP), 'up'))] }),
    tile({ label: 'Заявки «купити в 1 клік»', value: fmt.int(o.requests), hint: `успішних ${fmt.pct0(div(o.successful, o.requests))} · скасовано ${fmt.pct0(div(o.canceled, o.requests))} · наложка ${fmt.pct0(div(o.cod, o.requests))} · нових клієнтів ${fmt.pct0(div(o.new_customers, o.requests))}`, deltas: [dl('до попер. місяця', ps(rel(o.requests, op && op.requests)), 'neutral')] }),
    tile({ label: 'Додзвон за 48 годин', value: fmt.pct(reach), hint: `дзвонили ${fmt.pct0(div(o.called, o.requests))} заявок · медіана до першого дзвінка ${fmt.int(o.median_min_to_call)} хв`, deltas: [dl('до попер. місяця', pp(dPct(reach, reachP)), good(dPct(reach, reachP), 'up'))] }),
    tile({ label: 'Покинуті кошики за 7 днів', value: fmt.pct(ab), hint: `${fmt.int(c.abandoned_7d)} з ${fmt.int(c.carts)} · з відомим контактом ${fmt.int(c.abandoned_with_contact)} · після початку оформлення ${fmt.int(c.abandoned_after_checkout)}`, deltas: [dl('до попер. місяця', pp(dPct(ab, abP)), good(dPct(ab, abP), 'down'))] }),
    tile({ label: 'Вартість покинутих кошиків', value: fmt.uahM(c.abandoned_value_uah), hint: `середній покинутий ${fmt.uah0(c.avg_abandoned_value_uah)} · вище порогу доставки ${fmt.pct0(div(c.abandoned_above_threshold, c.abandoned_7d))}` })
  ].join('');
  const P = T.b5b_payments_monthly;
  const sh = k => MONTHS.map(m => { const r = oneM('b5b_payments_monthly', m); return r ? div(r[k], r.online_orders) : null; });
  barChart(document.getElementById('pa-outcome'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: [{ name: 'З першої спроби', color: C.s3, values: sh('approved_first') }, { name: 'Після невдалої', color: C.s4, values: sh('approved_after_fail') }, { name: 'Лише невдалі', color: C.crit, values: sh('failed_only') }, { name: 'Без спроби', color: C.ly, values: sh('no_attempt') }], fmt: (v, t) => t ? fmt.pct0(v) : fmt.pct(v), extra: k => { const r = P[k]; return r ? `<div class="r"><i></i><em>Онлайн-замовлень</em><b>${fmt.int(r.online_orders)}</b></div><div class="r"><i></i><em>Врятовано</em><b>${fmt.int(r.rescued)} (${fmt.pct0(div(r.rescued, r.with_any_fail))})</b></div>` : ''; } });
  legend(document.getElementById('pa-outcome-legend'), [{ name: 'З першої спроби', color: C.s3, box: true }, { name: 'Оплачено після невдалої', color: C.s4, box: true }, { name: 'Лише невдалі', color: C.crit, box: true }, { name: 'Без спроби у WayForPay', color: C.ly, box: true }]);
  const R = T.b5b2_fail_reasons_q3.filter(r => r.attempts >= 10);
  document.getElementById('pa-reasons').innerHTML = tableHTML([th('Причина (WayForPay)'), th('Статус'), th('Спроб'), th('Замовлень'), th('Частка спроб')], R.map(r => ({ cells: [{ text: r.reason_message + (r.reason_code ? ' · ' + r.reason_code : '') }, { text: r.status }, { text: fmt.int(r.attempts) }, { text: fmt.int(r.orders) }, { text: fmt.pct(r.share_attempts) }] })));
  const O = T.b5c_one_click_monthly, ov = k => MONTHS.map(m => (oneM('b5c_one_click_monthly', m) || {})[k] ?? null);
  barChart(document.getElementById('pa-oneclick'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: [{ name: 'Успішні', color: C.s3, values: ov('successful') }, { name: 'У доставці', color: C.s4, values: ov('in_progress') }, { name: 'Скасовані', color: C.ly, values: ov('canceled') }, { name: 'Відмови', color: C.crit, values: ov('refused') }], line: { name: 'Додзвонилися за 48 год', color: C.s1, values: ov('reached') }, fmt: fmt.int, extra: k => { const r = O[k]; return r ? `<div class="r"><i></i><em>Медіана до дзвінка</em><b>${fmt.int(r.median_min_to_call)} хв</b></div>` : ''; } });
  legend(document.getElementById('pa-oneclick-legend'), [{ name: 'Успішні', color: C.s3, box: true }, { name: 'У доставці', color: C.s4, box: true }, { name: 'Скасовані', color: C.ly, box: true }, { name: 'Відмови', color: C.crit, box: true }, { name: 'Додзвонилися', color: C.s1 }]);
  pills(document.getElementById('pa-oneclick-pills'), [[`${mlbl(ym)} · успішних`, fmt.pct0(div(o.successful, o.requests))], ['виручка успішних', fmt.uahM(o.billed_successful)], ['середній чек', fmt.uah0(div(o.billed_successful, o.successful))], ['нові клієнти', fmt.pct0(div(o.new_customers, o.requests))]]);
  const OCP = ['pdp', 'home', 'catalog', 'category', 'checkout', 'blog'], OCC = { pdp: C.s1, home: C.s5, catalog: C.s3, category: C.s2, checkout: C.acc, blog: C.ly };
  barChart(document.getElementById('pa-ocplace'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: OCP.map(k => ({ name: OC_L[k], color: OCC[k], values: MONTHS.map(m => { const r = byM('b5c2_one_click_places_monthly', m).find(x => x.click_place === k); return r ? r.events : 0; }) })), fmt: fmt.int });
  legend(document.getElementById('pa-ocplace-legend'), OCP.map(k => ({ name: OC_L[k], color: OCC[k], box: true })));
  const Cc = T.b5d_carts_monthly, cv = fn => MONTHS.map(m => { const r = oneM('b5d_carts_monthly', m); return r ? fn(r) : null; });
  barChart(document.getElementById('pa-carts'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: [{ name: 'Купили за 7 днів', color: C.s3, values: cv(r => r.carts - r.abandoned_7d) }, { name: 'Покинули', color: C.s2, values: cv(r => r.abandoned_7d) }], fmt: (v, t) => t ? fmt.k0(v) + ' тис.' : fmt.int(v), extra: k => { const r = Cc[k]; return r ? `<div class="r"><i></i><em>Покинуто</em><b>${fmt.pct(div(r.abandoned_7d, r.carts))}</b></div><div class="r"><i></i><em>З контактом</em><b>${fmt.int(r.abandoned_with_contact)}</b></div><div class="r"><i></i><em>Вартість покинутих</em><b>${fmt.uahM(r.abandoned_value_uah)}</b></div>` : ''; } });
  legend(document.getElementById('pa-carts-legend'), [{ name: 'Кошики з покупкою за 7 днів', color: C.s3, box: true }, { name: 'Покинуті', color: C.s2, box: true }]);
  barChart(document.getElementById('pa-thr'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: [{ name: 'Вище порогу', color: C.s1, values: cv(r => div(r.above_threshold, r.with_value)) }, { name: 'Нижче порогу', color: C.ly, values: cv(r => 1 - div(r.above_threshold, r.with_value)) }], fmt: (v, t) => t ? fmt.pct0(v) : fmt.pct(v), extra: k => { const r = Cc[k]; return r ? `<div class="r"><i></i><em>Середній кошик</em><b>${fmt.uah0(r.avg_cart_value_uah)}</b></div><div class="r"><i></i><em>Покинуті вище порогу</em><b>${fmt.int(r.abandoned_above_threshold)}</b></div>` : ''; } });
  legend(document.getElementById('pa-thr-legend'), [{ name: 'Кошик ≥ порогу безкоштовної доставки', color: C.s1, box: true }, { name: 'Нижче порогу', color: C.ly, box: true }]);
  pills(document.getElementById('pa-thr-pills'), [[`${mlbl(ym)} · середній кошик`, fmt.uah0(c.avg_cart_value_uah)], ['позицій у кошику', fmt.n2(c.avg_cart_lines)], ['покинуто нижче порогу', fmt.int(c.abandoned_below_threshold)], ['покинуто вище порогу', fmt.int(c.abandoned_above_threshold)]]);
}

/* ================= 6 · СКЛАД ЧЕКА ================= */
function renderStruct() {
  const ym = YM(), pm = PM(), s = oneM('b6a_order_structure_monthly', ym), sp_ = pm ? oneM('b6a_order_structure_monthly', pm) : null;
  const single = div(s.lines_1, s.orders), singleP = sp_ ? div(sp_.lines_1, sp_.orders) : null;
  const three = div(s.lines_3 + s.lines_4plus, s.orders), threeP = sp_ ? div(sp_.lines_3 + sp_.lines_4plus, sp_.orders) : null;
  const qty = div(s.with_qty_gt1, s.orders), qtyP = sp_ ? div(sp_.with_qty_gt1, sp_.orders) : null;
  document.getElementById('st-tiles').innerHTML = [
    tile({ label: `Одна позиція в чеку · ${mlbl(ym)}`, value: fmt.pct(single), hint: `середній чек таких замовлень ${fmt.uah0(s.aov_lines_1)}`, deltas: [dl('до попер. місяця', pp(dPct(single, singleP)), good(dPct(single, singleP), 'down'))] }),
    tile({ label: 'Три і більше позицій', value: fmt.pct(three), hint: `середній чек ${fmt.uah0(s.aov_lines_3plus)} · дві позиції ${fmt.pct(div(s.lines_2, s.orders))} (${fmt.uah0(s.aov_lines_2)})`, deltas: [dl('до попер. місяця', pp(dPct(three, threeP)), good(dPct(three, threeP), 'up'))] }),
    tile({ label: 'Кількість > 1 хоча б по одному SKU', value: fmt.pct(qty), hint: `UPO ${fmt.n2(s.upo)} · наборів (Complexes) ${fmt.pct(div(s.with_bundle, s.orders))}`, deltas: [dl('до попер. місяця', pp(dPct(qty, qtyP)), good(dPct(qty, qtyP), 'up'))] }),
    tile({ label: 'З подарунком · зі знижкою', value: `${fmt.pct(div(s.with_gift, s.orders))}<small>· ${fmt.pct0(div(s.with_discount, s.orders))}</small>`, hint: 'подарунок — рядок інвойсу Gift; знижка — відсоток або сума знижки по рядку' })
  ].join('');
  const sv = k => MONTHS.map(m => { const r = oneM('b6a_order_structure_monthly', m); return r ? div(r[k], r.orders) : null; });
  barChart(document.getElementById('st-lines'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: [{ name: '1 позиція', color: C.ly, values: sv('lines_1') }, { name: '2 позиції', color: C.s1, values: sv('lines_2') }, { name: '3 позиції', color: C.s3, values: sv('lines_3') }, { name: '4 і більше', color: C.s6, values: sv('lines_4plus') }], fmt: (v, t) => t ? fmt.pct0(v) : fmt.pct(v) });
  legend(document.getElementById('st-lines-legend'), [{ name: '1 позиція', color: C.ly, box: true }, { name: '2', color: C.s1, box: true }, { name: '3', color: C.s3, box: true }, { name: '4+', color: C.s6, box: true }]);
  lineChart(document.getElementById('st-aov'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), series: [{ name: '1 позиція', color: C.ly, values: MONTHS.map(m => (oneM('b6a_order_structure_monthly', m) || {}).aov_lines_1) }, { name: '2 позиції', color: C.s1, values: MONTHS.map(m => (oneM('b6a_order_structure_monthly', m) || {}).aov_lines_2) }, { name: '3 і більше', color: C.s6, values: MONTHS.map(m => (oneM('b6a_order_structure_monthly', m) || {}).aov_lines_3plus) }], fmt: (v, t) => t ? fmt.k(v) + ' тис.' : fmt.uah0(v), ymin0: true });
  legend(document.getElementById('st-aov-legend'), [{ name: '1 позиція', color: C.ly }, { name: '2 позиції', color: C.s1 }, { name: '3 і більше', color: C.s6 }]);
  const short = n => n.replace(/^UA /, '').replace(/Дієтична добавка Комплекс ''(.*)''/, '$1');
  document.getElementById('st-pairs').innerHTML = tableHTML([th('Товар A'), th('Товар B'), th('Разом'), th('P(B|A)'), th('Lift')], T.b6b_product_pairs_q3.map(r => ({ cells: [{ text: short(r.product_a) }, { html: `<span class="txt" style="white-space:normal">${esc(short(r.product_b))}</span>` }, { text: fmt.int(r.pair_orders) }, { text: fmt.pct0(r.p_b_given_a) }, { text: fmt.n2(r.lift), cls: r.lift >= 1.5 ? 'okc' : r.lift < 0.9 ? 'watch' : '' }] })));
  document.getElementById('st-attach').innerHTML = tableHTML([th('Товар'), th('Замовлень'), th('Сам у чеку'), th('Позицій поруч'), th('Сер. чек'), th('Як апсейл'), th('К-сть > 1')], T.b6c_product_attach_sept.filter(r => r.product_type !== 'Services' && r.as_gift < r.orders / 2).slice(0, 30).map(r => ({ cells: [{ text: short(r.product) }, { text: fmt.int(r.orders) }, { text: fmt.pct0(div(r.alone_orders, r.orders)) }, { text: fmt.n2(r.avg_lines_with) }, { text: fmt.uah0(r.avg_order_value_uah) }, { text: fmt.int(r.as_upsell) }, { text: fmt.pct0(div(r.qty_gt1, r.orders)) }] })));
}
