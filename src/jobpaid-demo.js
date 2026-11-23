// Project 3 demo, "From job done to invoice paid" (23 Nov 2026, preview): step 3 of the CoolFix customer story.
// A replay of the verified test run (plan: project doc claude/project3-phase1-architecture-and-page.md, Part G).
// It never calls n8n or Xero. Figures come from the plan's snapshot table (Part F, S1–S3).
// P3_VERIFIED stays false until the Mon 30 Nov run matches the answer key and the screenshots and recording are
// added; until then the pop-up shows a "Preview" line and screenshot slots (data-p3-todo).

export const P3_VERIFIED = false;

// Figures shown in the walk-through (plan Part F, with J-513 as "no completion", plan change 26).
// Tests check that the page matches these and that they add up.
export const P3_FIGURES = {
  quote: 850, extra: 100,
  waiting: [['J-516', 600], ['J-517', 380], ['INV-2200', 420]],   // step 4: still to pay after Carla's payment
  overdue: 420,
  unfinished: [['J-513', 480], ['J-514', 300], ['J-518', 650]],   // booked, date passed, not completed
  notSent: [['J-515', 560]],                                      // completed, draft not yet sent
};
export const sum = (rows) => rows.reduce((t, [, n]) => t + n, 0);

// The CoolFix story: which card link opens each step's pop-up.
export const STORY_OPENERS = {
  'enquiry-demo': '#demo-enquiry [data-eq-open]',
  'report-demo': '#demo-report [data-rp-open]',
  'jobpaid-demo': '#demo-jobpaid [data-jp-open]',
};

/** The 5-step walk-through: one step at a time, Back/Next, and the visitor's choice in step 1 carries through. */
export function mountWalkthrough(root) {
  const steps = [...root.querySelectorAll('[data-wt-step]')];
  const nav = root.querySelector('[data-wt-nav]');
  if (!steps.length || !nav) return;
  const back = nav.querySelector('[data-wt-back]');
  const next = nav.querySelector('[data-wt-next]');
  const count = nav.querySelector('[data-wt-count]');
  const dots = [...root.querySelectorAll('[data-wt-dot]')];
  const body = root.querySelector('.cs-body');
  const form = root.querySelector('[data-wt-form]');
  const err = root.querySelector('[data-wt-error]');
  const sent = root.querySelector('[data-wt-sent]');
  const after = root.querySelector('[data-wt-after]');
  let n = 0; let photo = false; let path = 'not-yet';

  const setPath = () => {
    root.querySelectorAll('[data-wt-path]').forEach((el) => { el.hidden = el.dataset.wtPath !== path; });
    const total = root.querySelector('[data-wt-total]');
    if (total) total.textContent = path === 'signed' ? '$950' : '$850';
  };
  const show = (i, focus) => {
    n = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => { s.hidden = k !== n; });
    dots.forEach((d, k) => { d.classList.toggle('is-on', k === n); d.classList.toggle('is-done', k < n); });
    back.disabled = n === 0;
    next.hidden = n === steps.length - 1;
    count.textContent = `Step ${n + 1} of ${steps.length}`;
    if (body) body.scrollTop = 0;
    if (focus) steps[n].querySelector('.wt-h')?.focus();
  };
  const fill = () => {
    photo = true; after?.classList.add('is-added');
    const add = after?.querySelector('[data-wt-add]'); if (add) add.outerHTML = '<span>&#10003;</span>';
    if (form) form.elements.signoff.checked = true;
  };
  const submit = () => {
    if (!photo) { err.textContent = 'Add the after photo. Repairs need before and after photos.'; return false; }
    if (!form.elements.signoff.checked) { err.textContent = 'Carla needs to confirm the work is completed.'; return false; }
    err.textContent = '';
    path = form.elements.extra.value === 'signed' ? 'signed' : 'not-yet';
    setPath();
    sent.hidden = false;
    form.querySelector('[data-wt-submit]').disabled = true;
    return true;
  };

  steps.forEach((s) => s.querySelector('.wt-h')?.setAttribute('tabindex', '-1'));
  root.querySelector('[data-wt-add]')?.addEventListener('click', () => { fill(); err.textContent = ''; });
  form?.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  // Next from step 1 without submitting: fill it in for the visitor, so nobody gets stuck.
  next.addEventListener('click', () => { if (n === 0 && sent.hidden) { fill(); submit(); } show(n + 1, true); });
  back.addEventListener('click', () => show(n - 1, true));
  const rec = root.querySelector('[data-wt-record]');
  rec?.addEventListener('click', () => {
    rec.hidden = true;
    root.querySelector('[data-wt-rec]').hidden = false;
    root.querySelector('[data-wt-after-rec]').hidden = false;
  });
  nav.hidden = false;
  setPath();
  show(0);
  root.addEventListener('close', () => show(0));
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
  mountWalkthrough(root);
  if (P3_VERIFIED) root.querySelectorAll('[data-p3-todo]').forEach((el) => el.remove());
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
