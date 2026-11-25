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
  assert.deepEqual(ids, ['hero-title', 'services', 'experience', 'how', 'about', 'faq', 'start']);
  const nav = (await page()).match(/<ul class="nav-list">([\s\S]*?)<\/ul>/)[1];
  assert.deepEqual([...nav.matchAll(/<li><a href="(#[a-z]+)">([^<]+)<\/a><\/li>/g)].map((m) => `${m[1]} ${m[2]}`), ['#services How I help', '#how How it works', '#about About', '#faq FAQ']);
  for (const gone of ['id="sn-drill"', 'id="enquiry-demo"', 'id="report-demo"', 'class="rr-tiles"', 'id="book-inline"', 'Demos &amp; examples']) assert.ok(!h.includes(gone), gone);
});

test('hero: spec copy, one booking button, trust strip', async () => {
  const h = await page();
  const hero = h.slice(h.indexOf('<section class="hero'), h.indexOf('</section>', h.indexOf('<section class="hero')));
  assert.match(hero, /<span class="hf-l1">Less manual work\.<\/span> <span class="hf-l2"><span class="h5-mark">Smarter business operations\.<\/span><\/span>/);
  assert.match(hero, /I help small and medium-sized businesses find where work is being repeated, delayed or lost &mdash; then improve it/);
  assert.deepEqual([...hero.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]), ['contact/#contact-form-area']);
  assert.match(hero, /30 minutes &middot; No obligation/);
  for (const t of ['Written scope and price before work begins.', 'You own what I build.', '30 days of fixes within the agreed scope.']) assert.ok(hero.includes(`<span>${t}</span>`), t);
});

test('How I help: three tiles show problem, improvement and outcome without opening a pop-up', async () => {
  const h = await page();
  const tiles = [...h.matchAll(/<li class="v6-tile">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(tiles.length, 3);
  tiles.forEach((t, i) => {
    const order = ['Customer problem', 'What I improve', 'Outcome'].map((k) => t.indexOf(`<p class="v6-k">${k}</p>`));
    assert.ok(order.every((x, j) => x > 0 && (j === 0 || x > order[j - 1])), `tile ${i + 1} order`);
    assert.match(t, /data-sp-open="(enquiry|report|invoice)" data-sp-group="sample" aria-haspopup="dialog">See project example/);
  });
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

test('live tools: booking opens the existing pop-up, the assistant opens the existing chat; buttons start with "Try it:"', async () => {
  const h = await page();
  const live = h.slice(h.indexOf('class="v6-live"'), h.indexOf('class="v6-close"'));
  assert.match(live, /<a class="btn btn-secondary" href="contact\/#contact-form-area">Try it: the booking system/);
  assert.match(live, /data-assistant-only hidden><button type="button" class="btn btn-secondary" data-assistant-open>Try it: the AI assistant/);
  for (const m of live.matchAll(/class="btn[^"]*"[^>]*>([^<]+)/g)) assert.match(m[1], /^Try it: /);
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
