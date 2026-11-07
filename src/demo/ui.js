// Live demo screens, with the weekly report beside them:
//   1 Check the records (Data & Reporting): the checks run, then a short "what just happened" summary.
//   2 Sort out the problems (Workflows & Processes): a Monday review sheet, one row per problem, with what it costs and
//     the prepared next step. The owner picks a decision in each row and applies them with one click.
//   3 Fix the cause (Business Tools & Systems): why each problem happened and what I'd improve; the customer confirms (a
//     simulated button), then the visitor sends a request through the fixed form (required fields, free slots only).
//   End: who did what, the three services, a bridge for other businesses and the booking ask.
// Roles are explicit: the checks prepare, the owner decides, the team calls if chosen, I fix the cause.
// Every number comes from ./engine.js. Emails, calls and replies are simulated and say so on screen.
// The section's static HTML (index.html) is what visitors see without JavaScript; this replaces it.

import { esc } from '../forms.js';
import { R118_REPLY, TEST_REQUEST, COSTS, CAUSES, HAND_REPORT } from './data.js';
import {
  CHECKS, initialState, report, check, confirmMerge, keepBoth, raiseInvoice, markNotBillable, askAddress, receiveReply,
  fixForm, sendTest, decided, freeSlots,
} from './engine.js';

const STAGES = [
  ['Data & Reporting', 'Check the records'],
  ['Workflows & Processes', 'Sort out the problems'],
  ['Business Tools & Systems', 'Fix the cause'],
];
// Matches the service cards' colours (see .svc-data / .svc-workflow / .svc-systems in styles.css).
const SVC_CLASS = ['svc-data', 'svc-workflow', 'svc-systems'];
const SERVICE_LINE = [
  'First, make the information trustworthy.',
  'Next, turn each problem into a decision.',
  'Finally, fix the source so it doesn’t come back.',
];
const ROWS = [['booked', 'Booked'], ['waiting', 'Waiting on someone'], ['notInvoiced', 'Done, not invoiced']];
const REAL_LINE = 'This site’s own booking works the same way: your request checks my calendar, books the slot, sends the invite and logs it, with nobody retyping anything.';

