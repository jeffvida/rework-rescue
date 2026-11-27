// 27 Nov 2026: USD | AUD toggle for the Pricing section. Fixed display prices, not live conversion.
// Every element with [data-price] (Pricing section, FAQ cost answer) shows the starting price in the chosen currency.
// USD is the default and what shows without JavaScript; the toggle itself only appears when this script runs.
const PRICES = { USD: 'USD $500', AUD: 'AUD $750' };
const KEY = 'rr-currency';

export function mountCurrency(doc = document) {
  const toggles = [...doc.querySelectorAll('[data-cur-toggle]')];
  if (!toggles.length) return;
  const set = (cur, save) => {
    if (!PRICES[cur]) cur = 'USD';
    doc.querySelectorAll('[data-price]').forEach((el) => { el.textContent = PRICES[cur]; });
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
