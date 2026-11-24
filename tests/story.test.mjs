// 24 Nov 2026 (preview, static): Jeff chose to drop the click-through demo. One CoolFix customer, three steps,
// each with Before / After / What improved and a drawn picture (option A). Step 1: no date or time → flagged
// "Needs info" and an AI draft reply for the office to approve (shown as a fictional example of what I can build).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_ITEMS } from '../src/report-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const carla = (h) => h.slice(h.indexOf('<div class="cj" id="carla"'), h.indexOf('<div class="built-group cj-others"'));
const steps = (c) => c.slice(c.indexOf('<ol class="cs3">'), c.indexOf('</ol>\n\n          <div class="cj-outcome">')).split('<li class="cs3-step"').slice(1);
const words = (s) => s.replace(/<figure[\s\S]*?<\/figure>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).filter((w) => /\w/.test(w)).length;

test('three static steps: heading, Before / After / What improved, and a picture', async () => {
  const c = carla(await read('../index.html'));
  const s = steps(c);
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => x.match(/<h4 class="cs3-h">([^<]+)<\/h4>/)[1]), ['The enquiry is captured', 'The missing job is caught', 'The right invoice is prepared']);
  for (const [i, x] of s.entries()) {
    assert.match(x, /<dt>Before<\/dt>[\s\S]*<dt>After<\/dt>[\s\S]*<dt>What improved<\/dt>/, `step ${i + 1}`);
    assert.match(x, /<figure class="cs3-pic" aria-label="Picture: [^"]+">/, `step ${i + 1} picture`);
    assert.doesNotMatch(x, /<img/, 'drawn pictures, no photos');
    assert.doesNotMatch(x, /n8n|Gemini|Xero|Google Sheets|Gmail|workflow|E-1038|<button/, `step ${i + 1}: no tools, codes or buttons`);
    assert.ok(words(x) <= 70, `step ${i + 1} stays short (${words(x)} words)`);
  }
  assert.doesNotMatch(await read('../src/home.js'), /mountCarla/, 'no script');
});

test('step 1: no date or time → Needs info, AI draft reply the office approves', async () => {
  const s1 = steps(carla(await read('../index.html')))[0];
  assert.match(s1, /gives no date or time/);
  assert.match(s1, /flagged &ldquo;Needs info&rdquo;\. AI drafts a reply asking for her preferred date and time\. The office checks it and sends it\./);
  assert.match(s1, /<p class="pic-k">AI draft reply &middot; waiting for approval<\/p>/);
  assert.match(s1, /No enquiry stalls because details are missing\./);
});

test('facts match the test data, the section is labelled fictional, and there is a bridge', async () => {
  const c = carla(await read('../index.html'));
  const e = RP_ITEMS.find((i) => i.ref === 'E-1038');
  assert.deepEqual([e.who, e.issue, e.tag], ['Carla Lim', 'Booked, no job', 'Office created J-512']);
  const [, s2, s3] = steps(c);
  assert.match(s2, /<small>Booked, no job<\/small>/); assert.match(s2, /Job J-512 created/);
  assert.match(s3, /Aircon repair <small>\(approved\)<\/small><\/span><strong>\$850<\/strong>/);
  assert.match(s3, /Held &middot; \$100/);
  assert.match(s3, /Draft total<\/span><strong>\$850<\/strong>/);
  assert.match(c, /<p class="cj-label">CoolFix Aircon &middot; Fictional example<\/p>/);
  assert.match(c, /Fictional example of what I can build\./);
  assert.match(c, /<p class="cj-bridge"><strong>Not an aircon business\?<\/strong> Swap Carla for your own customer\./);
  assert.match(c, /href="contact\/#contact-form-area">Book a free process review<\/a>/);
  assert.doesNotMatch(c, /[Pp]lanned|awaiting its final verification/);
});

test('tools sit behind one fold; the live enquiry form and Monday report still open from it', async () => {
  const h = await read('../index.html');
  const c = carla(h);
  const fold = c.slice(c.indexOf('<details class="fold cj-more">'));
  assert.match(fold, /data-eq-open aria-haspopup="dialog">Try it: send your own test enquiry/);
  assert.match(fold, /data-rp-open aria-haspopup="dialog">Try it: see the full Monday report/);
  assert.doesNotMatch(h, /jobpaid-demo|data-story-go|data-jp-|data-cj-/);
});
