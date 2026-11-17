// Safety net round (Jeff + ChatGPT, 17 Nov 2026): hero subhead + strip, interactive tiles, the safety-net section
// with five safeguards and a scripted failure drill, step 3, the fifth handover deliverable and the FAQ.
// The message: "I don't just automate the work. I design what happens when the work doesn't go to plan."
// Guard rails: no promise that it fixes itself, catches everything, never stops, processes exactly once, or that
// nothing is ever lost; retry only where it's safe; examples are fictional.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FLOWS } from '../src/tiles.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const page = () => read('../index.html');
const between = (h, a, b) => h.slice(h.indexOf(a), h.indexOf(b, h.indexOf(a)));
const text = (h) => h.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('hero: headline kept, benefit first; one quiet strip linking to the checks section (no failure talk up front)', async () => {
  const h = await page();
  assert.match(h, /<h1 id="hero-title">Less manual work\. <span class="h1-accent">Smarter business operations\./);
  const fig = between(h, 'id="hero-flow"', '</figure>');
  assert.match(fig, /<strong>Checks and control are built into every workflow\.<\/strong> <a href="#safety">See how/);
  const top = text(between(h, '<section class="hero', '</figure>'));
  assert.doesNotMatch(top, /fails?\b|failure|goes wrong|breaks?\b|retry/i, 'the hero sells confidence; failure handling is shown further down, as proof');
});

test('checks section: calm heading, memorable line, five customer-benefit headings with an example each, short limits line', async () => {
  const h = await page();
  const s = between(h, 'id="safety"', '</section>');
  assert.match(s, /<h2 id="safety-h">Checks and control, built in\.<\/h2>/);
  assert.match(s, /Automation should make everyday work easier, not create another thing your team has to worry about\./);
  assert.match(s, /<p class="sn-quote">I don&rsquo;t just automate the work\. I design what happens when the work doesn&rsquo;t go to plan\.<\/p>/);
  assert.deepEqual([...s.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]),
    ['Information checked', 'Problems made visible', 'Results checked', 'People stay involved', 'Ready for handover']);
  assert.equal((s.match(/class="sn-eg"/g) || []).length, 5, 'one plain example each');
  assert.match(s, /<p class="sn-limits">The checks are agreed for each workflow, based on its risks and the tools it connects to\.<\/p>/);
  assert.ok(h.indexOf('id="approach"') < h.indexOf('id="safety"') && h.indexOf('id="safety"') < h.indexOf('id="built"'), 'after the approach band, before the demos');
});

test('failure drill: optional (closed by default), outside cause, checked before retrying, held, person told, ends on recovery', async () => {
  const h = await page();
  assert.match(h, /<details class="sn-more no-print">\s*<summary>See what happens when a step fails<\/summary>/, 'closed by default: visitors choose to open it');
  const d = between(h, 'id="sn-drill"', '</figure>');
  assert.match(d, /When an outside tool goes down: an example/);
  const rows = [...d.matchAll(/<li class="sn-row[^"]*">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
  assert.equal(rows.length, 6);
  assert.match(rows[1], /Google Sheets didn.{1,8}t respond/, 'the cause is an outside tool');
  assert.match(rows[2], /nothing was saved, so it.*safe to try once more/, 'retry only because it is safe');
  assert.match(rows[3], /held for review/);
  assert.match(rows[4], /Ana \(Operations\) is alerted/); assert.match(rows[4], /backup steps/);
  assert.match(rows[5], /Ana restarts the run\. The 4 requests are processed, checked and logged\./, 'a person restarts it; it ends on recovery');
  assert.match(d, /Fictional example\. The checks in a real project are agreed in the scope\./);
  const js = await read('../src/demo/drill.js');
  assert.match(js, /prefers-reduced-motion: reduce/); assert.match(js, /addEventListener\('toggle'/);
  assert.doesNotMatch(js, /IntersectionObserver/, 'no auto-play on scroll');
  assert.doesNotMatch(js, /\.style\.[a-z]+\s*=|setInterval|setAttribute\('style'/, 'CSP: classes only; no loop');
});

test('process, handover and FAQ carry the safety net without new promises', async () => {
  const h = await page();
  assert.match(h, /<li><h3>Build and test<\/h3><p>Implement the solution and test normal cases, exceptions and what happens when things go wrong\.<\/p><\/li>/);
  assert.match(h, /<li><strong>Safety net<\/strong>The safeguards configured for your workflow, operating and backup instructions, and a demonstration of the agreed failure tests\.<\/li>/);
  for (const k of ['A working solution', 'Project files and access', 'A practical guide and walkthrough', '30 days of defect fixes']) assert.ok(h.includes(`<li><strong>${k}</strong>`), `${k} kept`);
  const faq = between(h, '<summary>What happens if the automation breaks?</summary>', '</details>');
  assert.match(faq, /Alerts for failed runs are good practice, and I treat them as the minimum\./);
  assert.match(faq, /affected work can be held for review/);
  assert.match(faq, /ongoing monitoring and maintenance are available and quoted separately\./);
  assert.match(faq, /No automation can prevent every outside service failure, and it doesn&rsquo;t replace human responsibility\./, 'the full honest limit lives in the FAQ');
});

test('six tiles: wording unchanged, one example workflow each (four steps + one safeguard), no prices or claims', async () => {
  const h = await page();
  assert.match(h, /<p class="rr-tiles-hint" hidden>Tap a problem to see how it could work\.<\/p>/);
  assert.equal(FLOWS.length, 6);
  for (const f of FLOWS) { assert.equal(f.steps.length, 4); assert.ok(f.net.length > 20); }
  const all = FLOWS.flatMap((f) => [...f.steps, f.net]).join(' ');
  assert.doesNotMatch(all, /[$₱€£]\s?\d|\d+\s?%|save[sd]? \d|guarantee|never fails|always works/i);
  const js = await read('../src/tiles.js');
  assert.match(js, /'Built-in check: '/);
  assert.match(js, /aria-expanded/); assert.match(js, /Escape/);
});

test('no overpromising anywhere on the page or in the examples', async () => {
  const visible = text(await page());
  const tiles = FLOWS.flatMap((f) => [...f.steps, f.net]).join(' ');
  for (const t of [visible, tiles]) {
    assert.doesNotMatch(t, /fixes itself|self-healing|catches every|detects every|every problem is (caught|detected)|never stops|never fails|exactly once|nothing (is |ever )?(gets )?lost|zero errors|100% (reliable|uptime|accurate)|before any loss/i);
  }
  const priv = await read('../privacy/index.html');
  assert.match(priv, /Ana, the job sheet and the times are made up\. They run in your browser and don&rsquo;t send or save anything\./);
});
