// 24 Nov 2026 (preview): the flagship CoolFix demo, "From customer enquiry to payment received."
// One customer (Carla Lim), three screens: Enquiry → Job → Payment. Jeff + ChatGPT direction, 24 Nov.
// Replaces the three CoolFix cards and the "Job done to paid" pop-up. Runs in the page only: no n8n or Xero calls.
// Without JavaScript all three screens show in order.

export const CJ_FIGURES = { quote: 850, extra: 100, draft: 850 };

export function mountCarla(root) {
  if (!root) return;
  const screens = [...root.querySelectorAll('[data-cj-screen]')];
  const tabs = [...root.querySelectorAll('[data-cj-tab]')];
  const nav = root.querySelector('[data-cj-nav]');
  if (!screens.length || !nav) return;
  const back = nav.querySelector('[data-cj-back]');
  const next = nav.querySelector('[data-cj-next]');
  const count = nav.querySelector('[data-cj-count]');
  const form = root.querySelector('[data-cj-form]');
  const err = root.querySelector('[data-cj-error]');
  const ok = root.querySelector('[data-cj-ok]');
  const submitBtn = root.querySelector('[data-cj-submit]');
  const after = root.querySelector('[data-cj-after]');
  let n = 0; let photo = true; let sent = false;

  const show = (i, focus) => {
    n = Math.max(0, Math.min(screens.length - 1, i));
    screens.forEach((s, k) => { s.hidden = k !== n; });
    tabs.forEach((t, k) => {
      t.setAttribute('aria-current', k === n ? 'step' : 'false');
      t.parentElement.classList.toggle('is-on', k === n);
      t.parentElement.classList.toggle('is-done', k < n);
    });
    back.disabled = n === 0;
    next.hidden = n === screens.length - 1;
    count.textContent = `${n + 1} of ${screens.length}`;
    if (focus) screens[n].querySelector('.cj-h')?.focus({ preventScroll: true });
  };
  const goTo = (i) => { show(i, true); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const setPhoto = (has) => {
    photo = has; sent = false;
    after.classList.toggle('is-added', has);
    after.innerHTML = has ? 'After <span>&#10003;</span>' : 'After <button type="button" class="wt-add" data-cj-add>Add photo</button>';
    ok.hidden = true; submitBtn.disabled = false; err.textContent = '';
    after.querySelector('[data-cj-add]')?.addEventListener('click', () => setPhoto(true));
  };
  const submit = () => {
    if (!photo) { err.textContent = 'Add the after photo. Repairs need before and after photos. No invoice is prepared until it is added.'; return; }
    err.textContent = ''; sent = true; ok.hidden = false; submitBtn.disabled = true;
  };

  screens.forEach((s) => s.querySelector('.cj-h')?.setAttribute('tabindex', '-1'));
  form?.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  root.querySelector('[data-cj-missing]')?.addEventListener('click', () => setPhoto(false));
  root.querySelectorAll('[data-cj-js]').forEach((el) => { el.hidden = false; });
  // Next from the job screen without submitting: the normal, successful submission happens for the visitor.
  next.addEventListener('click', () => { if (n === 1 && !sent) { setPhoto(true); submit(); } show(n + 1, true); });
  back.addEventListener('click', () => show(n - 1, true));
  tabs.forEach((t, k) => t.addEventListener('click', () => show(k, true)));
  document.querySelectorAll('[data-cj-start]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goTo(0); }));
  // "Next" buttons inside the enquiry and weekly-report pop-ups bring the visitor back to Carla's story.
  document.querySelectorAll('[data-cj-go]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.cjGo); const d = b.closest('dialog');
    if (d && d.open) { d.addEventListener('close', () => setTimeout(() => goTo(i), 0), { once: true }); d.close(); } else goTo(i);
  }));
  nav.hidden = false;
  show(0);
}
