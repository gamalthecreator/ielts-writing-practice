'use strict';
const T1 = window.TASK1, T1TIPS = window.TASK1_TIPS || {}, T2 = window.TASK2;
const MODES = {
  t1:   { label: 'Task 1 only', mins: 20, tasks: [1] },
  t2:   { label: 'Task 2 only', mins: 40, tasks: [2] },
  full: { label: 'Full Writing test (Task 1 + Task 2)', mins: 60, tasks: [1, 2] },
};
const MIN_WORDS = { 1: 150, 2: 250 };
const SUGGESTED = { 1: 20, 2: 40 };
const WARN_AT = [600, 300, 60]; // seconds left at which a warning pops up
const K = { attempts: 'ielts.attempts', session: 'ielts.session', log: 'ielts.errorlog', prefs: 'ielts.prefs' };
const CHECK = {
  1: ['Introduction paraphrases the question (not copied)', 'Overview present: 2 main features, no numbers',
      'Overview mentions the biggest change in ranking', 'Body paragraphs compare, not just list',
      'Numbers are accurate (just over / nearly)', 'Correct tense throughout, no switching',
      'No opinion, no reasons, no conclusion', "No informal words (got, faced, didn't, And…)",
      'No comma splices', '170–190 words', 'Finished within 20 minutes'],
  2: ['Answered EVERY part of the question', 'Clear position in the introduction, kept the same throughout',
      '4 paragraphs: intro, 2 body paragraphs, conclusion', 'Each body paragraph: point → explanation → specific example → link',
      'Conclusion restates the position, no new ideas', 'Linking words varied, not at the start of every sentence',
      'Mix of complex sentences (conditional, relative clause, passive)', 'No memorised phrases, informal words or contractions',
      'No comma splices', '270–300 words', 'Finished within 40 minutes'],
};

const app = document.getElementById('app');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const countWords = t => (t.trim().match(/\S+/g) || []).length;
const fmt = secs => { const s = Math.max(0, Math.round(secs)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const cap = s => s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
const paras = t => t.trim() ? esc(t).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') : '<p class="muted">(empty)</p>';
const when = d => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

let storageOK = true;
try { localStorage.setItem('ielts.test', '1'); localStorage.removeItem('ielts.test'); } catch { storageOK = false; }
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { toast('Could not save: ' + e.message, true); return false; }
  },
  del(k) { try { localStorage.removeItem(k); } catch { /* nothing to remove */ } },
};
const attempts = () => store.get(K.attempts, []);
const prefs = () => ({ mode: 'full', t1: 'random', t2: 'random', lock: true, font: 16, ...store.get(K.prefs, {}) });
const getQ = (task, n) => (task === 1 ? T1 : T2).find(q => q.n === Number(n));
const shortLabel = (task, q) => task === 1 ? `Q${q.n}. ${q.title}`
  : `${q.n}. ${q.text.split('\n')[0].slice(0, 75)}${q.text.split('\n')[0].length > 75 ? '…' : ''}`;
const doneCount = task => attempts().reduce((m, a) => (a.task === task && (m[a.qid] = (m[a.qid] || 0) + 1), m), {});

let session = null, tickH = null, lastTick = 0, lastSave = 0, timerHidden = false, histFilter = 'all', toastH;

function toast(msg, warn) {
  const t = $('#toast');
  t.textContent = msg; t.className = warn ? 'warn' : ''; t.hidden = false;
  clearTimeout(toastH); toastH = setTimeout(() => { t.hidden = true; }, 4500);
}
function zoom(src) { $('#zoom img').src = src; $('#zoom').hidden = false; }

function header(active) {
  return `<header class="bar"><h1>IELTS Academic Writing <span>practice</span></h1>
    <nav><button data-nav="home" class="${active === 'home' ? 'on' : ''}">New test</button>
    <button data-nav="history" class="${active === 'history' ? 'on' : ''}">My answers (${attempts().length})</button></nav></header>
    ${storageOK ? '' : '<div class="banner warn">This browser is blocking storage for local files, so your answers will NOT be saved. Open this file in Chrome or Edge.</div>'}`;
}
function wireNav() { $$('[data-nav]').forEach(b => { b.onclick = () => (b.dataset.nav === 'home' ? home() : showHistory()); }); }

