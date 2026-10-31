// Live demo screens: Check the records → Sort out the problems → Fix the cause, with the weekly report beside them.
// Roles are explicit: the checks and automations (set up once) find problems and prepare the next step; you, the
// owner, decide; your team does the jobs that need a person; I fix the cause. Each problem offers two real choices.
// Written for a business owner: names and dates, not record IDs (those stay in "See all records").
// Every number comes from ./engine.js. All emails, calls and replies are simulated and say so on screen.
// The section's static HTML (index.html) is what visitors see without JavaScript; this replaces it.

import { esc } from '../forms.js';
import { R118_REPLY, TEST_REQUEST } from './data.js';
import {
  CHECKS, initialState, report, check, confirmMerge, keepBoth, raiseInvoice, markNotBillable, askAddress, receiveReply,
  fixForm, sendTest, allSorted,
} from './engine.js';

const STAGES = [
  ['Data & Reporting Rework', 'Check the records'],
  ['Workflow Rework', 'Sort out the problems'],
  ['Systems Rework', 'Fix the cause'],
];
const SERVICE_LINE = [
  'First, make the information trustworthy.',
  'Next, turn each problem into a decision.',
  'Finally, fix the source so it doesn’t come back.',
];
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
  let pathLit = 0;
  let busy = false;
  let shown = report(s);
  let choices = {};   // problem id → the choice made ('merge' | 'keep' | 'send' | 'nobill' | 'email' | 'call')
  let changes = {};   // problem id or 'check' → "Booked 11 → 10"
  let formShown = false;

  root.innerHTML = `
    <div class="dm">
      <ol class="dm-strip">${STAGES.map(([svc, step]) => `<li><span class="dm-s-svc">${esc(svc)}</span><span class="dm-s-step">${esc(step)}</span></li>`).join('')}</ol>
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

  const stageIndex = () => ({ ready: 0, checking: 0, resolve: 1, connect: 2, sent: 2, end: 3 }[phase]);
  function paintStrip() {
    const at = stageIndex();
    root.querySelectorAll('.dm-strip li').forEach((li, i) => {
      li.classList.toggle('is-on', i === at);
      li.classList.toggle('is-done', i < at);
      if (i === at) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  const statusOf = (r) => {
    if (r.merged) return 'Merged into J-2049';
    if (r.confirmedSeparate) return `Booked ${when(r.when)}, confirmed as a separate visit`;
    if (r.status === 'done') return `Done ${r.when}${r.invoice ? `, ${r.invoice}` : r.notBillable ? ', not billable (warranty)' : r.markedInvoiced && !s.checked ? ', marked invoiced' : ', no invoice'}`;
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

  // ---- building blocks
  const btn = (action, label, kind = 'primary') => `<button type="button" class="btn btn-${kind} dm-btn" data-act="${action}">${esc(label)}</button>`;
  const prob = (id) => s.problems.find((p) => p.id === id);
  const move = (text) => `<p class="dm-move"><span>Your move:</span> ${text}</p>`;
  const upd = (id) => (changes[id] ? `<p class="dm-upd">Report updated: ${esc(changes[id])}</p>` : '');
  const svc = () => { const i = Math.min(stageIndex(), 2); return `<p class="dm-svc"><strong>${esc(STAGES[i][0])}.</strong> ${esc(SERVICE_LINE[i])}</p>`; };
  const roles = (...tags) => `<p class="dm-roles">${tags.map(([cls, t]) => `<span class="dm-role dm-role-${cls}">${esc(t)}</span>`).join('')}</p>`;
  const choice = (a, b) => `<div class="dm-choices" role="group" aria-label="Your decision">${btn(a[0], a[1], 'secondary')}${btn(b[0], b[1], 'secondary')}</div>`;

  function cards() {
    const a = prob('duplicate'); const b = prob('invoice'); const c = prob('address');
    const tagsOpen = roles(['auto', 'Prepared automatically'], ['you', 'Your decision']);

    let cardA;
    if (!a.done) cardA = `<li class="dm-card">${tagsOpen}<p class="dm-card-h">The Santos aircon visit is booked twice</p>
      <p>The checks noticed M. Santos twice for Thu 12 Nov, 9am: once from a phone call, once from the website. Same address, same job.</p>
      ${choice(['merge', 'Merge into one visit'], ['keep', 'Keep both: they’re separate visits'])}</li>`;
    else if (choices.duplicate === 'merge') cardA = `<li class="dm-card is-done"><p class="dm-card-h">Santos aircon visit: merged</p><p>You decided it was one visit. It stays booked for Thu 12 Nov, 9am, and nobody turns up twice.</p>${upd('duplicate')}</li>`;
    else cardA = `<li class="dm-card is-done"><p class="dm-card-h">Santos aircon visits: kept as two</p><p>You decided they’re separate visits. Both stay booked and won’t be flagged again.</p><p class="dm-upd">Report: no change, Booked stays ${shown.booked}.</p></li>`;

    let cardB;
    if (!b.done) cardB = `<li class="dm-card">${tagsOpen}<p class="dm-card-h">The Cruz gutter repair was never invoiced</p>
      <p>Done on Thu 5 Nov and marked as invoiced, but there’s no invoice in the accounts. An invoice has been drafted, ready to send.</p>
      ${choice(['invoice', 'Send the drafted invoice'], ['nobill', 'Not billable: it was warranty work'])}</li>`;
    else if (choices.invoice === 'send') cardB = `<li class="dm-card is-done"><p class="dm-card-h">Cruz gutter repair: invoiced</p><p><span class="dm-sim">Simulated</span> The drafted invoice was sent.</p>${upd('invoice')}</li>`;
    else cardB = `<li class="dm-card is-done"><p class="dm-card-h">Cruz gutter repair: not billable</p><p>You marked it as warranty work, so it won’t show as missing an invoice again.</p>${upd('invoice')}</li>`;

    let cardC;
    const asked = s.records.find((r) => r.ref === 'R-118')?.status === 'asked';
    if (c.done && choices.address === 'call') cardC = `<li class="dm-card is-done"><p class="dm-card-h">Torres water heater service: booked</p><p><span class="dm-sim">Simulated</span> Dana called G. Torres and got the address (${esc(R118_REPLY.address)}). Booked for ${esc(when(R118_REPLY.when))}.</p>${upd('address')}</li>`;
    else if (c.done) cardC = `<li class="dm-card is-done"><p class="dm-card-h">Torres water heater service: booked</p><p><span class="dm-sim">Simulated</span> G. Torres replied with the address (${esc(R118_REPLY.address)}). Booked for ${esc(when(R118_REPLY.when))}.</p>${upd('address')}</li>`;
    else if (asked && choices.address === 'call') cardC = `<li class="dm-card is-waiting">${roles(['team', 'Your team'])}<p class="dm-card-h">The Torres request: Dana is calling</p><p><span class="dm-sim">Simulated</span> Dana from the office is calling G. Torres for the address…</p></li>`;
    else if (asked) cardC = `<li class="dm-card is-waiting">${roles(['auto', 'Sent automatically'])}<p class="dm-card-h">The Torres request: email sent</p><p><span class="dm-sim">Simulated</span> The email went to G. Torres. Waiting for a reply…</p></li>`;
    else cardC = `<li class="dm-card">${tagsOpen}<p class="dm-card-h">The Torres request can’t be booked</p>
      <p>G. Torres asked for a water heater service on the website. The request never reached the job list, and there’s no address. An email asking for it has been written.</p>
      ${choice(['email', 'Send the email'], ['call', 'Ask Dana to call instead'])}</li>`;
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

  function whoDidWhat() {
    const lines = [
      ['auto', 'The checks and automations', `checked 18 records, prepared ${choices.invoice === 'send' ? 'an invoice' : 'the invoice'} and ${choices.address === 'call' ? 'the email' : 'an email'}, and booked your test request by itself.`],
      ['you', 'You', 'made 3 decisions.'],
    ];
    if (choices.address === 'call') lines.push(['team', 'Your team', 'Dana made one phone call.']);
    lines.push(['me', 'Me', 'fixed the form, so this problem won’t come back.']);
    return `<ul class="dm-who">${lines.map(([cls, who, what]) => `<li><span class="dm-role dm-role-${cls}">${esc(who)}</span> ${esc(what)}</li>`).join('')}</ul>`;
  }

  function paintStage(focus = false) {
    paintStrip();
    let h = '';
    if (phase === 'ready') {
      h = `${svc()}${roles(['auto', 'Runs automatically every Monday'])}
        <h3 class="dm-h">Monday morning. The report was built by hand.</h3>
        <p>It says 11 jobs are booked and nothing is waiting to be invoiced. Once I’ve set up the checks, they run on their own every Monday. Here you just press the button to watch them.</p>
        ${move('run Monday’s checks.')}${btn('check', 'Run Monday’s checks')}`;
    } else if (phase === 'checking') {
      h = `${svc()}${roles(['auto', 'Running automatically'])}<h3 class="dm-h">Checking the 18 records</h3><ol class="dm-checks">${CHECKS.map((c, i) => `<li class="${i < ticked ? 'is-done' : ''}">${esc(c.label)}</li>`).join('')}</ol>`;
    } else if (phase === 'resolve') {
      const sorted = s.problems.filter((p) => p.done).length;
      h = `${svc()}<h3 class="dm-h">The report was wrong in 3 places.</h3>
        <p class="dm-upd">Report corrected: ${esc(changes.check || '')}. One booking looks doubled.</p>
        <p>For each problem, the next step is already prepared. You don’t do the work; you decide.</p>
        ${move(`make 3 decisions <span class="dm-count">(${sorted} of 3 done)</span>. Watch the report change as you go.`)}${cards()}`;
    } else if (phase === 'connect' && !formShown) {
      h = `${svc()}<p class="dm-sorted">All 3 decided. The report is right again.</p>
        <h3 class="dm-h">Why did the Torres request have no address?</h3>
        <p>Because the website form never asked for one. Fixing that is my part: I change the form and connect it to your calendar and job list.</p>
        ${roles(['me', 'My part'])}${formPicture(false)}
        ${move('see the form I’d build.')}${btn('fix', 'See the fixed form')}`;
    } else if (phase === 'connect') {
      h = `${svc()}<p class="dm-sorted">All 3 decided. The report is right again.</p>
        <h3 class="dm-h">Every request now arrives ready to book.</h3>${formPicture(true)}
        ${roles(['customer', 'Now play the customer'])}
        ${move(`send a request through the new form: ${esc(TEST_REQUEST.job.toLowerCase())} at ${esc(TEST_REQUEST.address)}, ${esc(when(TEST_REQUEST.when))}.`)}${btn('send', 'Send a request through the new form')}`;
    } else if (phase === 'sent' || phase === 'end') {
      h = `${svc()}<h3 class="dm-h">Your request, step by step</h3>
        <ol class="dm-path">${PATH.map((p, i) => `<li class="${i < pathLit ? 'is-lit' : ''}">${esc(p)}</li>`).join('')}</ol>
        ${pathLit >= PATH.length ? '<p class="dm-upd">Booked by itself. Nobody retyped anything.</p>' : ''}`;
      if (phase === 'end') {
        h += `<div class="dm-end">
          <h3 class="dm-h">Checked first, fixed at the source.</h3>
          <p class="dm-end-sub">Who did what</p>
          ${whoDidWhat()}
          <p class="dm-end-sub">One process, three improvements</p>
          <ul class="dm-three">
            <li><a href="#services">Data &amp; Reporting Rework</a>: you know which numbers are right.</li>
            <li><a href="#services">Workflow Rework</a>: each problem comes to you with the next step prepared.</li>
            <li><a href="#services">Systems Rework</a>: your tools work together, so it doesn’t happen again.</li>
          </ul>
          <p class="dm-note">The 3 jobs still waiting each have a reason: a part on order, a quote with the customer, a customer away.</p>
          <p class="dm-real">${esc(REAL_LINE)}</p>
          <p class="dm-end-actions"><a class="btn btn-primary" href="contact/#contact-form-area">Book a free rework review</a>
            <span>Which part of your process needs rework? <a href="assessment/">Find Your Rework</a></span>
            <button type="button" class="dm-link" data-act="restart">Run it again</button></p>
        </div>`;
      }
    }
    stage.innerHTML = h;
    paintAll();
    if (focus) (stage.querySelector('.dm-end .dm-h') || stage.querySelector('.dm-h') || stage).focus({ preventScroll: false });
  }

  async function afterDecision() {
    if (allSorted(s)) { paintStage(); await wait(900); phase = 'connect'; formShown = false; paintStage(true); return; }
    paintStage();
    stage.querySelector('.dm-card:not(.is-done):not(.is-waiting) .dm-btn')?.focus();
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
    if (a === 'merge' || a === 'keep') {
      const before = report(s);
      choices.duplicate = a;
      s = a === 'merge' ? confirmMerge(s) : keepBoth(s);
      changes.duplicate = diff(before, report(s));
      paintReport(a === 'merge' ? 'Booked −1: the visit booked twice is now one.' : 'No change: you confirmed two separate visits.');
      say(a === 'merge' ? `Santos visit merged. ${changes.duplicate}.` : 'Kept as two visits. Booked stays the same.');
      await afterDecision(); return;
    }
    if (a === 'invoice' || a === 'nobill') {
      const before = report(s);
      choices.invoice = a === 'invoice' ? 'send' : 'nobill';
      s = a === 'invoice' ? raiseInvoice(s) : markNotBillable(s);
      changes.invoice = diff(before, report(s));
      paintReport(a === 'invoice' ? 'Not invoiced −1: the Cruz invoice was sent.' : 'Not invoiced −1: the Cruz job was warranty work, so no invoice is due.');
      say(`${a === 'invoice' ? 'Invoice sent.' : 'Marked not billable.'} ${changes.invoice}.`);
      await afterDecision(); return;
    }
    if (a === 'email' || a === 'call') {
      busy = true;
      const before = report(s);
      choices.address = a;
      s = askAddress(s, a); paintStage();
      say(a === 'email' ? 'Simulated email sent to G. Torres.' : 'Simulated: Dana is calling G. Torres.');
      await wait(1600);
      s = receiveReply(s); changes.address = diff(before, report(s));
      paintReport(`Booked +1, Waiting −1: ${a === 'email' ? 'G. Torres replied' : 'Dana got the address'}, so the job is booked.`);
      say(`Torres job booked. ${changes.address}.`);
      busy = false;
      await afterDecision(); return;
    }
    if (a === 'fix') {
      s = fixForm(s); formShown = true; paintReport('No change yet: the fixed form protects next week’s requests.'); paintStage(true); say('The fixed form: address, service and preferred time are now asked for.'); return;
    }
    if (a === 'send') {
      busy = true;
      const res = sendTest(s); s = res.state; phase = 'sent'; pathLit = 0; paintStage(true);
      for (let i = 1; i <= PATH.length; i++) {
        await wait(400); pathLit = i; paintStage();
        if (i === PATH.length) paintReport('Booked +1: your request booked itself.');
      }
      say(`Your request booked itself. Booked is now ${report(s).booked}.`);
      await wait(700); phase = 'end'; paintStage(true);
      busy = false; return;
    }
    if (a === 'restart') {
      s = initialState(); phase = 'ready'; pathLit = 0; ticked = 0; choices = {}; changes = {}; formShown = false;
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
