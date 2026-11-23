// One CoolFix customer across three demos (23 Nov 2026, preview). Plan: project doc
// claude/project3-phase1-architecture-and-page.md, Parts F, G and I.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_ITEMS } from '../src/report-demo.js';
import { P3_FIGURES, P3_VERIFIED, STORY_OPENERS, sum } from '../src/jobpaid-demo.js';

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
  assert.match(jp, /data-story-go="enquiry-demo">Back to the start: the enquiry/);
  assert.match(jp, /That&rsquo;s one job, from completion to payment\./, 'ChatGPT 23 Nov: ③ starts at completion, so it ends at payment');
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

test('walk-through: 5 steps in order, each with who acts and the agreed heading', async () => {
  const d = dialog(await read('../index.html'), 'jobpaid-demo');
  assert.match(d, /<p class="story-problem">Jobs get finished\. But invoices get delayed, amounts go wrong, and some work never gets billed\.<\/p>/);
  assert.match(d, /<p class="story-promise">When a job is completed, the invoice is prepared automatically\. Your office checks it before sending\.<\/p>/);
  const heads = [...d.matchAll(/<p class="wt-k">Step (\d) of 5 &middot; (\w+)[^<]*<\/p>\s*<h4 class="wt-h" id="wt-h\d">([^<]+)<\/h4>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(heads, [
    ['1', 'Technician', 'The job is done. The details are captured.'],
    ['2', 'Automation', 'The invoice is ready. Not sent.'],
    ['3', 'Office', 'One follow-up. No more guessing.'],
    ['4', 'Payment', 'Payments are tracked. Outstanding invoices stay visible.'],
    ['5', 'Owner', 'Start Monday knowing what needs attention.'],
  ]);
  assert.match(d, /data-wt-nav hidden/, 'Back/Next appear only with JavaScript; without it all steps show in order');
  assert.doesNotMatch(d, /n8n|workflow|API|\bAI\b/, 'no tool names or AI in the visitor text');
  assert.doesNotMatch(d, /No photo, no invoice/, 'photo rule not stated as universal');
  assert.doesNotMatch(d, /invoiced correctly|no missed jobs|payment received|how HVAC businesses work|creates (the )?jobs? for/i, 'plan wording rules');
  assert.match(d, /test payment/);
  assert.match(d, /In this demo the office creates jobs;/);
});

test('walk-through: sign-off and extra approval are separate; the call is fully recorded', async () => {
  const d = dialog(await read('../index.html'), 'jobpaid-demo');
  const form = d.slice(d.indexOf('data-wt-form'), d.indexOf('</form>'));
  assert.match(form, /name="signoff" checked> Carla confirms the work is completed/);
  assert.match(form, /<legend>Extra: replaced capacitor &middot; \$100\. Did Carla approve it\?<\/legend>/);
  assert.match(form, /value="not-yet" checked/);
  const rec = d.slice(d.indexOf('data-wt-rec hidden'), d.indexOf('</dl>', d.indexOf('data-wt-rec hidden')));
  for (const [k, v] of [['Contacted', 'Carla Lim'], ['Called by', 'Manager'], ['When', 'Wed 25 Nov, 9:30am'], ['Amount', '\\$100'], ['Outcome', 'Declined']]) assert.match(rec, new RegExp(`<dt>${k}</dt><dd>${v}</dd>`), k);
  const js = await read('../src/jobpaid-demo.js');
  assert.match(js, /Add the after photo\. Repairs need before and after photos\./);
  assert.match(js, /path === 'signed' \? '\$950' : '\$850'/);
});

test('walk-through figures reconcile: step 4 rows add up to step 5, and both match the plan', async () => {
  const d = dialog(await read('../index.html'), 'jobpaid-demo');
  const f = P3_FIGURES;
  const money = (n) => '$' + n.toLocaleString('en-US');
  const pay = d.slice(d.indexOf('wt-pay'), d.indexOf('</table>', d.indexOf('wt-pay')));
  const due = [...pay.matchAll(/<tr>(?:<td>[^]*?<\/td>){2}<td>\$([\d,]+)<\/td><\/tr>/g)].map((m) => Number(m[1].replace(',', '')));
  assert.deepEqual(due, f.waiting.map(([, n]) => n), 'step 4 rows');
  assert.match(pay, new RegExp(`Waiting to be paid</th><td><strong>\\${money(sum(f.waiting))}</strong>`));
  assert.equal(sum(f.waiting), 1400);
  const rep = d.slice(d.indexOf('<ul class="wt-rep">'), d.indexOf('</ul>', d.indexOf('<ul class="wt-rep">')));
  assert.match(rep, new RegExp(`Jobs still unfinished</span><strong>${f.unfinished.length} &middot; \\${money(sum(f.unfinished))}</strong>`));
  assert.match(rep, new RegExp(`Completed, not invoiced</span><strong>${f.notSent.length} &middot; \\${money(sum(f.notSent))}</strong>`));
  assert.match(rep, new RegExp(`Waiting to be paid</span><strong>\\${money(sum(f.waiting))}</strong>`));
  assert.match(rep, new RegExp(`of which overdue</span><strong>\\${money(f.overdue)}</strong>`));
  assert.ok(f.waiting.some(([r, n]) => r === 'INV-2200' && n === f.overdue), 'overdue is part of waiting, not added on top');
  assert.equal(sum(f.unfinished), 1430);
  assert.match(d, /Aircon repair \(approved quote\)<\/span><span>\$850<\/span>/);
});

test('until the test run is verified, the pop-up says it is a preview and shows screenshot slots', async () => {
  const h = await read('../index.html');
  const todo = (h.match(/data-p3-todo="/g) || []).length;
  if (!P3_VERIFIED) {
    assert.match(dialog(h, 'jobpaid-demo'), /<span class="jp-todo" data-p3-todo="preview banner">Planned figures from the test plan<\/span>/);
    assert.equal(todo, 1, 'planned-figures tag (the W1 screenshot is added with the real run)');
  } else {
    assert.equal(todo, 0, 'verified: every slot replaced with the real screenshot or recording');
  }
});

test('the three pop-ups share one opening, one set of names and one ending', async () => {
  const h = await read('../index.html');
  for (const id of ['enquiry-demo', 'report-demo', 'jobpaid-demo']) {
    const d = dialog(h, id);
    assert.match(d, /<p class="jp-label">CoolFix Aircon &middot; Fictional business &middot; /, `${id}: label`);
    assert.match(d, /<div class="story-intro">\s*<p class="story-problem">[^<]+<\/p>\s*<p class="story-promise">[^<]+<\/p>\s*<p class="story-carla"><strong>Carla&rsquo;s story:<\/strong>/, `${id}: problem, promise, Carla`);
    assert.match(d, /href="contact\/#contact-form-area"[^>]*>Book a free process review<\/a>/, `${id}: booking link`);
    assert.doesNotMatch(d, /made-up business|office&rsquo;s list|Monday email|\bn8n\b/, `${id}: one set of names, no tool names`);
  }
  const eq = dialog(h, 'enquiry-demo'); const rp = dialog(h, 'report-demo');
  assert.ok(eq.indexOf('data-story-go="report-demo"') < eq.indexOf('<details class="fold eq-real">'), '① Next comes before the fold');
  assert.ok(rp.indexOf('data-story-go="jobpaid-demo"') < rp.indexOf('<details class="fold eq-real">'), '② Next comes before the fold');
  assert.match(rp, /<span class="rp-found-story">1 booking with no job \(Carla\)<\/span>/);
  assert.match(eq, /Google Gemini/, "① keeps the privacy line naming Gemini");
});
