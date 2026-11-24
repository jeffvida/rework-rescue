// 24 Nov 2026 (preview, simplified): the flagship CoolFix demo, "From customer enquiry to payment received."
// One customer (Carla), three steps: Enquiry → Job → Payment. Each step: a heading, Before / After, and one
// "Try it" button that shows the result. Runs in the page only: no n8n or Xero calls.
// Without JavaScript all three steps and their results show in order.

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
  let n = 0;

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

  screens.forEach((s) => s.querySelector('.cj-h')?.setAttribute('tabindex', '-1'));
  root.querySelectorAll('[data-cj-js]').forEach((el) => { el.hidden = false; });
  root.querySelectorAll('[data-cj-res]').forEach((el) => { el.hidden = true; });
  root.querySelectorAll('[data-cj-run]').forEach((b) => b.addEventListener('click', () => {
    const res = root.querySelector(`[data-cj-res="${b.dataset.cjRun}"]`);
    res.hidden = false; b.closest('.cj-try').hidden = true;
  }));
  next.addEventListener('click', () => show(n + 1, true));
  back.addEventListener('click', () => show(n - 1, true));
  tabs.forEach((t, k) => t.addEventListener('click', () => show(k, true)));
  // "Next" buttons inside the enquiry and weekly-report pop-ups bring the visitor back to Carla's story.
  document.querySelectorAll('[data-cj-go]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.cjGo); const d = b.closest('dialog');
    if (d && d.open) { d.addEventListener('close', () => setTimeout(() => goTo(i), 0), { once: true }); d.close(); } else goTo(i);
  }));
  nav.hidden = false;
  show(0);
}
