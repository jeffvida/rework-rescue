// Shared field rules for every form on the site (contact form, assessment share form, booking pop-up).
// Client-side only: a server or form service must check again before trusting anything.
// Each check returns '' when the value is fine, or a plain-English message saying what to fix.

export const LIMITS = { name: 80, email: 254, company: 100, text: 500 };

export const MESSAGES = {
  nameRequired: 'Please enter your name.',
  nameShort: 'Please enter your full name (at least 2 letters).',
  nameChars: 'Please use letters only in your name (spaces, hyphens and apostrophes are fine).',
  nameLong: `Please shorten your name to ${LIMITS.name} characters.`,
  emailRequired: 'Please enter your email so I can reply.',
  emailSpace: 'Email addresses can\'t contain spaces. Please check it.',
  emailAt: 'An email address needs one @, like name@company.com.',
  emailDomain: 'The part after the @ doesn\'t look right. It should look like company.com.',
  emailFormat: 'That email doesn\'t look right. Please check it.',
  emailLong: 'That email is too long. Please check it.',
  companyRequired: 'Please enter your company or organization name.',
  companyShort: 'Please enter at least 2 characters.',
  companyChars: 'Please use letters or numbers in the company name.',
  companyLong: `Please shorten this to ${LIMITS.company} characters.`,
  textLong: (max) => `Please shorten this to ${max} characters.`,
  textNumbers: 'Please remove card, account or ID numbers. A general description is enough.',
  textMarkup: 'Please remove the < and > characters.',
  choice: 'Please choose one of the options in the list.',
};

/** Trim and collapse repeated spaces. */
export const tidy = (v) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

export function checkName(value) {
  const v = tidy(value);
  if (!v) return MESSAGES.nameRequired;
  if (v.length > LIMITS.name) return MESSAGES.nameLong;
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(v)) return MESSAGES.nameChars;
  if ((v.match(/\p{L}/gu) || []).length < 2) return MESSAGES.nameShort;
  return '';
}

const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function checkEmail(value) {
  const v = String(value ?? '').trim();
  if (!v) return MESSAGES.emailRequired;
  if (v.length > LIMITS.email) return MESSAGES.emailLong;
  if (/\s/.test(v)) return MESSAGES.emailSpace;
  const at = v.split('@');
  if (at.length !== 2 || !at[0]) return MESSAGES.emailAt;
  const [local, domain] = at;
  if (local.length > 64 || !LOCAL_RE.test(local)) return MESSAGES.emailFormat;
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL_RE.test(l))) return MESSAGES.emailDomain;
  if (!/^[A-Za-z]{2,}$/.test(labels[labels.length - 1])) return MESSAGES.emailDomain;
  return '';
}

// Common typing slips in well-known email domains. Used only as a gentle "Did you mean…?" hint;
// it never blocks sending, because an unusual domain can still be real.
const DOMAIN_FIXES = {
  'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gamil.com': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outllok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'iclod.com': 'icloud.com', 'icoud.com': 'icloud.com', 'icloud.con': 'icloud.com',
};
const TLD_FIXES = { con: 'com', cmo: 'com', comm: 'com', ocm: 'com', vom: 'com', xom: 'com', nte: 'net', ogr: 'org' };

/** Returns a corrected address to suggest, or '' when nothing looks mistyped. */
export function suggestEmail(value) {
  const v = String(value ?? '').trim();
  if (checkEmail(v)) return '';
  const i = v.lastIndexOf('@');
  const local = v.slice(0, i);
  const domain = v.slice(i + 1).toLowerCase();
  if (DOMAIN_FIXES[domain]) return `${local}@${DOMAIN_FIXES[domain]}`;
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  if (TLD_FIXES[tld]) return `${local}@${[...parts.slice(0, -1), TLD_FIXES[tld]].join('.')}`;
  return '';
}

export function checkCompany(value, { required = false } = {}) {
  const v = tidy(value);
  if (!v) return required ? MESSAGES.companyRequired : '';
  if (v.length > LIMITS.company) return MESSAGES.companyLong;
  if (/[<>]/.test(v)) return MESSAGES.companyChars;
  if (!/[\p{L}\p{N}]/u.test(v)) return MESSAGES.companyChars;
  if ((v.match(/[\p{L}\p{N}]/gu) || []).length < 2) return MESSAGES.companyShort;
  return '';
}

/** Free-text answers: optional, limited length, and no long number runs (card, account or ID numbers). */
export function checkText(value, { max = LIMITS.text, required = false, requiredMessage = '' } = {}) {
  const raw = String(value ?? '');
  const v = raw.trim();
  if (!v) return required ? requiredMessage : '';
  if (raw.length > max) return MESSAGES.textLong(max);
  if (/<[^>]*>/.test(v)) return MESSAGES.textMarkup;
  if (/(?:\d[ -]?){12,}/.test(v)) return MESSAGES.textNumbers;
  return '';
}

/** Dropdowns: the value must be one of the listed options (or empty when optional). */
export function checkChoice(value, allowed, { required = false } = {}) {
  const v = String(value ?? '');
  if (!v) return required ? MESSAGES.choice : '';
  return allowed.includes(v) ? '' : MESSAGES.choice;
}

export function isTimeZone(value) {
  if (!value) return true;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}
