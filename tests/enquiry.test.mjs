// Enquiry tracker demo (build #1, 21 Nov 2026): the page block, the checks (same as the n8n workflow's),
// reading the reply safely, the alert subject, and the privacy notice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkEnquiry, readReply, alertSubject, previewReply, autoReply, countStatuses, EQ_EXAMPLES, EQ_TEXT } from '../src/enquiry-demo.js';
import { SITE } from '../site-config.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');

test('page: a third card in Demos & examples opens the demo in a pop-up panel, so the page stays short', async () => {
  const h = await read('../index.html');
  const sec = h.slice(h.indexOf('id="built"'), h.indexOf('id="how"'));
  const cards = sec.slice(sec.indexOf('<ul class="built-cards'), sec.indexOf('</ul>', sec.indexOf('<ul class="built-cards')));
  assert.match(cards, /<h3>The enquiry tracker<\/h3>/);
  assert.match(cards, /<p class="built-try" data-eq-only hidden><a href="#enquiry-demo" data-eq-open aria-haspopup="dialog">Try it: send an enquiry/);
  const demo = sec.slice(sec.indexOf('<dialog class="cs eq-dlg" id="enquiry-demo"'), sec.indexOf('</dialog>'));
  assert.ok(demo.length > 100, 'demo lives in a dialog (closed by default)');
  assert.doesNotMatch(demo.slice(0, 80), /\bopen\b/);
  for (const l of ['Quote request', 'Urgent complaint', 'Unclear message']) assert.ok(demo.includes(`>${l}</button>`), l);
  for (const n of ['name', 'email', 'message']) assert.match(demo, new RegExp(`name="${n}"`));
  assert.match(demo, /class="eq-trap" aria-hidden="true">[\s\S]*name="website" type="text" tabindex="-1"/, 'hidden spam trap, out of the tab order');
  assert.equal((demo.match(/data-eq-step/g) || []).length, 5);
  assert.match(demo, /data-eq-reply hidden/, 'customer auto-reply preview');
  assert.match(demo, /Nothing is emailed to you\./);
  assert.match(demo, /In a real business, it starts from your inbox, checked every few minutes\./);
  assert.match(demo, /href="privacy\/#enquiry-demo"/);
  assert.match(demo, /made-up business/);
  const js = await read('../src/home.js');
  assert.match(js, /mountEnquiryDemo\(document\.getElementById\('enquiry-demo'\)\)/);
});

test('auto-reply: fixed wording only (no customer text), shown on the page and never emailed', async () => {
  assert.equal(autoReply({ name: 'Maria Lopez', status: 'New', category: 'Quote', owner: 'Sales', urgency: 'Normal' }), 'Thanks Maria, we got your quote request. Our Sales team will get back to you within 1 business day.');
  assert.equal(autoReply({ name: 'Ken Ortiz', status: 'New', category: 'Complaint', owner: 'Manager', urgency: 'High' }), 'Thanks Ken, we got your message and we’re sorry about the trouble. Our Manager will get back to you today.');
  assert.equal(autoReply({ name: 'Ana Cruz', status: 'Needs check', category: 'Other', owner: 'Manager', urgency: 'Normal' }), 'Thanks Ana, we got your message. Someone from our team will get back to you within 1 business day.');
  const js = await read('../src/enquiry-demo.js');
  assert.match(js, /shown here, not sent/);
});

test('config: the demo calls the production webhook on Railway', () => {
  assert.equal(SITE.enquiryDemoUrl, 'https://n8n-production-cf1c.up.railway.app/webhook/enquiry-demo');
});

