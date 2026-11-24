// 24 Nov 2026 (preview, simplified after Jeff: "customer reads too much and cannot follow, especially if their
// business is different"): one CoolFix customer, three steps, each with Before / After and one Try-it button.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_ITEMS } from '../src/report-demo.js';
import { CJ_FIGURES } from '../src/carla-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const carla = (h) => h.slice(h.indexOf('<div class="cj" id="carla"'), h.indexOf('<div class="built-group cj-others"'));
const screen = (c, i) => c.slice(c.indexOf(`data-cj-screen="${i}"`), i < 2 ? c.indexOf(`data-cj-screen="${i + 1}"`) : c.indexOf('data-cj-nav'));
const face = (s) => s.replace(/<details[\s\S]*?<\/details>/g, '').replace(/<div class="cj-outcome">[\s\S]*?<\/div>/, '');
const words = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).filter((w) => /\w/.test(w)).length;

test('three steps, one naming system, each with Before / After and one Try-it button', async () => {
  const c = carla(await read('../index.html'));
  assert.match(c, /<p class="cj-label">CoolFix Aircon &middot; Fictional example<\/p>/);
  assert.deepEqual([...c.matchAll(/<strong>(\w+)<\/strong><\/button>/g)].map((m) => m[1]), ['Enquiry', 'Job', 'Payment']);
  assert.deepEqual([...c.matchAll(/<h4 class="cj-h" id="cj-h\d">([^<]+)<\/h4>/g)].map((m) => m[1]),
    ['The enquiry is captured', 'The missing job is caught', 'The right invoice is prepared']);
  for (const i of [0, 1, 2]) {
    const s = face(screen(c, i));
    assert.match(s, /<dl class="cj-ba"><div><dt>Before<\/dt><dd>[^<]+<\/dd><\/div><div><dt>After<\/dt><dd>[^<]+<\/dd><\/div><\/dl>/, `step ${i + 1}`);
    assert.match(s, new RegExp(`data-cj-run="${i}">Try it: `), `step ${i + 1} button`);
    assert.match(s, /Carla/, `Carla in step ${i + 1}`);
    assert.doesNotMatch(s, /n8n|Gemini|Xero|Google Sheets|Gmail|workflow|E-1038/, `step ${i + 1}: no tool names or record codes`);
    assert.ok(words(s) <= 60, `step ${i + 1} stays short (${words(s)} words)`);
  }
  assert.match(c, /data-cj-nav hidden/, 'Back/Next and Try-it buttons only with JavaScript; without it every step and result shows');
});

test('a bridge for visitors whose business is different', async () => {
  const c = carla(await read('../index.html'));
  assert.match(c, /<p class="cj-bridge"><strong>Not an aircon business\?<\/strong> Swap Carla for your own customer\./);
});

test('facts match the test data: missing job → J-512; $850 approved, $100 held, $850 draft', async () => {
  const c = carla(await read('../index.html'));
  const e = RP_ITEMS.find((i) => i.ref === 'E-1038');
  assert.deepEqual([e.who, e.issue, e.tag], ['Carla Lim', 'Booked, no job', 'Office created J-512']);
  assert.match(face(screen(c, 1)), /Job J-512 created/);
  const s = face(screen(c, 2));
  assert.match(s, new RegExp(`Repair \\$${CJ_FIGURES.quote} \\(approved\\) &middot; Extra \\$${CJ_FIGURES.extra} \\(not approved yet\\)`));
  assert.match(s, new RegExp(`Invoice draft: \\$${CJ_FIGURES.draft}`));
  assert.equal(CJ_FIGURES.draft, CJ_FIGURES.quote, 'the extra is never on the draft');
  assert.match(screen(c, 2), /href="contact\/#contact-form-area">Book a free process review<\/a>/);
  assert.doesNotMatch(c, /[Pp]lanned|awaiting its final verification/, 'Jeff 24 Nov: no "planned" label');
});

test('tools and steps stay behind folds; the pop-ups lead back into Carla\'s story', async () => {
  const h = await read('../index.html');
  const c = carla(h);
  for (const i of [0, 1, 2]) assert.match(screen(c, i), /<details class="fold cj-more"><summary>How it&rsquo;s built<\/summary>/);
  assert.match(h, /data-cj-go="1">Next: the missing job is caught/);
  assert.match(h, /data-cj-go="2">Next: the right invoice/);
  assert.doesNotMatch(h, /jobpaid-demo|data-story-go|data-jp-/);
  assert.match(await read('../src/home.js'), /mountCarla\(document\.getElementById\('carla'\)\);/);
});
