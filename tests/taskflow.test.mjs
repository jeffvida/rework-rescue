// "What's taking up your team's time?" hero box (Jeff, 17 Nov 2026): built-in rules turn a typed task into a
// five-step workflow in the visitor's words. Always two automated steps, one check, one step that stays with a person.
// Never a price, a savings figure or a promise; nothing typed leaves the browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planFor, typeOf, sourceOf, storeOf, clean, MAX_LEN, TAGS } from '../src/demo/taskflow.js';

const cases = [
  ['We copy job requests from WhatsApp into our Excel sheet and forget to follow up', 'retyping'],
  ['Customers wait days because we forget to follow up', 'followups'],
  ['Rebuilding the same report every Monday', 'reports'],
  ['Our inbox is a mess, hundreds of emails a day', 'inbox'],
  ['New enquiries from the website get lost', 'enquiries'],
  ['Purchase approvals get stuck with the manager', 'approvals'],
  ['Checking invoices against completed jobs', 'invoices'],
  ['Booking appointments and rescheduling by phone', 'scheduling'],
  ['Everything takes too long', 'general'],
];

test('each typed task finds the closest task type', () => {
  for (const [text, type] of cases) assert.equal(typeOf(text), type, text);
});

test('every plan has five steps: start, two automated, one check, one that stays with a person', () => {
  for (const [text] of cases) {
    const { steps } = planFor(text);
    assert.deepEqual(steps.map((s) => s.tag), ['start', 'auto', 'auto', 'check', 'you'], text);
    for (const s of steps) { assert.ok(s.title && s.desc, text); assert.doesNotMatch(s.desc, /\{src\}|\{store\}/, text); }
  }
  assert.deepEqual(TAGS, { auto: 'Automated', check: 'Check', you: 'Stays with you' });
});

test('their words come back: where work arrives, where it is kept, reminders when they mention forgetting', () => {
  const p = planFor('We copy job requests from WhatsApp into our Excel sheet and forget to follow up');
  assert.match(p.steps[0].desc, /WhatsApp/);
  assert.match(p.steps[2].desc, /your Excel sheet/);
  assert.match(p.steps[2].title, /reminders set/);
  assert.equal(sourceOf('orders come through the website form'), 'your website form');
  assert.equal(sourceOf('nothing special'), 'email');
  assert.equal(storeOf('in google sheets'), 'your Google Sheet');
  assert.equal(storeOf('our CRM'), 'your CRM');
  assert.equal(storeOf('nothing special'), 'one simple tracker');
});

test('honest: no prices, savings, guarantees or invented results in any template', async () => {
  const js = await readFile(new URL('../src/demo/taskflow.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /[$₱€£]\s?\d|\d+\s?%|save[sd]? \d|hours? (a|per) week|guarantee|100%/i);
  for (const [text] of cases) for (const s of planFor(text).steps) assert.doesNotMatch(`${s.title} ${s.desc}`, /\d+\s?(%|hours)|save/i);
});

test('private: nothing typed is sent, stored or carried into booking', async () => {
  const js = await readFile(new URL('../src/demo/taskflow.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|location\.(href|search)\s*=|innerHTML/);
  assert.match(js, /textContent/, 'visitor text is only ever written as text');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /What you type stays in your browser\./);
  const box = html.slice(html.indexOf('id="task-box"'), html.indexOf('id="hero-flow"'));
  assert.match(box, /<form class="tw-ask" hidden>/, 'hidden without JavaScript; the example flow shows on its own');
  assert.doesNotMatch(box, /action=|method=/);
  assert.equal(clean('  a   b  '), 'a b');
  assert.equal(clean('x'.repeat(500)).length, MAX_LEN);
  assert.match(html, /maxlength="200"/);
});

test('the result panel: example label, not-a-quote note, booking button and reset', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const res = html.slice(html.indexOf('class="tw-result"'), html.indexOf('</div>', html.indexOf('class="tw-actions"')));
  assert.match(res, /aria-live="polite"/);
  assert.match(res, /An example of how this could work, based on your words\. Not a quote\./);
  assert.match(res, /href="contact\/#contact-form-area">Book a free review<\/a>/);
  assert.match(res, /data-tw-reset>Try another task<\/button>/);
  assert.equal((html.match(/data-tw-example>/g) || []).length, 3);
});