function options(task, sel) {
  const done = doneCount(task), groups = {};
  (task === 1 ? T1 : T2).forEach(q => (groups[task === 1 ? q.section : q.type] ||= []).push(q));
  let h = `<option value="random"${sel === 'random' ? ' selected' : ''}>🎲 Random (one I haven't done yet)</option>`;
  for (const [g, qs] of Object.entries(groups)) {
    h += `<optgroup label="${esc(task === 1 ? cap(g) : g)}">` + qs.map(q =>
      `<option value="${q.n}"${String(sel) === String(q.n) ? ' selected' : ''}>${esc(shortLabel(task, q))}${done[q.n] ? `   ✓${done[q.n]}` : ''}</option>`
    ).join('') + '</optgroup>';
  }
  return h;
}

// ---------- home ----------
function home() {
  stopTimer();
  const p = prefs(), sess = store.get(K.session, null);
  app.innerHTML = header('home') + `<main class="page">
    ${sess ? `<div class="banner">You have an unfinished test (${esc(MODES[sess.mode].label)}, ${fmt(sess.remaining)} left on the clock).
      <button id="resume" class="primary">Resume</button> <button id="discard">Discard it</button></div>` : ''}
    <section class="card"><h2>1. What do you want to practise?</h2>
      ${Object.entries(MODES).map(([k, m]) => `<label class="opt"><input type="radio" name="mode" value="${k}"${p.mode === k ? ' checked' : ''}>
        <b>${m.label}</b> <span class="muted">${m.mins} minutes</span></label>`).join('')}
    </section>
    <section class="card"><h2>2. Choose the question(s)</h2>
      <label class="field" id="f1">Task 1 <select id="sel1">${options(1, p.t1)}</select></label>
      <label class="field" id="f2">Task 2 <select id="sel2">${options(2, p.t2)}</select></label>
      <p class="muted small">✓2 means you have already answered that question twice.</p>
    </section>
    <section class="card"><h2>3. Rules</h2>
      <label class="opt"><input type="checkbox" id="lock"${p.lock ? ' checked' : ''}> <b>Exam mode:</b> writing stops and is submitted when time runs out.
        Untick to keep writing after time is up (the overtime is recorded).</label>
    </section>
    <section class="card"><h2>My error log <span class="muted small">read it before you start · saved automatically</span></h2>
      <textarea id="log" rows="6" spellcheck="false" placeholder="One mistake per line, e.g.
- comma splices
- 'has increased' for past data">${esc(store.get(K.log, ''))}</textarea>
    </section>
    <button id="start" class="primary big">Start test</button>
  </main>`;
  wireNav();
  const sync = () => {
    const m = MODES[$('input[name=mode]:checked').value];
    $('#f1').hidden = !m.tasks.includes(1); $('#f2').hidden = !m.tasks.includes(2);
  };
  $$('input[name=mode]').forEach(r => { r.onchange = sync; });
  sync();
  $('#log').oninput = e => store.set(K.log, e.target.value);
  $('#start').onclick = () => {
    if (sess && !confirm('Starting a new test will discard your unfinished one. Continue?')) return;
    const np = { ...p, mode: $('input[name=mode]:checked').value, t1: $('#sel1').value, t2: $('#sel2').value, lock: $('#lock').checked };
    store.set(K.prefs, np);
    startSession(np);
  };
  if (sess) {
    $('#resume').onclick = () => { session = sess; exam(); };
    $('#discard').onclick = () => { if (confirm('Discard the unfinished test? What you wrote in it will be lost.')) { store.del(K.session); home(); } };
  }
}

