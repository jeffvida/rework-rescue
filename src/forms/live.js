// Live field checks: a field is checked when the visitor leaves it, and an error clears as soon as it's fixed.
// Errors use the field's existing error element and aria-invalid, so screen readers announce them.
import { tidy, suggestEmail } from './rules.js';

// A check that runs on blur can show a message and push the submit button down mid-click, so the click
// misses. While a pointer is pressed, blur checks wait until the click has landed.
let pointerDown = false;
const pending = new Set();
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => { pointerDown = true; }, true);
  document.addEventListener('pointerup', () => {
    setTimeout(() => { pointerDown = false; pending.forEach((fn) => fn()); pending.clear(); }, 0);
  }, true);
}
const afterClick = (fn) => { if (pointerDown) pending.add(fn); else fn(); };

export function showError(input, errorEl, message) {
  if (!input || !errorEl) return;
  errorEl.textContent = message || '';
  errorEl.hidden = !message;
  if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
}

/**
 * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} input
 * @param {HTMLElement} errorEl
 * @param {(value:string)=>string} check
 * @param {{tidyOnBlur?:boolean}} [opts]
 */
export function wireField(input, errorEl, check, { tidyOnBlur = false } = {}) {
  if (!input || !errorEl) return;
  const run = () => showError(input, errorEl, check(input.value));
  input.addEventListener('blur', () => afterClick(() => {
    if (tidyOnBlur) input.value = tidy(input.value);
    if (input.value.trim() || input.getAttribute('aria-invalid') === 'true') run();
  }));
  input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
    if (input.getAttribute('aria-invalid') === 'true') run();
  });
}

/** Adds a non-blocking "Did you mean name@gmail.com?" hint under an email field. */
export function wireEmailHint(input, hintEl) {
  if (!input || !hintEl) return;
  const update = () => {
    input.value = input.value.trim();
    const s = suggestEmail(input.value);
    if (!s) { hintEl.hidden = true; hintEl.textContent = ''; return; }
    hintEl.textContent = 'Did you mean ';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hint-fix';
    b.textContent = s;
    b.addEventListener('click', () => {
      input.value = s;
      hintEl.hidden = true;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
    hintEl.append(b, '?');
    hintEl.hidden = false;
  };
  input.addEventListener('blur', () => afterClick(update));
  input.addEventListener('input', () => { if (!hintEl.hidden && !suggestEmail(input.value)) { hintEl.hidden = true; } });
}
