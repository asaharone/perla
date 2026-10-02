
/* ================= on-page inputs (artifact db) ================= */
const INPUTS = {};      // month -> doc body from db
let DEC = null;         // decisions from db (null = not loaded)
let db = null, usr = null, canWrite = null, dbMode = 'off';
let unsubInputs = null, unsubDec = null, writeRefused = false;
const dirty = { cmo: false, cfo: false };
const SEED_DECISIONS = [
  { text: 'Ліміт маркетингу на жовтень і тижнева стеля до затвердження (≈$30k на тиждень)', owner: 'Денис · Олексій · Альона', due: '2026-10-07', status: 'open' },
  { text: 'Правила знижок до флешу 08.10: потолок, стоп-правило «запас < 30 днів — не в акцію», тест 20% проти 15%', owner: 'Олексій · Вова', due: '2026-10-07', status: 'open' },
  { text: 'Блогери: пауза на нові оплати до звіту за серпень–вересень (витрата, GP по промокодах, брендовий пошук)', owner: 'Олексій', due: '2026-10-09', status: 'open' },
  { text: 'Бандл №1: одна дата запуску і відповідальний, або зняти з плану', owner: 'Олексій', due: '2026-10-09', status: 'open' },
  { text: 'Звірений з банком залишок по кожному рахунку, реєстр зобов\'язань, перший 13-тижневий прогноз кешу', owner: 'Альона · Марина', due: '2026-10-10', status: 'open' },
  { text: 'PO List, S&OP і план платежів — до однієї цифри по SKU; рішення по магнію, Joint, Peach, Black Cherry, Squalene', owner: 'власник закупівель', due: '2026-10-10', status: 'open' },
  { text: 'Виправити вітрини FD (Analytical dashboard 2026, COGS по сегментах у Finresult) і матеріали борду', owner: 'Альона', due: '2026-10-10', status: 'open' },
  { text: 'Board Pack за 3 дні до Борду 22.10 без ручних правок; словник метрик', owner: 'Артём (CLUST) · Катя', due: '2026-10-19', status: 'open' }
];
const nowIso = () => new Date().toISOString();
const timeStr = iso => { try { const d = new Date(iso); return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
const $ = id => document.getElementById(id);

function setDbMode(mode) {
  dbMode = mode;
  const ro = mode !== 'rw';
  ['c-q1', 'c-q2', 'c-q3', 'c-save', 'f-cash', 'f-cash-date', 'f-liab', 'f-ar', 'f-overdue', 'f-dso', 'f-stock-ua', 'f-stock-pl', 'f-transit', 'f-note', 'f-save', 'd-text', 'd-owner', 'd-due', 'd-add'].forEach(id => { const el = $(id); if (el) el.disabled = ro; });
  const msg = mode === 'off' ? 'Введення працює у версії сторінки на claude.ai (увійдіть в акаунт). Тут показано стартові значення зі знімка.'
    : mode === 'ro' ? 'У вас доступ лише на читання: показано збережені значення. Щоб вносити дані, потрібен рівень Contributor.'
    : 'Зберігається в базі цієї сторінки; бачать усі, хто має посилання. Поле «оновлено» показує час останнього збереження.';
  ['c-note', 'f-note-db', 'd-note'].forEach(id => { $(id).textContent = msg; });
}
function onMonthChanged() { dirty.cmo = dirty.cfo = false; if (db) subscribeInputs(); }
function subscribeInputs() {
  if (unsubInputs) { unsubInputs(); unsubInputs = null; }
  const key = F().month;
  if (INPUTS[key] === undefined) INPUTS[key] = null;
  unsubInputs = db.doc('inputs/' + key).onSnapshot(snap => {
    INPUTS[key] = snap.exists ? snap.data() : null;
    if (key === F().month) { renderInputs(); renderCEO(); renderCFO(); renderBench(); }
  }, err => { console.warn('inputs', err); });
}
function subscribeDecisions() {
  if (unsubDec) { unsubDec(); unsubDec = null; }
  unsubDec = db.collection('decisions').orderBy('created', 'desc').limit(80).onSnapshot(snap => {
    DEC = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDecisions();
  }, err => { console.warn('decisions', err); DEC = null; renderDecisions(); });
}
async function initDb() {
  if (!window.claude || typeof window.claude.use !== 'function') { setDbMode('off'); return; }
  try { db = await window.claude.use('db'); usr = await window.claude.use('user'); } catch (e) { db = null; }
  if (!db) { setDbMode('off'); return; }
  try { canWrite = usr ? await usr.can('data.write') : null; } catch (e) { canWrite = null; }
  setDbMode(canWrite === false ? 'ro' : 'rw');
  subscribeInputs(); subscribeDecisions();
}
function renderInputs() {
  const key = F().month, d = INPUTS[key] || null, seedMonth = MAN.as_of.slice(0, 7) === key;
  if (!dirty.cmo) { $('c-q1').value = d && d.cmo_q1 || ''; $('c-q2').value = d && d.cmo_q2 || ''; $('c-q3').value = d && d.cmo_q3 || ''; }
  $('c-status').textContent = d && d.cmo_updated ? 'Оновлено ' + timeStr(d.cmo_updated) : (dbMode === 'rw' ? 'Ще не заповнено' : '');
  if (!dirty.cfo) {
    const g = (k, s) => d && d[k] != null ? d[k] : (seedMonth || !d ? s : '');
    $('f-cash').value = g('cash_usd', MAN.cash.verified_usd) ?? ''; $('f-cash-date').value = g('cash_date', MAN.cash.verified_date) ?? '';
    $('f-liab').value = g('liabilities_uah', MAN.cash.liabilities_uah) ?? ''; $('f-ar').value = g('ar_uah', MAN.ar.total_uah) ?? '';
    const ov = g('overdue_pct', MAN.ar.overdue_pct); $('f-overdue').value = ov == null || ov === '' ? '' : +(ov * 100).toFixed(1);
    $('f-dso').value = g('dso_days', MAN.ar.dso_days) ?? ''; $('f-stock-ua').value = g('stock_ua_usd', MAN.inventory.stock_ua_usd) ?? '';
    $('f-stock-pl').value = g('stock_pl_usd', MAN.inventory.stock_pl_usd) ?? ''; $('f-transit').value = g('transit_usd', MAN.inventory.in_transit_usd) ?? '';
    $('f-note').value = d && d.note || '';
  }
  $('f-status').textContent = d && d.updated ? 'Оновлено ' + timeStr(d.updated) : 'Стартові значення зі знімка ' + fmt.date(MAN.as_of);
}
function renderDecisions() {
  const list = DEC && DEC.length ? DEC : (DEC === null || dbMode === 'off' ? SEED_DECISIONS.map((x, k) => ({ ...x, id: 'seed' + k, seed: true })) : []);
  const order = x => (x.status === 'done' ? 1 : 0) + '' + (x.due || '9999');
  const sorted = list.slice().sort((a, b) => order(a) < order(b) ? -1 : 1);
  const fromSeed = sorted.length && sorted[0].seed;
  $('decisions').innerHTML = sorted.map(x => {
    const late = x.status !== 'done' && x.due && x.due < S.data_through;
    return `<li class="${x.status === 'done' ? 'done' : ''}">${chip(x.status === 'done' ? { cls: 'ok', label: 'зроблено', icon: '✓' } : late ? { cls: 'alert', label: 'прострочено', icon: '✕' } : { cls: 'watch', label: 'відкрито', icon: '!' })}` +
      `<span>${esc(x.text)}<span class="meta">${esc(x.owner || '—')} · до ${fmt.date(x.due)}${x.effect ? ' · ' + esc(x.effect) : ''}</span></span>` +
      `<span>${x.seed || dbMode !== 'rw' ? '' : `<button class="btn" type="button" data-dec="${esc(x.id)}" data-next="${x.status === 'done' ? 'open' : 'done'}">${x.status === 'done' ? 'Відкрити' : 'Зроблено'}</button>`}</span></li>`;
  }).join('') || '<li>Рішень ще немає</li>';
  if (fromSeed) $('d-status').textContent = 'Стартовий список з діагностики 27.09 і підготовки до колу 02.10';
}
async function saveInputs(fields, statusEl, dirtyKey) {
  if (!db || dbMode !== 'rw') return;
  const key = F().month, body = Object.assign({}, INPUTS[key] || {}, fields);
  statusEl.textContent = 'Зберігаю…';
  try { await db.doc('inputs/' + key).set(body); dirty[dirtyKey] = false; statusEl.textContent = 'Збережено ' + timeStr(nowIso()); }
  catch (e) {
    if (e && e.code === 'invalid_argument' && !writeRefused) { writeRefused = true; setDbMode('ro'); }
    statusEl.textContent = 'Не збережено: ' + (e && e.message ? e.message : 'помилка');
  }
}
$('cmo-form').addEventListener('input', () => { dirty.cmo = true; });
$('cfo-form').addEventListener('input', () => { dirty.cfo = true; });
$('cmo-form').addEventListener('submit', e => { e.preventDefault(); saveInputs({ cmo_q1: $('c-q1').value.trim(), cmo_q2: $('c-q2').value.trim(), cmo_q3: $('c-q3').value.trim(), cmo_updated: nowIso() }, $('c-status'), 'cmo'); });
$('cfo-form').addEventListener('submit', e => {
  e.preventDefault();
  const n = id => { const v = $(id).value; return v === '' ? null : +v; };
  saveInputs({ cash_usd: n('f-cash'), cash_date: $('f-cash-date').value || null, liabilities_uah: n('f-liab'), ar_uah: n('f-ar'), overdue_pct: n('f-overdue') == null ? null : n('f-overdue') / 100, dso_days: n('f-dso'),
    stock_ua_usd: n('f-stock-ua'), stock_pl_usd: n('f-stock-pl'), transit_usd: n('f-transit'), note: $('f-note').value.trim(), updated: nowIso() }, $('f-status'), 'cfo');
});
$('decision-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!db || dbMode !== 'rw') return;
  const text = $('d-text').value.trim(); if (!text) { $('d-status').textContent = 'Напишіть рішення'; return; }
  $('d-status').textContent = 'Зберігаю…';
  try { await db.collection('decisions').add({ text, owner: $('d-owner').value.trim(), due: $('d-due').value || null, status: 'open', created: nowIso(), month: F().month }); $('d-text').value = ''; $('d-owner').value = ''; $('d-due').value = ''; $('d-status').textContent = 'Додано'; }
  catch (err) { if (err && err.code === 'invalid_argument' && !writeRefused) { writeRefused = true; setDbMode('ro'); } $('d-status').textContent = 'Не збережено: ' + (err && err.message ? err.message : 'помилка'); }
});
$('decisions').addEventListener('click', async e => {
  const b = e.target.closest('button[data-dec]'); if (!b || !db || dbMode !== 'rw') return;
  b.disabled = true;
  try { await db.doc('decisions/' + b.dataset.dec).update({ status: b.dataset.next, updated: nowIso() }); } catch (err) { b.disabled = false; $('d-status').textContent = 'Не збережено: ' + (err && err.message ? err.message : 'помилка'); }
});
['copy-w', 'copy-seg', 'copy-bp'].forEach((id, k) => { $(id).addEventListener('click', () => copyTable($(['tbl-w', 'tbl-seg', 'tbl-bp'][k]), $(id))); });

/* ================= init ================= */
function renderAll() { renderMeta(); renderCEO(); renderCMO(); renderCFO(); renderCLUST(); renderBench(); renderDecisions(); }
renderFlow();
setDbMode('off');
renderAll();
setView(view, false);
initDb();
})();
</script>
