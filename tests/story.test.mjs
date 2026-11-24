// 25 Nov 2026 (preview): Jeff replaced the Carla story with three sample projects, each with
// Problem / Solution / What improved and a picture (drawn for now; real screenshots to follow).
// Rule: labelled as sample projects built with fictional data, never as client work; no invented results.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_FIGURES } from '../src/report-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const box = (h) => h.slice(h.indexOf('<div class="sp" id="sample-projects"'), h.indexOf('<div class="built-group cj-others"'));
const cards = (b) => b.slice(b.indexOf('<ol class="cs3">'), b.indexOf('<div class="cj-outcome">')).split('<li class="cs3-step sp-card"').slice(1);
const words = (s) => s.replace(/<figure[\s\S]*?<\/figure>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).filter((w) => /\w/.test(w)).length;

test('three sample projects, each Problem / Solution / What improved with a picture', async () => {
  const c = cards(box(await read('../index.html')));
  assert.deepEqual(c.map((x) => x.match(/<h3 class="cs3-h">([^<]+)<\/h3>/)[1]), ['Enquiry tracker', 'Morning check and Monday report', 'Job done to invoice paid']);
  for (const [i, x] of c.entries()) {
    assert.match(x, /<p class="sp-tag">Sample project &middot; built and tested with fictional data<\/p>/, `card ${i + 1} label`);
    assert.match(x, /<dt>Problem<\/dt>[\s\S]*<dt>Solution<\/dt>[\s\S]*<dt>What improved<\/dt>/, `card ${i + 1}`);
    assert.match(x, /<figure class="cs3-pic" aria-label="Picture: [^"]+">/, `card ${i + 1} picture`);
    assert.doesNotMatch(x, /n8n|Gemini|Xero|Google Sheets|Gmail|workflow|client|\d+%|hours saved/i, `card ${i + 1}: no tool names, client claims or invented results`);
    assert.ok(words(x) <= 95, `card ${i + 1} stays short (${words(x)} words)`);
  }
});

test('pictures use the same fictional figures as the demos', async () => {
  const [, r, inv] = cards(box(await read('../index.html')));
  const m = (n) => '\\$' + n.toLocaleString('en-US');
  assert.match(r, new RegExp(`Work done, not invoiced</span><strong>${m(RP_FIGURES.notInvoiced)}</strong>`));
  assert.match(r, new RegExp(`Payments overdue</span><span class="pill pill-amber">${m(RP_FIGURES.overdue)}</span>`));
  assert.match(r, new RegExp(`Total to follow up</span><strong>${m(RP_FIGURES.toFollowUp)}</strong>`));
  assert.match(inv, /Aircon repair <small>\(approved\)<\/small><\/span><strong>\$850<\/strong>/);
  assert.match(inv, /Invoice total<\/span><strong>\$850<\/strong>/);
  assert.match(inv, /<li>Prepared<\/li><li>Sent by office<\/li><li class="is-paid">Paid &#10003;<\/li>/);
});

test('only features that are built; tools behind one fold; booking at the end', async () => {
  const h = await read('../index.html');
  const b = box(h);
  assert.doesNotMatch(b, /AI draft reply|Needs info/, 'AI draft reply for missing details is not built yet');
  assert.match(b, /<details class="fold cj-more"><summary>How they&rsquo;re built<\/summary>/);
  assert.match(b, /href="contact\/#contact-form-area">Book a free process review<\/a>/);
  assert.doesNotMatch(h, /id="carla"|jobpaid-demo|data-cj-/);
});
