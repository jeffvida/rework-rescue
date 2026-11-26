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
  assert.deepEqual(ids, ['hero-title', 'services', 'built-in', 'experience', 'how', 'about', 'faq', 'start']);
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
  assert.deepEqual([...hero.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]), ['contact/#contact-form-area'], 'one action only: the problem cards are not clickable');
  assert.match(hero, /Book a free process review/);
  assert.match(hero, /30 minutes &middot; No obligation/);
  for (const t of ['Enquiries left waiting', 'Reports built by hand', 'Details getting lost', 'Capture', 'Check', 'Organise', 'Built around your business rules', 'Work that keeps moving']) assert.ok(hero.includes(`${t}</`), t);
  assert.ok(hero.includes('h5-wave'), 'dotted wave background kept (Jeff, 26 Nov 12:49)');
  for (const gone of ['h5-panel', 'h5-chip', 'h5-trust']) assert.ok(!hero.includes(gone), gone);
  const cta = h.slice(h.indexOf('id="start"'), h.indexOf('</section>', h.indexOf('id="start"')));
  for (const t of ['Written scope and price before work begins.', 'You own what I build.', '30 days of fixes within the agreed scope.']) assert.ok(cta.includes(`<span>${t}</span>`), t);
});

test('How I help (26 Nov 13:34): one section, three cards — problem, solution, project, outcome, "View project"', async () => {
  const h = await page();
  const sec = h.slice(h.indexOf('id="services"'), h.indexOf('id="built-in"'));
  assert.match(sec, /Where work gets stuck &mdash; and how I improve it\./);
  assert.match(sec, /Independent projects demonstrating practical solutions to common operational problems\./);
  assert.match(sec, /Not client work\./);
  const tiles = [...h.matchAll(/<li class="v6-tile v6-tile-[a-z]+">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(tiles.length, 3);
  [['Enquiries left waiting', 'Enquiry Management Workflow'], ['Reports built by hand', 'Reporting &amp; Data Workflow'], ['Details getting lost', 'Job &amp; Invoice Workflow']].forEach(([prob, proj], i) => {
    const t = tiles[i];
    assert.ok(t.includes(`<h3 class="v6-tag">${prob}</h3>`) && t.includes(`<p>${proj}</p>`), prob);
    const order = ['The problem', 'The solution', 'The project', 'The outcome', 'View project'].map((k) => t.indexOf(k));
    assert.ok(order.every((x, j) => x > 0 && (j === 0 || x > order[j - 1])), `card ${i + 1} order`);
    assert.match(t, /data-sp-open="(enquiry|report|invoice)" data-sp-group="sample" aria-haspopup="dialog">/);
  });
  assert.ok(!h.includes('id="projects"'), 'no separate Selected projects section');
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
  assert.match(s, /This website also demonstrates how I put these tools into practice\./);
  for (const t of ['Online booking', 'AI website assistant']) assert.ok(s.includes(`<h3>${t}</h3>`), t);
  assert.match(s, /href="contact\/#contact-form-area">Try it: booking system/);
  assert.match(s, /data-assistant-only hidden><button type="button" class="v6-sel-try" data-assistant-open>Try it: AI assistant/);
  for (const m of s.matchAll(/class="v6-sel-try"[^>]*>([^<]+)/g)) assert.match(m[1], /^Try it: /);
  assert.ok(!h.includes('class="v6-live"') && !h.includes('05 &middot; Live'), 'old 04/05 cards gone');
});

test('26 Nov: compact safeguards keep all five and the human step; no company "we" lines left', async () => {
  const h = await page();
  const safe = h.slice(h.indexOf('id="safety"'), h.indexOf('class="v6-handover"'));
  assert.equal([...safe.matchAll(/<li class="v6-schip/g)].length, 5);
  assert.match(safe, /v6-schip-human"><span class="v6-schip-n" aria-hidden="true">3<\/span>Human approval where needed/);
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