function pickRandom(task) {
  const done = doneCount(task), list = task === 1 ? T1 : T2;
  const fresh = list.filter(q => !done[q.n]), pool = fresh.length ? fresh : list;
  return pool[Math.floor(Math.random() * pool.length)].n;
}

function startSession(p) {
  const m = MODES[p.mode];
  session = {
    mode: p.mode, lock: p.lock, remaining: m.mins * 60, overtime: 0, active: 0, warned: [],
    parts: m.tasks.map(task => {
      const sel = task === 1 ? p.t1 : p.t2;
      return { task, qid: sel === 'random' ? pickRandom(task) : Number(sel), text: '', secs: 0 };
    }),
  };
  saveSession();
  exam();
}
function saveSession() { lastSave = Date.now(); if (session) store.set(K.session, session); }

// ---------- exam ----------
function exam() {
  const s = session;
  app.innerHTML = `<div class="exam">
    <header class="exam-bar">
      <div>IELTS Academic · Writing · <span class="muted">${esc(MODES[s.mode].label)}</span></div>
      <button id="timer" class="timer" title="Click to hide or show the timer"></button>
      <div class="tools">
        <button id="fontDown" title="Smaller text" aria-label="Smaller text">A−</button>
        <button id="fontUp" title="Larger text" aria-label="Larger text">A+</button>
        <button id="finish" class="primary">Finish test</button>
      </div>
    </header>
    <main class="split">
      <section class="qpane" id="qpane"></section>
      <section class="apane">
        <textarea id="answer" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" aria-label="Your answer"></textarea>
        <div class="wc">Word count: <b id="wc">0</b></div>
      </section>
    </main>
    ${s.parts.length > 1 ? `<footer class="parts">${s.parts.map((pt, i) =>
      `<button data-part="${i}">Part ${pt.task} <span class="muted" id="pw${i}"></span></button>`).join('')}</footer>` : ''}
  </div>`;
  applyFont();
  const ta = $('#answer');
  ta.oninput = () => { s.parts[s.active].text = ta.value; updateWC(); saveSession(); };
  $$('[data-part]').forEach(b => { b.onclick = () => showPart(Number(b.dataset.part)); });
  $('#finish').onclick = () => finish(false);
  $('#timer').onclick = () => { timerHidden = !timerHidden; renderTimer(); };
  $('#fontUp').onclick = () => setFont(2);
  $('#fontDown').onclick = () => setFont(-2);
  $('#qpane').onclick = e => { if (e.target.matches('img.chart')) zoom(e.target.src); };
  window.onbeforeunload = e => { saveSession(); e.preventDefault(); e.returnValue = ''; };
  showPart(s.active);
  if (s.remaining <= 0 && s.lock) return finish(true);
  startTimer();
}

function showPart(i) {
  const s = session; s.active = i;
  const pt = s.parts[i], q = getQ(pt.task, pt.qid);
  $('#qpane').innerHTML = pt.task === 1 ? `
    <h2>Writing Task 1</h2><p class="inst">You should spend about 20 minutes on this task.</p>
    <div class="prompt"><p><b>${esc(q.prompt)}</b></p><p>${esc(q.instr)}</p></div>
    <img class="chart" src="${esc(q.img)}" alt="Chart for Task 1 question ${q.n}" title="Click to enlarge">
    <p class="inst">Write at least 150 words.</p>` : `
    <h2>Writing Task 2</h2><p class="inst">You should spend about 40 minutes on this task.</p>
    <p>Write about the following topic:</p>
    <div class="prompt">${q.text.split('\n').map(l => `<p><b>${esc(l)}</b></p>`).join('')}</div>
    <p>Give reasons for your answer and include any relevant examples from your own knowledge or experience.</p>
    <p class="inst">Write at least 250 words.</p>`;
  const img = $('#qpane img.chart');
  if (img) img.onerror = () => img.replaceWith(Object.assign(document.createElement('p'), {
    className: 'banner warn', textContent: 'Chart image not found. Keep the IELTS_Task1_Charts folder next to the IELTS_Writing_Simulator folder.' }));
  const ta = $('#answer');
  ta.value = pt.text; ta.readOnly = s.remaining <= 0 && s.lock; ta.focus();
  $$('[data-part]').forEach(b => b.classList.toggle('on', Number(b.dataset.part) === i));
  updateWC(); saveSession();
}