// The review sheet: one row per problem, two choices each.
const SHEET = [
  { id: 'duplicate', found: 'M. Santos aircon service booked twice for Thu 12 Nov, 9am.', next: 'Merge ready to go.', why: 'Could be two real visits, so you decide.',
    options: [['merge', 'Merge into one'], ['keep', 'Keep both']] },
  { id: 'invoice', found: 'D. Cruz gutter repair completed Thu 5 Nov, but no invoice exists in the accounts.', next: 'Invoice drafted, ready to send.', why: 'Could be warranty work, so you decide.',
    options: [['send', 'Send invoice'], ['nobill', 'Not billable (warranty)']] },
  { id: 'address', found: 'G. Torres water heater request from the website is stuck in the inbox, with no address.', next: 'Email to the customer written.', why: 'Email or a call? You know the customer.',
    options: [['email', 'Send email'], ['call', 'Ask Dana to call']] },
];
const DONE_TEXT = {
  merge: 'Merged: one visit, Thu 12 Nov, 9am.',
  keep: 'Kept as two visits. Won’t be flagged again.',
  send: 'Invoice sent (simulated).',
  nobill: 'Marked warranty work, no invoice due.',
  email: 'Email sent (simulated). Waiting for the customer to confirm.',
  call: 'Dana called (simulated). Waiting for the customer to confirm.',
};
const REASON = {
  merge: 'Booked unchanged: the duplicate was already counted once.',
  keep: 'Booked +1: you confirmed two separate visits.',
  send: 'Not invoiced −1: the Cruz invoice was sent.',
  nobill: 'Not invoiced −1: the Cruz job was warranty work.',
  email: 'Waiting unchanged: G. Torres hasn’t confirmed yet.',
  call: 'Waiting unchanged: G. Torres hasn’t confirmed yet.',
};
// What the review sheet carried out, in one sentence (the default choices give the brief's wording).
const APPLIED = {
  merge: 'the duplicate booking has been confirmed as one visit',
  keep: 'the two Santos bookings have been confirmed as separate visits',
  send: 'the $480 invoice has been sent',
  nobill: 'the Cruz job has been marked as warranty work, with no invoice due',
  email: 'the customer follow-up has been prepared and sent',
  call: 'Dana has called the customer to ask for the address',
};
const appliedLine = (p) => { const t = `${APPLIED[p.duplicate]}, ${APPLIED[p.invoice]}, and ${APPLIED[p.address]}.`; return t.charAt(0).toUpperCase() + t.slice(1); };

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
  let phase = 'ready'; // ready | checking | summary | review | applying | applied | cause | form | sent | end
  let ticked = 0;
  let pathLit = 0;
  let busy = false;
  let shown = report(s);
  let picks = {};     // row id → option chosen in the sheet
  let rowDone = {};   // row id → result text once applied
  let reasons = [];   // reasons shown under the report
  let sheetError = '';
  let formError = '';
  let formVals = {};

  root.innerHTML = `
    <div class="dm">
      <ol class="dm-strip">${STAGES.map(([svc, step], i) => `<li class="${SVC_CLASS[i]}"><span class="dm-s-svc">${esc(svc)}</span><span class="dm-s-step">${esc(step)}</span></li>`).join('')}</ol>
      <div class="dm-grid">
        <div class="dm-main"><div class="dm-stage" tabindex="-1"></div>
          <details class="dm-all"><summary>See all 18 records</summary><div class="dm-all-body"></div></details>
        </div>
        <aside class="dm-report" aria-label="This week’s report">
          <p class="dm-r-title">This week’s report</p>
          <p class="dm-r-tag"></p>
          <dl class="dm-r-rows">${ROWS.map(([k, l]) => `<div class="dm-r-row" data-k="${k}"><dt>${esc(l)}</dt><dd><span class="dm-old"></span><b></b><span class="dm-unit"></span></dd></div>`).join('')}</dl>
          <details class="dm-defs"><summary>What the numbers mean</summary><ul>
            <li><strong>Booked:</strong> unique confirmed visits.</li>
            <li><strong>Waiting:</strong> requests or jobs that still need someone to act.</li>
            <li><strong>Done, not invoiced:</strong> completed jobs without an invoice.</li></ul></details>
          <div class="dm-last"></div>
        </aside>
      </div>
      <p class="sr-only" aria-live="polite"></p>
    </div>`;
  const stage = root.querySelector('.dm-stage');
  const live = root.querySelector('.dm > [aria-live]');
  const lastLine = root.querySelector('.dm-last');
  const say = (m) => { live.textContent = ''; setTimeout(() => { live.textContent = m; }, 30); };

  // ---- the report: a changed number shows its before and after; the reasons sit underneath
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
    // Before the checks the hand-built report counts booking entries; afterwards, unique confirmed visits.
    root.querySelector('.dm-r-row[data-k="booked"] .dm-unit').textContent = s.checked ? 'unique confirmed visits' : 'booking entries';
    const tag = root.querySelector('.dm-r-tag');
    tag.textContent = next.tag;
    tag.dataset.tag = next.tag;
    if (reason !== undefined) {
      reasons = reason === null ? [] : [...reasons, reason];
      lastLine.innerHTML = reasons.length > 1 ? `<ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : esc(reasons[0] || '');
    }
    shown = next;
  }

  const stageIndex = () => ({ ready: 0, checking: 0, summary: 0, review: 1, applying: 1, applied: 1, cause: 2, form: 2, sent: 2, end: 3 }[phase]);
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
    if (r.status === 'asked') return `Waiting on customer (address asked by ${r.askedVia === 'call' ? 'phone' : 'email'})`;
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
  const move = (text) => `<p class="dm-move"><span>Your move:</span> ${text}</p>`;
  const svc = () => { const i = Math.min(stageIndex(), 2); return `<p class="dm-svc"><strong>${esc(STAGES[i][0])}.</strong> ${esc(SERVICE_LINE[i])}</p>`; };
  const roles = (...tags) => `<p class="dm-roles">${tags.map(([cls, t]) => `<span class="dm-role dm-role-${cls}">${esc(t)}</span>`).join('')}</p>`;

  function sheet() {
    const locked = phase !== 'review';
    const rows = SHEET.map((r, i) => {
      const decision = rowDone[r.id]
        ? `<span class="dm-sh-done">${esc(rowDone[r.id])}</span>`
        : `<select data-row="${r.id}" aria-label="Your decision for row ${i + 2}"${locked ? ' disabled' : ''}><option value="">Choose…</option>${
          r.options.map(([v, l]) => `<option value="${v}"${picks[r.id] === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      return `<tr class="${rowDone[r.id] ? 'is-done' : ''}"><th scope="row" class="dm-sh-n">${i + 2}</th>
        <td data-label="What was found">${esc(r.found)}</td>
        <td data-label="Why it matters" class="dm-sh-cost">${esc(COSTS[r.id])}</td>
        <td data-label="Prepared next step">${esc(r.next)}<span class="dm-sh-why">${esc(r.why)}</span></td>
        <td data-label="Your decision" class="dm-sh-pick">${decision}</td></tr>`;
    }).join('');
    return `<div class="dm-sheet">
      <p class="dm-sh-bar"><span class="dm-sh-file">Monday review</span><span class="dm-sh-tab">Week of 9 Nov</span></p>
      <table><thead><tr><th scope="col" class="dm-sh-n"><span class="sr-only">Row</span>1</th><th scope="col">What was found</th><th scope="col">Why it matters</th><th scope="col">Prepared next step</th><th scope="col">Your decision</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  const FORM_BEFORE = ['Name', 'Email', 'Message'];
  const FORM_AFTER = [['Name'], ['Email'], ['Address', 'required'], ['Service needed', 'required'], ['Preferred time', 'only available calendar slots']];
  const formPicture = () => `<div class="dm-forms" role="img" aria-label="The website request form before and after: address, service and preferred time are now asked for">
    <figure class="dm-fp"><figcaption>Before</figcaption><ul>${FORM_BEFORE.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></figure>
    <figure class="dm-fp is-after"><figcaption>After</figcaption><ul>${FORM_AFTER.map(([f, note]) => `<li class="${note ? 'is-new' : ''}">${esc(f)}${note ? ` <em>${esc(note)}</em>` : ''}</li>`).join('')}</ul></figure></div>`;

  let bookedWhen = TEST_REQUEST.when;
  const path = () => ['Request received', 'Checked: nothing missing, time is free', `Booked ${when(bookedWhen)}`, 'Added to the job sheet', 'Confirmation sent (simulated)', 'Report updated'];

  function whoDidWhat() {
    const lines = [
      ['auto', 'The checks and automations', 'pulled 18 records together, ran 4 checks, drafted an invoice and an email, carried out your decisions, and booked your test request by themselves.'],
      ['you', 'You', 'made 3 decisions in one sheet, applied them with one click, and played the customer.'],
    ];
    if (picks.address === 'call') lines.push(['team', 'Your team', 'Dana made one phone call.']);
    lines.push(['customer', 'The customer', 'G. Torres confirmed (simulated).']);
    lines.push(['me', 'Me', 'fixed the causes, starting with the form, so these problems don’t come back.']);
    return `<ul class="dm-who">${lines.map(([cls, who, what]) => `<li><span class="dm-role dm-role-${cls}">${esc(who)}</span> <span>${esc(what)}</span></li>`).join('')}</ul>`;
  }

  function paintStage(focus = false) {
    paintStrip();
    let h = '';
    if (phase === 'ready') {
      h = `${svc()}${roles(['auto', 'In real life: runs every Monday'])}
        <h3 class="dm-h">Monday morning. The report was built by hand.</h3>
        <p>It says 11 booking entries, 3 waiting and nothing to invoice. Building it took ${esc(HAND_REPORT)}. Here, press the button to watch the checks run.</p>
        ${move('run Monday’s checks.')}${btn('check', 'Run Monday’s checks')}`;
    } else if (phase === 'checking') {
      h = `${svc()}${roles(['auto', 'Running automatically'])}<h3 class="dm-h">Checking the 18 records</h3><ol class="dm-checks">${CHECKS.map((c, i) => `<li class="${i < ticked ? 'is-done' : ''}">${esc(c.label)}</li>`).join('')}</ol>`;
    } else if (phase === 'summary') {
      h = `${svc()}${roles(['auto', 'Done automatically'])}
        <h3 class="dm-h">Done. Here’s what just happened.</h3>
        <ul class="dm-summary">
          <li>Combined 18 requests from phone, email and the website.</li>
          <li>Ran 4 checks on every record.</li>
          <li>Prepared a next step for each problem.</li>
        </ul>
        <p class="dm-sorted">The checks found three problems: one duplicate booking, one completed job without an invoice, and one request stuck in the inbox. The report has been corrected to reflect the actual records.</p>
        <p class="dm-note">The initial report contains 11 booking entries. After checking for duplicate records, these represent 10 unique confirmed visits. The difference is a duplicate entry, not a valid booking being removed.</p>
        <p class="dm-note">In real life this runs by itself every Monday at 7am. Nobody presses anything.</p>
        <p class="dm-note"><strong>Each check is a rule I set up for your business after mapping how your work flows.</strong> It catches the problems we’ve agreed to look for.</p>
        ${btn('review', 'Next: review the problems')}`;
    } else if (phase === 'review' || phase === 'applying' || phase === 'applied') {
      const chosen = SHEET.filter((r) => picks[r.id]).length;
      h = `${svc()}${roles(['auto', 'Prepared automatically'], ['you', 'Your decision'])}
        <h3 class="dm-h">Your Monday review sheet</h3>
        <p>Each row shows the problem, what it costs and the next step, ready to go.</p>
        ${sheet()}
        <p class="dm-tools">Clear-cut cases are handled automatically. Only the ones that need a person come to you. You choose what happens next. The system prepares the work and carries out the approved actions. Works in Excel, Google Sheets, email or a simple page.</p>`;
      if (phase === 'review') {
        h += `${move(`choose in each row, then apply. <span class="dm-count">(${chosen} of 3 chosen)</span>`)}
          ${btn('apply', 'Apply my decisions')}${sheetError ? `<p class="dm-err" role="alert">${esc(sheetError)}</p>` : ''}`;
      } else if (phase === 'applying') {
        h += `<p class="dm-note">Carrying out your decisions…</p>`;
      } else {
        h += `<p class="dm-sorted">${esc(appliedLine(picks))}</p>
          <p>G. Torres stays in Waiting until the customer confirms. And next Monday the same problems will turn up again, because nothing has changed in how requests come in.</p>
          ${btn('cause', 'Next: fix why they happened')}`;
      }
    } else if (phase === 'cause' || phase === 'form') {
      const torres = s.records.find((r) => r.ref === 'R-118');
      const confirmed = torres && torres.status === 'booked';
      h = `${svc()}${roles(['me', 'My part'])}
        <h3 class="dm-h">Why it happened, and what I’d improve</h3>
        <div class="dm-causes"><table><thead><tr><th scope="col">Problem</th><th scope="col">Why it happened</th><th scope="col">What I would improve</th></tr></thead><tbody>${
          CAUSES.map((c) => `<tr><th scope="row">${esc(c.problem)}</th><td data-label="Why it happened">${esc(c.why)}</td><td data-label="What I would improve">${esc(c.fix)}</td></tr>`).join('')}</tbody></table></div>
        <p class="dm-try">The website form, before and after:</p>
        ${formPicture()}`;
      if (!confirmed) {
        h += `${roles(['customer', 'The customer'])}
          <p>G. Torres hasn’t confirmed yet${torres && torres.askedVia === 'call' ? ' after Dana’s call' : ' after the email'}. In real life this is the customer’s reply. Here, you can simulate it.</p>
          ${btn('confirm', 'Simulate customer confirmation')}`;
      } else {
        const slots = freeSlots(s);
        const v = { name: 'Test customer', email: 'test@example.com', address: TEST_REQUEST.address, job: TEST_REQUEST.job, when: slots.includes(TEST_REQUEST.when) ? TEST_REQUEST.when : '', ...formVals };
        const err = (k) => formError && formError.includes(k) ? ' aria-invalid="true"' : '';
        h += `<p class="dm-sorted">G. Torres confirmed the booking. The request is now scheduled.</p>
          ${roles(['customer', 'Now play the customer'])}
          ${move(`send a request through the new form: ${esc(TEST_REQUEST.job.toLowerCase())} at ${esc(TEST_REQUEST.address)}, ${esc(when(TEST_REQUEST.when))}.`)}
          <form class="dm-form" novalidate>
            <label>Name <input name="name" value="${esc(v.name)}" autocomplete="off"${err('name')}></label>
            <label>Email <input name="email" type="email" value="${esc(v.email)}" autocomplete="off"></label>
            <label>Address <em>required</em> <input name="address" value="${esc(v.address)}" autocomplete="off"${err('address')}></label>
            <label>Service needed <em>required</em> <input name="job" value="${esc(v.job)}" autocomplete="off"${err('job')}></label>
            <label>Preferred time <em>only free times from the calendar</em> <select name="when"${err('when')}><option value="">Choose a time…</option>${
              slots.map((t) => `<option value="${esc(t)}"${v.when === t ? ' selected' : ''}>${esc(when(t))}</option>`).join('')}</select></label>
            <p class="dm-note">${esc(when(TEST_REQUEST.when).split(',')[0])}: 9am and 1pm are already booked, so they aren’t offered.</p>
            ${formError ? `<p class="dm-err" role="alert">${esc(formError.includes('when') ? 'Choose one of the free times.' : 'Fill in the required fields.')}</p>` : ''}
            <p><button type="submit" class="btn btn-primary dm-btn">Send request</button></p>
          </form>`;
      }
    } else if (phase === 'sent' || phase === 'end') {
      h = `${svc()}<h3 class="dm-h">Your request, step by step</h3>
        <ol class="dm-path">${path().map((p, i) => `<li class="${i < pathLit ? 'is-lit' : ''}">${esc(p)}</li>`).join('')}</ol>
        ${pathLit >= path().length ? `<p class="dm-upd">Your request booked itself. Booked is now ${report(s).booked}.</p>` : ''}`;
      if (phase === 'end') {
        h += `<div class="dm-end">
          <h3 class="dm-h">Checked first, fixed at the source.</h3>
          <p class="dm-end-sub">Who did what</p>
          ${whoDidWhat()}
          <p class="dm-end-sub">One process, three improvements</p>
          <ul class="dm-three">
            <li><a href="#services">Data &amp; Reporting</a>: you know which numbers are right.</li>
            <li><a href="#services">Workflows &amp; Processes</a>: each problem comes to you with the next step prepared.</li>
            <li><a href="#services">Business Tools &amp; Systems</a>: your tools work together, so the same problems are less likely to happen again.</li>
          </ul>
          <p class="dm-bridge"><strong>Not a repair business?</strong> The same problems show up as orders keyed in twice, timesheets that don’t match payroll, supplier bills nobody checked, or a monthly report rebuilt from five spreadsheets.</p>
          <div class="dm-ask">
            <p><strong>Bring one report or process you don’t fully trust.</strong> In 30 minutes, we’ll find what’s off and what it would take to fix it.</p>
            <p class="dm-end-actions"><a class="btn btn-primary" href="contact/#contact-form-area">Book a free rework review</a>
              <button type="button" class="dm-link" data-act="restart">Run it again</button></p>
          </div>
          <p class="dm-real">${esc(REAL_LINE)}</p>
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
      s = check(s).state; phase = 'summary';
      paintReport(null);
      paintReport('Booked −1: one visit was booked twice, so it counts once.');
      paintReport('Waiting +1: a website request was stuck in the inbox.');
      paintReport('Not invoiced +1: a finished job has no invoice.');
      paintStage(true);
      say('Checks finished. 3 problems found and the report corrected: Booked 11 → 10, Waiting on someone 3 → 4, Done, not invoiced 0 → 1.');
      busy = false; return;
    }
    if (a === 'review' && phase === 'summary') { phase = 'review'; paintStage(true); return; }
    if (a === 'apply' && phase === 'review') {
      if (SHEET.some((r) => !picks[r.id])) { sheetError = 'Choose a decision in every row first.'; paintStage(); stage.querySelector('select:not([disabled]) option[value=""]:checked')?.parentElement.focus(); return; }
      busy = true; sheetError = ''; phase = 'applying'; paintStage();
      paintReport(null);
      // Carry out the three decisions one row at a time, moving the report with each.
      const steps = [
        ['duplicate', (x) => (picks.duplicate === 'keep' ? keepBoth(x) : confirmMerge(x))],
        ['invoice', (x) => (picks.invoice === 'nobill' ? markNotBillable(x) : raiseInvoice(x))],
      ];
      for (const [id, step] of steps) {
        await wait(600);
        s = step(s); rowDone[id] = DONE_TEXT[picks[id]];
        paintReport(REASON[picks[id]]); paintStage();
      }
      await wait(600);
      s = askAddress(s, picks.address); rowDone.address = DONE_TEXT[picks.address];
      paintReport(REASON[picks.address]);
      phase = decided(s) ? 'applied' : 'review';
      paintStage();
      stage.querySelector('[data-act="cause"]')?.focus();
      say(`${appliedLine(picks)} The report now says ${report(s).booked} booked, ${report(s).waiting} waiting, ${report(s).notInvoiced} not invoiced.`);
      busy = false; return;
    }
    if (a === 'cause' && phase === 'applied') { phase = 'cause'; paintStage(true); return; }
    if (a === 'confirm' && phase === 'cause') {
      const before = s; s = receiveReply(s);
      if (s === before) return; // already confirmed
      rowDone.address = `Customer confirmed (${R118_REPLY.address}). Booked ${when(R118_REPLY.when)}.`;
      s = fixForm(s); phase = 'form';
      paintReport('Booked +1, Waiting −1: G. Torres confirmed the booking.');
      paintStage(true);
      say('G. Torres confirmed the booking. The request is now scheduled.');
      return;
    }
    if (a === 'send' && phase === 'form') {
      const res = sendTest(s, formVals);
      if (!res.passed) { formError = res.errors.join(' '); paintStage(); stage.querySelector('[aria-invalid="true"]')?.focus(); return; }
      busy = true; formError = '';
      bookedWhen = formVals.when || TEST_REQUEST.when;
      s = res.state; phase = 'sent'; pathLit = 0; paintStage(true);
      const steps = path().length;
      for (let i = 1; i <= steps; i++) {
        await wait(400); pathLit = i; paintStage();
        if (i === steps) paintReport('Booked +1: your request booked itself.');
      }
      say(`Your request booked itself. Booked is now ${report(s).booked}.`);
      await wait(900); phase = 'end'; paintStage(true);
      busy = false; return;
    }
    if (a === 'restart') {
      s = initialState(); phase = 'ready'; pathLit = 0; ticked = 0; picks = {}; rowDone = {}; sheetError = ''; formError = ''; formVals = {}; bookedWhen = TEST_REQUEST.when;
      shown = report(s); paintReport(null); paintReport('Built by hand from the job list.'); paintStage(true);
    }
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) act(b.dataset.act);
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('.dm-form');
    if (!f) return;
    e.preventDefault();
    formVals = Object.fromEntries(new FormData(f).entries());
    act('send');
  });
  root.addEventListener('input', (e) => {
    const f = e.target.closest('.dm-form');
    if (!f) return;
    formVals = Object.fromEntries(new FormData(f).entries());
    if (String(e.target.value || '').trim()) e.target.removeAttribute('aria-invalid');
  });
  root.addEventListener('change', (e) => {
    if (e.target.closest('.dm-form')) { e.target.dispatchEvent(new Event('input', { bubbles: true })); return; }
    const sel = e.target.closest('select[data-row]');
    if (!sel || phase !== 'review') return;
    if (sel.value) picks[sel.dataset.row] = sel.value; else delete picks[sel.dataset.row];
    if (sheetError && SHEET.every((r) => picks[r.id])) sheetError = '';
    const id = sel.dataset.row;
    paintStage();
    stage.querySelector(`select[data-row="${id}"]`)?.focus();
  });

  paintReport('Built by hand from the job list.');
  paintStage();
  return { check: () => act('check'), get phase() { return phase; } };
}
