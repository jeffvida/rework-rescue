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

test('hero: 24 Nov headline, benefit first, no failure talk up front; the checks link now sits with the step-by-step example', async () => {
  const h = await page();
  assert.match(h, /<h1 id="hero-title"><span class="hf-l1">Stop chasing details\.<\/span> <span class="hf-l2">Get work <span class="h5-mark">under control\.<\/span><\/span><\/h1>/, '24 Nov headline');
  const top = text(h.slice(h.indexOf('<section class="hero'), h.indexOf('</section>', h.indexOf('<section class="hero'))));
  assert.doesNotMatch(top, /fails?\b|failure|goes wrong|breaks?\b|retry/i, 'the hero sells confidence; failure handling is shown further down, as proof');
  assert.match(h, /<a href="#safety">See how the checks work/, '23 Nov: the Dana example (and its link) is gone; the FAQ still links to the checks');
});

test('checks section: calm heading, memorable line, five customer-benefit headings, no per-card examples (20 Nov), short limits line', async () => {
  const h = await page();
  const s = between(h, 'id="safety"', '</section>');
  assert.match(s, /<h2 id="safety-h">Checks and control, built in\.<\/h2>/);
  assert.match(s, /<p class="lede">Every workflow I build has checks, and tells the right person when something needs attention\.<\/p>/);
  assert.doesNotMatch(text(s), /repair|job request|job sheet/i, 'general business example, not repair-specific');
  assert.match(s, /<p class="sn-quote">I don&rsquo;t just automate the work\. I design what happens when the work doesn&rsquo;t go to plan\.<\/p>/);
  assert.deepEqual([...s.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]),
    ['Information checked', 'Failed steps caught', 'Results checked', 'People stay involved', 'Ready for handover']);
  assert.equal((s.match(/class="sn-eg"/g) || []).length, 0, 'per-card examples removed (20 Nov)');
  assert.match(s, /<p class="sn-limits">The checks are agreed for each workflow, based on its risks and the tools it connects to\.<\/p>/);
  assert.ok(h.indexOf('id="built"') < h.indexOf('id="safety"') && h.indexOf('id="safety"') < h.indexOf('id="how"'), '23 Nov: after the demos (proof first), before How it works');
});

test('failure drill: optional (closed by default), general example, pauses, person told, person recovers with a check', async () => {
  const h = await page();
  assert.match(h, /<details class="sn-more no-print">\s*<summary>See what happens when a step fails<\/summary>/, 'closed by default: visitors choose to open it');
  const d = between(h, 'id="sn-drill"', '</figure>');
  assert.match(d, /<p class="sn-drill-k">A practical example<\/p>/);
  assert.match(d, /When a connected tool is temporarily unavailable/);
  const rows = [...d.matchAll(/<li class="sn-row[^"]*">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
  assert.equal(rows.length, 4, 'four steps: short enough to scan');
  assert.match(rows[0], /Four new requests arrive in the shared inbox/);
  assert.match(rows[1], /so it pauses/); assert.match(rows[1], /original messages stay in the inbox/, 'nothing is deleted at the source');
  assert.match(rows[2], /responsible person is notified/); assert.match(rows[2], /agreed backup process/);
  assert.match(rows[3], /responsible person checks what.{1,8}s already recorded and processes the outstanding requests/, 'a person recovers it, checking first: no automatic recovery claimed');
  assert.match(rows[3], /completed entries are checked and recorded/);
  assert.match(d, /Fictional example\. The checks, backup process and recovery steps are agreed for each project\./);
  const js = await read('../src/demo/drill.js');
  assert.match(js, /prefers-reduced-motion: reduce/); assert.match(js, /addEventListener\('toggle'/);
  assert.doesNotMatch(js, /IntersectionObserver/, 'no auto-play on scroll');
  assert.doesNotMatch(js, /\.style\.[a-z]+\s*=|setInterval|setAttribute\('style'/, 'CSP: classes only; no loop');
});

test('process, handover and FAQ carry the safety net without new promises', async () => {
  const h = await page();
  assert.match(h, /<li><h3>Build and test<\/h3><p>Test the usual cases, unusual situations and what happens when something goes wrong\.<\/p><\/li>/);
  assert.match(h, /<strong>Error alerts and a fix guide<\/strong><span>The checks for your workflow, a status dashboard and log, email alerts, and a written guide with backup steps\. You and I walk through the agreed failure tests\.<\/span><\/li>/);
  for (const k of ['A working solution', 'Project files and access', 'A practical guide and walkthrough', '30 days of fixes']) assert.ok(h.includes(`<strong>${k}</strong>`), `${k} kept`);
  const faq = between(h, '<summary>What happens if something breaks or a connected app changes?</summary>', '</details>');
  assert.equal((h.match(/<summary>What happens if/g) || []).length, 1, 'one failure FAQ, not two');
  assert.match(faq, /I test the agreed ways it could fail with you before handover\./);
  assert.match(faq, /Outside services can still fail, and changes after handover are quoted separately\./, 'honest about outside providers (shortened 20 Nov)');
  assert.doesNotMatch(text(faq), /API|token|rate limit|error code/i, 'no technical jargon');
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
  assert.match(priv, /The requests, people and times in them are made up\. They run in your browser and don&rsquo;t send or save anything\./);
});
