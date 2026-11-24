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

test('four static steps: heading, Before / After / What improved, and a picture', async () => {
  const c = carla(await read('../index.html'));
  const s = steps(c);
  assert.equal(s.length, 4);
  assert.deepEqual(s.map((x) => x.match(/<h4 class="cs3-h">([^<]+)<\/h4>/)[1]), ['The enquiry is captured', 'The missing job is caught', 'Carla is billed correctly, then pays', 'The owner sees the whole week']);
  for (const [i, x] of s.entries()) {
    assert.match(x, /Carla/, `Carla in step ${i + 1}`);
    assert.match(x, /<dt>Before<\/dt>[\s\S]*<dt>After<\/dt>[\s\S]*<dt>What improved<\/dt>/, `step ${i + 1}`);
    assert.match(x, /<figure class="cs3-pic" aria-label="Picture: [^"]+">/, `step ${i + 1} picture`);
    assert.doesNotMatch(x, /<img/, 'drawn pictures, no photos');
    assert.doesNotMatch(x, /n8n|Gemini|Xero|Google Sheets|Gmail|workflow|E-1038|<button/, `step ${i + 1}: no tools, codes or buttons`);
    assert.ok(words(x) <= 80, `step ${i + 1} stays short (${words(x)} words)`);
  }
  assert.doesNotMatch(await read('../src/home.js'), /mountCarla/, 'no script');
});

test('step 1: no date or time → Needs info, AI draft reply the office approves', async () => {
  const s1 = steps(carla(await read('../index.html')))[0];
  assert.match(s1, /gives no date or time/);
  assert.match(s1, /flagged &ldquo;Needs info&rdquo;\. AI drafts a reply asking for her preferred date and time\. The office checks it and sends it\./);
  assert.match(s1, /<p class="pic-k">AI draft reply &middot; waiting for approval<\/p>/);
  assert.match(s1, /Carla is asked for a time the same day, so her booking goes ahead instead of sitting in the inbox\./);
});

test('facts match the test data, the section is labelled fictional, and there is a bridge', async () => {
  const c = carla(await read('../index.html'));
  const e = RP_ITEMS.find((i) => i.ref === 'E-1038');
  assert.deepEqual([e.who, e.issue, e.tag], ['Carla Lim', 'Booked, no job', 'Office created J-512']);
  const [, s2, s3, s4] = steps(c);
  assert.match(s2, /<small>Booked, no job<\/small>/); assert.match(s2, /Job J-512 created/);
  assert.match(s3, /Aircon repair <small>\(approved\)<\/small><\/span><strong>\$850<\/strong>/);
  assert.match(s3, /Extra: capacitor \$100<\/span><span class="pill pill-amber">Left off &middot; waiting for Carla&rsquo;s OK/);
  assert.match(s3, /Invoice total<\/span><strong>\$850<\/strong>/);
  assert.match(s3, /<li>Prepared<\/li><li>Sent by office<\/li><li class="is-paid">Paid &#10003;<\/li>/, 'payment shown as a clear sequence');
  // step 4 figures = the Mon 30 Nov answer key (project3 plan, snapshot S3)
  assert.match(s4, /Work done, not invoiced<\/span><strong>\$560<\/strong>/);
  assert.match(s4, /Payments overdue<\/span><span class="pill pill-amber">\$420<\/span>/);
  assert.match(s4, /Jobs still open<\/span><strong>3<\/strong>/);
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
  assert.match(steps(c)[3], /data-rp-open aria-haspopup="dialog">Try it: see the full Monday report/);
  assert.doesNotMatch(h, /jobpaid-demo|data-story-go|data-jp-|data-cj-/);
});
