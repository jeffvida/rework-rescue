// Funnel events: assessment_started, assessment_completed, assessment_share_started, assessment_lead_submitted.
//
// NOTHING IS SENT. No analytics tool is chosen yet, so track() only:
//  - raises a "rr:analytics" event inside the page (so a tool can listen later), and
//  - calls SITE.analytics.send(name, props) only if a send function is configured there (it isn't).
// Properties never include answers, contact details or identifiers: only the result category and pillar.
// When a tool is chosen, update the privacy page and the "Nothing is saved" line on the assessment.

import { SITE } from '../config/site.js';

export const EVENTS = Object.freeze({
  STARTED: 'assessment_started',
  COMPLETED: 'assessment_completed',
  SHARE_STARTED: 'assessment_share_started',
  LEAD_SUBMITTED: 'assessment_lead_submitted',
});

const ALLOWED_PROPS = ['category', 'service_pillar', 'state'];
const fired = new Set();

/** @param {string} name  @param {object} [props]  @param {{once?:boolean}} [opts] */
export function track(name, props = {}, { once = false } = {}) {
  if (once) {
    if (fired.has(name)) return false;
    fired.add(name);
  }
  const clean = {};
  for (const k of ALLOWED_PROPS) if (props[k]) clean[k] = String(props[k]);
  try {
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('rr:analytics', { detail: { name, props: clean } }));
    }
  } catch { /* ignore */ }
  try {
    const send = SITE.analytics && SITE.analytics.send;
    if (typeof send === 'function') send(name, clean);
  } catch { /* analytics must never break the page */ }
  return true;
}

/** Allows a new run of the assessment to count as a new start/completion. */
export function resetOnce(...names) { names.forEach((n) => fired.delete(n)); }
