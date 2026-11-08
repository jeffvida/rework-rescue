// Live demo: a fictional small team's week, recorded in three places, with the weekly report beside it.
// Five stages, each tied to one service area:
//   1 Investigate the report (Data & Reporting): the hand-built report and the three sources; "Check the records".
//   2 Find what needs attention (Data & Reporting): the three items, revealed one at a time, with their records.
//   3 Decide what happens next (Workflows & Processes): a choice per item; the report updates; changeable until finished.
//   4 Improve how the work gets done (Workflows & Processes): three prevention rules, before and after (proposed).
//   5 See a better way of working (Business Tools & Systems): how the three sources could work together (illustration).
// Then the final report (with anything still open), the booking ask and "Run it again".
// Every number comes from ./engine.js. Nothing leaves the page: no real records, emails, invoices or bookings.
// The section's static HTML (index.html) is what visitors see without JavaScript; this replaces it.

import { esc } from '../forms.js';
import { TRACKER, COMPLETION, FINANCE, SOURCES, TEAM, PENDING_REASONS, CONSEQUENCE, PREVENTION } from './data.js';
import { initialState, sourceCounts, runChecks, findings, check, decide, clearDecision, allDecided, finalize, reopen, report, outstanding } from './engine.js';

const STAGES = [
  ['Data & Reporting', 'Investigate the report'],
  ['Data & Reporting', 'Find what needs attention'],
  ['Workflows & Processes', 'Decide what happens next'],
  ['Workflows & Processes', 'Improve how the work gets done'],
  ['Business Tools & Systems', 'See a better way of working'],
];
// Matches the service colours (see .svc-data / .svc-workflow / .svc-systems in styles.css).
const SVC_CLASS = ['svc-data', 'svc-data', 'svc-workflow', 'svc-workflow', 'svc-systems'];
// [key, label, short label for the pinned report on phones]
const ROWS = [
  ['openWork', 'Open work', 'Open'], ['completed', 'Completed this week', 'Done'], ['notInvoiced', 'Completed, not invoiced', 'Not invoiced'],
  ['noOwner', 'Open with no owner', 'No owner'], ['itemsToReview', 'Items to review', 'To review'],
];
const CHECKS = [
  'Bringing the three sources together by Work ID.',
  'Looking for the same work entered twice.',
  'Matching completed work to the finance register.',
  'Checking that every open item has an owner.',
];
const FIELDS = {
  tracker: [['id', 'Work ID'], ['work', 'Work'], ['owner', 'Owner'], ['status', 'Status'], ['due', 'Due']],
  completion: [['id', 'Work ID'], ['completed', 'Completed'], ['result', 'Result']],
  finance: [['id', 'Work ID'], ['invoice', 'Invoice'], ['amount', 'Amount'], ['status', 'Status']],
};
const ROWS_BY_SOURCE = { tracker: TRACKER, completion: COMPLETION, finance: FINANCE };
const money = (n) => `$${n.toLocaleString('en-US')}`;
const cell = (k, v) => (k === 'amount' ? money(v) : k === 'owner' && !v ? '<em>None</em>' : esc(v));
const sourceName = (id) => SOURCES.find((x) => x.id === id).name;

const BEFORE_AFTER = {
  before: ['Information is kept separately.', 'People compare records by hand.', 'Missing information is found late.', 'Follow-ups depend on someone remembering to check.'],
  after: ['Information follows a clearer process.', 'Records are checked the same way every time.', 'Missing details are flagged earlier.', 'Ownership and follow-ups are easy to see.'],
};
const WHO = [
  ['auto', 'The checks', 'Bring the records together, compare them and flag what needs attention.'],
  ['you', 'You', 'Make the decisions that need your judgment.'],
  ['team', 'Your team', 'Carries out the follow-ups that need a person.'],
  ['me', 'Me', 'Map the process, find the causes, and set up the checks and improvements that make the work run better.'],
];

