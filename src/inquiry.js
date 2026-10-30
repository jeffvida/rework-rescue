// Sending an inquiry or a shared assessment result: field validation, the payload, the lead record
// and the submit call to SITE.submitEndpoint. Nothing is sent while that endpoint is empty.

import { MESSAGES, checkChoice, checkCompany, checkEmail, checkName, checkText, isTimeZone } from './forms.js';

// ---- Inquiry fields and checks
// Inquiry form validation (Stage 2C section 4.2). Client-side only; the server must validate again.

export const INQUIRY_MESSAGES = {
  required: 'Please enter your name and email so I can reply.',
  email: "That email doesn't look right. Please check it.",
  note: 'Please shorten this to 500 characters.',
  sendFailure: "Something went wrong and your message wasn't sent. Your assessment answers are still on this page. Please try again.",
  unconfigured: "Message sending isn't set up on this site yet, so your message was not sent. Nothing has left this page.",
};

export const ROLE_OPTIONS = [
  ['', 'Choose one (optional)'],
  ['owner_director', 'Owner or director'],
  ['operations', 'Operations'],
  ['finance_admin', 'Finance or admin'],
  ['it_technical', 'IT or technical'],
  ['other', 'Other'],
  ['prefer_not', 'Prefer not to say'],
];

export const SIZE_OPTIONS = [
  ['', 'Choose one (optional)'],
  ['1-10', '1-10'],
  ['11-50', '11-50'],
  ['51-250', '51-250'],
  ['250+', 'More than 250'],
  ['prefer_not', 'Prefer not to say'],
];

/**
 * Checks every field of the contact form. Returns a map of field -> message (empty when all valid).
 * Field keys match the form's element names.
 * @param {{name?:string,email?:string,organization?:string,role?:string,organizationSize?:string,timeZone?:string,note?:string}} fields
 */
export function validateInquiry(fields, { noteMax = 500 } = {}) {
  const errors = {};
  const set = (k, m) => { if (m) errors[k] = m; };
  set('name', checkName(fields.name));
  set('email', checkEmail(fields.email));
  set('organization', checkCompany(fields.organization));
  set('role', checkChoice(fields.role || '', ROLE_OPTIONS.map(([v]) => v).filter(Boolean)));
  set('organizationSize', checkChoice(fields.organizationSize || '', SIZE_OPTIONS.map(([v]) => v).filter(Boolean)));
  if (!isTimeZone(fields.timeZone)) errors.timeZone = MESSAGES.choice;
  set('note', checkText(fields.note, { max: noteMax }));
  return errors;
}

// ---- Inquiry payload
// Builds the payload for the contact-page inquiry form.
// Assessment results are shared separately, from the result page (src/assessment/share-form.js and the lead record below).

/**
 * @param {{fields:object, honeypot?:string}} input
 */
export function buildPayload({ fields, honeypot = '' }) {
  return {
    record_type: 'contact_inquiry',
    contact: {
      name: (fields.name || '').trim(),
      email: (fields.email || '').trim(),
      organization: (fields.organization || '').trim(),
      role: fields.role || '',
      organizationSize: fields.organizationSize || '',
      timeZone: fields.timeZone || '',
      note: (fields.note || '').trim(),
    },
    includesAssessmentSummary: false,
    // Spam trap: real visitors never see or fill this field. The server should reject non-empty values.
    website: honeypot,
  };
}

/** Kept for compatibility with older templates. The contact page never attaches an assessment. */
export function summaryPreview() {
  return '';
}

// ---- Sending
// Submission adapter. The only code in this project that can send data off the page.
//
// Returns one of:
//   { status: 'unconfigured' }              no endpoint set: nothing is sent, and the UI says so honestly
//   { status: 'sent' }                      the endpoint answered with a 2xx status
//   { status: 'failed', reason }            network error, timeout or non-2xx answer
//
// Never logs the payload and never reports success unless the endpoint confirmed it.