function updateWC() {
  const s = session;
  $('#wc').textContent = countWords(s.parts[s.active].text);
  s.parts.forEach((p, i) => { const el = $('#pw' + i); if (el) el.textContent = `· ${countWords(p.text)} words`; });
}
function applyFont() { document.documentElement.style.setProperty('--fs', prefs().font + 'px'); }
function setFont(d) { const p = prefs(); p.font = Math.min(26, Math.max(12, p.font + d)); store.set(K.prefs, p); applyFont(); }

// Timer: counts wall-clock time, so a frozen/background tab still loses time like the real exam.
// It is saved every second; if the page is closed, the clock stops until you resume.
function startTimer() { stopTimer(); lastTick = Date.now(); tickH = setInterval(tick, 250); renderTimer(); }
function stopTimer() { clearInterval(tickH); tickH = null; }
function tick() {
  const s = session, now = Date.now(), dt = (now - lastTick) / 1000;
  lastTick = now;
  s.parts[s.active].secs += dt;
  if (s.remaining > 0) {
    s.remaining = Math.max(0, s.remaining - dt);
    for (const w of WARN_AT) {
      if (s.remaining <= w && !s.warned.includes(w)) {
        s.warned.push(w);
        if (s.remaining > 0) toast(`${w / 60} minute${w > 60 ? 's' : ''} remaining`, w <= 300);
      }
    }
    if (s.remaining === 0) {
      if (s.lock) { renderTimer(); return finish(true); }
      toast('Time is up. You can keep writing; overtime is being recorded.', true);
    }
  } else s.overtime += dt;
  renderTimer();
  if (now - lastSave > 1000) saveSession();
}
function renderTimer() {
  const s = session, el = $('#timer');
  if (!el || !s) return;
  const over = s.remaining <= 0;
  el.textContent = timerHidden ? 'Show timer' : over ? `Time up · +${fmt(s.overtime)}` : `${fmt(Math.ceil(s.remaining))} left`;
  el.className = 'timer' + (timerHidden ? '' : over ? ' over' : s.remaining <= 300 ? ' low' : s.remaining <= 600 ? ' warn' : '');
}

function finish(auto) {
  const s = session;
  if (!auto) {
    const short = s.parts.filter(p => countWords(p.text) < MIN_WORDS[p.task])
      .map(p => `• Task ${p.task}: ${countWords(p.text)} words (minimum ${MIN_WORDS[p.task]})`);
    let msg = s.remaining > 0 ? `You still have ${fmt(s.remaining)} left.\n` : '';
    if (short.length) msg += `\nUnder the word limit:\n${short.join('\n')}\n`;
    if (!confirm(msg + '\nSubmit your answers now?')) return;
  }
  stopTimer();
  const sessionId = uid(), date = new Date().toISOString();
  const recs = s.parts.filter(p => p.text.trim()).map(p => ({
    id: uid(), sessionId, date, mode: s.mode, task: p.task, qid: p.qid, text: p.text, words: countWords(p.text),
    secs: Math.round(p.secs), limitMins: MODES[s.mode].mins, overtime: Math.round(s.overtime), auto,
    band: '', notes: '', checks: [] }));
  if (recs.length && !store.set(K.attempts, [...attempts(), ...recs])) {
    alert('Saving failed, so your test is still open. Copy your text somewhere safe.');
    return startTimer();
  }
  window.onbeforeunload = null;
  store.del(K.session); session = null;
  if (auto) toast(recs.length ? 'Time is up. Your answers have been saved.' : 'Time is up. Nothing was written, so nothing was saved.');
  recs.length ? renderRecords(recs, 'Your answers') : home();
}

