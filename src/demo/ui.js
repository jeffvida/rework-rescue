// Live demo screens: Check the records → Sort out the problems → Fix the cause, with the weekly report beside them.
// Written for a business owner: names and dates, not record IDs (those stay in "See all records"), one
// "Your move" line per step, and a plain reason beside every number that changes.
// Every number comes from ./engine.js. All emails and replies are simulated and say so on screen.
// The section's static HTML (index.html) is what visitors see without JavaScript; this replaces it.

import { esc } from '../forms.js';
import { R118_REPLY, TEST_REQUEST } from './data.js';
import {
  CHECKS, initialState, report, check, confirmMerge, raiseInvoice, askAddress, receiveReply, fixForm, sendTest, allSorted,
} from './engine.js';

const STAGES = [['check', 'Check the records'], ['resolve', 'Sort out the problems'], ['connect', 'Fix the cause']];
const ROWS = [['booked', 'Booked'], ['waiting', 'Waiting on someone'], ['notInvoiced', 'Done, not invoiced']];
const REAL_LINE = 'This site’s own booking works the same way: your request checks my calendar, books the slot, sends the invite and logs it, with nobody retyping anything.';

/** 'Thu 12 Nov 09:00' → 'Thu 12 Nov, 9am' */
export function when(text) {
  const m = /^(.*) (\d{2}):(\d{2})$/.exec(text || '');
  if (!m) return text || '';
  const h = Number(m[2]); const min = m[3];
  const hour = ((h + 11) % 12) + 1;
  return `${m[1]}, ${hour}${min === '00' ? '' : `:${min}`}${h < 12 ? 'am' : 'pm'}`;
}

