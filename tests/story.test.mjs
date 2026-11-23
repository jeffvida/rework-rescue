// One CoolFix customer across three demos (23 Nov 2026, preview). Plan: project doc
// claude/project3-phase1-architecture-and-page.md, Parts F, G and I.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_ITEMS } from '../src/report-demo.js';
import { P3_SNAPSHOTS, P3_VERIFIED, STORY_OPENERS } from '../src/jobpaid-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const dialog = (h, id) => { const a = h.indexOf(`id="${id}"`); return h.slice(a, h.indexOf('</dialog>', a)); };
const money = (n) => '$' + n.toLocaleString('en-US');

test('step strip: three steps in order, each opens its own demo', async () => {
  const h = await read('../index.html');
  const strip = h.slice(h.indexOf('<ol class="story-strip">'), h.indexOf('</ol>', h.indexOf('<ol class="story-strip">')));
  const links = [...strip.matchAll(/<a href="#(demo-[a-z]+)" data-(eq|rp|jp)-open aria-haspopup="dialog">[\s\S]*?<strong>([^<]+)<\/strong>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(links, [['demo-enquiry', 'eq', 'Enquiry comes in:'], ['demo-report', 'rp', 'Monday check:'], ['demo-jobpaid', 'jp', 'Job done to paid:']]);
  for (const [anchor] of links) assert.match(h, new RegExp(`<li class="built-card[^"]*" id="${anchor}">`), anchor);
  assert.match(h, /<li class="built-card built-card-wide" id="demo-jobpaid">/, 'step 3 is the wide card');
  for (const [n, l] of [['1', 'Enquiry comes in'], ['2', 'Monday check'], ['3', 'Job done to paid']]) assert.match(h, new RegExp(`<p class="built-step"><span class="story-n" aria-hidden="true">${n}</span> ${l}</p>`));
});

test('"Next" links join the pop-ups in order and every target exists', async () => {
  const h = await read('../index.html');
  assert.match(dialog(h, 'enquiry-demo'), /data-story-go="report-demo">Next: what Monday&rsquo;s check found/);
  assert.match(dialog(h, 'report-demo'), /data-story-go="jobpaid-demo">Next: follow Carla&rsquo;s job to paid/);
  const jp = dialog(h, 'jobpaid-demo');
  assert.match(jp, /data-story-go="report-demo">Monday&rsquo;s check<\/button> caught Carla&rsquo;s booking with no job, so the office created job <span class="jp-nw">J-512<\/span>\. Here&rsquo;s what happened next\./);
  assert.match(jp, /data-story-go="enquiry-demo">Back to the start:/);
  assert.match(jp, /That&rsquo;s one customer, from first email to paid\./);
  for (const m of h.matchAll(/data-story-go="([a-z-]+)"/g)) {
    const sel = STORY_OPENERS[m[1]]; assert.ok(sel, m[1]);
    const [, anchor, attr] = sel.match(/^#([a-z-]+) \[([a-z-]+)\]$/);
    const at = h.indexOf(`id="${anchor}"`);
    const card = h.slice(at, Math.min(...[h.indexOf('<li class="built-card', at + 5), h.indexOf('</ul>\n        </div>', at)].filter((x) => x > 0)));
    assert.match(card, new RegExp(`${attr} aria-haspopup="dialog"`), `${m[1]} opener is in its card`);
    assert.ok(h.includes(`id="${m[1]}" aria-labelledby`), `${m[1]} dialog exists`);
  }
  assert.match(await read('../src/home.js'), /mountJobPaidDemo\(document\.getElementById\('jobpaid-demo'\)\);\s*mountStoryLinks\(\);/);
});

test('Carla Lim / E-1038 / J-512 are the same everywhere, and no staff name is a customer', async () => {
  const h = await read('../index.html');
  const e = RP_ITEMS.find((i) => i.ref === 'E-1038');
  assert.deepEqual([e.who, e.issue, e.todo, e.owner, e.tag], ['Carla Lim', 'Booked, no job', 'Create the job', 'Scheduling', 'Office created J-512']);
  assert.match(await read('../src/report-demo.js'), /i\.tag \? `<em class="rp-tag">/);
  const story = h.slice(h.indexOf('id="story-h"'), h.indexOf('class="rr-tools"'));
  for (const m of story.matchAll(/Carla [A-Z][a-z]+/g)) assert.equal(m[0], 'Carla Lim');
  assert.doesNotMatch(story, /\bJ-5(?!1[2-8]\b|0[0-9]\b)\d\d\b/, 'only the plan\'s job numbers');
  for (const staff of ['Leo', 'Sam', 'Rico']) assert.doesNotMatch(dialog(h, 'enquiry-demo'), new RegExp(`eq-c-name">${staff}\\b`), staff);
  assert.match(await read('../src/enquiry-demo.js'), /!tr\.hasAttribute\('data-keep'\)/, "Carla's row isn't pushed out by visitors' enquiries");
});

test('job-to-paid pop-up: snapshot figures match the plan, in the plan order', async () => {
  const d = dialog(await read('../index.html'), 'jobpaid-demo');
  const { S1, S2, S3 } = P3_SNAPSHOTS;
  assert.match(d, new RegExp(`<p class="jp-asat">As at ${S1.asAt}</p>\\s*<ul class="jp-figs">\\s*<li><strong>\\${money(S1.draft)}</strong> Invoice draft prepared</li>\\s*<li><strong>\\${money(S1.extraPending)}</strong> Extra awaiting confirmation</li>\\s*<li class="jp-fig-warn"><strong>\\${money(S1.overdue)}</strong> Overdue invoice</li>`));
  const scen = [...d.matchAll(/role="tab" id="jp-s\d"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(scen, ['Missing evidence', 'Unapproved extra', 'Not yet sent', 'Overdue payment']);
  const asAt = [...d.matchAll(/id="jp-sp\d"[\s\S]*?jp-asat">As at ([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(asAt, [S2.asAt, S1.asAt, S3.asAt, S3.asAt]);
  const tabs = [...d.matchAll(/role="tab" id="jp-t\d"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['Technician form', 'Invoice draft', 'Team&rsquo;s list', 'Payments']);
  assert.match(d, new RegExp(`As at ${S2.asAt}</span> ${S2.job} Needs evidence: ${S2.missing}\\.`));
  assert.match(d, /\$850\. The \$100 extra is left off until the customer confirms\./);
  assert.match(d, new RegExp(`As at ${S3.asAt}</span> ${S3.openItems} open items\\.`));
  assert.match(d, /J-512 paid \$850 \(test payment\) &middot; J-516 \$600 of \$1,200, due today &middot; J-517 \$380 due Tue 1 Dec &middot; INV-2200 \$420 overdue\./);
  assert.equal((d.match(/<li><b>/g) || []).length, 8, "Carla's timeline: 8 events");
  assert.match(d, /Shown with Xero\. QuickBooks is similar\./);
});

test('job-to-paid pop-up: wording rules from the plan', async () => {
  const h = await read('../index.html');
  const d = dialog(h, 'jobpaid-demo');
  const card = h.slice(h.indexOf('id="demo-jobpaid"'), h.indexOf('</li>\n', h.indexOf('id="demo-jobpaid"')));
  assert.doesNotMatch(d + card, /invoiced correctly|no missed jobs|payment received|how HVAC businesses work|creates (the )?jobs? for/i);
  assert.match(d, /Paid \(test payment\)/);
  assert.match(d, /In this demo the office creates jobs;/);
  assert.match(card, /<a href="#jobpaid-demo" data-jp-open aria-haspopup="dialog">Try it: follow Carla&rsquo;s job to paid/);
  assert.match(card, /<dt>What I build<\/dt><dd>Each completed job is checked and turned into a draft invoice in your accounting software, for approved work only\.<\/dd>/);
  const js = await read('../src/jobpaid-demo.js');
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|SITE\./, 'replay only: never calls n8n or Xero');
});

test('until the test run is verified, the pop-up says it is a preview and shows screenshot slots', async () => {
  const h = await read('../index.html');
  const todo = (h.match(/data-p3-todo="/g) || []).length;
  if (!P3_VERIFIED) {
    assert.match(dialog(h, 'jobpaid-demo'), /<p class="jp-todo" data-p3-todo="preview banner"><strong>Preview:<\/strong>/);
    assert.equal(todo, 7, 'banner, W1 screenshot, 4 tab screenshots, recording');
  } else {
    assert.equal(todo, 0, 'verified: every slot replaced with the real screenshot or recording');
  }
});
