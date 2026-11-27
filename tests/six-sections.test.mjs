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
  assert.deepEqual(ids, ['hero-title', 'services', 'experience', 'how', 'safety', 'pricing', 'about', 'faq', 'start']);
  const nav = (await page()).match(/<ul class="nav-list">([\s\S]*?)<\/ul>/)[1];
  assert.deepEqual([...nav.matchAll(/<li><a href="(#[a-z]+)">([^<]+)<\/a><\/li>/g)].map((m) => `${m[1]} ${m[2]}`), ['#services Projects', '#how How it works', '#pricing Pricing', '#about About', '#faq FAQ']);
  for (const gone of ['id="sn-drill"', 'id="enquiry-demo"', 'id="report-demo"', 'class="rr-tiles"', 'Demos &amp; examples']) assert.ok(!h.includes(gone), gone);
});

test('hero (27 Nov evening): left copy kept (subhead ends "checks built in"); right side = "Your week": four everyday problems, each struck through and fixed', async () => {
  const h = await page();
  const hero = h.slice(h.indexOf('<section class="hero'), h.indexOf('</section>', h.indexOf('<section class="hero')));
  assert.match(hero, /AI &amp; AUTOMATION, BUILT ON 8\+ YEARS IN OPERATIONS/);
  assert.match(hero, /<span class="hf-l1">Less manual work\.<\/span> <span class="hf-l2"><span class="h5-mark">More time for your business\.<\/span><\/span>/);
  assert.match(hero, /I find where work gets stuck, then set up AI and automation with the right checks built in\./);
  assert.deepEqual([...hero.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]), ['contact/#contact-form-area', 'contact/#written-review'], 'booking button + written-review link only');
  assert.match(hero, /Book a free process review/);
  assert.match(hero, /30 minutes &middot; No obligation/);
  assert.match(hero, /<figure class="hos" id="hero-story">/);
  assert.match(hero, /<span class="hos-title">Your week<\/span><span class="hos-tag">Example<\/span>/);
  const rows = [...hero.matchAll(/<span class="hos-what">([^<]+)<\/span><span class="hos-st"><span class="hos-old"><span class="sr-only">Before: <\/span>([^<]+)<\/span><span class="hos-new"><span class="sr-only">After: <\/span><svg[^>]*>.*?<\/svg>([^<]+)<\/span>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(rows, [
    ['New customer enquiry', '2 days, no reply', 'Logged, reply drafted'],
    ['Customer details', 'Typed into 3 places', 'Entered once, synced'],
    ['Follow-up on a request', 'Nobody assigned', 'Owner set, reminder sent'],
    ['Weekly report', '3 hours by hand', 'Built and checked'],
  ]);
  assert.match(hero, /Set up and checked by me\. You approve anything important\./);
  for (const gone of ['rrh-', 'rri-', 'hcb-', 'Imagine your', 'invoice', 'Invoice']) assert.ok(!hero.includes(gone), gone);
  assert.ok(hero.includes('h5-wave'), 'dotted wave background kept (Jeff, 26 Nov 12:49)');
  const cta = h.slice(h.indexOf('id="start"'), h.indexOf('</section>', h.indexOf('id="start"')));
  assert.match(cta, /<h2 id="cta-h">Let&rsquo;s look at one process together\.<\/h2>/);
  for (const t of ['Written scope and price before work begins.', 'You own what I build.', '30 days of fixes within the agreed scope.']) assert.ok(cta.includes(`<span>${t}</span>`), t);
});

test('Projects (27 Nov, option B): one grid — three sample workflows + two live tools; no repeat of the hero problems', async () => {
  const h = await page();
  const sec = h.slice(h.indexOf('id="services"'), h.indexOf('id="experience"'));
  assert.match(sec, /<p class="eyebrow">Projects<\/p>\s*<h2 id="services-h">Projects I&rsquo;ve built and tested\.<\/h2>/);
  assert.match(sec, /tested with sample data, not client projects\./);
  const cards = [...sec.matchAll(/<li class="pj-card [^"]+">([\s\S]*?)<\/p>\s*<\/li>/g)].map((m) => m[1]);
  assert.equal(cards.length, 5);
  const names = cards.map((c) => c.match(/<h3 class="pj-h">([^<]+)<\/h3>/)[1]);
  assert.deepEqual(names, ['Enquiry tracker', 'Self-checking weekly report', 'Job-to-invoice check', 'Online booking', 'AI website assistant']);
  cards.slice(0, 3).forEach((c) => assert.match(c, /<p class="pj-tag">Sample workflow<\/p>/));
  cards.slice(3).forEach((c) => assert.match(c, /<p class="pj-tag pj-tag-live">Live on this site<\/p>/));
  ['enquiry', 'report', 'invoice', 'booking', 'chat'].forEach((id, i) => assert.ok(cards[i].includes(`data-sp-open="${id}" data-sp-group="project"`), id));
  cards.forEach((c) => assert.match(c, /<ul class="pj-tools" aria-label="Tools used">/));
  for (const m of sec.matchAll(/class="pj-try"[^>]*>([^<]+)/g)) assert.match(m[1], /^Try it: /);
  const grid = sec.slice(0, sec.indexOf('data-sp-details'));
  for (const p of ['Enquiries left waiting', 'Reports built by hand', 'Details getting lost', 'The problem', 'Where work gets stuck']) assert.ok(!grid.includes(p), `no hero repeat: ${p}`);
  assert.ok(!h.includes('id="built-in-h"'), 'separate Live demos section folded in');
  assert.ok(sec.includes('<span class="anchor" id="built-in"></span>'), 'old #built-in links still land here');
});

test('invoice pop-up shows both workflow screenshots', async () => {
  const h = await page();
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

test('26 Nov 14:32: How it works has 4 steps; Reliability is its own section with 4 checks, the key line and the handover list', async () => {
  const h = await page();
  const how = h.slice(h.indexOf('id="how"'), h.indexOf('id="safety"'));
  assert.deepEqual([...how.matchAll(/<li><h3>([^<]+)<\/h3>/g)].map((m) => m[1]), ['Understand &amp; identify', 'Agree on the plan', 'Build &amp; test', 'Hand over']);
  const safe = h.slice(h.indexOf('id="safety"'), h.indexOf('id="handover"'));
  assert.match(safe, /It doesn&rsquo;t just run\. It checks when something goes wrong\./);
  assert.match(safe, /If something goes wrong, the workflow catches it and tells the right person\./);
  assert.equal([...safe.matchAll(/<li class="v6-snode/g)].length, 4);
  assert.match(safe, /v6-snode-human"[\s\S]*?People stay in control/);
  const hand = h.slice(h.indexOf('id="handover"'), h.indexOf('id="pricing"'));
  assert.ok(h.indexOf('id="safety"') < h.indexOf('id="handover"') && h.indexOf('id="handover"') < h.indexOf('id="pricing"'), '27 Nov 09:33: handover sits inside Reliability');
  assert.equal([...hand.matchAll(/<li><strong>/g)].length, 3, '09:42: three handover points');
  assert.ok(!safe.includes('v6-handover'));
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
  // 27 Nov: the only prices allowed are the approved ones (starting price per currency, maintenance from AUD $250).
  assert.doesNotMatch(v.replace(/(USD \$500|AU\$750|USD \$165\/month)/g, ''), /[$₱€£]\s?\d|per hour|testimonial|what (my )?clients say|100% accurate|all errors detected/i);
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

test('27 Nov: Pricing after Handover with a USD | AUD toggle (USD default); FAQ covers cost, time and after-handover', async () => {
  const h = await page();
  const pr = h.slice(h.indexOf('id="pricing"'), h.indexOf('id="about"'));
  assert.match(pr, /Practical improvements, priced upfront\./);
  assert.match(pr, /Projects start from<\/p>\s*<p class="v6-price-amt"[^>]*><span data-price>USD \$500<\/span>/);
  assert.match(pr, /data-cur-toggle hidden>[\s\S]*?data-cur="USD" aria-pressed="true">USD<\/button><button type="button" data-cur="AUD" aria-pressed="false">AUD/);
  assert.ok(!/<select/.test(pr), 'no dropdown');
  ['Project pricing', 'Before work starts, you&rsquo;ll receive:', 'A clear scope of work.', 'Agreed deliverables.', 'A written price.', 'An expected timeframe.', 'Software and subscription costs', 'Support when you need it', 'Ongoing maintenance from <span class="nowrap" data-price="maint">USD $165/month</span>', 'Optional. Agreed separately based on your requirements.', 'No surprises. No commitment until you agree.'].forEach((t) => assert.ok(pr.includes(t), t));
  const faq = h.slice(h.indexOf('id="faq"'), h.indexOf('id="start"'));
  const qs = [...faq.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]);
  ['Who do you work with?', 'Can you work with larger businesses or teams?', 'Do you use AI for everything?', 'Will this replace anyone on my team?', 'Can you work with confidential or sensitive information?', 'How much does a project cost?', 'How long does a project take?', 'What happens after handover?', 'Are software subscriptions and API costs included?', 'Can I request support after the 30 days?'].forEach((q) => assert.ok(qs.includes(q), q));
  assert.match(faq, /Projects start from <span data-price>USD \$500<\/span>/);
  assert.match(faq, /1&ndash;3 weeks/);
  assert.match(faq, /<span data-price="maint">USD \$165\/month<\/span>/);
  assert.match(faq, /Solo operators, small teams/);
  assert.match(faq, /I won&rsquo;t actively monitor it after handover/);
  assert.ok(!/pilot|enterprise/i.test(faq), 'no pilot or enterprise offer');
});

test('27 Nov: currency toggle switches every [data-price] and remembers the choice', async () => {
  const { mountCurrency } = await import('../src/currency.js');
  const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  const prices = [{ textContent: 'USD $500', dataset: { price: '' } }, { textContent: 'USD $500', dataset: { price: '' } }, { textContent: 'USD $165/month', dataset: { price: 'maint' } }];
  const mk = (cur) => { const b = { dataset: { cur }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }; b.closest = () => b; return b; };
  const btns = [mk('USD'), mk('AUD')]; let handler;
  const toggle = { hidden: true, addEventListener: (t, f) => { handler = f; } };
  const doc = { querySelectorAll: (sel) => (sel === '[data-cur-toggle]' ? [toggle] : sel === '[data-price]' ? prices : btns) };
  mountCurrency(doc);
  assert.equal(toggle.hidden, false);
  assert.deepEqual(prices.map((p) => p.textContent), ['USD $500', 'USD $500', 'USD $165/month']);
  assert.equal(btns[0].attrs['aria-pressed'], 'true');
  handler({ target: btns[1] });
  assert.deepEqual(prices.map((p) => p.textContent), ['AUD $750', 'AUD $750', 'AUD $250/month']);
  assert.equal(btns[1].attrs['aria-pressed'], 'true');
  assert.equal(store['rr-currency'], 'AUD');
  delete globalThis.localStorage;
});
