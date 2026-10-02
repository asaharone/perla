<script>
(function () {
'use strict';
const S = JSON.parse(document.getElementById('data').textContent);
const SQL = JSON.parse(document.getElementById('sql').textContent);
const M = S.months, T = S.targets, PL = S.plan, LY = S.ly, MAN = S.manual;
const MS = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
const MN = ['січень','лютий','березень','квітень','травень','червень','липень','серпень','вересень','жовтень','листопад','грудень'];
const MG = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const YEAR = +M[0].month.slice(0, 4);
const mi = f => +f.month.slice(5, 7) - 1;
const MINUS = '−';
const cap = s => s[0].toUpperCase() + s.slice(1);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- formatting ---------- */
const grp = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const dec = (v, d) => { const [a, b] = Math.abs(v).toFixed(d).split('.'); return grp(a) + (b ? ',' + b : ''); };
const sg = v => (v < 0 ? MINUS : '');
const fmt = {
  usd: v => v == null ? '—' : sg(v) + '$' + (Math.abs(v) >= 1e6 ? dec(v / 1e6, 2) + 'M' : Math.abs(v) >= 1e3 ? dec(v / 1e3, 1) + 'k' : dec(v, 0)),
  k: v => v == null ? '—' : sg(v) + dec(v / 1e3, 1),
  k0: v => v == null ? '—' : sg(v) + dec(v / 1e3, 0),
  usd2: v => v == null ? '—' : sg(v) + '$' + dec(v, 2),
  usd0: v => v == null ? '—' : sg(v) + '$' + dec(v, 0),
  int: v => v == null ? '—' : sg(v) + dec(v, 0),
  pct: v => v == null ? '—' : sg(v) + dec(v * 100, 1) + '%',
  pct0: v => v == null ? '—' : sg(v) + dec(v * 100, 0) + '%',
  x: v => v == null ? '—' : sg(v) + dec(v, 2) + 'x',
  days: v => v == null ? '—' : dec(v, 0) + ' дн.',
  uah: v => v == null ? '—' : sg(v) + dec(v / 1e6, 1) + ' млн грн',
  date: s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '—',
  dm: s => s ? s.slice(8, 10) + '.' + s.slice(5, 7) : '—'
};
const ps = d => d == null ? '—' : (d > 0 ? '+' : d < 0 ? MINUS : '±') + dec(d * 100, 1) + '%';
const pp = d => d == null ? '—' : (d > 0 ? '+' : d < 0 ? MINUS : '±') + dec(d * 100, 1) + ' п.п.';
const pusd = d => d == null ? '—' : (d > 0 ? '+' : d < 0 ? MINUS : '±') + fmt.usd(Math.abs(d));
const px = d => d == null ? '—' : (d > 0 ? '+' : d < 0 ? MINUS : '±') + dec(Math.abs(d), 2) + 'x';
const rel = (a, b) => (a == null || b == null || !b) ? null : a / b - 1;
const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

/* ---------- plan, status, scale rule ---------- */
function planAt(m) {
  const rf = PL.rf, b = PL.budget;
  if (rf.revenue[m] != null) return { src: 'RF CLUST', to: 'до RF', revenue: rf.revenue[m], orders: rf.orders[m], marketing: rf.marketing[m] };
  return { src: 'бюджет 2026', to: 'до бюджету', revenue: b.revenue[m], orders: b.orders[m], marketing: b.marketing[m] };
}
const limitAt = f => (PL.limit || {})[f.month] || null;
function st(kind, v) {
  if (v == null) return null;
  const S_ = (cls, label) => ({ cls, label, icon: cls === 'ok' ? '✓' : cls === 'watch' ? '!' : '✕' });
  switch (kind) {
    case 'mkt_share': return v <= T.mkt_share_b2c ? S_('ok', 'у нормі') : v <= T.mkt_share_b2c + 0.03 ? S_('watch', 'увага') : S_('alert', 'вище орієнтиру');
    case 'cpo': return v <= T.cpo ? S_('ok', 'у нормі') : v <= T.cpo * 1.1 ? S_('watch', 'увага') : S_('alert', 'вище цілі');
    case 'nc': return v >= T.nc_watch ? S_('ok', 'у нормі') : v >= T.nc_alert ? S_('watch', 'увага') : S_('alert', 'нижче тригера');
    case 'disc': return v <= T.discount ? S_('ok', 'у плані') : v <= T.discount + 0.05 ? S_('watch', 'вище плану') : S_('alert', 'вище плану');
    case 'cm3': return v >= T.cm3_share ? S_('ok', 'у нормі') : v >= T.cm3_share - 0.05 ? S_('watch', 'увага') : S_('alert', 'нижче цілі');
    case 'cac': return v <= T.cac ? S_('ok', 'у нормі') : v <= T.cac * 1.25 ? S_('watch', 'увага') : S_('alert', 'вище цілі');
    case 'rep90': return v >= T.rep90 ? S_('ok', 'у нормі') : v >= T.rep90 - 0.05 ? S_('watch', 'увага') : S_('alert', 'нижче орієнтиру');
    case 'dso': return v <= T.dso ? S_('ok', 'у нормі') : v <= T.dso * 1.2 ? S_('watch', 'увага') : S_('alert', 'вище цілі');
    case 'overdue': return v <= T.overdue ? S_('ok', 'у нормі') : v <= T.overdue * 1.5 ? S_('watch', 'увага') : S_('alert', 'вище KPI');
    case 'limit': return v <= 1 ? S_('ok', 'у ліміті') : v <= 1.05 ? S_('watch', 'на межі') : S_('alert', 'понад ліміт');
  }
  return null;
}
const chip = s => s ? `<span class="chip ${s.cls}"><i aria-hidden="true">${s.icon}</i>${s.label}</span>` : '';
const chipNa = label => `<span class="chip na"><i aria-hidden="true">?</i>${label}</span>`;
const cellCls = s => !s ? '' : s.cls === 'ok' ? 'okc' : s.cls === 'watch' ? 'watch' : 'bad';
const sevOrder = { alert: 0, watch: 1, ok: 2, na: 3 };

function scaleRule(i) {
  const f = M[i], p = M[i - 1];
  const r = f.nc_total_per_mkt, s = st('nc', r);
  let inc = null, dM = null, dNC = null;
  if (p) { dM = f.marketing - p.marketing; dNC = f.nc_total - p.nc_total; if (dM > 0) inc = dNC / dM; }
  const allowed = r >= T.nc_watch && (inc == null || inc >= 1);
  return { st: s, r, inc, dM, dNC, allowed };
}
function verdictScale(i) {
  const f = M[i], m = mi(f), nx = (m + 1) % 12, R = scaleRule(i);
  const head = R.allowed
    ? `Бюджет ${MG[nx]} можна збільшувати: NC / маркетинг ${fmt.x(R.r)} ≥ 2,5x`
    : `Бюджет ${MG[nx]} — не вище рівня ${MG[m]} (${fmt.usd(f.marketing)}): NC / маркетинг ${fmt.x(R.r)} при тригері 2,5x`;
  let incTxt;
  if (R.dM == null) incTxt = 'не рахується — немає попереднього місяця';
  else if (R.dM <= 0) incTxt = 'не рахується — бюджет знизився на ' + fmt.usd(-R.dM);
  else incTxt = dec(R.inc, 2) + ' (поріг 1,0)';
  const detail = `Правило скейлу з Board Pack: бюджет росте, лише якщо NC / маркетинг ≥ 2,5x і кожен додатковий $1 маркетингу дав ≥ $1 NC. NC на додатковий $1 маркетингу: ${incTxt}. Оцінка з BigQuery; фінальне рішення — за P&L.`;
  return { cls: R.st.cls, html: `${chip(R.st)}<p class="vt">${head}</p><p class="vd">${detail}</p>` };
}

/* ---------- state ---------- */
const CLOSED = M.filter(f => f.complete);
let sel = M.indexOf(CLOSED[CLOSED.length - 1]);
let view = 'ceo';
try { const v = localStorage.getItem('cockpit-view'); if (/^(ceo|cmo|cfo|clust|bench|flow)$/.test(v || '')) view = v; } catch (e) {}
if (/^#(ceo|cmo|cfo|clust|bench|flow)$/.test(location.hash)) view = location.hash.slice(1);
const F = () => M[sel];
const P = () => M[sel - 1] || null;
const prevLbl = () => P() ? 'до ' + MG[mi(P())] : '';
const closedUpTo = () => M.slice(0, sel + 1).filter(f => f.complete);
const lyAt = (arr, m) => (arr && arr[m] != null) ? arr[m] : null;
const custAt = ym => S.customers.find(c => c.month === ym) || null;
const utmAt = ym => S.utm.find(c => c.month === ym) || null;
const ymOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
function lastMature(key) { const arr = S.cohorts.filter(c => c[key === 'rep90' ? 'mature90' : key === 'rep180' ? 'mature180' : 'mature365']); return arr[arr.length - 1] || null; }

/* ---------- header, tabs ---------- */
const monthSel = document.getElementById('month');
M.forEach((f, i) => { const o = document.createElement('option'); o.value = i; o.textContent = cap(MN[mi(f)]) + ' ' + f.month.slice(0, 4) + (f.complete ? '' : ' · неповний'); monthSel.appendChild(o); });
monthSel.value = String(sel);
monthSel.addEventListener('change', () => { sel = +monthSel.value; renderAll(); onMonthChanged(); });
function renderMeta() {
  const f = F();
  document.getElementById('meta').innerHTML =
    `Звітний місяць: <b>${MN[mi(f)]} ${f.month.slice(0, 4)}</b>${f.complete ? '' : ' (неповний, по ' + fmt.dm(S.data_through) + ')'} · знімок ${fmt.date(S.generated)} · дані по ${fmt.date(S.data_through)} · база — дата відвантаження, USD.`;
  document.getElementById('foot-src').textContent = 'Джерело: ' + S.source + '. План — Board Pack (бюджет 2026, RF CLUST); 2025 — P&L Finance Dashboard; ручні вводи — фінанси.';
  document.getElementById('foot-targets').textContent = `Пороги CLUST: маркетинг ≤ ${fmt.pct0(T.mkt_share_b2c)} виручки B2C (${fmt.pct0(T.mkt_share_total)} від загальної), CPO ≤ ${fmt.usd0(T.cpo)}, NC / маркетинг ≥ ${dec(T.nc_watch, 1)}x, знижка ≤ ${fmt.pct0(T.discount)}, CM3 ≥ ${fmt.pct0(T.cm3_share)}, DSO ≤ ${T.dso} дн., просрочка ≤ ${fmt.pct0(T.overdue)}, кеш ≥ ${fmt.usd(T.cash_min_usd)}. На погодження Борду 22.10.`;
}
const tabs = [...document.querySelectorAll('.tab')];
function setView(v, push) {
  view = v;
  tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.v === v)));
  document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  try { localStorage.setItem('cockpit-view', v); } catch (e) {}
  if (push) { try { history.replaceState(null, '', '#' + v); } catch (e) {} }
}
tabs.forEach(t => t.addEventListener('click', () => setView(t.dataset.v, true)));
tabs.forEach((t, k) => t.addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const n = tabs[(k + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); setView(n.dataset.v, true);
}));
document.addEventListener('click', e => { const a = e.target.closest('a[data-tab]'); if (a) { e.preventDefault(); setView(a.dataset.tab, true); window.scrollTo({ top: 0 }); } });