// ---------- saved answers ----------
function recordCard(r) {
  const q = getQ(r.task, r.qid);
  if (!q) return `<article class="card"><p class="muted">This answer's question (Task ${r.task}, #${r.qid}) no longer exists.</p><div class="answer">${paras(r.text)}</div></article>`;
  const min = MIN_WORDS[r.task];
  const qhtml = r.task === 1
    ? `<p><b>${esc(q.prompt)}</b></p><img class="chart small" src="${esc(q.img)}" alt="Chart for question ${q.n}">`
    : q.text.split('\n').map(l => `<p><b>${esc(l)}</b></p>`).join('');
  const help = r.task === 1 ? `
      <details open><summary>Overview hint: did you find these main features?</summary>${q.hintHtml}</details>
      <details><summary>Exact data: check your numbers</summary>${q.dataHtml}</details>
      <details><summary>Tips for ${esc(cap(q.section))}</summary>${T1TIPS[q.section] || ''}</details>
      <details><summary>Language bank</summary>${T1TIPS['LANGUAGE BANK'] || ''}</details>`
    : `<details open><summary>What this question type requires</summary><p><b>${esc(q.type)}:</b> ${esc(q.must)}</p></details>`;
  return `<article class="card rec" data-id="${r.id}">
    <header class="rec-head"><h3>Task ${r.task}: ${esc(shortLabel(r.task, q))}</h3><span class="muted">${when(r.date)}</span></header>
    <div class="stats">
      <span class="${r.words < min ? 'bad' : 'good'}">${r.words} words${r.words < min ? ` (under ${min}!)` : ''}</span>
      <span>Time on this task: ${fmt(r.secs)} <span class="muted">(suggested ${SUGGESTED[r.task]}:00)</span></span>
      ${r.overtime ? `<span class="bad">Overtime: ${fmt(r.overtime)}</span>` : ''}
      <span class="muted">${esc(MODES[r.mode]?.label || '')}${r.auto ? ' · auto-submitted at time up' : ''}</span>
    </div>
    <details class="q"><summary>Question</summary>${qhtml}</details>
    <div class="cols">
      <div><h4>Your answer</h4><div class="answer">${paras(r.text)}</div>
        <div class="row"><button data-copy>📋 Copy question + answer (to paste for feedback)</button>
        <button data-retry>↻ Try this question again</button></div></div>
      <div><h4>Self-check</h4>
        <ul class="checks">${CHECK[r.task].map((c, i) => `<li><label><input type="checkbox" data-check="${i}"${(r.checks || []).includes(i) ? ' checked' : ''}> ${esc(c)}</label></li>`).join('')}</ul>
        ${help}</div>
    </div>
    <div class="feedback">
      <label>Band from feedback <input data-band value="${esc(r.band)}" placeholder="e.g. 6.5" size="6"></label>
      <label class="grow">Feedback notes <textarea data-notes rows="3" placeholder="Paste the feedback you got, or your own notes">${esc(r.notes)}</textarea></label>
    </div>
  </article>`;
}

function renderRecords(recs, title) {
  window.scrollTo(0, 0);
  app.innerHTML = header('history') + `<main class="page wide"><div class="toolbar"><button data-nav="history">← All my answers</button></div>
    <h2>${esc(title)}</h2>${recs.map(recordCard).join('')}</main>`;
  wireNav();
  $$('.rec').forEach(card => {
    const id = card.dataset.id;
    const upd = fn => { const all = attempts(), r = all.find(a => a.id === id); if (r) { fn(r); store.set(K.attempts, all); } };
    $$('[data-check]', card).forEach(cb => {
      cb.onchange = () => upd(r => {
        const i = Number(cb.dataset.check), cur = r.checks || [];
        r.checks = cb.checked ? [...new Set([...cur, i])] : cur.filter(x => x !== i);
      });
    });
    const band = $('[data-band]', card), notes = $('[data-notes]', card);
    band.oninput = () => upd(r => { r.band = band.value.trim(); });
    notes.oninput = () => upd(r => { r.notes = notes.value; });
    $('[data-copy]', card).onclick = () => copyRec(id);
    $('[data-retry]', card).onclick = () => retry(id);
    $$('img.chart', card).forEach(img => { img.onclick = () => zoom(img.src); });
  });
}

