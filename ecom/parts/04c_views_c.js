
/* ================= 7–8 · КЛІЄНТИ ================= */
function renderCust() {
  const ym = YM(), pm = PM();
  const nr = byM('b7_new_repeat_monthly', ym), n = nr.find(r => r.ctype === 'new') || {}, r = nr.find(x => x.ctype === 'repeat') || {};
  const nrp = pm ? byM('b7_new_repeat_monthly', pm) : [], np = nrp.find(x => x.ctype === 'new') || {}, rp = nrp.find(x => x.ctype === 'repeat') || {};
  const newShare = div(n.orders, (n.orders || 0) + (r.orders || 0)), newShareP = pm ? div(np.orders, (np.orders || 0) + (rp.orders || 0)) : null;
  const CO = T.b8a_first_product_cohorts, wsum = sumBy(CO, 'customers'), rep90 = div(CO.reduce((a, x) => a + x.repeat_90 * x.customers, 0), wsum), rep180 = div(CO.reduce((a, x) => a + (x.repeat_180_q1 || 0) * x.customers, 0), wsum);
  document.getElementById('cu-tiles').innerHTML = [
    tile({ label: `Нові клієнти серед успішних · ${mlbl(ym)}`, value: fmt.pct(newShare), hint: `${fmt.int(n.orders)} перших замовлень · ${fmt.int(r.orders)} повторних`, deltas: [dl('до попер. місяця', pp(dPct(newShare, newShareP)), 'neutral')] }),
    tile({ label: 'Середній чек: нові / постійні', value: `${fmt.uah0(n.aov)}<small>/ ${fmt.uah0(r.aov)}</small>`, hint: `апсейл у нових ${fmt.pct(div(n.upsell_uah, n.revenue_uah))}, у постійних ${fmt.pct(div(r.upsell_uah, r.revenue_uah))}` }),
    tile({ label: 'UPO: нові / постійні', value: `${fmt.n2(n.upo)}<small>/ ${fmt.n2(r.upo)}</small>`, hint: `одна позиція: нові ${fmt.pct0(div(n.single_line, n.orders))}, постійні ${fmt.pct0(div(r.single_line, r.orders))}` }),
    tile({ label: 'Повтор за 90 днів', value: fmt.pct(rep90), hint: `когорта перших замовлень січень–червень 2026, зважено за товарами першої покупки · за 180 днів (Q1) ${fmt.pct(rep180)}` })
  ].join('');
  const cv = (t, k) => MONTHS.map(m => (byM('b7_new_repeat_monthly', m).find(x => x.ctype === t) || {})[k] ?? null);
  barChart(document.getElementById('cu-month'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), stacked: true, series: [{ name: 'Нові клієнти', color: C.s1, values: cv('new', 'orders') }, { name: 'Постійні', color: C.s6, values: cv('repeat', 'orders') }], fmt: (v, t) => t ? fmt.k0(v) + ' тис.' : fmt.int(v), extra: k => { const a = byM('b7_new_repeat_monthly', MONTHS[k]); const nn = a.find(x => x.ctype === 'new') || {}, rr = a.find(x => x.ctype === 'repeat') || {}; return `<div class="r"><i></i><em>Частка нових</em><b>${fmt.pct(div(nn.orders, (nn.orders || 0) + (rr.orders || 0)))}</b></div><div class="r"><i></i><em>Виручка нових</em><b>${fmt.uahM(nn.revenue_uah)}</b></div><div class="r"><i></i><em>Виручка постійних</em><b>${fmt.uahM(rr.revenue_uah)}</b></div>`; } });
  legend(document.getElementById('cu-month-legend'), [{ name: 'Перше замовлення клієнта', color: C.s1, box: true }, { name: 'Повторне', color: C.s6, box: true }]);
  lineChart(document.getElementById('cu-aov'), { labels: MONTHS.map(mlbl), tipLabels: MONTHS.map(mname), series: [{ name: 'Чек нових', color: C.s1, values: cv('new', 'aov') }, { name: 'Чек постійних', color: C.s6, values: cv('repeat', 'aov') }], fmt: (v, t) => t ? fmt.k(v) + ' тис.' : fmt.uah0(v), ymin0: true });
  legend(document.getElementById('cu-aov-legend'), [{ name: 'Середній чек нових', color: C.s1 }, { name: 'Постійних', color: C.s6 }]);
  const short = s => s.replace(/^UA /, '');
  rowsChart(document.getElementById('cu-rep'), { rows: CO.slice(0, 20).map(x => ({ name: short(x.first_product), value: x.repeat_90, share: x.repeat_90, extra: fmt.int(x.customers) + ' клієнтів', color: C.s1 })).sort((a, b) => b.value - a.value), fmt: fmt.pct, ref: { share: rep90, label: 'середнє ' + fmt.pct(rep90) } });
  const TR = T.b8b_first_to_second_product;
  document.getElementById('cu-trans').innerHTML = tableHTML([th('Перша покупка'), th('Друга покупка'), th('Клієнтів'), th('Частка')], TR.slice(0, 32).map(x => ({ cells: [{ text: short(x.first_product) }, { html: `<span style="white-space:normal">${esc(short(x.second_product))}${x.same_product ? ' <span class="chip ok"><i aria-hidden="true">↻</i>той самий</span>' : ''}</span>` }, { text: fmt.int(x.customers) }, { text: fmt.pct0(x.share) }] })));
}