/* ---------- tooltip ---------- */
const tipEl = document.getElementById('tip');
function showTip(html, x, y) {
  tipEl.innerHTML = html; tipEl.hidden = false;
  const r = tipEl.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
  tipEl.style.left = Math.max(8, left) + 'px'; tipEl.style.top = Math.max(8, top) + 'px';
}
function hideTip() { tipEl.hidden = true; }

/* ---------- charts (SVG) ---------- */
const NS = 'http://www.w3.org/2000/svg';
function niceTicks(lo, hi, n) {
  if (hi === lo) { hi = lo + 1; }
  const span = hi - lo, raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const cand = [1, 2, 2.5, 5, 10].map(c => c * p);
  const step = cand.find(c => c >= raw) || cand[cand.length - 1];
  const t0 = Math.ceil(lo / step) * step, out = [];
  for (let v = t0; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
function spark(vals, target) {
  const v = vals.filter(x => x != null); if (!v.length) return '';
  const W = 240, H = 36, pad = 5, all = v.concat(target != null ? [target] : []);
  let lo = Math.min(...all), hi = Math.max(...all); if (hi === lo) { hi += 1; lo -= 1; }
  const x = k => vals.length === 1 ? W / 2 : pad + (W - 2 * pad) * k / (vals.length - 1);
  const y = u => pad + (H - 2 * pad) * (1 - (u - lo) / (hi - lo));
  const pts = vals.map((u, k) => u == null ? null : `${x(k).toFixed(1)},${y(u).toFixed(1)}`).filter(Boolean).join(' ');
  const t = target != null ? `<line x1="0" x2="${W}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}" stroke="var(--line-2)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : '';
  const k = vals.length - 1;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">${t}<polyline points="${pts}" fill="none" stroke="var(--ly)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
    (vals[k] != null ? `<circle cx="${x(k).toFixed(1)}" cy="${y(vals[k]).toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>` : '') + `</svg>`;
}

/* lineChart: labels[], series:[{name,color,values,dash,ref}], fmt, refs:[{value,label}], ymin0 */
function lineChart(el, o) {
  const W = 640, H = o.height || 230, L = 46, R = 12, Tp = 14, B = 30;
  const n = o.labels.length;
  let vals = [];
  o.series.forEach(s => s.values.forEach(v => { if (v != null) vals.push(v); }));
  (o.refs || []).forEach(r => vals.push(r.value));
  if (!vals.length) { el.innerHTML = '<p class="note">Немає даних</p>'; return; }
  let lo = o.ymin0 ? Math.min(0, ...vals) : Math.min(...vals), hi = Math.max(...vals);
  if (!o.ymin0) { const padv = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1; lo -= padv; hi += padv; }
  if (o.ymax != null) hi = Math.max(hi, o.ymax);
  const ticks = niceTicks(lo, hi, 4); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const x = k => L + (W - L - R) * (n === 1 ? 0.5 : k / (n - 1));
  const y = v => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo));
  let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">`;
  ticks.forEach(t => { g += `<line x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${esc(o.fmt(t, true))}</text>`; });
  const every = n > 14 ? Math.ceil(n / 12) : 1;
  o.labels.forEach((lb, k) => { if (k % every === 0 || (k === n - 1 && (n - 1) % every > every / 2)) g += `<text x="${x(k).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(lb)}</text>`; });
  (o.refs || []).forEach(r => { g += `<line x1="${L}" x2="${W - R}" y1="${y(r.value).toFixed(1)}" y2="${y(r.value).toFixed(1)}" stroke="var(--ref)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - R}" y="${(y(r.value) - 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--ink-2)">${esc(r.label)}</text>`; });
  if (o.bands) o.bands.forEach(b => { g += `<rect x="${x(b.from).toFixed(1)}" y="${Tp}" width="${(x(b.to) - x(b.from)).toFixed(1)}" height="${H - Tp - B}" fill="var(--band)"/>`; });
  o.series.forEach(s => {
    let d = '', open = false;
    s.values.forEach((v, k) => { if (v == null) { open = false; return; } d += (open ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(v).toFixed(1); open = true; });
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="5 4"' : ''}/>`;
    const lastK = s.values.map((v, k) => v == null ? -1 : k).filter(k => k >= 0).pop();
    if (lastK != null && !s.dash) g += `<circle cx="${x(lastK).toFixed(1)}" cy="${y(s.values[lastK]).toFixed(1)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
  });
  g += `<line id="xh" x1="0" x2="0" y1="${Tp}" y2="${H - B}" stroke="var(--line-2)" stroke-width="1" visibility="hidden"/>`;
  g += `<rect x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - B}" fill="transparent" class="hit"/></svg>`;
  el.innerHTML = g;
  const svg = el.querySelector('svg'), xh = svg.querySelector('#xh');
  const move = ev => {
    const pt = svg.getBoundingClientRect(); const px_ = (ev.clientX - pt.left) / pt.width * W;
    let k = Math.round((px_ - L) / ((W - L - R) / (n === 1 ? 1 : n - 1))); k = Math.max(0, Math.min(n - 1, k));
    xh.setAttribute('x1', x(k)); xh.setAttribute('x2', x(k)); xh.setAttribute('visibility', 'visible');
    const rows = o.series.map(s => s.values[k] == null ? '' : `<div class="r"><i class="${s.dash ? 'dash' : ''}" style="border-color:${s.color}"></i><em>${esc(s.name)}</em><b>${esc(o.fmt(s.values[k]))}</b></div>`).join('');
    showTip(`<div class="t">${esc(o.tipLabels ? o.tipLabels[k] : o.labels[k])}</div>${rows}`, ev.clientX, ev.clientY);
  };
  svg.addEventListener('mousemove', move); svg.addEventListener('touchmove', e => { move(e.touches[0]); }, { passive: true });
  svg.addEventListener('mouseleave', () => { hideTip(); xh.setAttribute('visibility', 'hidden'); }); svg.addEventListener('touchend', hideTip);
}
/* barChart: labels[], series:[{name,color,values}], stacked, fmt, refs, line:{name,color,values} optional (same unit) */
function barChart(el, o) {
  const W = 640, H = o.height || 230, L = 46, R = 12, Tp = 14, B = 30, n = o.labels.length;
  const tot = o.labels.map((_, k) => o.stacked ? o.series.reduce((a, s) => a + (s.values[k] || 0), 0) : Math.max(...o.series.map(s => s.values[k] || 0)));
  let hi = Math.max(0, ...tot, ...(o.refs || []).map(r => r.value), ...((o.line && o.line.values) || []).filter(v => v != null));
  let lo = Math.min(0, ...o.series.flatMap(s => s.values.filter(v => v != null)));
  const ticks = niceTicks(lo, hi, 4); hi = Math.max(hi, ticks[ticks.length - 1]); lo = Math.min(lo, ticks[0]);
  const slot = (W - L - R) / n, bw = Math.max(3, slot * (o.stacked ? 0.66 : 0.8 / o.series.length));
  const y = v => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo));
  let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">`;
  ticks.forEach(t => { g += `<line x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${esc(o.fmt(t, true))}</text>`; });
  const every = n > 14 ? Math.ceil(n / 12) : 1;
  o.labels.forEach((lb, k) => { if (k % every === 0 || (k === n - 1 && (n - 1) % every > every / 2)) g += `<text x="${(L + slot * (k + 0.5)).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(lb)}</text>`; });
  o.labels.forEach((_, k) => {
    let acc = 0;
    o.series.forEach((s, si) => {
      const v = s.values[k]; if (v == null || v === 0) return;
      const x0 = o.stacked ? L + slot * (k + 0.5) - bw / 2 : L + slot * k + slot * 0.1 + si * bw;
      const y0 = o.stacked ? y(acc + Math.max(v, 0)) : y(Math.max(v, 0)), y1 = o.stacked ? y(acc) : y(Math.min(v, 0));
      const h = Math.max(0, Math.abs(y1 - y0) - 2);
      g += `<rect x="${x0.toFixed(1)}" y="${(Math.min(y0, y1) + 1).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${s.color}" rx="${o.stacked ? 0 : 3}"${o.muted && o.muted[k] ? ' opacity=".45"' : ''}/>`;
      if (o.stacked) acc += v;
    });
  });
  (o.refs || []).forEach(r => { g += `<line x1="${L}" x2="${W - R}" y1="${y(r.value).toFixed(1)}" y2="${y(r.value).toFixed(1)}" stroke="var(--ref)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - R}" y="${(y(r.value) - 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--ink-2)">${esc(r.label)}</text>`; });
  if (o.line) {
    let d = '', open = false;
    o.line.values.forEach((v, k) => { if (v == null) { open = false; return; } d += (open ? 'L' : 'M') + (L + slot * (k + 0.5)).toFixed(1) + ' ' + y(v).toFixed(1); open = true; });
    g += `<path d="${d}" fill="none" stroke="${o.line.color}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  g += `<rect id="hl" x="0" y="${Tp}" width="${slot.toFixed(1)}" height="${H - Tp - B}" fill="var(--band)" visibility="hidden"/>`;
  g += `<rect x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - B}" fill="transparent"/></svg>`;
  el.innerHTML = g;
  const svg = el.querySelector('svg'), hl = svg.querySelector('#hl');
  const move = ev => {
    const pt = svg.getBoundingClientRect(); const px_ = (ev.clientX - pt.left) / pt.width * W;
    let k = Math.floor((px_ - L) / slot); k = Math.max(0, Math.min(n - 1, k));
    hl.setAttribute('x', (L + slot * k).toFixed(1)); hl.setAttribute('visibility', 'visible');
    let rows = o.series.map(s => s.values[k] == null ? '' : `<div class="r"><i class="box" style="background:${s.color};border-color:${s.color}"></i><em>${esc(s.name)}</em><b>${esc(o.fmt(s.values[k]))}</b></div>`).join('');
    if (o.stacked && o.series.length > 1) rows += `<div class="r"><i></i><em>Разом</em><b>${esc(o.fmt(tot[k]))}</b></div>`;
    if (o.line && o.line.values[k] != null) rows += `<div class="r"><i style="border-color:${o.line.color}"></i><em>${esc(o.line.name)}</em><b>${esc(o.fmt(o.line.values[k]))}</b></div>`;
    if (o.extra) rows += o.extra(k);
    showTip(`<div class="t">${esc(o.tipLabels ? o.tipLabels[k] : o.labels[k])}</div>${rows}`, ev.clientX, ev.clientY);
  };
  svg.addEventListener('mousemove', move); svg.addEventListener('touchmove', e => { move(e.touches[0]); }, { passive: true });
  svg.addEventListener('mouseleave', () => { hideTip(); hl.setAttribute('visibility', 'hidden'); }); svg.addEventListener('touchend', hideTip);
}
const legend = (el, items) => { el.innerHTML = items.map(i => `<span><i class="lk ${i.dash ? 'dash' : ''} ${i.box ? 'box' : ''}" style="${i.box ? 'background:' + i.color : 'color:' + i.color}"></i>${esc(i.name)}</span>`).join(''); };

