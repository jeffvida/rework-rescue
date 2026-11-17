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

test('hero: headline kept, one quiet strip linking to the safety net (no technical list in the hero)', async () => {
  const h = await page();
  assert.match(h, /<h1 id="hero-title">Less manual work\. <span class="h1-accent">Smarter business operations\./);
  const fig = between(h, 'id="hero-flow"', '</figure>');
  assert.match(fig, /<strong>Every workflow has a safety net\.<\/strong> <a href="#safety">See what happens when something goes wrong/);
  assert.doesNotMatch(fig, /Check the information|Catch failed steps|retry/i, 'the methodology lives in the safety-net section, not the hero');
});

test('safety-net section: heading, memorable line, five safeguards in order, each with an example; limits note', async () => {
  const h = await page();
  const s = between(h, 'id="safety"', '</section>');
  assert.match(s, /<h2 id="safety-h">Automation needs a safety net\.<\/h2>/);
  assert.match(s, /<p class="sn-quote">I don&rsquo;t just automate the work\. I design what happens when the work doesn&rsquo;t go to plan\.<\/p>/);
  assert.deepEqual([...s.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]),
    ['Check the information', 'Catch failed steps', 'Check the results', 'Keep people informed and in control', 'Prepare for handover']);
  assert.equal((s.match(/class="sn-eg"/g) || []).length, 5, 'one plain example each');
  assert.match(s, /No automation can prevent every outside service failure or replace human responsibility\./);
  assert.ok(h.indexOf('id="approach"') < h.indexOf('id="safety"') && h.indexOf('id="safety"') < h.indexOf('id="built"'), 'after the approach band, before the demos');
});

test('failure drill: caught, checked before retrying, held, named person told what to do, restarted by a person, logged', async () => {
  const h = await page();
  const d = between(h, 'id="sn-drill"', '</figure>');
  const rows = [...d.matchAll(/<li class="sn-row[^"]*">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
  assert.equal(rows.length, 7);
  assert.match(rows[1], /didn.rsquo;t respond|didn’t respond|didn&rsquo;t respond/);
  assert.match(rows[2], /nothing was saved, so it.*safe to try once more/, 'retry only because it is safe');
  assert.match(rows[3], /held for review/);
  assert.match(rows[4], /Ana \(Operations\) is alerted/); assert.match(rows[4], /backup steps/);
  assert.match(rows[5], /Ana restarts the run/, 'a person restarts it; it does not fix itself');
  assert.match(rows[6], /Logged/);
  assert.match(d, /Fictional example\. The safeguards in a real project are agreed in the scope\./);
  const js = await read('../src/demo/drill.js');
  assert.match(js, /prefers-reduced-motion: reduce/); assert.match(js, /IntersectionObserver/);
  assert.doesNotMatch(js, /\.style\.[a-z]+\s*=|setInterval|setAttribute\('style'/, 'CSP: classes only; plays once, no loop');
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
});

test('six tiles: wording unchanged, one example workflow each (four steps + one safeguard), no prices or claims', async () => {
  const h = await page();
  assert.match(h, /<p class="rr-tiles-hint" hidden>Tap a problem to see how it could work\.<\/p>/);
  assert.equal(FLOWS.length, 6);
  for (const f of FLOWS) { assert.equal(f.steps.length, 4); assert.ok(f.net.length > 20); }
  const all = FLOWS.flatMap((f) => [...f.steps, f.net]).join(' ');
  assert.doesNotMatch(all, /[$₱€£]\s?\d|\d+\s?%|save[sd]? \d|guarantee|never fails|always works/i);
  const js = await read('../src/tiles.js');
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