test('checks: same rules as the workflow (spam trap, name, email, message length)', () => {
  const ok = { name: 'Maria Lopez', email: 'maria@lopezdental.example', message: 'Can I get a quote please?' };
  assert.equal(checkEnquiry(ok), '');
  for (const x of EQ_EXAMPLES) assert.equal(checkEnquiry(x), '', x.label);
  assert.equal(checkEnquiry({ ...ok, website: 'spam.com' }), EQ_TEXT.invalid);
  assert.equal(checkEnquiry({ ...ok, name: 'A' }), EQ_TEXT.invalid);
  assert.equal(checkEnquiry({ ...ok, name: 'x'.repeat(101) }), EQ_TEXT.invalid);
  assert.equal(checkEnquiry({ ...ok, email: 'not-an-email' }), EQ_TEXT.invalid);
  assert.equal(checkEnquiry({ ...ok, message: 'hi' }), EQ_TEXT.invalid);
  assert.equal(checkEnquiry({ ...ok, message: 'x'.repeat(2001) }), EQ_TEXT.invalid);
  assert.equal(checkEnquiry({ ...ok, message: '   hello   ' }), EQ_TEXT.invalid, 'spaces don’t count');
});

test('reply: only known fields reach the page; unknown status reads as Needs check; ok must be true', () => {
  const r = readReply({ ok: true, name: 'Test Visitor', need: 'Quote to clean 1 aircon unit this week', category: 'Quote', urgency: 'Normal', owner: 'Sales', status: 'New', check_reason: '', extra: '<script>' });
  assert.deepEqual(r, { name: 'Test Visitor', company: '', need: 'Quote to clean 1 aircon unit this week', category: 'Quote', urgency: 'Normal', owner: 'Sales', status: 'New', check_reason: '' });
  assert.equal(readReply({ ok: false, error: 'x' }), null);
  assert.equal(readReply(null), null);
  assert.equal(readReply({ ok: true, name: 'A', status: 'Done?' }).status, 'Needs check');
  assert.equal(readReply({ ok: true, name: 'A' }).need, 'See message');
});

test('alert subject matches the workflow: CHECK: and URGENT prefixes', () => {
  assert.equal(alertSubject({ status: 'New', urgency: 'Normal', category: 'Quote', name: 'Maria Lopez', owner: 'Sales' }), 'Quote from Maria Lopez → Sales');
  assert.equal(alertSubject({ status: 'New', urgency: 'High', category: 'Complaint', name: 'Ken Ortiz', owner: 'Manager' }), 'URGENT Complaint from Ken Ortiz → Manager');
  assert.equal(alertSubject({ status: 'Needs check', urgency: 'Normal', category: 'Other', name: 'Ana Cruz', owner: 'Manager' }), 'CHECK: Other from Ana Cruz → Manager');
});

test('preview replies follow the same rules: the unclear example and anything typed are Needs check', () => {
  assert.equal(previewReply(EQ_EXAMPLES[0]).owner, 'Sales');
  assert.equal(previewReply(EQ_EXAMPLES[1]).urgency, 'High');
  assert.equal(previewReply(EQ_EXAMPLES[2]).status, 'Needs check');
  assert.equal(previewReply({ name: 'Me', message: 'Something I typed myself' }).status, 'Needs check');
});

test('privacy: the demo is explained (Gemini free tier, demo sheet, nothing sent to the visitor)', async () => {
  const p = await read('../privacy/index.html');
  const sec = p.slice(p.indexOf('<h2 id="enquiry-demo">'), p.indexOf('<h2', p.indexOf('<h2 id="enquiry-demo">') + 5));
  assert.match(sec, /made-up business/);
  assert.match(sec, /Gemini&rsquo;s free service/);
  assert.match(sec, /Nothing is sent to the email address you enter\./);
  assert.match(p, /the enquiry tracker demo&rsquo;s service when you send an enquiry/);
});

test('tracker: looks like the real sheet (all useful columns), with a summary of what is waiting', async () => {
  const h = await read('../index.html');
  const demo = h.slice(h.indexOf('id="enquiry-demo"'), h.indexOf('</dialog>'));
  for (const c of ['Received', 'Name', 'Company', 'Need', 'Category', 'Urgency', 'Owner', 'Status', 'Check reason']) assert.ok(demo.includes(`<th scope="col">${c}</th>`), c);
  assert.equal((demo.match(/<tr data-status="/g) || []).length, 3, 'three made-up rows to start: Contacted, Won, Needs check');
  assert.match(demo, /data-eq-sum/);
  assert.deepEqual(countStatuses(['New', 'Contacted', 'Won', 'Needs check', 'New']).map((c) => c.n), [2, 1, 1, 1]);
});
