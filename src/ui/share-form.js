// "Want to discuss your result?" block, shown directly under the assessment result.
// The result is never hidden or blocked. Contact details and the assessment are sent only when the
// visitor opens this form and presses "Share my assessment".

import { esc } from './esc.js';
import { submitInquiry } from '../inquiry/adapter.js';
import { buildLeadRecord, newSubmissionId } from '../leads/lead.js';
import { track, EVENTS } from '../analytics/track.js';
import { checkName, checkEmail, checkCompany, checkText, LIMITS } from '../forms/rules.js';
import { wireField, wireEmailHint, showError } from '../forms/live.js';

export const SHARE_MESSAGES = {
  name: 'Please enter your name.',
  email: 'Please enter your email so Jeff can reply.',
  emailFormat: "That email doesn't look right. Please check it.",
  company: 'Please enter your company or organization name.',
  improvement: 'Please shorten this to 500 characters.',
  failure: "That didn't send just yet. Your assessment result is still available above. Please try again, or use the contact link below.",
  unconfigured: "Sharing isn't switched on yet, so nothing was sent. Your assessment result is still available above. You can reach Jeff using the contact link below.",
};

export function validateShare(f, max = 500) {
  const e = {};
  const set = (k, m) => { if (m) e[k] = m; };
  set('name', checkName(f.name));
  set('email', checkEmail(f.email));
  set('company', checkCompany(f.company));
  set('improvement', checkText(f.improvement, { max }));
  return e;
}

/**
 * @param {HTMLElement} root
 * @param {{getResult:()=>object, getSummary:()=>string, config:object, utm:object,
 *          privacyHref:string, contactHref:string, contactLabel:string, page:string, fetchImpl?:Function}} ctx
 */
