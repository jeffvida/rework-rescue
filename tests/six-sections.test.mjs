// 25 Nov 2026: the six-section page (Jeff + ChatGPT final structure and copy), built on preview/six-sections.
// Checks the structure, the copy that carries the problem → improvement → outcome story, the live tools,
// and the guard rails (no prices, no invented results, illustrative labels, one booking wording, CSP).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const page = () => read('../index.html');
const main = (h) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
const visible = (h) => h.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');

test('six sections in order, and the nav matches', async () => {
  const h = main(await page());
  const ids = [...h.matchAll(/<section class="[^"]*" (?:id="([^"]+)" )?aria-labelledby="([^"]+)"/g)].map((m) => m[1] || m[2]);
  assert.deepEqual(ids, ['hero-title', 'services', 'built-in', 'experience', 'how', 'safety', 'about', 'faq', 'start']);
  const nav = (await page()).match(/<ul class="nav-list">([\s\S]*?)<\/ul>/)[1];
  assert.deepEqual([...nav.matchAll(/<li><a href="(#[a-z]+)">([^<]+)<\/a><\/li>/g)].map((m) => `${m[1]} ${m[2]}`), ['#services How I help', '#how How it works', '#about About', '#faq FAQ']);
  for (const gone of ['id="sn-drill"', 'id="enquiry-demo"', 'id="report-demo"', 'class="rr-tiles"', 'Demos &amp; examples']) assert.ok(!h.includes(gone), gone);
});

test('hero (26 Nov v13): short copy, problems → AI & Automation → result, one booking button, trust strip moved to the final CTA', async () => {
  const h = await page();
  const hero = h.slice(h.indexOf('<section class="hero'), h.indexOf('</section>', h.indexOf('<section class="hero')));
  assert.match(hero, /AI &amp; AUTOMATION, BUILT ON 8\+ YEARS IN OPERATIONS/);
  assert.match(hero, /<span class="hf-l1">Less manual work\.<\/span> <span class="hf-l2"><span class="h5-mark">More time for your business\.<\/span><\/span>/);
  assert.match(hero, /I find where work gets stuck, then set up AI and automation with the right checks to keep things moving\./);
  assert.deepEqual([...hero.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]), ['contact/#contact-form-area', 'contact/#written-review'], 'booking button + written-review link only: the problem cards are not clickable');
  assert.match(hero, /Book a free process review/);
  assert.match(hero, /30 minutes &middot; No obligation/);
  for (const t of ['Enquiries left waiting', 'Reports built by hand', 'Details getting lost', 'Capture', 'Check', 'Organise', 'Built around your business rules', 'Work that keeps moving']) assert.ok(hero.includes(`${t}</`), t);
  assert.ok(hero.includes('h5-wave'), 'dotted wave background kept (Jeff, 26 Nov 12:49)');
  for (const gone of ['h5-panel', 'h5-chip', 'h5-trust']) assert.ok(!hero.includes(gone), gone);
  const cta = h.slice(h.indexOf('id="start"'), h.indexOf('</section>', h.indexOf('id="start"')));
  for (const t of ['Written scope and price before work begins.', 'You own what I build.', '30 days of fixes within the agreed scope.']) assert.ok(cta.includes(`<span>${t}</span>`), t);
});