async function copyRec(id) {
  const r = attempts().find(a => a.id === id), q = getQ(r.task, r.qid);
  const text = `IELTS Academic Writing Task ${r.task}: ${shortLabel(r.task, q)}\n` +
    `Question: ${r.task === 1 ? `${q.prompt}\n${q.instr}` : q.text}\n` +
    `Words: ${r.words} · Time: ${fmt(r.secs)} (suggested ${SUGGESTED[r.task]}:00)${r.overtime ? ` · Overtime: ${fmt(r.overtime)}` : ''}\n\n` +
    `My answer:\n${r.text}`;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('Copied. Paste it into the chat for feedback.');
}

function retry(id) {
  const r = attempts().find(a => a.id === id);
  if (store.get(K.session, null) && !confirm('Starting a new test will discard your unfinished one. Continue?')) return;
  const p = { ...prefs(), mode: r.task === 1 ? 't1' : 't2', [r.task === 1 ? 't1' : 't2']: String(r.qid) };
  store.set(K.prefs, p);
  startSession(p);
}

// ---------- history ----------
function showHistory() {
  stopTimer();
  const all = attempts().sort((a, b) => b.date.localeCompare(a.date));
  const keys = [...new Set(all.map(a => `${a.task}:${a.qid}`))].sort();
  const match = a => histFilter === 'all' || histFilter === `t${a.task}` || histFilter === `${a.task}:${a.qid}`;
  const rows = all.filter(match);
  app.innerHTML = header('history') + `<main class="page wide">
    <div class="toolbar">
      <label>Show <select id="filter">
        <option value="all">All answers</option><option value="t1">All Task 1</option><option value="t2">All Task 2</option>
        <optgroup label="One question">${keys.map(k => {
          const [t, n] = k.split(':').map(Number), q = getQ(t, n);
          return q ? `<option value="${k}">Task ${t} · ${esc(shortLabel(t, q))}</option>` : '';
        }).join('')}</optgroup></select></label>
      <button id="compare" class="primary" disabled>Compare selected</button>
      <span class="grow"></span>
      <button id="export">⬇ Back up (export)</button>
      <label class="btn">⬆ Restore (import)<input type="file" id="import" accept=".json,application/json" hidden></label>
    </div>
    ${rows.length ? `<div class="table-wrap"><table class="hist"><thead><tr><th><span class="muted small">pick 2–3</span></th><th>Date</th><th>Task</th><th>Question</th><th>Words</th><th>Time</th><th>Band</th><th></th></tr></thead><tbody>
      ${rows.map(r => {
        const q = getQ(r.task, r.qid);
        return `<tr data-id="${r.id}"><td><input type="checkbox" data-sel aria-label="Select for comparison"></td><td>${when(r.date)}</td><td>${r.task}</td>
          <td>${esc(q ? shortLabel(r.task, q) : '?')}</td><td class="${r.words < MIN_WORDS[r.task] ? 'bad' : ''}">${r.words}</td>
          <td>${fmt(r.secs)}${r.overtime ? ` <span class="bad">+${fmt(r.overtime)}</span>` : ''}</td><td>${esc(r.band) || '—'}</td>
          <td class="actions"><button data-open>Open</button> <button data-del class="danger" title="Delete this answer" aria-label="Delete">✕</button></td></tr>`;
      }).join('')}</tbody></table></div>`
      : '<p class="muted">No saved answers here yet.</p>'}
    <p class="muted small">Answers are saved in this browser only, on this computer. Clearing browser data deletes them, so use “Back up” now and then.</p>
  </main>`;
  wireNav();
  const f = $('#filter');
  f.value = histFilter; if (f.value !== histFilter) { histFilter = 'all'; f.value = 'all'; }
  f.onchange = () => { histFilter = f.value; showHistory(); };
  const selected = () => $$('[data-sel]:checked').map(c => c.closest('tr').dataset.id);
  $$('[data-sel]').forEach(c => {
    c.onchange = () => {
      const n = selected().length;
      $('#compare').disabled = n < 2 || n > 3;
      $('#compare').textContent = `Compare selected (${n})`;
    };
  });
  $('#compare').onclick = () => compare(selected());
  $$('[data-open]').forEach(b => { b.onclick = () => renderRecords(attempts().filter(a => a.id === b.closest('tr').dataset.id), 'Saved answer'); });
  $$('[data-del]').forEach(b => {
    b.onclick = () => {
      if (!confirm('Delete this answer permanently?')) return;
      store.set(K.attempts, attempts().filter(a => a.id !== b.closest('tr').dataset.id));
      showHistory();
    };
  });
  $('#export').onclick = exportData;
  $('#import').onchange = e => importData(e.target.files[0]);
}

