// Self-checking weekly report demo (build #2, 21 Nov 2026).
// A replay of Jeff's real n8n run on fictional CoolFix Aircon data: nothing is sent, nothing calls n8n.
// The figures and the 12 items match the workflow's output for the week 16–22 Nov 2026.

export const RP_WEEK = '16 Nov – 22 Nov';
export const RP_FIGURES = {
  enquiries: 12, jobsDone: 5, jobsValue: 2390, invoiced: 1790, collected: 1600, payments: 3,
  notInvoiced: 640, overdue: 420, toFollowUp: 1060, held: 2,
};
export const RP_OVERVIEW = 'A busy week: 12 enquiries, 5 jobs done worth $2,390 and $1,600 collected. The main gap is money, with $1,060 still to be invoiced or collected.';

// Same order, labels and owners as the workflow's Action list (most urgent and money first).
export const RP_ITEMS = [
  { ref: 'E-1039', issue: 'Urgent, no reply', who: 'Dan Wu', todo: 'Call today', owner: 'Manager' },
  { ref: 'J-504', issue: 'Not invoiced', who: 'Hart Realty · $640', todo: 'Send invoice', owner: 'Manager' },
  { ref: 'INV-2200', issue: 'Overdue invoice', who: 'Ng Motors · $420', todo: 'Chase payment', owner: 'Manager' },
  { ref: 'J-501', issue: 'Invoiced twice', who: 'INV-2203, INV-2206', todo: 'Cancel the extra invoice', owner: 'Manager' },
  { ref: 'INV-2204', issue: 'Invoice ≠ quote', who: 'Ana Cruz · $260 vs $220', todo: 'Check the amount', owner: 'Manager' },
  { ref: 'E-1038', issue: 'Booked, no job', who: 'Carla Lim', todo: 'Create the job', owner: 'Scheduling', tag: 'Office created J-512' },
  { ref: 'J-508', issue: 'Job date passed', who: 'Santos Cafe', todo: 'Confirm or reschedule', owner: 'Scheduling' },
  { ref: 'E-1041', issue: 'Possible duplicate', who: 'Same as E-1040', todo: 'Check and close', owner: 'Sales' },
  { ref: 'E-1042', issue: 'Unclear enquiry', who: 'Not clear what they need', todo: 'Read and reply', owner: 'Manager' },
  { ref: 'E-1043', issue: 'No owner', who: 'Grace Uy', todo: 'Assign an owner', owner: 'Manager' },
  { ref: 'J-506', issue: 'No technician', who: 'Lee Property', todo: 'Assign one', owner: 'Scheduling' },
  { ref: 'J-507', issue: 'Unknown enquiry ref', who: 'Ref E-1029 not found', todo: 'Fix the ref', owner: 'Scheduling' },
];

// Tuesday: the team marks two items done. Only one was really fixed.
export const RP_MARKED = {
  'J-504': { fixed: true, note: 'Invoice INV-2207 found. Confirmed.' },
  'INV-2200': { fixed: false, note: 'No payment recorded yet.' },
};

/** Status of each item: before the next check (team's marks) and after it (what the check finds). */
export function rpStatuses(afterCheck) {
  return RP_ITEMS.map((i) => {
    const m = RP_MARKED[i.ref];
    if (!m) return { ref: i.ref, status: 'Open', note: '' };
    if (!afterCheck) return { ref: i.ref, status: 'Done', note: 'Marked done by the team' };
    return m.fixed ? { ref: i.ref, status: 'Done', note: m.note, confirmed: true } : { ref: i.ref, status: 'Still found', note: m.note };
  });
}

export function rpOwnerCounts() {
  return RP_ITEMS.reduce((a, i) => (a[i.owner] = (a[i.owner] || 0) + 1, a), {});
}

const money = (n) => '$' + n.toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The Monday email, as the workflow sends it (same layout, figures and items). */
export function rpEmailHtml() {
  const f = RP_FIGURES;
  const tile = (v, l, s, strong) => `<div class="rp-tile${strong ? ' rp-tile-key' : ''}"><strong>${v}</strong><span>${l}</span><small>${s}</small></div>`;
  const [a, b, c, ...rest] = RP_ITEMS;
  const first = [a, b, c].map((i, n) => `<li><b>${n + 1}. ${esc(i.todo)}</b>: ${esc(i.who)}<span>${esc(i.issue)} · ${esc(i.ref)} · ${esc(i.owner)}</span></li>`).join('');
  const more = rest.map((i) => `<tr><td><b>${esc(i.issue)}</b><span>${esc(i.who)}</span></td><td>${esc(i.todo)}</td><td><span>${esc(i.owner)}<br>${esc(i.ref)}</span></td></tr>`).join('');
  return `<div class="rp-mail-head"><p class="rp-mail-subj">CoolFix Aircon weekly: ${money(f.toFollowUp)} to follow up, ${RP_ITEMS.length} to action</p><p class="rp-mail-from">Monday 7:00 am · to the owner</p></div>
<div class="rp-mail-body">
<p class="rp-mail-title">CoolFix Aircon · weekly report <span>${RP_WEEK}</span></p>
<p class="rp-note">${f.held} rows left out of the totals (bad or duplicate data).</p>
<div class="rp-tiles">${tile(f.enquiries, 'Enquiries', 'this week')}${tile(f.jobsDone, 'Jobs done', 'worth ' + money(f.jobsValue))}${tile(money(f.collected), 'Collected', f.payments + ' payments')}${tile(money(f.toFollowUp), 'To follow up', 'unbilled + overdue', true)}</div>
<p class="rp-overview">${esc(RP_OVERVIEW)} <span class="rp-ai">AI-written, numbers checked</span></p>
<p class="rp-mail-h">Do first</p>
<ol class="rp-first">${first}</ol>
<details class="rp-more-fold"><summary>Also needs action (${rest.length})</summary>
<table class="rp-more">${more}</table></details>
<p class="rp-mail-small">Left out of totals: E-1046 (date written as &ldquo;yesterday&rdquo;); INV-2206 (second invoice for the same job).</p>
</div>`;
}