test('How I help (26 Nov 14:23): three green cards — problem, what I improve, project name as the link', async () => {
  const h = await page();
  const sec = h.slice(h.indexOf('id="services"'), h.indexOf('id="built-in"'));
  assert.match(sec, /Where work gets stuck &mdash; and how I improve it\./);
  assert.match(sec, /Three working examples I&rsquo;ve built and tested end to end, so you can see how each solution works before we talk\./);
  assert.match(sec, /tested with sample data, not client projects\./);
  const tiles = [...h.matchAll(/<li class="v6-tile v6-tile-[a-z]+">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(tiles.length, 3);
  [['Enquiries left waiting', 'Enquiry Workflow'], ['Reports built by hand', 'Reporting Workflow'], ['Details getting lost', 'Job &amp; Invoice Workflow']].forEach(([prob, proj], i) => {
    const t = tiles[i];
    assert.ok(t.includes(`<h3 class="v6-tag">${prob}</h3>`) && t.includes(`<span>${proj}</span>`), prob);
    assert.ok(!t.includes('The project') && !t.includes('The outcome') && !t.includes('View project'), `card ${i + 1} trimmed labels`);
    const order = ['The problem', 'What I improve', proj].map((k) => t.indexOf(k));
    assert.ok(order.every((x, j) => x > 0 && (j === 0 || x > order[j - 1])), `card ${i + 1} order`);
    assert.match(t, /data-sp-open="(enquiry|report|invoice)" data-sp-group="sample" aria-haspopup="dialog">/);
  });
  assert.ok(!h.includes('id="projects"'), 'no separate Selected projects section');
});

test('Live demos (26 Nov 14:23): full section heading; invoice pop-up shows both workflow screenshots', async () => {
  const h = await page();
  const b = h.slice(h.indexOf('id="built-in"'), h.indexOf('id="experience"'));
  assert.match(b, /<p class="eyebrow">Live demos<\/p>\s*<h2 id="built-in-h">Built into this website<\/h2>/);
  const inv = h.slice(h.indexOf('id="sp-d-invoice"'), h.indexOf('</article>', h.indexOf('id="sp-d-invoice"')));
  assert.ok(inv.includes('assets/workflows/job-completion.webp') && inv.includes('assets/workflows/xero-draft.webp'));
});

test('pop-ups: labelled illustrative, problem first, and a booking CTA that closes the pop-up', async () => {
  const h = await page();
  for (const id of ['enquiry', 'report', 'invoice']) {
    const a = h.slice(h.indexOf(`id="sp-d-${id}"`), h.indexOf('</article>', h.indexOf(`id="sp-d-${id}"`)));
    assert.match(a, /<p class="sp-tag">Sample workflow/, id);
    assert.ok(a.indexOf('The problem') < a.indexOf('The improvement') && a.indexOf('The improvement') < a.indexOf('The result'), id);
    assert.match(a, /<p class="v6-foot">Illustrative/, id);
    assert.match(a, /href="contact\/#contact-form-area" data-sp-leave>Discuss a similar improvement</, id);
  }
});

test('Built into this website (26 Nov): compact, not numbered; links start with "Try it:" and open the booking page / chat', async () => {
  const h = await page();
  const s = h.slice(h.indexOf('id="built-in"'), h.indexOf('id="experience"'));
  assert.match(s, /Built into this website<\/h2>/);
  assert.match(s, /Two tools running on this site right now\. Try them for yourself\./);
  for (const t of ['Online booking', 'AI website assistant']) assert.ok(s.includes(`<h3>${t}</h3>`), t);
  assert.equal([...s.matchAll(/<p class="v6-live-dot">Live on this site<\/p>/g)].length, 2);
  assert.match(s, /Choose a time and book a meeting without the usual back-and-forth\./);
  assert.match(s, /Ask a question and see how the website assistant responds\./);
  assert.match(s, /href="contact\/#contact-form-area">Try it: booking system/);
  assert.match(s, /data-assistant-only hidden><button type="button" class="v6-sel-try" data-assistant-open>Try it: AI assistant/);
  for (const m of s.matchAll(/class="v6-sel-try"[^>]*>([^<]+)/g)) assert.match(m[1], /^Try it: /);
  assert.ok(!h.includes('class="v6-live"') && !h.includes('05 &middot; Live'), 'old 04/05 cards gone');
});

test('26 Nov 14:32: How it works has 4 steps; Reliability is its own section with 4 checks, the key line and the handover list', async () => {
  const h = await page();
  const how = h.slice(h.indexOf('id="how"'), h.indexOf('id="safety"'));
  assert.deepEqual([...how.matchAll(/<li><h3>([^<]+)<\/h3>/g)].map((m) => m[1]), ['Understand &amp; identify', 'Agree on the plan', 'Build &amp; test', 'Hand over']);
  const safe = h.slice(h.indexOf('id="safety"'), h.indexOf('id="about"'));
  assert.match(safe, /It doesn&rsquo;t just run\. It checks when something goes wrong\./);
  assert.match(safe, /If something goes wrong, the workflow catches it and tells the right person\./);
  assert.equal([...safe.matchAll(/<li class="v6-snode/g)].length, 4);
  assert.match(safe, /v6-snode-human"[\s\S]*?People stay in control/);
  assert.equal([...safe.slice(safe.indexOf('v6-handover')).matchAll(/<li><strong>/g)].length, 4);
  assert.ok(h.indexOf('id="how"') < h.indexOf('id="safety"') && h.indexOf('id="safety"') < h.indexOf('id="about"'));
  assert.doesNotMatch(visible(main(h)), /\bWe(&rsquo;|’|')ll\b|\bWe review\b/);
});

test('proof: previous-role results are labelled as not client work; details open in the pop-up', async () => {
  const h = await page();
  const s = h.slice(h.indexOf('id="experience"'), h.indexOf('id="how"'));
  assert.match(s, /not Rework Rescue client results/);
  assert.match(s, /data-sp-open="exp-meter" data-sp-group="exp"/);
  assert.ok(h.includes('id="sp-d-exp-meter"') && h.includes('id="sp-d-exp-report"'));
});

test('guard rails: no prices or testimonials, one booking wording, no inline styles', async () => {
  const h = await page();
  const v = visible(h);
  assert.doesNotMatch(v, /[$₱€£]\s?\d|per hour|testimonial|what (my )?clients say|100% accurate|all errors detected/i);
  assert.doesNotMatch(v, /(report|rework) review/i);
  for (const m of h.matchAll(/<a class="btn btn-primary[^"]*" href="contact\/#contact-form-area">([^<]+)<\/a>/g)) assert.ok(['Book a free process review', 'Discuss a similar improvement'].includes(m[1]), m[1]);
  assert.doesNotMatch(h, /\sstyle="/, 'CSP: no inline styles');
  assert.doesNotMatch(h, /<p[^>]*>[^<]*<p[\s>]/, 'no unclosed paragraph');
});

test('26 Nov: restored the bottom calendar, real workflow screenshots + tools lines, and the About lines', async () => {
  const h = await page();
  assert.ok(h.slice(h.indexOf('id="start"')).includes('id="book-inline"'));
  for (const [id, shot] of [['enquiry', 'enquiry-tracker'], ['report', 'weekly-report'], ['booking', 'booking-calendar'], ['chat', 'chat-assistant']]) {
    const a = h.slice(h.indexOf(`id="sp-d-${id}"`), h.indexOf('</article>', h.indexOf(`id="sp-d-${id}"`)));
    assert.ok(a.includes(`assets/workflows/${shot}.webp`) && a.includes('Tools used:'), id);
  }
  assert.match(h.slice(h.indexOf('id="sp-d-invoice"')), /Tools used:<\/strong> n8n/);
  const about = h.slice(h.indexOf('id="about"'), h.indexOf('id="faq"'));
  for (const t of ['Tools I work with', 'call times that fit', 'linkedin.com/in/jeffhersonvida']) assert.ok(about.includes(t), t);
});

test('26 Nov: experience pop-ups follow the sample layout (problem, what happened, example, what improved)', async () => {
  const h = await page();
  for (const id of ['exp-meter', 'exp-report']) {
    const a = h.slice(h.indexOf(`id="sp-d-${id}"`), h.indexOf('</article>', h.indexOf(`id="sp-d-${id}"`)));
    const order = ['The problem', 'What happened', 'synthetic data', 'What improved', 'Tools used'].map((k) => a.indexOf(k));
    assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), id);
    assert.ok(!a.includes('flow2') && !a.includes('<details'), id);
  }
});