export async function submitInquiry(payload, { endpoint = '', fetchImpl, timeoutMs = 15000 } = {}) {
  if (!endpoint) return { status: 'unconfigured' };
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { status: 'failed', reason: 'no-fetch' };

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller ? controller.signal : undefined,
    });
    if (res && res.ok) return { status: 'sent' };
    return { status: 'failed', reason: `http-${res ? res.status : 'none'}` };
  } catch (err) {
    return { status: 'failed', reason: err && err.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---- Shared assessment result (lead record)
// Assessment lead record: built in the browser only when a visitor chooses to share their result
// and presses "Share my assessment". It is posted to SITE.submitEndpoint by submitInquiry() above.
//
// While SITE.submitEndpoint is empty, nothing is sent and the form says so honestly.
//
// ---------------------------------------------------------------------------------------------
// SERVER CONTRACT (for whichever lead store is connected later: Google Sheet script, Netlify
// function, Cloudflare function, etc.). The browser never holds any key or credential.
//  - Accept POST application/json with the record below. Reply 2xx only after the record is saved.
//  - Reject (but reply 2xx, so bots learn nothing) when `website` (spam trap) is not empty.
//  - Validate again on the server: name and email required, company optional; improvement_area <= 500 chars.
//  - Deduplicate on submission_id: the same id is resent on a retry of the same interaction.
//    A new interaction (form opened again later) gets a new id, so repeat leads are kept.
//  - Store one row per lead. `status` starts as "New".
//  - Optional: email Jeff "New Rework Rescue assessment lead" with name, email, company,
//    assessment_result.result_name, assessment_summary, improvement_area, created_at and utm_* fields.
// ---------------------------------------------------------------------------------------------

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];

/** UTM values from a query string. Only these three keys are read. */
export function readUtm(search = '') {
  const params = new URLSearchParams(search);
  const out = {};
  for (const key of UTM_KEYS) out[key] = (params.get(key) || '').trim().slice(0, 100);
  return out;
}

export function newSubmissionId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fall through */ }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The result part of the record: enough to answer "which problems lead to conversations". */
export function assessmentResult(r) {
  if (!r) return {};
  const w = r.workload;
  return {
    result: r.pillar || 'START_WITH_ONE_PROCESS', // REPORTING | DATA | WORKFLOW | START_WITH_ONE_PROCESS
    result_name: r.pillarName,
    area: r.kind === 'fallback' ? r.area : r.answers.area,
    task: r.kind === 'fallback' ? r.task : r.answers.task,
    frequency: r.answers ? r.answers.frequency : '',
    time_each: r.answers ? r.answers.time : '',
    same_steps: r.answers ? r.answers.consistency : '',
    limits: r.answers ? r.answers.limits : [],
    workload_month: w && w.kind === 'annual' ? `${w.month} staff-hours` : '',
    workload_year: w && w.kind === 'annual' ? `${w.year} staff-hours` : '',
  };
}

/**
 * @param {{fields:{name,email,company,improvement}, result:object, summary:string,
 *          submissionId:string, utm:object, page:string, honeypot?:string, now?:Date}} input
 */
export function buildLeadRecord({ fields, result, summary = '', submissionId, utm = {}, page = '', honeypot = '', now = new Date() }) {
  return {
    record_type: 'assessment_lead',
    submission_id: submissionId,
    created_at: now.toISOString(),
    name: (fields.name || '').trim(),
    email: (fields.email || '').trim(),
    company: (fields.company || '').trim(),
    improvement_area: (fields.improvement || '').trim(),
    assessment_result: assessmentResult(result),
    // The assessment uses a simple lookup; it does not calculate a score.
    assessment_score: null,
    assessment_summary: summary,
    source: 'assessment_result',
    landing_page: page,
    utm_source: utm.utm_source || '',
    utm_medium: utm.utm_medium || '',
    utm_campaign: utm.utm_campaign || '',
    status: 'New',
    website: honeypot,
  };
}