export function mountReportDemo(root) {
  if (!root || typeof HTMLDialogElement !== 'function' || typeof root.showModal !== 'function') return;
  let opener = null;
  document.querySelectorAll('[data-rp-only]').forEach((el) => { el.hidden = false; });
  document.querySelectorAll('[data-rp-open]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); opener = a;
    document.documentElement.classList.add('cs-lock');
    root.showModal();
    root.querySelector('[data-rp-close]')?.focus();
  }));
  root.addEventListener('close', () => { document.documentElement.classList.remove('cs-lock'); opener?.focus({ preventScroll: true }); });
  root.querySelector('[data-rp-close]')?.addEventListener('click', () => root.close());
  root.addEventListener('click', (e) => { if (e.target === root) root.close(); });

  // Tabs: Monday email · Team's list
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const show = (t, focus) => {
    tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; root.querySelector('#' + x.getAttribute('aria-controls')).hidden = !on; });
    if (focus) t.focus();
  };
  tabs.forEach((t, n) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); show(tabs[(n + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
    });
  });
  root.querySelectorAll('[data-rp-goto]').forEach((b) => b.addEventListener('click', () => show(tabs[Number(b.dataset.rpGoto)], true)));

  const mail = root.querySelector('[data-rp-mail]');
  if (mail) mail.innerHTML = rpEmailHtml();

  // Team's list with owner filter and the "next check" replay
  const body = root.querySelector('[data-rp-rows]');
  const filters = root.querySelector('[data-rp-filter]');
  const runBtn = root.querySelector('[data-rp-run]');
  const say = root.querySelector('[data-rp-status]');
  const result = root.querySelector('[data-rp-result]');
  let owner = 'All'; let checked = false;
  const pill = (s) => s.confirmed ? '<span class="pill pill-ok">Done ✓</span>' : s.status === 'Still found' ? '<span class="pill pill-amber">Still found</span>' : s.status === 'Done' ? '<span class="pill pill-neutral">Done</span>' : '<span class="pill">Open</span>';
  const draw = () => {
    const st = rpStatuses(checked);
    body.innerHTML = RP_ITEMS.map((i, n) => ({ i, s: st[n] })).filter(({ i }) => owner === 'All' || i.owner === owner)
      .map(({ i, s }) => `<tr class="${RP_MARKED[i.ref] ? 'rp-marked' : ''}${checked && RP_MARKED[i.ref] ? ' rp-flash' : ''}${i.tag ? ' rp-story' : ''}"><td><b>${esc(i.issue)}</b><span>${esc(i.who)}</span>${i.tag ? `<em class="rp-tag">${esc(i.tag)}</em>` : ''}</td><td>${esc(i.todo)}</td><td>${esc(i.owner)}<span>${esc(i.ref)}</span></td><td>${pill(s)}${s.note ? `<span>${esc(s.note)}</span>` : ''}</td></tr>`).join('');
  };
  if (filters) {
    const counts = rpOwnerCounts();
    filters.innerHTML = [['All', RP_ITEMS.length], ...Object.entries(counts)].map(([k, n]) => `<button type="button" class="eq-chip" aria-pressed="${k === 'All'}" data-owner="${esc(k)}">${esc(k)} <span>${n}</span></button>`).join('');
    filters.addEventListener('click', (e) => {
      const b = e.target.closest('[data-owner]'); if (!b) return;
      owner = b.dataset.owner;
      filters.querySelectorAll('[data-owner]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    });
  }
  if (runBtn) runBtn.addEventListener('click', () => {
    if (checked) { checked = false; runBtn.textContent = "Run Wednesday's check"; if (result) result.hidden = true; draw(); if (say) say.textContent = 'Reset to Tuesday.'; return; }
    runBtn.disabled = true; runBtn.textContent = 'Checking the sheets…';
    setTimeout(() => {
      checked = true; runBtn.disabled = false; runBtn.textContent = 'Replay from Tuesday';
      if (result) result.hidden = false;
      draw();
      if (say) say.textContent = 'Check done. J-504 is confirmed done. INV-2200 is still found: no payment recorded yet.';
    }, 900);
  });
  if (body) draw();
}
