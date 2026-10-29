// Inquiry form (Stage 2C section 4.2). Renders into a container and talks only to the submission adapter.

import { SITE } from '../config/site.js';
import { esc } from './esc.js';
import { validateInquiry, INQUIRY_MESSAGES, ROLE_OPTIONS, SIZE_OPTIONS } from '../inquiry/validate.js';
import { checkName, checkEmail, checkCompany, checkText, LIMITS } from '../forms/rules.js';
import { wireField, wireEmailHint, showError } from '../forms/live.js';
import { buildPayload, summaryPreview } from '../inquiry/payload.js';
import { submitInquiry } from '../inquiry/adapter.js';

function timeZones() {
  let list = [];
  try {
    if (typeof Intl.supportedValuesOf === 'function') list = Intl.supportedValuesOf('timeZone');
  } catch { /* fall through */ }
  if (!list.length) list = ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
  return list;
}

function browserZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; }
}

const opt = (value, label, selected) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;

/**
 * @param {HTMLElement} root
 * @param {{ getAnswers: ()=>object, getDecision: ()=>object|null, onSent: ()=>void, config?: object, fetchImpl?: Function }} ctx
 */
export function mountInquiryForm(root, ctx) {
  const config = { ...SITE, ...(ctx.config || {}) };
  const answers = ctx.getAnswers();
  const hasAssessment = Object.keys(answers).length > 0 && !!ctx.getDecision();
  const zone = browserZone();

  root.innerHTML = `
    <form class="inquiry" novalidate aria-describedby="inq-status">
      ${config.submitEndpoint ? '' : `<p class="callout callout-warn" role="note"><strong>Not connected yet.</strong> This form is a preview. Nothing you type here is sent anywhere, and no email is delivered, until a submission endpoint is set up (see the README). To reach me now, use the email or LinkedIn details on this page.</p>`}
      <div class="field">
        <label for="inq-name">Name <span class="req">(required)</span></label>
        <input id="inq-name" name="name" type="text" autocomplete="name" required maxlength="${LIMITS.name}" aria-describedby="inq-name-err">
        <p class="error" id="inq-name-err" hidden></p>
      </div>
      <div class="field">
        <label for="inq-email">Email <span class="req">(required)</span></label>
        <input id="inq-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" required maxlength="${LIMITS.email}" aria-describedby="inq-email-err inq-email-hint">
        <p class="error" id="inq-email-err" hidden></p>
        <p class="hint" id="inq-email-hint" aria-live="polite" hidden></p>
      </div>
      <div class="field">
        <label for="inq-org">Organization <span class="opt">(optional)</span></label>
        <input id="inq-org" name="organization" type="text" autocomplete="organization" maxlength="${LIMITS.company}" aria-describedby="inq-org-err">
        <p class="error" id="inq-org-err" hidden></p>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="inq-role">Your role <span class="opt">(optional)</span></label>
          <select id="inq-role" name="role" aria-describedby="inq-role-err">${ROLE_OPTIONS.map(([v, l]) => opt(v, l, false)).join('')}</select>
          <p class="error" id="inq-role-err" hidden></p>
        </div>
        <div class="field">
          <label for="inq-size">Organization size <span class="opt">(optional)</span></label>
          <select id="inq-size" name="organizationSize" aria-describedby="inq-size-err">${SIZE_OPTIONS.map(([v, l]) => opt(v, l, false)).join('')}</select>
          <p class="error" id="inq-size-err" hidden></p>
        </div>
      </div>
      <div class="field">
        <label for="inq-tz">Your time zone <span class="opt">(optional)</span></label>
        <select id="inq-tz" name="timeZone" aria-describedby="inq-tz-err">
          <option value="">Choose one (optional)</option>
          ${timeZones().map((z) => opt(z, z.replace(/_/g, ' '), z === zone)).join('')}
        </select>
        <p class="error" id="inq-tz-err" hidden></p>
      </div>
      <div class="field">
        <label for="inq-note">Anything else you'd like me to know <span class="opt">(optional)</span></label>
        <p class="help" id="inq-note-help"><strong>Please don't include confidential or sensitive information.</strong> Describe the process in general terms.</p>
        <textarea id="inq-note" name="note" rows="4" maxlength="${config.NOTE_MAX + 200}" aria-describedby="inq-note-help inq-note-count inq-note-err"></textarea>
        <p class="counter" id="inq-note-count" aria-live="off"><span id="inq-note-n">0</span> / ${config.NOTE_MAX}</p>
        <p class="error" id="inq-note-err" hidden></p>
      </div>
      <div class="hp" aria-hidden="true">
        <label for="inq-website">Leave this field empty</label>
        <input id="inq-website" name="website" type="text" tabindex="-1" autocomplete="off">
      </div>
      ${hasAssessment ? `
      <div class="field summary-field">
        <label class="choice"><input type="checkbox" id="inq-summary" name="includeSummary"><span class="choice-text"><span class="choice-label">Include a summary of my assessment answers</span><span class="choice-desc">Optional. Unchecked by default. Your answers stay on this page unless you tick this box and send the form.</span></span></label>
        <div id="inq-summary-preview" aria-live="polite"><p class="muted">No assessment answers will be sent.</p></div>
      </div>` : `
      <p class="muted" id="inq-summary-none">No assessment answers will be sent.</p>`}
      <p class="muted contact-use">I'll use these details only to reply to you and discuss possible work. They aren't sold, shared for marketing or added to a mailing list, and if nothing goes ahead they're deleted within 12 months. See the <a href="${esc(ctx.privacyHref || '../privacy/')}">privacy notice</a>.</p>
      <p class="muted">The rework review is a free ${esc(config.CALL_MINUTES)}-minute conversation. Detailed process mapping, solution design and implementation are part of a paid, defined-scope project.</p>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="inq-submit">Request my rework review</button>
      </div>
      <div id="inq-status" role="status" aria-live="polite" class="form-status"></div>
    </form>`;

  const form = root.querySelector('form');
  const q = (id) => root.querySelector(id);
  const status = q('#inq-status');
  const submit = q('#inq-submit');
  const note = q('#inq-note');
  const summaryBox = q('#inq-summary');

  note.addEventListener('input', () => { q('#inq-note-n').textContent = String(note.value.length); });

  if (summaryBox) {
    const preview = q('#inq-summary-preview');
    summaryBox.addEventListener('change', () => {
      if (summaryBox.checked) {
        preview.innerHTML = `<p><strong>This is exactly what will be sent with your message:</strong></p>
          <pre class="payload-preview" tabindex="0" aria-label="Assessment summary that will be sent">${esc(summaryPreview(ctx.getAnswers(), ctx.getDecision()))}</pre>`;
      } else {
        preview.innerHTML = '<p class="muted">No assessment answers will be sent.</p>';
      }
    });
  }

  // Field key (form element name) -> element id suffix
  const IDS = { name: 'name', email: 'email', organization: 'org', role: 'role', organizationSize: 'size', timeZone: 'tz', note: 'note' };
  const ORDER = Object.keys(IDS);
  const el = (k) => q(`#inq-${IDS[k]}`);
  const err = (k) => q(`#inq-${IDS[k]}-err`);
  const setError = (k, message) => showError(el(k), err(k), message);

  wireField(el('name'), err('name'), checkName, { tidyOnBlur: true });
  wireField(el('email'), err('email'), checkEmail);
  wireEmailHint(el('email'), q('#inq-email-hint'));
  wireField(el('organization'), err('organization'), (v) => checkCompany(v), { tidyOnBlur: true });
  wireField(el('note'), err('note'), (v) => checkText(v, { max: config.NOTE_MAX }));

  const collect = () => ({
    name: form.elements.name.value,
    email: form.elements.email.value,
    organization: form.elements.organization.value,
    role: form.elements.role.value,
    organizationSize: form.elements.organizationSize.value,
    timeZone: form.elements.timeZone.value,
    note: form.elements.note.value,
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = collect();
    const errors = validateInquiry(fields, { noteMax: config.NOTE_MAX });
    ORDER.forEach((f) => setError(f, errors[f] || ''));
    status.textContent = '';
    status.className = 'form-status';
    const firstInvalid = ORDER.find((f) => errors[f]);
    if (firstInvalid) { el(firstInvalid).focus(); return; }

    const includeSummary = !!(summaryBox && summaryBox.checked);
    const payload = buildPayload({
      fields,
      includeSummary,
      answers: includeSummary ? ctx.getAnswers() : undefined,
      decision: includeSummary ? ctx.getDecision() : undefined,
      honeypot: form.elements.website.value,
    });

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending…';
    const result = await submitInquiry(payload, { endpoint: config.submitEndpoint, fetchImpl: ctx.fetchImpl });
    submit.disabled = false;
    submit.removeAttribute('aria-busy');

    if (result.status === 'sent') {
      status.textContent = '';
      ctx.onSent();
      return;
    }
    status.className = 'form-status callout callout-error';
    status.textContent = result.status === 'unconfigured' ? INQUIRY_MESSAGES.unconfigured : INQUIRY_MESSAGES.sendFailure;
  });

  return { form };
}

export function confirmationHtml(config = SITE) {
  return `
    <h1 id="confirm-title" tabindex="-1">Thanks. Your message has been sent.</h1>
    <p>You'll hear back within ${esc(config.RESPONSE_DAYS)} business days.</p>
    <h2>What to expect</h2>
    <p>The rework review is a free ${esc(config.CALL_MINUTES)}-minute conversation about one report, check or process: whether it's worth fixing, and roughly what it would take. Detailed process mapping, solution design, and implementation are part of a paid, defined-scope project.</p>`;
}
