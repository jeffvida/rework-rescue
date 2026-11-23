// Project 3 demo, "From job done to invoice paid" (23 Nov 2026, preview): step 3 of the CoolFix customer story.
// A replay of the verified test run (plan: project doc claude/project3-phase1-architecture-and-page.md, Part G).
// It never calls n8n or Xero. Figures come from the plan's snapshot table (Part F, S1–S3).
// P3_VERIFIED stays false until the Mon 30 Nov run matches the answer key and the screenshots and recording are
// added; until then the pop-up shows a "Preview" line and screenshot slots (data-p3-todo).

export const P3_VERIFIED = false;

// Snapshot figures shown in the pop-up (plan Part F). Tests check the page against these.
export const P3_SNAPSHOTS = {
  S1: { asAt: 'Tue 24 Nov, 4:05pm', draft: 850, extraPending: 100, overdue: 420 },
  S2: { asAt: 'Tue 24 Nov, 3:40pm', job: 'J-512', missing: 'after photo' },
  S3: { asAt: 'Mon 30 Nov, 7am', openItems: 7, paid: 850, partPaid: [600, 1200], dueSoon: 380, overdue: 420 },
};

// The CoolFix story: which card link opens each step's pop-up.
export const STORY_OPENERS = {
  'enquiry-demo': '#demo-enquiry [data-eq-open]',
  'report-demo': '#demo-report [data-rp-open]',
  'jobpaid-demo': '#demo-jobpaid [data-jp-open]',
};

function mountTabs(list) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const show = (t, focus) => {
    tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; });
    if (focus) t.focus();
  };
  tabs.forEach((t, n) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); show(tabs[(n + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
    });
  });
}

export function mountJobPaidDemo(root) {
  if (!root || typeof HTMLDialogElement !== 'function' || typeof root.showModal !== 'function') return;
  let opener = null;
  document.querySelectorAll('[data-jp-only]').forEach((el) => { el.hidden = false; });
  document.querySelectorAll('[data-jp-open]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); opener = a;
    document.documentElement.classList.add('cs-lock');
    root.showModal();
    root.querySelector('[data-jp-close]')?.focus();
  }));
  root.addEventListener('close', () => { document.documentElement.classList.remove('cs-lock'); opener?.focus({ preventScroll: true }); });
  root.querySelector('[data-jp-close]')?.addEventListener('click', () => root.close());
  root.addEventListener('click', (e) => { if (e.target === root) root.close(); });
  root.querySelectorAll('[role="tablist"]').forEach(mountTabs);
  if (P3_VERIFIED) root.querySelectorAll('.jp-todo').forEach((el) => el.remove());
}

/** "Next" links between the three pop-ups: close this one, then open the next once it has closed. */
export function mountStoryLinks() {
  document.querySelectorAll('[data-story-go]').forEach((b) => b.addEventListener('click', () => {
    const next = document.querySelector(STORY_OPENERS[b.dataset.storyGo] || '');
    if (!next) return;
    const cur = b.closest('dialog');
    if (cur && cur.open) { cur.addEventListener('close', () => setTimeout(() => next.click(), 0), { once: true }); cur.close(); } else next.click();
  }));
}
