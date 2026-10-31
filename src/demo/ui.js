// Live demo screens: Check the records → Sort out the problems → Fix the cause, with the weekly report beside them.
// Every number comes from ./engine.js. All emails and replies are simulated and say so on screen.
// The section's static HTML (index.html) is what visitors see without JavaScript; this replaces it.

import { esc } from '../forms.js';
import { BUSINESS, NEW_INVOICE, R118_REPLY, TEST_REQUEST } from './data.js';
import {
  CHECKS, initialState, report, check, confirmMerge, raiseInvoice, askAddress, receiveReply, fixForm, sendTest, allSorted,
} from './engine.js';

const STAGES = [['check', 'Check the records'], ['resolve', 'Sort out the problems'], ['connect', 'Fix the cause']];
const ROWS = [['booked', 'Booked'], ['waiting', 'Waiting on someone'], ['notInvoiced', 'Done, not invoiced']];
const REAL_LINE = 'This site’s own booking works the same way: your request checks my calendar, books the slot, sends the invite and logs it, with nobody retyping anything.';

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
          <p class="dm-flag" hidden></p>
        </aside>
      </div>
      <p class="sr-only" aria-live="polite"></p>
    </div>`;
  const stage = root.querySelector('.dm-stage');
  const live = root.querySelector('[aria-live]');
  const say = (m) => { live.textContent = ''; setTimeout(() => { live.textContent = m; }, 30); };

  // ---- the report: the changed number shows its before and after for a few seconds
  function paintReport() {
    const next = report(s);
    for (const [k] of ROWS) {
      const row = root.querySelector(`.dm-r-row[data-k="${k}"]`);
      const old = row.querySelector('.dm-old');
      row.querySelector('b').textContent = next[k];
      if (next[k] !== shown[k]) {
        old.textContent = `${shown[k]} → `;
        row.classList.remove('is-changed'); void row.offsetWidth; row.classList.add('is-changed');
        clearTimeout(row._t);
        row._t = setTimeout(() => { old.textContent = ''; row.classList.remove('is-changed'); }, 3500);
      }
    }
    const tag = root.querySelector('.dm-r-tag');
    tag.textContent = next.tag;
    tag.dataset.tag = next.tag;
    const flag = root.querySelector('.dm-flag');
    flag.hidden = !next.likelyDuplicates;
    flag.textContent = next.likelyDuplicates ? '1 likely duplicate in Booked' : '';
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
    if (r.status === 'booked') return `Booked ${r.when}${r.jobRef ? ` (now ${r.jobRef})` : ''}`;
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

  function cards() {
    const a = prob('duplicate'); const b = prob('invoice'); const c = prob('address');
    const cardA = a.done
      ? '<li class="dm-card is-done"><p><strong>J-2049 and J-2051:</strong> Merged. One visit stays booked for M. Santos, Thu 12 Nov 09:00.</p></li>'
      : `<li class="dm-card"><p class="dm-kind">Likely duplicate</p><p><strong>J-2049 and J-2051</strong> look like the same visit: M. Santos, aircon service, Thu 12 Nov 09:00.</p>${btn('merge', 'Confirm merge')}</li>`;
    const cardB = b.done
      ? `<li class="dm-card is-done"><p><strong>J-2041:</strong> Invoice ${NEW_INVOICE} created for the gutter repair.</p></li>`
      : `<li class="dm-card"><p class="dm-kind">Done, never invoiced</p><p><strong>J-2041</strong>, gutter repair for D. Cruz, was marked invoiced but no invoice exists.</p>${btn('invoice', 'Raise the invoice')}</li>`;
    let cardC;
    if (c.done) cardC = `<li class="dm-card is-done"><p><span class="dm-sim">Simulated reply</span> from G. Torres: ${R118_REPLY.address}.</p><p><strong>R-118</strong> is booked as ${R118_REPLY.ref}, ${R118_REPLY.when}.</p></li>`;
    else if (addressAsked) cardC = '<li class="dm-card is-waiting"><p><span class="dm-sim">Simulated email</span> sent to G. Torres asking for the address.</p><p>Waiting on customer…</p></li>';
    else cardC = '<li class="dm-card"><p class="dm-kind">Can’t be booked</p><p>Website request <strong>R-118</strong> from G. Torres never reached the job list, and has no address.</p>' + btn('ask', 'Ask for the address') + '</li>';
    return `<ul class="dm-cards">${cardA}${cardB}${cardC}</ul>`;
  }

  function formMock(fixed, filled) {
    const f = (label, value, req) => `<div class="dm-field${req ? ' is-new' : ''}"><span class="dm-f-label">${esc(label)}${req ? ' <em>(required)</em>' : ''}</span><span class="dm-f-box">${value ? esc(value) : ''}</span></div>`;
    return `<div class="dm-form${fixed ? ' is-fixed' : ''}" aria-label="Website request form, ${fixed ? 'after' : 'before'}">
      <p class="dm-form-title">Request a repair</p>
      ${f('Name', filled ? TEST_REQUEST.customer : '')}${f('Email', filled ? 'test@example.com' : '')}
      ${fixed ? `${f('Address', filled ? TEST_REQUEST.address : '', true)}${f('Service', filled ? TEST_REQUEST.job : '', true)}${f('Preferred time (free times from the calendar)', filled ? TEST_REQUEST.when : '', true)}` : f('Message', '')}
    </div>`;
  }

  const PATH = ['Website form', 'Job list (all 4 checks pass)', 'Calendar', 'Confirmation email (simulated)', 'This week’s report'];

  function paintStage(focus = false) {
    paintStrip();
    let h = '';
    if (phase === 'ready') {
      h = `<h3 class="dm-h">Monday morning at ${esc(BUSINESS)}</h3>
        <p>18 records from the website, phone calls and email. The report says 11 jobs are booked and nothing is waiting to be invoiced.</p>
        ${btn('check', 'Check the records')}`;
    } else if (phase === 'checking') {
      h = `<h3 class="dm-h">Checking 18 records</h3><ol class="dm-checks">${CHECKS.map((c, i) => `<li class="${i < ticked ? 'is-done' : ''}">${esc(c.label)}</li>`).join('')}</ol>`;
    } else if (phase === 'resolve') {
      h = `<h3 class="dm-h">18 records checked. 14 were fine. 3 problems involve the other 4.</h3>
        <p class="dm-note">The report was wrong in three places. It now shows what’s actually true.</p>${cards()}`;
    } else if (phase === 'connect' && !s.formFixed) {
      h = `<p class="dm-sorted">All three problems sorted.</p>
        <h3 class="dm-h">Why did R-118 arrive without an address?</h3>
        <p>The website form only asked for a name, an email and a message.</p>${formMock(false, false)}${btn('fix', 'Fix the request form')}`;
    } else if (phase === 'connect') {
      h = `<p class="dm-sorted">All three problems sorted.</p>
        <h3 class="dm-h">Every request now arrives ready to book.</h3>${formMock(true, true)}${btn('send', 'Send a test request')}`;
    } else if (phase === 'sent' || phase === 'end') {
      h = `<h3 class="dm-h">${esc(TEST_REQUEST.request)} on its way</h3>
        <ol class="dm-path">${PATH.map((p, i) => `<li class="${i < pathLit ? 'is-lit' : ''}">${esc(p)}</li>`).join('')}</ol>
        ${pathLit >= PATH.length ? `<p class="dm-note">${esc(TEST_REQUEST.request)} is now ${esc(TEST_REQUEST.ref)}, booked ${esc(TEST_REQUEST.when)}. Nobody retyped anything.</p>` : ''}`;
      if (phase === 'end') {
        const waiting = s.records.filter((r) => r.status === 'waiting');
        h += `<div class="dm-end">
          <h3 class="dm-h">Checked first, fixed at the source.</h3>
          <p>The numbers are right, the problems have owners, and the form won’t let this one happen again next week.</p>
          <p class="dm-note">${waiting.length} jobs are still waiting, each with a reason:</p>
          <ul class="dm-waiting">${waiting.map((r) => `<li><strong>${esc(r.ref)}</strong> ${esc(r.reason)}</li>`).join('')}</ul>
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
      s = check(s).state; phase = 'resolve'; paintReport(); paintStage(true);
      say('Checks finished: 3 problems found, report corrected.');
      busy = false; return;
    }
    if (a === 'merge') { s = confirmMerge(s); paintReport(); say('Duplicate merged; one visit stays booked.'); }
    if (a === 'invoice') { s = raiseInvoice(s); paintReport(); say(`Invoice created for J-2041.`); }
    if (a === 'ask') {
      busy = true; addressAsked = true; s = askAddress(s); paintStage(); say('Simulated email sent to G. Torres.');
      await wait(1500);
      s = receiveReply(s); paintReport(); say(`R-118 booked as ${R118_REPLY.ref}.`);
      busy = false;
    }
    if ((a === 'merge' || a === 'invoice' || a === 'ask') && allSorted(s)) {
      paintStage(); await wait(700); phase = 'connect'; paintStage(true); return;
    }
    if (a === 'merge' || a === 'invoice' || a === 'ask') {
      paintStage();
      stage.querySelector('.dm-card:not(.is-done) .dm-btn')?.focus();
      return;
    }
    if (a === 'fix') { s = fixForm(s); paintReport(); paintStage(true); say('Request form fixed.'); return; }
    if (a === 'send') {
      busy = true;
      const res = sendTest(s); s = res.state; phase = 'sent'; pathLit = 0; paintStage(true);
      for (let i = 1; i <= PATH.length; i++) {
        await wait(350); pathLit = i; paintStage();
        if (i === PATH.length) paintReport();
      }
      say(`Test request booked as ${TEST_REQUEST.ref}.`);
      await wait(600); phase = 'end'; paintStage(true);
      busy = false; return;
    }
    if (a === 'restart') {
      s = initialState(); phase = 'ready'; addressAsked = false; pathLit = 0; ticked = 0;
      shown = report(s); paintReport(); paintStage(true);
    }
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) act(b.dataset.act);
  });

  paintReport();
  paintStage();
  return { check: () => act('check'), get phase() { return phase; } };
}