function compare(ids) {
  const recs = ids.map(id => attempts().find(a => a.id === id)).sort((a, b) => a.date.localeCompare(b.date));
  window.scrollTo(0, 0);
  app.innerHTML = header('history') + `<main class="page full">
    <div class="toolbar"><button data-nav="history">← All my answers</button></div>
    <div class="compare" style="grid-template-columns:repeat(${recs.length},1fr)">${recs.map(r => {
      const q = getQ(r.task, r.qid);
      return `<section class="card"><h3>Task ${r.task}: ${esc(q ? shortLabel(r.task, q) : '?')}</h3>
        <p class="muted">${when(r.date)}</p>
        <div class="stats"><span class="${r.words < MIN_WORDS[r.task] ? 'bad' : ''}">${r.words} words</span><span>${fmt(r.secs)}</span>
          <span>Band: <b>${esc(r.band) || '—'}</b></span><span>Self-check: ${(r.checks || []).length}/${CHECK[r.task].length}</span></div>
        <div class="answer">${paras(r.text)}</div>
        ${r.notes ? `<h4>Feedback notes</h4><div class="notes">${paras(r.notes)}</div>` : ''}</section>`;
    }).join('')}</div></main>`;
  wireNav();
}

function exportData() {
  const data = { app: 'ielts-writing-sim', version: 1, exported: new Date().toISOString(), attempts: attempts(), errorlog: store.get(K.log, '') };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: `ielts-writing-backup-${data.exported.slice(0, 10)}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function importData(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('That file is not a valid backup.', true); }
  const valid = x => x && typeof x.id === 'string' && (x.task === 1 || x.task === 2) && Number.isFinite(x.qid)
    && typeof x.text === 'string' && typeof x.date === 'string';
  const incoming = Array.isArray(data?.attempts) ? data.attempts.filter(valid) : [];
  if (!incoming.length) return toast('No answers found in that file.', true);
  const all = attempts(), have = new Set(all.map(a => a.id));
  const added = incoming.filter(a => !have.has(a.id)).map(a => ({
    mode: a.task === 1 ? 't1' : 't2', secs: 0, overtime: 0, band: '', notes: '', checks: [], ...a, words: countWords(a.text) }));
  if (!store.set(K.attempts, [...all, ...added])) return;
  if (typeof data.errorlog === 'string' && !store.get(K.log, '').trim()) store.set(K.log, data.errorlog);
  toast(`Restored ${added.length} answer(s); ${incoming.length - added.length} were already here.`);
  showHistory();
}

// ---------- start ----------
$('#zoom').onclick = () => { $('#zoom').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#zoom').hidden = true; });
if (!Array.isArray(T1) || !Array.isArray(T2)) {
  app.innerHTML = '<p class="banner warn">Question files are missing. Keep task1.js and task2.js next to index.html (run build_questions.py to recreate task1.js).</p>';
} else home();