export function mountShareBlock(root, ctx) {
  const { config } = ctx;
  const max = config.NOTE_MAX || 500;
  let submissionId = null;
  let sending = false;
  const result = () => {
    const r = ctx.getResult();
    return { category: r ? r.pillar || 'FALLBACK' : '', service_pillar: r ? r.pillarName : '' };
  };

  function intro() {
    root.innerHTML = `
      <div class="share-block share-intro" id="share-block">
        <div class="share-actions">
          <button type="button" class="btn btn-primary btn-large" data-book id="share-h">${esc((ctx.labels || {}).button || 'Book a free rework review')}</button>
          <button type="button" class="btn btn-secondary" data-share="open">${esc((ctx.labels || {}).shareButton || 'Send my result without booking')}</button>
          <button type="button" class="btn btn-ghost" data-share="dismiss">No thanks</button>
        </div>
      </div>`;
  }

  function dismissed() {
    root.innerHTML = `
      <div class="share-block share-dismissed" id="share-block">
        <p id="share-h" tabindex="-1">No problem. Your result stays on this page until you close or refresh it. Nothing has been sent.</p>
        <p class="share-actions"><a class="btn btn-secondary" href="../">Back to the home page</a>
          <button type="button" class="btn btn-ghost" data-book>${esc((ctx.labels || {}).button || 'Book a free rework review')} after all</button></p>
      </div>`;
  }

  function form() {
    submissionId = newSubmissionId(); // one id per interaction; a retry reuses it
    const preview = ctx.getSummary();
    root.innerHTML = `
      <div class="share-block share-open" id="share-block">
        <h3 id="share-h" tabindex="-1">Share your result with Jeff</h3>
        ${config.submitEndpoint ? '' : '<p class="callout callout-warn" role="note"><strong>Not connected yet.</strong> This form is a preview. Nothing is sent until a lead store is set up. To reach Jeff now, use the contact link below.</p>'}
        <form class="share-form" novalidate aria-describedby="share-privacy">
          <div class="field-row">
            <div class="field">
              <label for="sh-name">Name</label>
              <input id="sh-name" name="name" type="text" autocomplete="name" required maxlength="${LIMITS.name}" aria-describedby="sh-name-err">
              <p class="error" id="sh-name-err" hidden></p>
            </div>
            <div class="field">
              <label for="sh-email">Email</label>
              <input id="sh-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" required maxlength="${LIMITS.email}" aria-describedby="sh-email-err sh-email-hint">
              <p class="error" id="sh-email-err" hidden></p>
              <p class="hint" id="sh-email-hint" aria-live="polite" hidden></p>
            </div>
          </div>
          <div class="field">
            <label for="sh-company">Company <span class="opt">(optional)</span></label>
            <input id="sh-company" name="company" type="text" autocomplete="organization" maxlength="${LIMITS.company}" aria-describedby="sh-company-err">
            <p class="error" id="sh-company-err" hidden></p>
          </div>
          <div class="field">
            <label for="sh-improvement">What would you most like to improve? <span class="opt">(optional)</span></label>
            <p class="help" id="sh-improvement-help">A sentence or two is enough. Please leave out confidential or sensitive information.</p>
            <textarea id="sh-improvement" name="improvement" rows="3" maxlength="${max + 200}" aria-describedby="sh-improvement-help sh-improvement-err"></textarea>
            <p class="error" id="sh-improvement-err" hidden></p>
          </div>
          <div class="hp" aria-hidden="true">
            <label for="sh-website">Leave this field empty</label>
            <input id="sh-website" name="website" type="text" tabindex="-1" autocomplete="off">
          </div>
          <p class="share-privacy" id="share-privacy">Your assessment is private until you choose to share it. By submitting this form, you'll send your assessment result and contact details to Jeff at Rework Rescue so he can follow up about your workflow. <a href="${esc(ctx.privacyHref)}">Privacy notice</a></p>
          <details class="share-preview">
            <summary>See exactly what will be shared from your result</summary>
            <pre class="payload-preview" tabindex="0" aria-label="Assessment details that will be shared">${esc(preview)}</pre>
          </details>
          <div class="share-actions">
            <button type="submit" class="btn btn-primary" id="sh-submit">Share my assessment</button>
            <button type="button" class="btn btn-ghost" data-share="dismiss">No thanks</button>
          </div>
          <div id="sh-status" role="status" aria-live="polite" class="form-status"></div>
          <p class="muted share-contact">Prefer email? <a href="${esc(ctx.contactHref)}">${esc(ctx.contactLabel)}</a></p>
        </form>
      </div>`;
  }

  function success(firstName) {
    root.innerHTML = `
      <div class="share-block share-done" id="share-block">
        <h3 id="share-h" tabindex="-1">Thanks, ${esc(firstName)}.</h3>
        <p>Your assessment has been shared with Jeff.</p>
        <p>He now has the context about your workflow and can follow up from there.</p>
        <p class="share-sign"><strong>Rework Rescue</strong><br>Less rework. More real work.</p>
      </div>`;
  }

  const focus = () => { const h = root.querySelector('#share-h'); if (h) h.focus(); };

  function setError(field, msg) {
    showError(root.querySelector(`#sh-${field}`), root.querySelector(`#sh-${field}-err`), msg);
  }

  function wireLive() {
    const f = (k) => root.querySelector(`#sh-${k}`);
    const e = (k) => root.querySelector(`#sh-${k}-err`);
    wireField(f('name'), e('name'), checkName, { tidyOnBlur: true });
    wireField(f('email'), e('email'), checkEmail);
    wireEmailHint(f('email'), root.querySelector('#sh-email-hint'));
    wireField(f('company'), e('company'), (v) => checkCompany(v), { tidyOnBlur: true });
    wireField(f('improvement'), e('improvement'), (v) => checkText(v, { max }));
  }

  async function submit(formEl) {
    if (sending) return; // blocks double clicks and double Enter presses
    const f = {
      name: formEl.elements.name.value,
      email: formEl.elements.email.value,
      company: formEl.elements.company.value,
      improvement: formEl.elements.improvement.value,
    };
    const errors = validateShare(f, max);
    ['name', 'email', 'company', 'improvement'].forEach((k) => setError(k, errors[k]));
    const status = root.querySelector('#sh-status');
    status.className = 'form-status';
    status.textContent = '';
    const first = ['name', 'email', 'company', 'improvement'].find((k) => errors[k]);
    if (first) { root.querySelector(`#sh-${first}`).focus(); return; }

    const record = buildLeadRecord({
      fields: f,
      result: ctx.getResult(),
      summary: ctx.getSummary(),
      submissionId,
      utm: ctx.utm,
      page: ctx.page,
      honeypot: formEl.elements.website.value,
    });
    const btn = root.querySelector('#sh-submit');
    sending = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending…';
    let res;
    try {
      res = await submitInquiry(record, { endpoint: config.submitEndpoint, fetchImpl: ctx.fetchImpl });
    } catch {
      res = { status: 'failed' };
    }
    sending = false;
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (res.status === 'sent') {
      track(EVENTS.LEAD_SUBMITTED, result());
      success(f.name.trim().split(/\s+/)[0]);
      focus();
      return;
    }
    status.className = 'form-status callout callout-error';
    status.textContent = res.status === 'unconfigured' ? SHARE_MESSAGES.unconfigured : SHARE_MESSAGES.failure;
  }

  root.addEventListener('click', (event) => {
    const b = event.target.closest('[data-share]');
    if (!b) return;
    if (b.dataset.share === 'open') {
      track(EVENTS.SHARE_STARTED, result());
      form(); wireLive(); focus();
    } else if (b.dataset.share === 'dismiss') {
      dismissed(); focus();
    }
  });
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(event.target);
  });

  // No lead store connected yet: offer email (with the result pre-filled) and LinkedIn instead of a form
  // that can't send. Nothing leaves the page unless the visitor sends the email themselves.
  if (!config.submitEndpoint && ctx.email) {
    const L = ctx.labels || {};
    const href = () => `mailto:${ctx.email}?subject=${encodeURIComponent(L.emailSubject || 'Find Your Rework result')}&body=${encodeURIComponent(`Hi Jeff,\n\nI'd like to talk through this result.\n\n${ctx.getSummary()}\n\nName:\nCompany:\n`)}`;
    root.innerHTML = `
      <div class="share-block share-intro" id="share-block">
        <div class="share-actions">
          <button type="button" class="btn btn-primary btn-large" id="share-h" data-book>${esc(L.button || 'Book a free rework review')}</button>
          <a class="btn btn-secondary" data-share-email href="${esc(href())}">${esc(L.emailButton || 'Email my result without booking')}</a>
          ${ctx.linkedin ? `<a class="btn btn-ghost" href="${esc(ctx.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(L.linkedinButton || 'Message on LinkedIn')}<span class="sr-only"> (opens in a new tab)</span></a>` : ''}
        </div>
      </div>`;
    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-share-email]')) track(EVENTS.SHARE_STARTED, result());
    });
    return { open() { root.scrollIntoView({ block: 'start' }); const b = root.querySelector('#share-h'); if (b) b.focus(); } };
  }

  intro();
  return {
    open() { root.querySelector('[data-share="open"]') ? root.querySelector('[data-share="open"]').click() : focus(); root.scrollIntoView({ block: 'start' }); },
  };
}