export function mountDemo(root) {
  if (!root) return null;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  let s = initialState();
  let phase = 'ready'; // ready | checking | resolve | connect | sent | end
  let ticked = 0;
  let addressAsked = false;
  let pathLit = 0;
  let busy = false;
  let shown = report(s);
  const changes = {}; // problem id → "Booked 11 → 10" etc., shown on its card once sorted

  root.innerHTML = `
    <div class="dm">
      <ol class="dm-strip">${STAGES.map(([k, l]) => `<li data-stage="${k}">${esc(l)}</li>`).join('')}</ol>
      <div class="dm-grid">
        <div class="dm-main"><div class="dm-stage" tabindex="-1"></div>
          <details class="dm-all"><summary>See all 18 records</summary><div class="dm-all-body"></div></details>
        </div>
        <aside class="dm-report" aria-label="This week’s report">
          <p class="dm-r-title">This week’s report</p>
          <p class="dm-r-tag"></p>
          <dl class="dm-r-rows">${ROWS.map(([k, l]) => `<div class="dm-r-row" data-k="${k}"><dt>${esc(l)}</dt><dd><span class="dm-old"></span><b></b></dd></div>`).join('')}</dl>
          <p class="dm-last"></p>
        </aside>
      </div>
      <p class="sr-only" aria-live="polite"></p>
    </div>`;
  const stage = root.querySelector('.dm-stage');
  const live = root.querySelector('.dm > [aria-live]');
  const lastLine = root.querySelector('.dm-last');
  const say = (m) => { live.textContent = ''; setTimeout(() => { live.textContent = m; }, 30); };

  /** The rows that changed between two reports, as "Booked 11 → 10". */
  const diff = (a, b) => ROWS.filter(([k]) => a[k] !== b[k]).map(([k, l]) => `${l} ${a[k]} → ${b[k]}`).join(', ');

  // ---- the report: the changed number shows its before and after, with the reason underneath
  function paintReport(reason) {
    const next = report(s);
    for (const [k] of ROWS) {
      const row = root.querySelector(`.dm-r-row[data-k="${k}"]`);
      const old = row.querySelector('.dm-old');
      row.querySelector('b').textContent = next[k];
      if (next[k] !== shown[k]) {
        old.textContent = `${shown[k]} → `;
        row.classList.remove('is-changed'); void row.offsetWidth; row.classList.add('is-changed');
        clearTimeout(row._t);
        row._t = setTimeout(() => { old.textContent = ''; row.classList.remove('is-changed'); }, 4000);
      }
    }
    const tag = root.querySelector('.dm-r-tag');
    tag.textContent = next.tag;
    tag.dataset.tag = next.tag;
    if (reason !== undefined) lastLine.textContent = reason;
    shown = next;
  }

  function paintStrip() {
    const at = { ready: 0, checking: 0, resolve: 1, connect: 2, sent: 2, end: 3 }[phase];
    root.querySelectorAll('.dm-strip li').forEach((li, i) => {
      li.classList.toggle('is-on', i === at);
      li.classList.toggle('is-done', i < at);
      if (i === at) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  const statusOf = (r) => {
    if (r.merged) return 'Merged into J-2049';
    if (r.status === 'done') return `Done ${r.when}${r.invoice ? `, ${r.invoice}` : r.markedInvoiced && !s.checked ? ', marked invoiced' : ', no invoice'}`;
    if (r.status === 'booked') return `Booked ${when(r.when)}${r.jobRef ? ` (now ${r.jobRef})` : ''}`;
    if (r.status === 'waiting') return `Waiting: ${r.reason}`;
    if (r.status === 'asked') return 'Waiting on customer (address asked)';
    return 'Request in the inbox, not in the job list';
  };
  function paintAll() {
    root.querySelector('.dm-all summary').textContent = `See all ${s.records.length} records`;
    root.querySelector('.dm-all-body').innerHTML = `<div class="dm-table-wrap"><table class="dm-table"><thead><tr><th scope="col">Ref</th><th scope="col">Came in by</th><th scope="col">Customer</th><th scope="col">Job</th><th scope="col">Address</th><th scope="col">Status</th></tr></thead><tbody>${
      s.records.map((r) => `<tr><td>${esc(r.ref)}</td><td>${esc(r.source)}</td><td>${esc(r.customer)}</td><td>${esc(r.job)}</td><td>${r.address ? esc(r.address) : '<em>none given</em>'}</td><td>${esc(statusOf(r))}</td></tr>`).join('')
    }</tbody></table></div>`;
  }

  // ---- stage content
  const btn = (action, label, primary = true) => `<button type="button" class="btn ${primary ? 'btn-primary' : 'btn-secondary'} dm-btn" data-act="${action}">${esc(label)}</button>`;
  const prob = (id) => s.problems.find((p) => p.id === id);
  const move = (text) => `<p class="dm-move"><span>Your move:</span> ${text}</p>`;
  const upd = (id) => (changes[id] ? `<p class="dm-upd">Report updated: ${esc(changes[id])}</p>` : '');

  function cards() {
    const a = prob('duplicate'); const b = prob('invoice'); const c = prob('address');
    const cardA = a.done
      ? `<li class="dm-card is-done"><p class="dm-card-h">Santos aircon visit: merged</p><p>One visit stays booked for Thu 12 Nov, 9am.</p>${upd('duplicate')}</li>`
      : `<li class="dm-card"><p class="dm-card-h">The Santos aircon visit is booked twice</p><p>M. Santos is in the diary twice for Thu 12 Nov, 9am: once from a phone call and once from the website. Same address, same job.</p>${btn('merge', 'Merge into one visit')}</li>`;
    const cardB = b.done
      ? `<li class="dm-card is-done"><p class="dm-card-h">Cruz gutter repair: invoiced</p><p>The invoice has been raised.</p>${upd('invoice')}</li>`
      : `<li class="dm-card"><p class="dm-card-h">The Cruz gutter repair was never invoiced</p><p>The job was done on Thu 5 Nov and marked as invoiced, but there’s no invoice in the accounts.</p>${btn('invoice', 'Raise the invoice')}</li>`;
    let cardC;
    if (c.done) cardC = `<li class="dm-card is-done"><p class="dm-card-h">Torres water heater service: booked</p><p><span class="dm-sim">Simulated reply</span> G. Torres sent the address (${esc(R118_REPLY.address)}). Booked for ${esc(when(R118_REPLY.when))}.</p>${upd('address')}</li>`;
    else if (addressAsked) cardC = '<li class="dm-card is-waiting"><p class="dm-card-h">The Torres request can’t be booked yet</p><p><span class="dm-sim">Simulated email</span> sent to G. Torres asking for the address. Waiting for a reply…</p></li>';
    else cardC = `<li class="dm-card"><p class="dm-card-h">The Torres request can’t be booked</p><p>G. Torres asked for a water heater service on the website. The request never reached the job list, and there’s no address.</p>${btn('ask', 'Ask for the address')}</li>`;
    return `<ul class="dm-cards">${cardA}${cardB}${cardC}</ul>`;
  }

  // The website form, shown as a picture (not something to type in): before, and after the fix.
  const FORM_BEFORE = ['Name', 'Email', 'Message'];
  const FORM_AFTER = [['Name'], ['Email'], ['Address', 'new, required'], ['Service needed', 'new, required'], ['Preferred time', 'new, shows free times from the calendar']];
  function formPicture(fixed) {
    const before = `<figure class="dm-fp"><figcaption>Before</figcaption><ul>${FORM_BEFORE.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></figure>`;
    const after = fixed ? `<figure class="dm-fp is-after"><figcaption>After</figcaption><ul>${FORM_AFTER.map(([f, note]) => `<li class="${note ? 'is-new' : ''}">${esc(f)}${note ? ` <em>${esc(note)}</em>` : ''}</li>`).join('')}</ul></figure>` : '';
    return `<div class="dm-forms" role="img" aria-label="${fixed ? 'The website request form before and after: address, service and preferred time are now asked for' : 'The website request form asks only for a name, an email and a message'}">${before}${after}</div>`;
  }

  const PATH = ['Request received', 'Checked: nothing missing', `Booked ${when(TEST_REQUEST.when)}`, 'Confirmation sent (simulated)', 'Report updated'];

  function paintStage(focus = false) {
    paintStrip();
    let h = '';
    if (phase === 'ready') {
      h = `<h3 class="dm-h">Monday morning. The report was built by hand.</h3>
        <p>It says 11 jobs are booked and nothing is waiting to be invoiced. It was put together from website requests, phone calls and emails.</p>
        ${move('check the 18 records behind it.')}${btn('check', 'Check the records')}`;
    } else if (phase === 'checking') {
      h = `<h3 class="dm-h">Checking the 18 records</h3><ol class="dm-checks">${CHECKS.map((c, i) => `<li class="${i < ticked ? 'is-done' : ''}">${esc(c.label)}</li>`).join('')}</ol>`;
    } else if (phase === 'resolve') {
      const sorted = s.problems.filter((p) => p.done).length;
      h = `<h3 class="dm-h">The report was wrong in 3 places.</h3>
        <p class="dm-upd">Report corrected: ${esc(changes.check || '')}. One booking looks doubled.</p>
        ${move(`sort out these 3 <span class="dm-count">(${sorted} of 3 done)</span>. Watch the report change as you go.`)}${cards()}`;
    } else if (phase === 'connect' && !s.formFixed) {
      h = `<p class="dm-sorted">All 3 sorted. The report is right again.</p>
        <h3 class="dm-h">Why did the Torres request arrive without an address?</h3>
        <p>Because the website form never asked for one.</p>${formPicture(false)}
        ${move('fix the cause, so it doesn’t happen next week.')}${btn('fix', 'Fix the request form')}`;
    } else if (phase === 'connect') {
      h = `<p class="dm-sorted">All 3 sorted. The report is right again.</p>
        <h3 class="dm-h">Every request now arrives ready to book.</h3>${formPicture(true)}
        ${move(`send a test request: ${esc(TEST_REQUEST.job.toLowerCase())} at ${esc(TEST_REQUEST.address)}, ${esc(when(TEST_REQUEST.when))}.`)}${btn('send', 'Send a test request')}`;
    } else if (phase === 'sent' || phase === 'end') {
      h = `<h3 class="dm-h">The test request, step by step</h3>
        <ol class="dm-path">${PATH.map((p, i) => `<li class="${i < pathLit ? 'is-lit' : ''}">${esc(p)}</li>`).join('')}</ol>
        ${pathLit >= PATH.length ? '<p class="dm-upd">Booked by itself. Nobody retyped anything.</p>' : ''}`;
      if (phase === 'end') {
        const waiting = s.records.filter((r) => r.status === 'waiting');
        h += `<div class="dm-end">
          <h3 class="dm-h">Checked first, fixed at the source.</h3>
          <p>The numbers are right, each problem had someone to sort it, and the form won’t let this one happen again next week.</p>
          <p class="dm-note">${waiting.length} jobs are still waiting, and that’s fine: each has a reason.</p>
          <ul class="dm-waiting">${waiting.map((r) => `<li><strong>${esc(r.customer)}, ${esc(r.job.toLowerCase())}:</strong> ${esc(r.reason.charAt(0).toLowerCase() + r.reason.slice(1))}</li>`).join('')}</ul>
          <p class="dm-real">${esc(REAL_LINE)}</p>
          <p class="dm-end-actions"><a class="btn btn-primary" href="contact/#contact-form-area">Book a free rework review</a>${btn('restart', 'Run it again', false)}</p>
        </div>`;
      }
    }
    stage.innerHTML = h;
    paintAll();
    if (focus) (stage.querySelector('.dm-end .dm-h') || stage.querySelector('.dm-h') || stage).focus({ preventScroll: false });
  }

  // ---- actions
  async function act(a) {
    if (busy) return;
    if (a === 'check' && phase === 'ready') {
      busy = true; phase = 'checking'; ticked = 0; paintStage(true);
      for (let i = 1; i <= CHECKS.length; i++) { await wait(450); ticked = i; paintStage(); }
      await wait(250);
      const before = report(s);
      s = check(s).state; phase = 'resolve';
      changes.check = diff(before, report(s));
      paintReport('Waiting +1: a website request was stuck in the inbox. Not invoiced +1: a finished job has no invoice. Booked: one visit looks booked twice.');
      paintStage(true);
      say(`Checks finished. The report was wrong in 3 places. ${changes.check}.`);
      busy = false; return;
    }
    if (a === 'merge' || a === 'invoice' || a === 'ask') {
      const before = report(s);
      if (a === 'merge') {
        s = confirmMerge(s); changes.duplicate = diff(before, report(s));
        paintReport('Booked −1: the visit booked twice is now one.'); say(`Santos visit merged. ${changes.duplicate}.`);
      }
      if (a === 'invoice') {
        s = raiseInvoice(s); changes.invoice = diff(before, report(s));
        paintReport('Not invoiced −1: the Cruz invoice was raised.'); say(`Invoice raised. ${changes.invoice}.`);
      }
      if (a === 'ask') {
        busy = true; addressAsked = true; s = askAddress(s); paintStage(); say('Simulated email sent to G. Torres asking for the address.');
        await wait(1500);
        s = receiveReply(s); changes.address = diff(before, report(s));
        paintReport('Booked +1, Waiting −1: G. Torres replied, so the job is booked.'); say(`Torres job booked. ${changes.address}.`);
        busy = false;
      }
      if (allSorted(s)) { paintStage(); await wait(900); phase = 'connect'; paintStage(true); return; }
      paintStage();
      stage.querySelector('.dm-card:not(.is-done) .dm-btn')?.focus();
      return;
    }
    if (a === 'fix') {
      s = fixForm(s); paintReport('No change yet: the fix protects next week’s requests.'); paintStage(true); say('Request form fixed.'); return;
    }
    if (a === 'send') {
      busy = true;
      const res = sendTest(s); s = res.state; phase = 'sent'; pathLit = 0; paintStage(true);
      for (let i = 1; i <= PATH.length; i++) {
        await wait(400); pathLit = i; paintStage();
        if (i === PATH.length) paintReport('Booked +1: the test request booked itself.');
      }
      say('Test request booked by itself. Booked is now 12.');
      await wait(700); phase = 'end'; paintStage(true);
      busy = false; return;
    }
    if (a === 'restart') {
      s = initialState(); phase = 'ready'; addressAsked = false; pathLit = 0; ticked = 0;
      Object.keys(changes).forEach((k) => delete changes[k]);
      shown = report(s); paintReport('Built by hand from the job list.'); paintStage(true);
    }
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) act(b.dataset.act);
  });

  paintReport('Built by hand from the job list.');
  paintStage();
  return { check: () => act('check'), get phase() { return phase; } };
}
