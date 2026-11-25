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

test('big tiles, three per row; hover shows Problem / Solution / What improved; click opens the details', async () => {
  const s = sec(await read('../index.html'));
  assert.match(s, /<ul class="sp-grid" data-sp-track aria-label="Sample projects">/);
  assert.doesNotMatch(s, /sp-arrow|data-sp-dots/, 'no sideways scrolling (Jeff 25 Nov 08:03)');
  assert.equal((s.match(/<span class="sp-hover" aria-hidden="true">/g) || []).length, 5);
  for (const m of s.matchAll(/<span class="sp-hover" aria-hidden="true">([\s\S]*?)<\/span>\s*<\/a>/g)) assert.match(m[1], /<b>Problem<\/b>[\s\S]*<b>Solution<\/b>[\s\S]*<b>What improved<\/b>/);
  const css = await read('../assets/styles.css');
  assert.match(css, /\.sp-grid \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.sp-tile:hover \.sp-hover/);
  assert.deepEqual([...s.matchAll(/href="#sp-d-(\w+)" data-sp-open="(\w+)" aria-haspopup="dialog"/g)].map((m) => [m[1], m[2]]), IDS.map((i) => [i, i]));
  assert.deepEqual([...s.matchAll(/<span class="sp-tile-h">([^<]+)<\/span>/g)].map((m) => m[1]), ['Enquiry tracker', 'Morning check and Monday report', 'Job done to invoice paid', 'Booking calendar', 'Chat assistant']);
  assert.match(s, /<dialog class="cs sp-dlg" id="sp-dialog"/);
  const js = await read('../src/sample-rail.js');
  assert.match(js, /details\.append\(body\.firstElementChild\)/, 'articles are moved, not copied, so Try-it links keep working');
  assert.match(await read('../src/home.js'), /mountSampleRail\(\);/);
});

test('each pop-up: Problem / Solution / What improved, How it works, the workflow image, Tools used', async () => {
  const s = sec(await read('../index.html'));
  for (const id of IDS) {
    const d = detail(s, id);
    assert.match(d, /<p class="sp-tag">(Sample project &middot; Built and tested with fictional data|Live on this site &middot; Running for real)<\/p>/, id);
    assert.match(d, /<dt>Problem<\/dt>[\s\S]*<dt>Solution<\/dt>[\s\S]*<dt>What improved<\/dt>/, id);
    assert.match(d, /<h4 class="sp-sub">How it works<\/h4>\s*<ol class="sp-flow">(<li>[^<]+<\/li>){4,5}<\/ol>/, `${id}: a simple flow of 4–5 steps`);
    assert.match(d, id === 'invoice' ? /<h4 class="sp-sub">What it looks like<\/h4>\s*<figure class="cs3-pic"/ : /<h4 class="sp-sub">The workflow<\/h4>\s*<figure class="sp-shot"><a href="assets\/workflows\/[a-z-]+\.webp"/, id);
    assert.match(d, /<h4 class="sp-sub">Tools used<\/h4>\s*<p class="sp-tools">[^<]+<\/p>/, id);
    assert.doesNotMatch(d, /<details/, `${id}: nothing hidden in folds`);
    const face = d.slice(0, d.indexOf('<h4 class="sp-sub">How it works'));
    assert.doesNotMatch(face, /n8n|Gemini|Xero|Google Sheets|Gmail|client (work|project)|\d+%|hours saved/i, `${id}: no tool names, client claims or invented results in the text`);
  }
  for (const id of ['enquiry', 'report', 'invoice']) assert.match(detail(s, id), /Sample project &middot; Built and tested with fictional data/);
});

test('thumbnails and pictures use the same fictional figures as the demos; only built features', async () => {
  const s = sec(await read('../index.html'));
  const m = (n) => '\\$' + n.toLocaleString('en-US');
  const r = s.slice(s.indexOf('data-sp-open="report"'), s.indexOf('</a>', s.indexOf('data-sp-open="report"'))); // the tile thumbnail
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
