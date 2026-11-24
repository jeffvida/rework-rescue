// 24 Nov 2026 (preview): one flagship CoolFix demo, "From customer enquiry to payment received."
// Jeff + ChatGPT direction (24 Nov): Carla in every stage, Enquiry → Job → Payment, success first,
// tools and fallbacks behind folds, outcome biggest. Data from project doc claude/project3-phase1-architecture-and-page.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_ITEMS } from '../src/report-demo.js';
import { CJ_FIGURES } from '../src/carla-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const carla = (h) => h.slice(h.indexOf('<div class="cj" id="carla"'), h.indexOf('<div class="built-group cj-others"'));
const screen = (c, i) => c.slice(c.indexOf(`data-cj-screen="${i}"`), i < 2 ? c.indexOf(`data-cj-screen="${i + 1}"`) : c.indexOf('data-cj-nav'));
const face = (s) => s.replace(/<details[\s\S]*?<\/details>/g, '');

test('copy above the demo, word for word, with a "Try it:" button', async () => {
  const h = await read('../index.html');
  assert.match(h, /<p class="built-lead">See how AI and automation help a service business capture enquiries, keep jobs on track and prepare accurate invoices &mdash; with checks and human approval along the way\.<\/p>/);
  assert.match(h, /<a class="btn btn-primary" href="#carla" data-cj-start>Try it: follow Carla from enquiry to paid <span aria-hidden="true">&darr;<\/span><\/a>/);
  assert.match(h, /<em>One fictional service business\. Three connected improvements\. One clearer way to work\.<\/em>/);
  assert.doesNotMatch(h, /<img[^>]+(technician|hvac|stock)/i, 'no photo (Jeff 24 Nov)');
});

test('three stages in order, one naming system, Carla in every stage', async () => {
  const c = carla(await read('../index.html'));
  assert.match(c, /<p class="cj-label">CoolFix Aircon &middot; Fictional example<\/p>\s*<h3 class="cj-meet-h" id="carla-h">Meet Carla<\/h3>/);
  const bar = [...c.matchAll(/data-cj-tab="(\d)"><span class="cj-n">(\d\d)<\/span> <strong>(\w+)<\/strong> <small>([^<]+)<\/small>/g)].map((m) => m.slice(1));
  assert.deepEqual(bar, [['0', '01', 'Enquiry', 'Capture and assign.'], ['1', '02', 'Job', 'Identify and check.'], ['2', '03', 'Payment', 'Invoice and track.']]);
  const heads = [...c.matchAll(/<p class="cj-k">(\d\d) &middot; (\w+)<\/p>\s*<h4 class="cj-h" id="cj-h\d">([^<]+)<\/h4>/g)].map((m) => m.slice(1));
  assert.deepEqual(heads, [['01', 'Enquiry', 'The enquiry is captured'], ['02', 'Job', 'The missing job is caught'], ['03', 'Payment', 'The correct invoice is prepared']]);
  for (const i of [0, 1, 2]) assert.match(face(screen(c, i)), /Carla/, `Carla in stage ${i + 1}`);
  for (const i of [0, 1, 2]) assert.match(screen(c, i), /<p class="cj-result"><strong>Result<\/strong>/, `result line ${i + 1}`);
  for (const m of c.matchAll(/Carla [A-Z][a-z]+/g)) assert.equal(m[0], 'Carla Lim');
  assert.match(c, /data-cj-nav hidden/, 'Back/Next only with JavaScript; without it all screens show');
});

test('the visitor text has no tool names; tools, steps and fallbacks sit behind folds', async () => {
  const c = carla(await read('../index.html'));
  for (const i of [0, 1, 2]) {
    const s = screen(c, i);
    assert.doesNotMatch(face(s), /n8n|Gemini|Xero|Google Sheets|Gmail|workflow/, `stage ${i + 1} face`);
    assert.match(s, /<details class="fold cj-more"><summary>How it&rsquo;s built<\/summary>/, `stage ${i + 1} fold`);
  }
});

test('the Monday check is what catches the missing job, and matches the weekly report data', async () => {
  const c = carla(await read('../index.html'));
  const e = RP_ITEMS.find((i) => i.ref === 'E-1038');
  assert.deepEqual([e.who, e.issue, e.todo, e.tag], ['Carla Lim', 'Booked, no job', 'Create the job', 'Office created J-512']);
  const s = face(screen(c, 1));
  assert.match(s, /<strong>E-1038 &middot; Carla Lim<\/strong><br>Booked, no job<\/span><span class="pill pill-amber">Create the job<\/span>/);
  assert.match(s, /<strong>Office created J-512<\/strong>/);
  assert.doesNotMatch(c, /\bJ-5(?!12\b)\d\d\b/, 'only Carla\'s job');
});

test('success first: the form starts complete; the missing photo is an optional second case', async () => {
  const c = carla(await read('../index.html'));
  const form = c.slice(c.indexOf('data-cj-form'), c.indexOf('</form>'));
  assert.match(form, /<p class="wt-photo is-added" data-cj-after>After <span>&#10003;<\/span><\/p>/);
  assert.doesNotMatch(form, /Try it: press Submit before/);
  assert.match(c, /data-cj-missing>What if the after photo is missing\?<\/button>/);
  const js = await read('../src/carla-demo.js');
  assert.match(js, /Add the after photo\. Repairs need before and after photos\./);
  assert.match(js, /if \(n === 1 && !sent\) \{ setPhoto\(true\); submit\(\); \}/, 'Next never leaves the visitor stuck');
});

test('figures: $850 approved, $100 held, $850 draft; the outcome block closes the story', async () => {
  const c = carla(await read('../index.html'));
  const money = (n) => '\\$' + n;
  const s = screen(c, 2);
  assert.match(s, new RegExp(`<span>Approved work</span><strong>${money(CJ_FIGURES.quote)}</strong>`));
  assert.match(s, new RegExp(`<span>Unapproved extra</span><strong>${money(CJ_FIGURES.extra)}</strong>`));
  assert.match(s, new RegExp(`<span>Invoice draft</span><strong>${money(CJ_FIGURES.draft)}</strong>`));
  assert.equal(CJ_FIGURES.draft, CJ_FIGURES.quote, 'the extra is never on the draft');
  for (const l of ['Enquiries don&rsquo;t get lost.', 'Missing jobs become visible.', 'Incorrect charges are held.', 'Invoice and payment status can be followed.']) assert.ok(s.includes(`<li>${l}</li>`), l);
  assert.match(s, /This is what better operations can look like\./);
  assert.match(s, /href="contact\/#contact-form-area">Book a free process review<\/a>/);
  assert.doesNotMatch(c, /[Pp]lanned|awaiting its final verification/, 'Jeff 24 Nov: no "planned" label');
});

test('the enquiry and weekly-report pop-ups lead back into Carla\'s story', async () => {
  const h = await read('../index.html');
  assert.match(h, /data-cj-go="1">Next: the missing job is caught/);
  assert.match(h, /data-cj-go="2">Next: the correct invoice/);
  assert.doesNotMatch(h, /jobpaid-demo|data-story-go|data-jp-/, 'the old job-to-paid pop-up is gone');
  assert.match(await read('../src/home.js'), /mountCarla\(document\.getElementById\('carla'\)\);/);
});
