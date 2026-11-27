// 27 Nov 2026: USD | AUD toggle (US$ / AU$ format, Jeff 11:45) for the Pricing section. Fixed display prices, not live conversion.
// Every element with [data-price] shows its price in the chosen currency:
//   data-price (empty)  → starting price (Pricing section, FAQ cost answer)
//   data-price="maint"  → ongoing maintenance (FAQ "Can I request support after the 30 days?")
// USD is the default and what shows without JavaScript; the toggle itself only appears when this script runs.
const PRICES = {
  start: { USD: 'US$500', AUD: 'AU$750' },
  maint: { USD: 'US$165/month', AUD: 'AU$250/month' },
};
const KEY = 'rr-currency';

export function mountCurrency(doc = document) {
  const toggles = [...doc.querySelectorAll('[data-cur-toggle]')];
  if (!toggles.length) return;
  const set = (cur, save) => {
    if (!PRICES.start[cur]) cur = 'USD';
    doc.querySelectorAll('[data-price]').forEach((el) => {
      const kind = (el.dataset && el.dataset.price) || 'start';
      if (PRICES[kind]) el.textContent = PRICES[kind][cur];
    });
    doc.querySelectorAll('[data-cur]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cur === cur)));
    if (save) { try { localStorage.setItem(KEY, cur); } catch (e) { /* storage unavailable: choice lasts for this visit */ } }
  };
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  set(saved || 'USD', false);
  toggles.forEach((t) => {
    t.hidden = false;
    t.addEventListener('click', (e) => { const b = e.target.closest('[data-cur]'); if (b) set(b.dataset.cur, true); });
  });
}
