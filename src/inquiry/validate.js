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

import { checkName, checkEmail, checkCompany, checkText, checkChoice, isTimeZone, MESSAGES } from '../forms/rules.js';

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
