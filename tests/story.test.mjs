// 25 Nov 2026 (preview): sample projects in one sideways row with floating arrows; each tile opens a pop-up
// with Problem / Solution / What improved, a simple "How it works" flow, a picture and the technical side.
// Rules: sample projects labelled as built with fictional data, never as client work; no invented results;
// only features that are actually built.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_FIGURES } from '../src/report-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const sec = (h) => h.slice(h.indexOf('<div class="sp-rail" id="sample-projects"'), h.indexOf('</dialog>', h.indexOf('id="sp-dialog"')) + 9);
const detail = (s, id) => s.slice(s.indexOf(`id="sp-d-${id}"`), s.indexOf('</article>', s.indexOf(`id="sp-d-${id}"`)));
const IDS = ['enquiry', 'report', 'invoice', 'booking', 'chat'];

test('one sideways row: five tiles, floating arrows, each tile opens its details', async () => {
  const s = sec(await read('../index.html'));
  assert.match(s, /<button type="button" class="sp-arrow sp-prev" data-sp-prev aria-label="Previous projects" hidden>/);
  assert.match(s, /<button type="button" class="sp-arrow sp-next" data-sp-next aria-label="More projects" hidden>/);
  assert.deepEqual([...s.matchAll(/href="#sp-d-(\w+)" data-sp-open="(\w+)" aria-haspopup="dialog"/g)].map((m) => [m[1], m[2]]), IDS.map((i) => [i, i]));
  assert.deepEqual([...s.matchAll(/<span class="sp-tile-h">([^<]+)<\/span>/g)].map((m) => m[1]), ['Enquiry tracker', 'Morning check and Monday report', 'Job done to invoice paid', 'Booking calendar', 'Chat assistant']);
  assert.match(s, /<dialog class="cs sp-dlg" id="sp-dialog"/);
  const js = await read('../src/sample-rail.js');
  assert.match(js, /details\.append\(body\.firstElementChild\)/, 'articles are moved, not copied, so Try-it links keep working');
  assert.match(await read('../src/home.js'), /mountSampleRail\(\);/);
});

test('each pop-up: label, Problem / Solution / What improved, How it works, a picture, the technical side', async () => {
  const s = sec(await read('../index.html'));
  for (const id of IDS) {
    const d = detail(s, id);
    assert.match(d, /<p class="sp-tag">(Sample project &middot; Built and tested with fictional data|Live on this site &middot; Running for real)<\/p>/, id);
    assert.match(d, /<dt>Problem<\/dt>[\s\S]*<dt>Solution<\/dt>[\s\S]*<dt>What improved<\/dt>/, id);
    assert.match(d, /<h4 class="sp-sub">How it works<\/h4>\s*<ol class="sp-flow">(<li>[^<]+<\/li>){4,5}<\/ol>/, `${id}: a simple flow of 4–5 steps`);
    assert.match(d, /<figure class="cs3-pic" aria-label="Picture: /, id);
    assert.match(d, /<details class="fold cj-more"><summary>The technical side<\/summary>/, id);
    const face = d.slice(0, d.indexOf('<details'));
    assert.doesNotMatch(face, /n8n|Gemini|Xero|Google Sheets|Gmail|client (work|project)|\d+%|hours saved/i, `${id}: no tool names, client claims or invented results before the fold`);
  }
  for (const id of ['enquiry', 'report', 'invoice']) assert.match(detail(s, id), /Sample project &middot; Built and tested with fictional data/);
});

test('pictures use the same fictional figures as the demos; only built features', async () => {
  const s = sec(await read('../index.html'));
  const m = (n) => '\\$' + n.toLocaleString('en-US');
  const r = detail(s, 'report');
  assert.match(r, new RegExp(`Work done, not invoiced</span><strong>${m(RP_FIGURES.notInvoiced)}</strong>`));
  assert.match(r, new RegExp(`Total to follow up</span><strong>${m(RP_FIGURES.toFollowUp)}</strong>`));
  const inv = detail(s, 'invoice');
  assert.match(inv, /Invoice total<\/span><strong>\$850<\/strong>/);
  assert.match(inv, /<li>Prepared<\/li><li>Sent by office<\/li><li class="is-paid">Paid &#10003;<\/li>/);
  assert.doesNotMatch(s, /AI draft reply|Needs info/, 'AI draft reply for missing details is not built yet');
  assert.match(detail(s, 'enquiry'), /data-eq-open aria-haspopup="dialog">Try it: send your own test enquiry/);
  assert.match(detail(s, 'report'), /data-rp-open aria-haspopup="dialog">Try it: see the full Monday report/);
  assert.match(s, /href="contact\/#contact-form-area">Book a free process review<\/a>/);
});
