// Live demo: an interactive Monday operations review at Quillfern Home Repairs, with the weekly report beside it.
// Five stages, each tied to one service area:
//   1 Investigate the report (Data & Reporting): the hand-built report; the four checks run.
//   2 Discover the problems (Data & Reporting): three findings, revealed one by one; the report is corrected.
//   3 Make the decisions (Workflows & Processes): a Monday review sheet; the owner picks a decision per row and applies
//     them with one click. The customer's confirmation (simulated) follows by itself.
//   4 Improve the process (Business Tools & Systems): why each problem happened and the improvement I'd propose.
//   5 See the better workflow (Business Tools & Systems): the improved form, ready to send (optional), then the final
//     report, what improved, the booking ask and who does what.
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
  ['Data & Reporting', 'Investigate the report'],
  ['Data & Reporting', 'Discover the problems'],
  ['Workflows & Processes', 'Make the decisions'],
  ['Business Tools & Systems', 'Improve the process'],
  ['Business Tools & Systems', 'See the better workflow'],
];
// Matches the service cards' colours (see .svc-data / .svc-workflow / .svc-systems in styles.css).
const SVC_CLASS = ['svc-data', 'svc-data', 'svc-workflow', 'svc-systems', 'svc-systems'];
const ROWS = [['booked', 'Booked'], ['waiting', 'Waiting'], ['notInvoiced', 'Done, not invoiced']];