/* ---------- tables ---------- */
function tableHTML(cols, rows) {
  let h = '<thead><tr>' + cols.map(c => `<th class="${c.cls || ''}">${c.label}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(r => {
    if (r.section) { h += `<tr class="sec"><td colspan="${cols.length}">${esc(r.section)}</td></tr>`; return; }
    h += `<tr class="${r.cls || ''}">` + r.cells.map((c, k) => `<td class="${(cols[k].cls || '')} ${c.cls || ''}">${c.html != null ? c.html : esc(c.text)}</td>`).join('') + '</tr>';
  });
  return h + '</tbody>';
}
function copyTable(tbl, btn) {
  const rows = [...tbl.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim().replace(/−/g, '-')).join('\t')).join('\n');
  const done = ok => { const t = btn.textContent; btn.textContent = ok ? 'Скопійовано' : 'Виділіть таблицю і скопіюйте'; setTimeout(() => { btn.textContent = t; }, 1800); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(rows).then(() => done(true), () => { selectAll(tbl); done(false); });
  else { selectAll(tbl); done(false); }
}
function selectAll(node) { try { const r = document.createRange(); r.selectNodeContents(node); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }
const tile = o => `<div class="card tile"><div class="lbl"><span>${o.label}</span>${o.chip || ''}</div><div class="val">${o.value}</div>` +
  (o.hint ? `<div class="hint">${o.hint}</div>` : '') + `<div class="deltas">${(o.deltas || []).filter(Boolean).join('')}</div>${o.spark || ''}</div>`;
const dl = (label, txt, cls) => txt && txt !== '—' ? `<span>${label} <b class="${cls || 'neutral'}">${txt}</b></span>` : '';
const good = (d, better) => d == null || !better || Math.abs(d) < 1e-9 ? 'neutral' : ((d > 0) === (better === 'up') ? 'up-good' : 'up-bad');
const series = (key, i) => M.slice(0, i + 1).map(f => f[key]);
</script>