// How an open action reads in the report ("W-314 No owner yet (work is on hold)") and in the end sentence.
const lower = (x) => x.charAt(0).toLowerCase() + x.slice(1);
const openText = (o) => (o.reason ? `${o.action} (${lower(o.reason)})` : o.action);
const endText = (o) => (o.issue === 'finance' ? `${o.id} needs an invoice follow-up` : `${o.id} has no owner yet (${lower(o.reason)})`);

export function mountDemo(root) {
  if (!root) return null;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const counts = sourceCounts();

  let s = initialState();
  let at = 0;           // stage index 0–4, or 5 for the end
  let revealed = 0;     // items shown in stage 2 (one at a time)
  let ticked = 0;       // checks ticked during "Check the records"
  let busy = false;
  let error = '';
  let shown = report(s);
  let lines = [];       // "why it changed" lines under the report

  root.innerHTML = `
    <div class="dm dm2">
      <ol class="dm-strip">${STAGES.map(([svc, step], i) => `<li class="${SVC_CLASS[i]}"><span class="dm-s-svc">${esc(svc)}</span><span class="dm-s-step">${esc(step)}</span></li>`).join('')}</ol>
      <div class="dm-grid">
        <div class="dm-main"><div class="dm-stage" tabindex="-1"></div>
          <details class="dm-all"><summary>See all ${counts.total} records</summary><div class="dm-all-body">${
            SOURCES.map((src) => recTable(src.id, ROWS_BY_SOURCE[src.id])).join('')}</div></details>
        </div>
        <aside class="dm-report" aria-label="This week’s report">
          <p class="dm-r-title">This week’s report</p>
          <p class="dm-r-tag"></p>
          <dl class="dm-r-rows">${ROWS.map(([k, l, sh]) => `<div class="dm-r-row" data-k="${k}"><dt><span class="dm-l-long">${esc(l)}</span><span class="dm-l-short" aria-hidden="true">${esc(sh)}</span></dt><dd><span class="dm-old"></span><b></b><span class="dm-unit"></span></dd></div>`).join('')}</dl>
          <div class="dm-open"></div>
          <div class="dm-last"></div>
        </aside>
      </div>
      <p class="sr-only" aria-live="polite"></p>
    </div>`;
  const stage = root.querySelector('.dm-stage');
  const live = root.querySelector('.dm > [aria-live]');
  const say = (m) => { live.textContent = ''; setTimeout(() => { live.textContent = m; }, 30); };

  function recTable(source, rows, { missing } = {}) {
    const f = FIELDS[source];
    const body = rows.length
      ? rows.map((r) => `<tr>${f.map(([k]) => `<td data-label="${esc(f.find((x) => x[0] === k)[1])}">${cell(k, r[k])}</td>`).join('')}</tr>`).join('')
      : `<tr class="dm-none"><td colspan="${f.length}">No entry for ${esc(missing)}</td></tr>`;
    return `<div class="dm-table-wrap"><table class="dm-table"><caption>${esc(sourceName(source))}</caption>
      <thead><tr>${f.map(([, l]) => `<th scope="col">${esc(l)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // ---- the report: a changed number counts to its new value and shows its before and after.
  function tween(el, from, to) {
    if (reduce || typeof requestAnimationFrame !== 'function' || typeof from !== 'number' || typeof to !== 'number' || from === to) { el.textContent = to ?? '–'; return; }
    const t0 = performance.now(); const dur = 450;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
      if (p < 1 && el._to === to) requestAnimationFrame(step);
    };
    el._to = to; requestAnimationFrame(step);
  }
  function unit(k, r) {
    if (k === 'noOwner' && r.noOwner === null) return 'not checked';
    if (k === 'openWork' && r.possibleDuplicates) return `incl. ${r.possibleDuplicates} possible duplicate`;
    if (k === 'notInvoiced' && r.followUps) return 'follow-up set';
    if (k === 'noOwner' && r.pendingWithReason) return 'reason recorded';
    return '';
  }
  function paintReport(line) {
    const next = report(s);
    for (const [k] of ROWS) {
      const row = root.querySelector(`.dm-r-row[data-k="${k}"]`);
      const old = row.querySelector('.dm-old');
      const num = row.querySelector('b');
      if (next[k] !== shown[k]) {
        tween(num, shown[k], next[k]);
        old.textContent = `${shown[k] ?? '–'} → `;
        row.classList.remove('is-changed'); void row.offsetWidth; row.classList.add('is-changed');
        clearTimeout(row._t);
        row._t = setTimeout(() => { old.textContent = ''; row.classList.remove('is-changed'); }, 4000);
      } else {
        num._to = next[k]; num.textContent = next[k] ?? '–';
      }
      row.querySelector('.dm-unit').textContent = unit(k, next);
    }
    const tag = root.querySelector('.dm-r-tag');
    tag.textContent = next.status;
    tag.dataset.tag = next.status;
    const open = outstanding(s);
    root.querySelector('.dm-open').innerHTML = open.length
      ? `<p class="dm-open-h">Still open</p><ul>${open.map((o) => `<li><b>${esc(o.id)}</b> <span>${esc(openText(o))}</span></li>`).join('')}</ul>` : '';
    if (line !== undefined) lines = line === null ? [] : [...lines.slice(-2), line];
    root.querySelector('.dm-last').innerHTML = lines.map((l) => `<p>${esc(l)}</p>`).join('');
    shown = next;
  }

  function paintStrip() {
    root.querySelectorAll('.dm-strip li').forEach((li, i) => {
      li.classList.toggle('is-on', i === at);
      li.classList.toggle('is-done', i < at || (at === 5));
      if (i === at) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  // ---- building blocks
  const btn = (action, label, kind = 'primary') => `<button type="button" class="btn btn-${kind} dm-btn" data-act="${action}">${esc(label)}</button>`;
  const area = (i, line) => `<p class="dm-svc"><strong>${esc(STAGES[i][0])}.</strong> ${esc(line)}</p>`;
  const nav = (next) => `<div class="dm-nav">${at > 0 ? '<button type="button" class="dm-link dm-back" data-act="back">&larr; Back</button>' : ''}${next || ''}</div>`;
  const checksList = () => `<ol class="dm-checks">${CHECKS.map((c, i) => `<li class="${i < ticked ? 'is-done' : ''}">${esc(c)}</li>`).join('')}</ol>`;

  function findingCard(f, i) {
    let recs = '';
    if (f.issue === 'duplicate') recs = recTable('tracker', f.records.tracker);
    if (f.issue === 'finance') recs = `${recTable('tracker', f.records.tracker)}${recTable('completion', f.records.completion)}${recTable('finance', [], { missing: f.ids[0] })}`;
    if (f.issue === 'owner') recs = recTable('tracker', f.records.tracker);
    const extra = f.issue === 'finance'
      ? `<p class="dm-note">${esc(internalNote())}</p>` : '';
    return `<li class="dm-find2 dm-reveal">
      <p class="dm-find-label"><span>${i + 1} of 3</span> ${esc(f.title)} <span class="dm-ids">${esc(f.ids.join(' and '))}</span></p>
      <p>${esc(f.explain)}</p>
      <div class="dm-recs">${recs}</div>
      <p class="dm-why"><span>Why it matters:</span> ${esc(f.why)}</p>${extra}</li>`;
  }
  function internalNote() {
    const ok = runChecks().finance.filter((x) => x.result === 'notBillable').map((x) => x.id);
    return `${ok.join(', ')} also has no finance entry, but the completion log records it as internal work, so it isn’t flagged.`;
  }

  function decisionCard(f) {
    const d = s.decisions[f.issue];
    const name = `dm-d-${f.issue}`;
    const picked = d?.choice || (f.issue === 'owner' ? pendingPick : '');
    const radios = f.choices.map(([v, l]) => `<label class="dm-choice"><input type="radio" name="${name}" value="${v}" data-issue="${f.issue}"${picked === v ? ' checked' : ''}> ${esc(l)}</label>`).join('');
    let detail = '';
    if (f.issue === 'owner' && picked) {
      const mode = picked;
      const opts = mode === 'assign' ? TEAM : PENDING_REASONS;
      const cur = mode === 'assign' ? d?.member : d?.reason;
      const label = mode === 'assign' ? 'Team member' : 'Reason';
      detail = `<label class="dm-detail">${label} <select data-detail="${mode}"><option value="">Choose…</option>${
        opts.map((o) => `<option${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    }
    const consequence = d ? (typeof CONSEQUENCE[d.choice] === 'function' ? CONSEQUENCE[d.choice](d.member || d.reason) : CONSEQUENCE[d.choice]) : '';
    return `<fieldset class="dm-decide${d ? ' is-decided' : ''}"><legend>${esc(f.title)} <span class="dm-ids">${esc(f.ids.join(' and '))}</span></legend>
      <p class="dm-explain">${esc(f.explain)}</p>
      <div class="dm-choices">${radios}</div>${detail}
      ${consequence ? `<p class="dm-sorted">${esc(consequence)}</p>` : ''}</fieldset>`;
  }
  let pendingPick = ''; // owner choice picked but its team member or reason not chosen yet

  function paintStage(focus = false) {
    paintStrip();
    let h = '';
    const r = report(s);
    if (at === 0) {
      h = `${area(0, 'First, make sure the numbers tell the same story.')}
        <h3 class="dm-h">This week’s report was put together by hand.</h3>
        <p>It shows ${r.openWork} open items, ${r.completed} completed and nothing waiting to be invoiced. The information behind it lives in three places:</p>
        <ul class="dm-sources">${SOURCES.map((src) => `<li><b>${esc(src.name)}</b><span>${counts[src.id]} records</span><small>${esc(src.fields.join(' · '))}</small></li>`).join('')}</ul>`;
      if (busy || s.checked) {
        h += checksList();
        h += s.checked && !busy ? `<p class="dm-sorted">${counts.total} records from ${counts.sources} sources checked.</p>${nav(btn('next', 'Next: see what needs attention'))}` : '';
      } else {
        h += `<p>Bring the three sources together and see whether they agree.</p>${btn('check', 'Check the records')}`;
      }
    } else if (at === 1) {
      const fs = findings(s);
      h = `${area(1, 'The checks show what doesn’t match or is missing.')}
        <h3 class="dm-h">${fs.length} items need attention.</h3>
        <p>${counts.total} records from ${counts.sources} sources were compared. Each item shows the records behind it.</p>
        <ol class="dm-finds2">${fs.slice(0, revealed).map(findingCard).join('')}</ol>
        ${nav(revealed < fs.length ? btn('more', `Show the next item (${revealed + 1} of ${fs.length})`) : btn('next', 'Next: decide what happens'))}`;
    } else if (at === 2) {
      const fs = findings(s);
      const n = fs.filter((f) => f.decision).length;
      h = `${area(2, 'Each item needs a person’s judgment, so you decide.')}
        <h3 class="dm-h">Decide what happens next.</h3>
        <p>The report updates as you choose. You can change your mind until you finish.</p>
        <div class="dm-decisions">${fs.map(decisionCard).join('')}</div>
        <p class="dm-count">${n} of ${fs.length} decided</p>
        ${error ? `<p class="dm-err" role="alert">${esc(error)}</p>` : ''}
        ${nav(btn('finish', 'Finish decisions'))}`;
    } else if (at === 3) {
      h = `${area(3, 'Fixing this week is half the job. The other half is stopping it happening again.')}
        <h3 class="dm-h">Improve how the work gets done.</h3>
        <ol class="dm-prevent">${PREVENTION.map((p) => `<li class="dm-reveal"><p class="dm-fix-h">${esc(findings(s).find((f) => f.issue === p.issue).title)}</p>
          <dl><div><dt>Now</dt><dd>${esc(p.before)}</dd></div><div class="dm-fix-to"><dt>Improvement</dt><dd>${esc(p.after)}</dd></div></dl></li>`).join('')}</ol>
        <p>These improvements could mean less repeated checking, fewer missed tasks and fewer manual corrections.</p>
        <p class="dm-note">Proposed improvements for this fictional team.</p>
        <p class="dm-next-note">This week&rsquo;s report is sorted, and these changes could stop the same problems coming back.</p>
        ${nav(`<a class="btn btn-primary dm-book" href="contact/#contact-form-area">Book a free rework review</a>${btn('next', 'Next: see how your tools could work together →', 'secondary')}`)}`;
    } else if (at === 4) {
      const flow = ['Operations Tracker', 'Completion Log', 'Finance Register', 'Clearer operations report'];
      h = `${area(4, 'Your everyday tools, working together.')}
        <h3 class="dm-h">See a better way of working.</h3>
        <ol class="dm-flow" aria-label="How the information could flow">${flow.map((x, i) => `<li class="dm-reveal${i === flow.length - 1 ? ' is-out' : ''}">${esc(x)}</li>`).join('')}</ol>
        <div class="dm-ba">
          <div><p class="dm-ba-h">Before</p><ul>${BEFORE_AFTER.before.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div class="is-after"><p class="dm-ba-h">After</p><ul>${BEFORE_AFTER.after.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        </div>
        <p class="dm-note"><span class="dm-sim">Illustration</span> This shows how the three sources could work together. The page isn’t connected to any real system.</p>
        ${nav(btn('next', 'See the final report'))}`;
    } else {
      const open = outstanding(s);
      h = `<h3 class="dm-h">Checked, decisions made, and improvements identified.</h3>
        <div class="dm-final" aria-label="Final report"><p class="dm-final-t">This week’s report <span data-tag="${esc(r.status)}">${esc(r.status)}</span></p>
          <p class="dm-final-n"><span><b>${r.openWork}</b> open</span><span><b>${r.completed}</b> completed</span><span><b>${r.notInvoiced}</b> not invoiced</span><span><b>${r.noOwner}</b> with no owner</span><span><b>${r.itemsToReview}</b> to review</span></p>
          ${open.length ? `<p class="dm-final-open"><strong>Still open:</strong> ${open.map((o) => esc(endText(o))).join('; ')}. The review is finished, but ${open.length === 1 ? 'this still needs' : 'these still need'} doing.</p>` : '<p class="dm-final-open">Nothing left open.</p>'}</div>
        <p class="dm-end-sub">What could improve?</p>
        <ul class="dm-three">
          <li><a href="#services">Data &amp; Reporting</a>: the report matches what’s in the records.</li>
          <li><a href="#services">Workflows &amp; Processes</a>: every item has a decision, and the same problems are less likely to return.</li>
          <li><a href="#services">Business Tools &amp; Systems</a>: a clearer way for the tracker, completion log and finance register to work together.</li>
        </ul>
        <p class="dm-end-sub">Who does what?</p>
        <ul class="dm-who">${WHO.map(([cls, who, what]) => `<li><span class="dm-role dm-role-${cls}">${esc(who)}</span> <span>${esc(what)}</span></li>`).join('')}</ul>
        <div class="dm-end-actions"><button type="button" class="dm-link" data-act="back">&larr; Back</button>
          <button type="button" class="dm-link" data-act="restart">Run it again</button></div>`;
    }
    stage.innerHTML = h;
    stage.querySelectorAll('.dm-h').forEach((el) => el.setAttribute('tabindex', '-1'));
    if (focus) (stage.querySelector('.dm-h') || stage).focus({ preventScroll: false });
  }

  function go(to) {
    if (to === 2 && s.finalized) s = reopen(s); // coming back to the decisions unlocks them
    at = to; error = '';
    paintStage(true);
    // Back to the progress strip if it is above the screen or under the sticky header (scroll-padding-top in styles.css).
    const top = root.querySelector('.dm-strip');
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (top && top.getBoundingClientRect().top < offset) top.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  // ---- actions
  async function act(a) {
    if (busy) return;
    if (a === 'check' && !s.checked) {
      busy = true; ticked = 0; paintStage();
      stage.querySelector('.dm-checks')?.setAttribute('tabindex', '-1');
      stage.querySelector('.dm-checks')?.focus();
      for (let i = 1; i <= CHECKS.length; i++) { await wait(250); ticked = i; paintStage(); }
      s = check(s); busy = false; revealed = 1;
      paintReport(null);
      paintReport('Checked against all three sources.');
      const r = report(s);
      say(`Checks finished. ${r.itemsToReview} items to review. Completed, not invoiced ${r.notInvoiced}. Open with no owner ${r.noOwner}. Report status: ${r.status}.`);
      go(1); return;
    }
    if (a === 'more' && at === 1) {
      revealed = Math.min(revealed + 1, findings(s).length); paintStage();
      const cards = stage.querySelectorAll('.dm-find2');
      const last = cards[cards.length - 1];
      last?.setAttribute('tabindex', '-1'); last?.focus({ preventScroll: true });
      last?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    if (a === 'next' && at < 5) { go(at + 1); return; }
    if (a === 'back' && at > 0) { go(at - 1); return; }
    if (a === 'finish' && at === 2) {
      if (!allDecided(s)) { error = 'Choose what happens with every item first.'; paintStage(); stage.querySelector('.dm-decide:not(.is-decided) input')?.focus(); return; }
      s = finalize(s); paintReport();
      say(`Decisions finished. Report status: ${report(s).status}.`);
      go(3); return;
    }
    if (a === 'restart') {
      s = initialState(); at = 0; revealed = 0; ticked = 0; pendingPick = ''; error = '';
      shown = report(s); paintReport(null); paintReport('Built by hand from the operations tracker.'); paintStage(true);
      say('Example reset. Report status: Built by hand.');
    }
  }

  function decided(issue, line) {
    paintReport(line);
    if (error && allDecided(s)) error = '';
    paintStage();
    const r = report(s);
    say(`${line} Report status: ${r.status}. ${r.itemsToReview} to review.`);
  }
  const consequenceOf = (d) => (typeof CONSEQUENCE[d.choice] === 'function' ? CONSEQUENCE[d.choice](d.member || d.reason) : CONSEQUENCE[d.choice]);

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) act(b.dataset.act);
  });
  root.addEventListener('change', (e) => {
    if (at !== 2) return;
    const radio = e.target.closest('input[type="radio"][data-issue]');
    if (radio) {
      const issue = radio.dataset.issue;
      if (issue === 'owner') {
        // The owner choice needs a team member or a reason before it counts.
        pendingPick = radio.value;
        const prev = s.decisions.owner;
        if (prev && prev.choice !== radio.value) s = clearDecision(s, 'owner');
        paintReport(); paintStage();
        stage.querySelector('select[data-detail]')?.focus();
        return;
      }
      s = decide(s, issue, radio.value);
      decided(issue, consequenceOf(s.decisions[issue]));
      stage.querySelector(`input[name="dm-d-${issue}"]:checked`)?.focus();
      return;
    }
    const sel = e.target.closest('select[data-detail]');
    if (sel) {
      const mode = sel.dataset.detail;
      if (!sel.value) { s = clearDecision(s, 'owner'); pendingPick = mode; paintReport(); paintStage(); stage.querySelector('select[data-detail]')?.focus(); return; }
      s = decide(s, 'owner', mode, sel.value); pendingPick = '';
      decided('owner', consequenceOf(s.decisions.owner));
      stage.querySelector('select[data-detail]')?.focus();
    }
  });

  paintReport('Built by hand from the operations tracker.');
  paintStage();
  return { check: () => act('check'), get stage() { return at; } };
}