// The review sheet: one row per problem, two choices each.
const SHEET = [
  { id: 'duplicate', label: 'M. Santos booked twice', found: 'M. Santos aircon service booked twice for Thu 12 Nov, 9am.', next: 'Merge ready to go.', why: 'Could be two real visits, so you decide.',
    options: [['merge', 'Merge into one'], ['keep', 'Keep both']] },
  { id: 'invoice', label: 'D. Cruz not invoiced', found: 'D. Cruz gutter repair completed Thu 5 Nov, but no invoice exists in the accounts.', next: 'Invoice drafted, ready to send.', why: 'Could be warranty work, so you decide.',
    options: [['send', 'Send invoice'], ['nobill', 'Not billable (warranty)']] },
  { id: 'address', label: 'G. Torres request with no address', found: 'G. Torres water heater request from the website is stuck in the inbox, with no address.', next: 'Email to the customer written.', why: 'Email or a call? You know the customer.',
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
// Stage 2: the three findings, revealed one by one.
const FINDINGS = [
  { label: 'Duplicate booking', who: 'M. Santos', lines: ['Aircon service.', 'Thu 12 Nov, 9am.', 'Two bookings exist for the same visit.'], impact: 'Two technicians could go to the same job.' },
  { label: 'Missing invoice', who: 'D. Cruz', lines: ['Gutter repair.', 'Completed Thu 5 Nov.', 'The job list says it was invoiced, but no invoice exists in the accounts.'], impact: '$480 of completed work hasn’t been billed.' },
  { label: 'Incomplete request', who: 'G. Torres', lines: ['Water heater service.', 'Website request.', 'No address supplied.', 'Still sitting in the inbox.'], impact: 'Waiting four days. The customer may have called someone else.' },
];
// What the review sheet carried out, in one sentence.
const APPLIED = {
  merge: 'the duplicate booking has been confirmed as one visit',
  keep: 'the two Santos bookings have been confirmed as separate visits',
  send: 'the $480 invoice has been sent',
  nobill: 'the Cruz job has been marked as warranty work, with no invoice due',
  email: 'the customer follow-up has been sent',
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
  // ready | checking (stage 1) · findings (2) · review | applying | applied (3) · cause (4) · better | sent (5) · end
  let phase = 'ready';
  let ticked = 0;
  let pathLit = 0;
  let busy = false;
  let confirmed = false; // the customer's (simulated) confirmation has come in
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
          <dl class="dm-r-rows">${ROWS.map(([k, l]) => `<div class="dm-r-row" data-k="${k}"><dt>${esc(l)}</dt><dd><span class="dm-old"></span><b></b><span class="dm-q" aria-hidden="true">?</span><span class="dm-unit"></span></dd></div>`).join('')}</dl>
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

  // ---- the report: a changed number counts to its new value and shows its before and after; the reasons sit underneath.
  // Until the checks run, the 0 carries the same "?" as the hero card.
  function tween(el, from, to) {
    if (reduce || typeof requestAnimationFrame !== 'function' || from === to) { el.textContent = to; return; }
    const t0 = performance.now(); const dur = 450;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
      if (p < 1 && el._to === to) requestAnimationFrame(step);
    };
    el._to = to; requestAnimationFrame(step);
  }
  function paintReport(reason) {
    const next = report(s);
    for (const [k] of ROWS) {
      const row = root.querySelector(`.dm-r-row[data-k="${k}"]`);
      const old = row.querySelector('.dm-old');
      const num = row.querySelector('b');
      if (next[k] !== shown[k]) {
        tween(num, shown[k], next[k]);
        old.textContent = `${shown[k]} → `;
        row.classList.remove('is-changed'); void row.offsetWidth; row.classList.add('is-changed');
        clearTimeout(row._t);
        row._t = setTimeout(() => { old.textContent = ''; row.classList.remove('is-changed'); }, 4000);
      } else {
        num._to = next[k]; num.textContent = next[k];
      }
    }
    root.querySelector('.dm-r-row[data-k="notInvoiced"]').classList.toggle('is-suspect', !s.checked);
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

  const stageIndex = () => ({ ready: 0, checking: 0, findings: 1, review: 2, applying: 2, applied: 2, cause: 3, better: 4, sent: 4, end: 5 }[phase]);
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
  const area = (i, line) => `<p class="dm-svc"><strong>${esc(STAGES[i][0])}.</strong> ${esc(line)}</p>`;
  const roles = (...tags) => `<p class="dm-roles">${tags.map(([cls, t]) => `<span class="dm-role dm-role-${cls}">${esc(t)}</span>`).join('')}</p>`;
  const checksList = () => `<ol class="dm-checks">${CHECKS.map((c, i) => `<li class="${i < ticked ? 'is-done' : ''}">${esc(c.label)}</li>`).join('')}</ol>`;

  function sheet() {
    const locked = phase !== 'review';
    const rows = SHEET.map((r, i) => {
      const decision = rowDone[r.id]
        ? `<span class="dm-sh-done">${esc(rowDone[r.id])}</span>`
        : `<select data-row="${r.id}" aria-label="Your decision, row ${i + 2}: ${esc(r.label)}"${locked ? ' disabled' : ''}><option value="">Choose…</option>${
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
  const FORM_AFTER = [['Name', 'required'], ['Email', 'required'], ['Address', 'required'], ['Service needed', 'required'], ['Preferred time', 'only available calendar slots']];
  const NEW_FIELDS = ['Address', 'Service needed', 'Preferred time'];
  const formPicture = () => `<div class="dm-forms" role="img" aria-label="The website request form before and after: address, service and preferred time are now asked for, and every field is required">
    <figure class="dm-fp"><figcaption>Before</figcaption><ul>${FORM_BEFORE.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></figure>
    <figure class="dm-fp is-after"><figcaption>After</figcaption><ul>${FORM_AFTER.map(([f, note]) => `<li class="${NEW_FIELDS.includes(f) ? 'is-new' : ''}">${esc(f)} <em>${esc(note)}</em></li>`).join('')}</ul></figure></div>`;

  let bookedWhen = TEST_REQUEST.when;
  const path = () => ['Request received.', 'Checked: nothing missing, time is free.', `Booked ${when(bookedWhen)}.`, 'Added to the job sheet.', 'Confirmation prepared (simulated).', 'Report updated.'];

  const WHO = [
    ['auto', 'The checks and automations', 'Bring records together, run checks, identify problems, prepare actions and update information.'],
    ['you', 'You', 'Make the decisions that need your judgment and approve the next steps.'],
    ['team', 'Your team', 'Handles the activities that need human involvement.'],
    ['customer', 'The customer', 'Provides the missing information and confirms the booking.'],
    ['me', 'Me', 'Map the process, identify the causes, design the improvements and configure the tools and automation needed to make the process work better.'],
  ];
  const whoDoesWhat = () => `<ul class="dm-who">${WHO.map(([cls, who, what]) => `<li><span class="dm-role dm-role-${cls}">${esc(who)}</span> <span>${esc(what)}</span></li>`).join('')}</ul>`;

  function testForm() {
    const slots = freeSlots(s);
    const v = { name: 'Test customer', email: 'test@example.com', address: TEST_REQUEST.address, job: TEST_REQUEST.job, when: slots.includes(TEST_REQUEST.when) ? TEST_REQUEST.when : '', ...formVals };
    const err = (k) => (formError && formError.split(' ').includes(k) ? ' aria-invalid="true"' : '');
    return `<form class="dm-form" novalidate aria-label="Improved booking form (simulation)">
        <label>Name <em>required</em> <input name="name" value="${esc(v.name)}" autocomplete="off"${err('name')}></label>
        <label>Email <em>required</em> <input name="email" type="email" value="${esc(v.email)}" autocomplete="off"${err('email')}></label>
        <label>Address <em>required</em> <input name="address" value="${esc(v.address)}" autocomplete="off"${err('address')}></label>
        <label>Service needed <em>required</em> <input name="job" value="${esc(v.job)}" autocomplete="off"${err('job')}></label>
        <label>Preferred time <em>only available calendar slots</em> <select name="when"${err('when')}><option value="">Choose a time…</option>${
          slots.map((t) => `<option value="${esc(t)}"${v.when === t ? ' selected' : ''}>${esc(when(t))}</option>`).join('')}</select></label>
        <p class="dm-note">${esc(when(TEST_REQUEST.when).split(',')[0])}: 9am and 1pm are already booked, so they aren’t offered.</p>
        ${formError ? `<p class="dm-err" role="alert">${esc(formError.split(' ').some((k) => k !== 'when') ? 'Fill in the required fields.' : 'Choose one of the available times.')}</p>` : ''}
        <p class="dm-end-actions"><button type="submit" class="btn btn-primary dm-btn">Send request</button>
          <button type="button" class="dm-link" data-act="end">Skip to the results</button></p>
      </form>`;
  }

  function paintStage(focus = false) {
    paintStrip();
    let h = '';
    if (phase === 'ready' || phase === 'checking') {
      // Stage 1: investigate the report
      h = `${area(0, 'First, make the information trustworthy.')}${roles(['auto', phase === 'ready' ? 'In real life: runs every Monday' : 'Running automatically'])}
        <h3 class="dm-h">Monday morning. The report was built by hand.</h3>
        <p>It says 11 booking entries, 3 waiting and nothing to invoice. Building it took ${esc(HAND_REPORT)}.</p>
        <p>Here, run the checks to see what’s hiding in the records.</p>
        ${phase === 'ready' ? btn('check', 'Run Monday’s checks') : checksList()}`;
    } else if (phase === 'findings') {
      // Stage 2: discover the problems (the cards fade in one by one)
      h = `${area(1, 'The checks reveal what’s missing.')}${roles(['auto', 'Running automatically'])}
        <h3 class="dm-h">Three problems were hiding in the records.</h3>
        <p>18 records brought together. Four checks run across every record.</p>
        <ol class="dm-finds">${FINDINGS.map((f) => `<li class="dm-find">
          <p class="dm-find-label">${esc(f.label)}</p>
          <p class="dm-find-who">${esc(f.who)}</p>
          <p class="dm-find-lines">${f.lines.map((l) => esc(l)).join(' ')}</p>
          <p class="dm-find-impact"><span>Impact:</span> ${esc(f.impact)}</p></li>`).join('')}</ol>
        <p class="dm-note">The original 11 booking entries included one duplicate. After checking, they represent 10 unique confirmed visits, without removing a valid booking.</p>
        <p class="dm-note">In a live setup, these checks run automatically every Monday using rules configured around your business.</p>
        ${btn('review', 'Review the problems')}`;
    } else if (phase === 'review' || phase === 'applying' || phase === 'applied') {
      // Stage 3: make the decisions
      const chosen = SHEET.filter((r) => picks[r.id]).length;
      h = `${area(2, 'Next, turn each problem into a decision.')}${roles(['auto', 'Prepared automatically'], ['you', 'Your decision'])}
        <h3 class="dm-h">Your Monday review sheet</h3>
        <p>Each row shows what was found, why it matters and the next step. You decide what happens when human judgment is needed.</p>
        ${sheet()}
        <p class="dm-tools">Routine checks run automatically. When something needs human judgment, the system prepares the next step for your approval. Once approved, it carries out the action and updates the records.</p>`;
      if (phase === 'review') {
        h += `${move(`Choose a decision for each problem. <span class="dm-count">(${chosen} of 3 chosen)</span>`)}
          ${btn('apply', 'Apply my decisions')}${sheetError ? `<p class="dm-err" role="alert">${esc(sheetError)}</p>` : ''}`;
      } else if (phase === 'applying') {
        h += `<p class="dm-note">Carrying out your decisions…</p>`;
      } else {
        h += `<p class="dm-sorted">${esc(appliedLine(picks))}</p>`;
        if (confirmed) {
          h += `${roles(['customer', 'The customer'])}
            <p class="dm-sorted">Customer reply received (simulated). G. Torres provided the missing address and confirmed the appointment.</p>
            <p class="dm-note">In a live process, the booking would update when the customer responds.</p>
            ${btn('cause', 'Next: improve the process')}`;
        } else {
          h += `<p class="dm-note">Actions applied. Waiting for G. Torres to reply…</p>`;
        }
      }
    } else if (phase === 'cause') {
      // Stage 4: improve the process (proposed improvements, not built in this example)
      h = `${area(3, 'Finally, fix the source so the same problems are less likely to return.')}${roles(['me', 'My part'])}
        <h3 class="dm-h">Why it happened, and what I’d improve.</h3>
        <ol class="dm-fixes">${CAUSES.map((c) => `<li class="dm-fix">
          <p class="dm-fix-h">${esc(c.problem)}.</p>
          <dl><div><dt>Why it happened</dt><dd>${esc(c.why)}</dd></div><div class="dm-fix-to"><dt>What I’d improve</dt><dd>${esc(c.fix)}</dd></div></dl></li>`).join('')}</ol>
        <p>The aim isn’t just to correct this week’s report. It’s to improve the process that created the problems in the first place.</p>
        <p class="dm-note">These are proposed improvements for this fictional business. The improved form is the one you can try next.</p>
        ${btn('better', 'Next: see the better workflow')}`;
    } else if (phase === 'better' || phase === 'sent') {
      // Stage 5: see the better workflow (the form is ready to send; trying it is optional)
      h = `${area(4, 'Requests arrive complete and only at free times.')}${roles(['customer', 'You play the customer'])}
        <h3 class="dm-h">A better way to receive booking requests.</h3>
        <p>The improved form captures the information needed upfront and only offers available appointment times.</p>
        ${formPicture()}`;
      if (phase === 'better') {
        h += `${move('Try the improved booking form. It’s filled in with an example request; change anything you like.')}${testForm()}`;
      } else {
        h += `<p class="dm-f-h">Your request, step by step <span class="dm-sim">Simulation</span></p>
          <ol class="dm-path">${path().map((p, i) => `<li class="${i < pathLit ? 'is-lit' : ''}">${esc(p)}</li>`).join('')}</ol>
          ${pathLit >= path().length ? `<p class="dm-upd">Your request booked itself. Booked is now ${report(s).booked}.</p>` : ''}`;
      }
    } else if (phase === 'end') {
      // The completed experience: final report, what improved, the booking ask, who does what
      const r = report(s);
      h = `<h3 class="dm-h">Checked first. Improved at the source.</h3>
        <div class="dm-final" aria-label="Final report"><p class="dm-final-t">This week’s report <span>${esc(r.tag)}</span></p>
          <p class="dm-final-n"><span><b>${r.booked}</b> booked</span><span><b>${r.waiting}</b> waiting</span><span><b>${r.notInvoiced}</b> done but not invoiced</span></p></div>
        <p class="dm-end-sub">What improved?</p>
        <ul class="dm-three">
          <li><a href="#services">Data &amp; Reporting</a>: you know which numbers are right.</li>
          <li><a href="#services">Workflows &amp; Processes</a>: each problem comes with the next step prepared.</li>
          <li><a href="#services">Business Tools &amp; Systems</a>: your tools work together, so the same problems are less likely to happen again.</li>
        </ul>
        <div class="dm-ask">
          <h3 class="dm-h">Your business could work this way, too.</h3>
          <p>You don’t need another complicated system. You need a clearer process, reliable information and tools that work together.</p>
          <p>Bring one report or process you don’t fully trust. In a free 30-minute review, we’ll identify what’s causing the rework and discuss a practical way to improve it.</p>
          <div class="dm-end-actions"><div class="dm-ask-cta"><a class="btn btn-primary" href="contact/#contact-form-area">Book a free rework review</a><p class="cta-micro">30 minutes · No obligation</p></div>
            <button type="button" class="dm-link" data-act="restart">Run it again</button></div>
        </div>
        <p class="dm-end-sub">Who does what?</p>
        ${whoDoesWhat()}`;
    }
    stage.innerHTML = h;
    stage.querySelectorAll('.dm-h').forEach((el) => el.setAttribute('tabindex', '-1')); // so a new step's heading can take focus
    paintAll();
    if (focus) (stage.querySelector('.dm-h') || stage).focus({ preventScroll: false });
  }

  // ---- actions
  async function act(a) {
    if (busy) return;
    if (a === 'check' && phase === 'ready') {
      busy = true; phase = 'checking'; ticked = 0; paintStage();
      stage.querySelector('.dm-checks')?.setAttribute('tabindex', '-1');
      stage.querySelector('.dm-checks')?.focus();
      for (let i = 1; i <= CHECKS.length; i++) { await wait(300); ticked = i; paintStage(); }
      await wait(300);
      s = check(s).state; phase = 'findings';
      paintReport(null);
      paintReport('Booked −1: one visit was entered twice.');
      paintReport('Waiting +1: a website request was stuck in the inbox.');
      paintReport('Not invoiced +1: a completed job has no invoice.');
      paintStage(true);
      say('Checks finished. Three problems found and the report corrected: Booked 11 → 10, Waiting 3 → 4, Done, not invoiced 0 → 1. Report status: Checked.');
      busy = false; return;
    }
    if (a === 'review' && phase === 'findings') { phase = 'review'; paintStage(true); return; }
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
        await wait(450);
        s = step(s); rowDone[id] = DONE_TEXT[picks[id]];
        paintReport(REASON[picks[id]]); paintStage();
      }
      await wait(450);
      s = askAddress(s, picks.address); rowDone.address = DONE_TEXT[picks.address];
      paintReport(REASON[picks.address]);
      phase = decided(s) ? 'applied' : 'review';
      paintStage();
      // The customer's reply follows by itself (simulated), so the visitor doesn't need another click.
      say(`${appliedLine(picks)} Report status: Actions applied. Waiting for the customer to reply.`);
      // The customer's reply (simulated) arrives by itself after a short pause, so the visitor doesn't need another click
      // and still sees the "Actions applied" status first.
      await new Promise((r) => setTimeout(r, 2000)); // a pause, not motion: kept with reduced motion too
      s = fixForm(receiveReply(s)); confirmed = true;
      rowDone.address = `Customer replied (simulated): ${R118_REPLY.address}, booked ${when(R118_REPLY.when)}.`;
      paintReport('Booked +1, Waiting −1: G. Torres replied with the address and confirmed (simulated).');
      paintStage();
      stage.querySelector('[data-act="cause"]')?.focus();
      say(`Customer reply received (simulated). G. Torres provided the missing address and confirmed the appointment. Report status: Updated. ${report(s).booked} booked, ${report(s).waiting} waiting, ${report(s).notInvoiced} not invoiced.`);
      busy = false; return;
    }
    if (a === 'cause' && phase === 'applied' && confirmed) { phase = 'cause'; paintStage(true); return; }
    if (a === 'better' && phase === 'cause') { phase = 'better'; paintStage(true); return; }
    if (a === 'send' && phase === 'better') {
      const res = sendTest(s, formVals);
      if (!res.passed) { formError = res.errors.join(' '); paintStage(); stage.querySelector('[aria-invalid="true"]')?.focus(); return; }
      busy = true; formError = '';
      bookedWhen = formVals.when || TEST_REQUEST.when;
      s = res.state; phase = 'sent'; pathLit = 0; paintStage();
      stage.querySelector('.dm-f-h')?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      const steps = path().length;
      for (let i = 1; i <= steps; i++) {
        await wait(300); pathLit = i; paintStage();
        if (i === steps) paintReport('Booked +1: your request booked itself.');
      }
      say(`Your request booked itself. Booked is now ${report(s).booked}.`);
      await wait(1400);
      phase = 'end'; paintStage(true);
      busy = false; return;
    }
    if (a === 'end' && phase === 'better') { formError = ''; phase = 'end'; paintStage(true); return; }
    if (a === 'restart') {
      s = initialState(); phase = 'ready'; pathLit = 0; ticked = 0; confirmed = false; picks = {}; rowDone = {}; sheetError = ''; formError = ''; formVals = {}; bookedWhen = TEST_REQUEST.when;
      shown = report(s); paintReport(null); paintReport('Built by hand from the job list.'); paintStage(true);
      say('Simulation reset. Report status: Built by hand.');
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
