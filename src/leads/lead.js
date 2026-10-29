// Assessment lead record: built in the browser only when a visitor chooses to share their result
// and presses "Share my assessment". It is posted to SITE.submitEndpoint by src/inquiry/adapter.js.
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
