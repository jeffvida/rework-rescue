// Field rules shared by the contact form, the assessment share form and the booking pop-up. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkName, checkEmail, suggestEmail, checkCompany, checkText, checkChoice, isTimeZone, MESSAGES } from '../src/forms.js';
import { validateInquiry } from '../src/inquiry.js';
import { validateShare } from '../src/assessment/share-form.js';

test('valid emails pass', () => {
  for (const e of ['jeff@example.com', 'first.last@company.co.uk', 'a+tag@sub.domain.org', "o'neil@firm.io", ' spaced@ends.com ', 'ACCOUNTS@Big-Co.com.au'])
    assert.equal(checkEmail(e), '', e);
});

test('invalid emails are caught with a helpful message', () => {
  const cases = {
    '': MESSAGES.emailRequired,
    'jeff example.com': MESSAGES.emailSpace,
    'jeff.example.com': MESSAGES.emailAt,
    'jeff@@example.com': MESSAGES.emailAt,
    '@example.com': MESSAGES.emailAt,
    'jeff@example': MESSAGES.emailDomain,
    'jeff@example.c': MESSAGES.emailDomain,
    'jeff@example.123': MESSAGES.emailDomain,
    'jeff@-example.com': MESSAGES.emailDomain,
    'jeff@example..com': MESSAGES.emailDomain,
    'jeff..x@example.com': MESSAGES.emailFormat,
    '.jeff@example.com': MESSAGES.emailFormat,
    'jeff,x@example.com': MESSAGES.emailFormat,
  };
  for (const [e, m] of Object.entries(cases)) assert.equal(checkEmail(e), m, e);
});

test('common domain typos get a suggestion, real domains do not', () => {
  assert.equal(suggestEmail('ana@gmial.com'), 'ana@gmail.com');
  assert.equal(suggestEmail('ana@gmail.con'), 'ana@gmail.com');
  assert.equal(suggestEmail('ana@company.con'), 'ana@company.com');
  assert.equal(suggestEmail('ana@hotmial.com'), 'ana@hotmail.com');
  for (const e of ['ana@gmail.com', 'ana@company.co', 'ana@site.cm', 'not an email']) assert.equal(suggestEmail(e), '', e);
});

test('names', () => {
  for (const n of ['Jeff Herson Vida', 'Ana-María O’Neil', 'Zoë', 'J. R. Cruz', '  Li   Wei  ']) assert.equal(checkName(n), '', n);
  assert.equal(checkName(''), MESSAGES.nameRequired);
  assert.equal(checkName('   '), MESSAGES.nameRequired);
  assert.equal(checkName('J'), MESSAGES.nameShort);
  assert.equal(checkName('Jeff123'), MESSAGES.nameChars);
  assert.equal(checkName('jeff@example.com'), MESSAGES.nameChars);
  assert.equal(checkName('http://spam.example'), MESSAGES.nameChars);
  assert.equal(checkName('a'.repeat(81)), MESSAGES.nameLong);
});

test('company names', () => {
  for (const c of ['', 'Acme Pty Ltd', '3M', 'Smith & Sons', 'acme.com']) assert.equal(checkCompany(c), '', c);
  assert.equal(checkCompany('', { required: true }), MESSAGES.companyRequired);
  assert.equal(checkCompany('---'), MESSAGES.companyChars);
  assert.equal(checkCompany('<b>x</b>'), MESSAGES.companyChars);
  assert.equal(checkCompany('A'), MESSAGES.companyShort);
});

test('free text: length, markup and card or account numbers', () => {
  assert.equal(checkText(''), '');
  assert.equal(checkText('Our weekly billing report takes 3 hours and has 2 manual steps.'), '');
  assert.equal(checkText('x'.repeat(501)), MESSAGES.textLong(500));
  assert.equal(checkText('<script>alert(1)</script>'), MESSAGES.textMarkup);
  assert.equal(checkText('Card 4111 1111 1111 1111 failed'), MESSAGES.textNumbers);
  assert.equal(checkText('Account 123456789012'), MESSAGES.textNumbers);
  assert.equal(checkText('Invoice INV-3402 for $2,310 in 2026'), '');
});

test('dropdowns and time zones', () => {
  assert.equal(checkChoice('', ['a']), '');
  assert.equal(checkChoice('a', ['a']), '');
  assert.equal(checkChoice('z', ['a']), MESSAGES.choice);
  assert.ok(isTimeZone('Asia/Manila') && isTimeZone('') && !isTimeZone('Mars/Base'));
});

test('contact form checks every field', () => {
  assert.deepEqual(validateInquiry({ name: 'Ana Cruz', email: 'ana@acme.com', organization: 'Acme', role: 'operations', organizationSize: '11-50', timeZone: 'Asia/Manila', note: 'Weekly report' }), {});
  const e = validateInquiry({ name: '1', email: 'ana@acme', organization: '--', role: 'boss', organizationSize: 'huge', timeZone: 'Nowhere/Zone', note: 'x'.repeat(501) });
  assert.deepEqual(Object.keys(e).sort(), ['email', 'name', 'note', 'organization', 'organizationSize', 'role', 'timeZone']);
});

test('share form checks every field', () => {
  assert.deepEqual(validateShare({ name: 'Ana Cruz', email: 'ana@acme.com', company: 'Acme', improvement: '' }), {});
  assert.deepEqual(Object.keys(validateShare({ name: '', email: 'bad', company: '--', improvement: '4111111111111111' })).sort(), ['company', 'email', 'improvement', 'name']);
  assert.deepEqual(validateShare({ name: 'Ana Cruz', email: 'ana@acme.com', company: '', improvement: '' }), {}, 'company is optional');
});
