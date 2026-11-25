// 25 Nov 2026 (preview): ChatGPT round 2 applied (Jeff pasted it). Numbered problem-first cards, a
// fictional-data note under the heading, live website features as their own group linking to the real
// thing, and a simpler pop-up: problem → what happens → example result (fictional data) → what improves,
// with the workflow diagram and tools behind "How it's built". Never presented as client work.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_FIGURES } from '../src/report-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const sec = (h) => h.slice(h.indexOf('<p class="eyebrow">Sample projects</p>'), h.indexOf('</dialog>', h.indexOf('id="sp-dialog"')) + 9);
const detail = (s, id) => s.slice(s.indexOf(`id="sp-d-${id}"`), s.indexOf('</article>', s.indexOf(`id="sp-d-${id}"`)));
const tile = (s, id) => s.slice(s.indexOf(`data-sp-open="${id}"`), s.indexOf('</a>', s.indexOf(`data-sp-open="${id}"`)));
const re = (t) => new RegExp(t.replace(/[.?]/g, '\\$&'));
// 25 Nov 08:59: industry-neutral titles (Jeff + ChatGPT); the CoolFix examples, figures and demos stay underneath.
const CARDS = [['enquiry', '01 &mdash; Customer enquiries &amp; follow-ups', 'Enquiries get missed or forgotten.', 'AI reads incoming enquiries, records the details and assigns an owner.', 'Every enquiry has an owner'],
  ['report', '02 &mdash; Business operations &amp; reporting', 'Important work and information go unnoticed.', 'Automated checks identify missing records, outstanding work and overdue payments.', 'Know what needs attention'],
  ['invoice', '03 &mdash; Work, records &amp; payments', 'Errors and unapproved charges affect payments.', 'Completion details and approval rules are checked before an invoice is prepared.', 'Only approved work proceeds']];

test('heading, fictional-data note, numbered problem-first cards (ChatGPT wording)', async () => {
  const s = sec(await read('../index.html'));
  assert.match(s, /<h2 id="built-h">Common business problems\. Practical improvements\.<\/h2>/);
  assert.match(s, /<p class="sp-note">Illustrative examples using fictional business data\. Actual workflows are tailored to each business\.<\/p>/);
  for (const [id, tag, h, one, out] of CARDS) {
    const t = tile(s, id);
    assert.match(t, re(`<span class="sp-tile-tag">${tag}</span>`), id);
    assert.match(t, re(`<span class="sp-tile-h">${h}</span>`), id);
    assert.match(t, re(`<span class="sp-tile-one">${one}</span>`), id);
    assert.match(t, re(`<span class="sp-out">&#10003; ${out}</span>`), id);
  }
  assert.match(s, /<strong>Have a similar problem\? Let&rsquo;s look at your process\.<\/strong>/);
  assert.doesNotMatch(s, /sp-hover/);
  for (const m of s.matchAll(/<span class="sp-tile-(tag|h)">([^<]+)<\/span>/g)) assert.doesNotMatch(m[2], /aircon|air-con|technician|trade|field|CoolFix|repair/i, `industry-neutral: ${m[2]}`);
});

test('live website features: own group, picture, same pop-up as the others, Try it: links inside', async () => {
  const s = sec(await read('../index.html'));
  assert.ok(s.indexOf('Sample projects <span>') < s.indexOf('Live website features <span>&mdash; Try the experience</span>'));
  assert.match(s, /<span class="sp-tile-tag">04 &mdash; Online bookings &amp; scheduling<\/span>\s*<span class="sp-tile-h">Arranging appointments takes too much time\.<\/span>/);
  assert.match(s, /<span class="sp-tile-tag">05 &mdash; AI customer assistance<\/span>\s*<span class="sp-tile-h">Customers need answers when your team is busy\.<\/span>\s*<span class="sp-tile-one">An AI assistant answers within defined limits and suggests the next step\.<\/span>/);
  assert.match(s, /href="contact\/#contact-form-area" data-sp-leave>Try it: book a time/);
  assert.match(s, /data-assistant-open data-sp-leave>Try it: ask the assistant/);
  assert.equal((s.match(/<span class="sp-out sp-out-live">Live on this site<\/span>/g) || []).length, 2);
  for (const id of ['booking', 'chat']) {
    const d = detail(s, id);
    assert.match(d, /<p class="sp-kind">Live on this site<\/p>/, id);
    const order = ['How it&rsquo;s built', 'The problem', 'What happens', 'What visitors see', 'What improves'].map((x) => d.indexOf(`<h4 class="sp-sub">${x}</h4>`));
    assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), `${id}: ${order}`);
    assert.match(d, /data-sp-leave>Try it: /, `${id}: the Try-it link closes the pop-up first`);
    assert.doesNotMatch(d, /<details/);
  }
});

test('pop-up: How it\'s built first (open, not a fold) → problem → what happens → example result → what improves', async () => {
  const s = sec(await read('../index.html'));
  for (const [id] of CARDS) {
    const d = detail(s, id);
    assert.match(d, /<p class="sp-kind">Sample project<\/p>/, id);
    const order = ['How it&rsquo;s built', 'The problem', 'What happens', 'Example result &mdash; fictional data', 'What improves'].map((x) => d.indexOf(`<h4 class="sp-sub">${x}</h4>`));
    assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), `${id}: ${order}`);
    assert.equal((d.match(/<ol class="sp-does">(<li>[^<]+<\/li>){4}<\/ol>/g) || []).length, 1, `${id}: four steps`);
    assert.doesNotMatch(d, /<details/, `${id}: nothing collapsible (Jeff 25 Nov 09:21)`);
    assert.match(d, /<div class="sp-block sp-built"><h4 class="sp-sub">How it&rsquo;s built<\/h4>[\s\S]*?<p class="sp-tools"><strong>Tools used:<\/strong>/, id);
    assert.doesNotMatch(d, /client (work|project)|\d+%|hours saved/i, id);
  }
  const inv = detail(s, 'invoice');
  assert.match(inv, /<h3 class="sp-detail-h" id="sp-h-invoice">Make sure the invoice reflects approved work\.<\/h3>/);
  assert.match(inv, /<span>Approved repair<\/span><strong>\$850<\/strong>[\s\S]*<span>Extra charge awaiting approval<\/span><strong>\$100<\/strong>[\s\S]*<span>Invoice draft<\/span><strong>\$850<\/strong>/);
  assert.match(inv, /The office reviews and sends the invoice\. The additional \$100 is not included without approval\./);
  assert.match(inv, /<li>An invoice draft is prepared for office approval\.<\/li>/, 'prepared for review, never sent automatically');
  const m = (n) => '\\$' + n.toLocaleString('en-US');
  assert.match(detail(s, 'report'), new RegExp(`Total to follow up</span><strong>${m(RP_FIGURES.toFollowUp)}</strong>`));
  assert.match(detail(s, 'enquiry'), /data-eq-open aria-haspopup="dialog">Try it: send your own test enquiry/);
  assert.match(detail(s, 'report'), /data-rp-open aria-haspopup="dialog">Try it: see the full Monday report/);
  assert.doesNotMatch(s, /AI draft reply|Needs info/);
  assert.match(await read('../src/sample-rail.js'), /x\.dataset\.spGroup === t\.dataset\.spGroup/);
});