/* ================= DQ · ДАНІ ================= */
function renderData() {
  const D = S.defs;
  document.getElementById('dq-table').innerHTML = tableHTML([th('Тиждень з'), th('Zoho створені'), th('Zoho успішні'), th('GA4 покупки'), th('Zoho ↔ GA4'), th('Cookie GA у Zoho'), th('WFP схвалено'), th('WFP ↔ Zoho')],
    T.dq_weekly_links.map(w => ({ cells: [{ text: fmt.date(w.week_start) }, { text: fmt.int(w.zoho_created) }, { text: fmt.int(w.zoho_successful) }, { text: fmt.int(w.ga_transactions) }, { text: fmt.pct0(div(w.zoho_linked_ga, w.zoho_orders)), cls: div(w.zoho_linked_ga, w.zoho_orders) < 0.75 ? 'watch' : '' }, { text: fmt.pct0(div(w.zoho_with_ga_cookie, w.zoho_orders)) }, { text: fmt.int(w.wfp_approved) }, { text: fmt.pct0(div(w.wfp_linked, w.wfp_attempts)) }] })));
  document.getElementById('dq-notes').innerHTML = D.dq_notes.map(t => `<li>${esc(t)}</li>`).join('');
  document.getElementById('defs').innerHTML = D.definitions.map(d => `<div class="d"><b>${esc(d.term)}</b><span>${esc(d.def)}</span><span class="src">${esc(d.src)}</span></div>`).join('');
  document.getElementById('decisions').innerHTML = D.decisions.map(d => `<li>${chip({ cls: 'watch', label: 'до ' + fmt.dm(d.due), icon: '!' })}<span>${esc(d.text)}</span><span class="who">${esc(d.owner)}</span></li>`).join('');
  document.getElementById('tracking').innerHTML = D.tracking.map(t => `<li><span class="pri ${t.p === 'P2' ? 'p2' : t.p === 'P3' ? 'p3' : ''}">${t.p}</span>${esc(t.text)}</li>`).join('');
  document.getElementById('howto').innerHTML = D.howto.map(t => `<li>${esc(t)}</li>`).join('');
  document.getElementById('sql-list').innerHTML = Object.keys(SQL).sort().map(k => `<details class="sqlbox"><summary>${esc(k)}</summary><pre>${esc(SQL[k])}</pre></details>`).join('');
}

/* ================= init ================= */
function renderAll() {
  renderMeta();
  renderOverview(); renderEntry(); renderCart(); renderUpsell(); renderPay(); renderStruct(); renderCust();
}
renderData();
setView(view, false);
renderAll();
})();
</script>
