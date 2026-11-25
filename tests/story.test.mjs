// 25 Nov 2026 (preview): ChatGPT's recommendation applied to the sample projects (Jeff: "apply chat gpt
// recommendation to all"). Tiles lead with the business problem, a short solution and a visible outcome;
// sample projects and live website features are separate groups; hover is only a visual cue; the pop-up
// runs business problem → improved process → result → workflow → checks and human involvement.
// Rules: fictional data labelled; never presented as client work; no invented results; only built features.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_FIGURES } from '../src/report-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const sec = (h) => h.slice(h.indexOf('<div class="sp-rail" id="sample-projects"'), h.indexOf('</dialog>', h.indexOf('id="sp-dialog"')) + 9);
const detail = (s, id) => s.slice(s.indexOf(`id="sp-d-${id}"`), s.indexOf('</article>', s.indexOf(`id="sp-d-${id}"`)));
const tile = (s, id) => s.slice(s.indexOf(`data-sp-open="${id}"`), s.indexOf('</a>', s.indexOf(`data-sp-open="${id}"`)));
const SAMPLES = [['enquiry', 'Enquiry tracker', 'Enquiries get missed or forgotten.', 'Every enquiry has an owner'],
  ['report', 'Morning operations check', 'Completed work goes unbilled.', 'Problems surfaced earlier'],
  ['invoice', 'Job-to-invoice checks', 'Invoices contain unapproved extras.', 'Only approved work proceeds']];

test('header and two groups: sample projects, then live website features', async () => {
  const h = await read('../index.html');
  assert.match(h, /<h2 id="built-h">Common business problems\. Practical improvements\.<\/h2>\s*<p class="built-intro">See how I use AI, automation and reporting to make everyday operations easier\.<\/p>/);
  const s = sec(h);
  assert.ok(s.indexOf('Sample projects <span>&mdash; See how I improve business operations</span>') < s.indexOf('Live website features <span>&mdash; Try the experience</span>'));
  assert.deepEqual([...s.matchAll(/data-sp-open="(\w+)" data-sp-group="(\w+)"/g)].map((m) => m[1] + ':' + m[2]),
    ['enquiry:sample', 'report:sample', 'invoice:sample', 'booking:live', 'chat:live']);
});

test('tiles lead with the problem, a short solution and a visible outcome; no hover-only content', async () => {
  const s = sec(await read('../index.html'));
  for (const [id, name, problem, outcome] of SAMPLES) {
    const t = tile(s, id);
    assert.match(t, new RegExp(`<span class="sp-tile-tag">${name}</span>\\s*<span class="sp-tile-h">${problem.replace('.', '\\.')}</span>`), id);
    assert.match(t, new RegExp(`<span class="sp-out">&#10003; ${outcome}</span>`), id);
    assert.match(t, /<span class="sp-tile-go">Explore example/, id);
  }
  for (const id of ['booking', 'chat']) assert.match(tile(s, id), /<span class="sp-out sp-out-live">Live on this site<\/span>/);
  assert.doesNotMatch(s, /sp-hover/, 'hover adds a cue, never essential information');
  assert.match(await read('../assets/styles.css'), /\.sp-tile:hover \.sp-tile-go span, \.sp-tile:focus-visible \.sp-tile-go span \{ transform: translateX\(5px\); \}/);
});

test('pop-up order: problem → improved process → result → workflow → checks; tools behind a fold', async () => {
  const s = sec(await read('../index.html'));
  for (const id of ['enquiry', 'report', 'invoice', 'booking', 'chat']) {
    const d = detail(s, id);
    const order = ['The business problem', 'What the improved process does', 'The result', 'See the workflow', 'Checks and human involvement'].map((x) => d.indexOf(`<h4 class="sp-sub">${x}</h4>`));
    assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), `${id}: ${order}`);
    assert.match(d, /<details class="fold cj-more"><summary>How it&rsquo;s built<\/summary>\s*<p class="sp-tools"><strong>Tools used:<\/strong>/, id);
    assert.doesNotMatch(d.slice(0, d.indexOf('<details')), /n8n|Gemini|Xero|Google Sheets|Gmail|client (work|project)|\d+%|hours saved/i, `${id}: plain words before the fold`);
  }
  for (const [id] of SAMPLES) assert.match(detail(s, id), /<p class="sp-label">Fictional example data<\/p>/);
  assert.match(detail(s, 'enquiry'), /<h3 class="sp-detail-h" id="sp-h-enquiry">Never lose track of an enquiry\.<\/h3>/);
  const js = await read('../src/sample-rail.js');
  assert.match(js, /x\.dataset\.spGroup === t\.dataset\.spGroup/, 'Next/Previous stay within the group');
  assert.match(js, /details\.append\(body\.firstElementChild\)/);
});

test('figures match the demos; only built features', async () => {
  const s = sec(await read('../index.html'));
  const m = (n) => '\\$' + n.toLocaleString('en-US');
  assert.match(tile(s, 'report'), new RegExp(`Work done, not invoiced</span><strong>${m(RP_FIGURES.notInvoiced)}</strong>`));
  assert.match(detail(s, 'invoice'), /Invoice total<\/span><strong>\$850<\/strong>/);
  assert.doesNotMatch(s, /AI draft reply|Needs info/);
  assert.match(detail(s, 'enquiry'), /data-eq-open aria-haspopup="dialog">Try it: send your own test enquiry/);
  assert.match(detail(s, 'report'), /data-rp-open aria-haspopup="dialog">Try it: see the full Monday report/);
});
