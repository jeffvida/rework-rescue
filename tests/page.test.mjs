// The homepage after the 15 Nov 2026 rework (Jeff + ChatGPT decisions, built on preview/final-page):
// proof-first hero, five-step flow, What I automate, Automation with checks built in, proof (own builds, tools,
// previous-role results), How it works, About, FAQ, Book. Copy from Jeff and ChatGPT is checked word for word.
// The guard rails from the earlier rounds stay: no prices, testimonials or invented results; first person; one
// button wording; booking hours match the calendar; the build cards match the n8n workflows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const page = () => read('../index.html');
const section = (html, id, next) => html.slice(html.indexOf(`id="${id}"`), next ? html.indexOf(`id="${next}"`) : undefined);
const visibleText = (h) => h.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');

test('hero: Jeff and ChatGPT copy word for word, two buttons, proof line, no framework', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('<figure'));
  assert.match(hero, /<p class="eyebrow hero-pill">For business owners and operations teams<\/p>/);
  assert.match(hero, /<h1 id="hero-title">Less manual work\. <span class="h1-accent">Smarter business operations\./);
  assert.match(hero, /<p class="hero-sub">I set up AI and automation that read your emails and forms, update your records, chase follow-ups and prepare weekly reports &mdash; with checks before anyone relies on the results\.<\/p>/);
  assert.match(hero, /href="contact\/#contact-form-area">[\s\S]*?Book a free review<\/a>/);
  assert.match(hero, /<a class="btn btn-large hv-explore" href="#built">Try a live automation/);
  assert.ok(hero.indexOf('Book a free review') < hero.indexOf('Try a live automation'));
  assert.match(hero, /The booking and chat on this page run on automations I built\. <a href="#built">Try them\.<\/a>/);
  assert.doesNotMatch(hero, /hv-chips|hv-written|cred-strip/, 'hero kept to the approved elements');
  assert.doesNotMatch(html, /\bCapture\b|>Move<|>See<|Capture \/ Move|Fix the (tools|steps|numbers)/, 'no Capture / Move / See framework anywhere');
});

test('hero flow: five steps, ends on a person approving, labelled fictional; plays once, Skip/Replay, CSP-safe', async () => {
  const html = await page();
  const fig = html.slice(html.indexOf('id="hero-flow"'), html.indexOf('</figure>', html.indexOf('id="hero-flow"')));
  assert.deepEqual([...fig.matchAll(/<span class="rf-n" aria-hidden="true">\d<\/span>([^<]+)<\/p>/g)].map((m) => m[1]),
    ['Request arrives', 'AI extracts the details', 'Record updated', 'Missing information flagged', 'A person reviews and approves']);
  assert.match(fig, /<li class="is-missing"><small>Phone<\/small>Missing<\/li>/, 'the missing detail is visible, not just a warning sign');
  assert.match(fig, /No phone number &mdash; needed to arrange the repair/);
  assert.match(fig, /Approved by a person/);
  assert.match(fig, /<figcaption class="rf-cap" id="rf-cap">Fictional sample business\. Illustration only\./);
  // The HTML is the final frame: the "before" states are hidden from screen readers and from no-JS visitors.
  for (const m of fig.matchAll(/<span class="rf-pre[^"]*"([^>]*)>/g)) assert.match(m[1], /aria-hidden="true"/);
  const c = await read('../assets/styles.css');
  assert.match(c, /\.rf-pre \{ display: none !important; \}/);
  assert.match(c, /@media \(prefers-reduced-motion: reduce\) \{ \.rf-step, \.rf-card \{ transition: none; \} \}/);
  const js = await read('../src/demo/flow.js');
  assert.match(js, /prefers-reduced-motion: reduce/); assert.match(js, /IntersectionObserver/); assert.match(js, /'Replay'/); assert.match(js, /'Skip'/);
  assert.doesNotMatch(js, /\.style\.[a-z]+\s*=|setInterval/, 'CSP: classes only; plays once, no loop');
  const { STEP_MS, APPROVE_MS, STEPS } = await import('../src/demo/flow.js');
  const total = 250 + (STEPS - 1) * STEP_MS + APPROVE_MS + 900;
  assert.ok(total <= 9000, `about 8 seconds (${total} ms)`);
});

test('hero: only the five-step flow; the earlier Today / With panel is gone (15 Nov decision)', async () => {
  const html = await page();
  assert.doesNotMatch(html, /id="hero-visual"|hx-toggle|With Rework Rescue/);
  const home = await read('../src/home.js');
  assert.doesNotMatch(home, /mountHero|hero=panel|get\('hero'\)/);
  assert.match(home, /mountFlow\(document\.getElementById\('hero-flow'\)\)/);
});
test('What I automate: five tiles, the customer problem first, then what gets built (ChatGPT table)', async () => {
  const sec = section(await page(), 'services', 'approach');
  assert.match(sec, /<h2 id="services-h">What I automate<\/h2>/);
  assert.deepEqual([...sec.matchAll(/<strong>([^<]+)<\/strong><span>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]), [
    ['Emails piling up', 'AI-assisted reading, classification and request tracking'],
    ['Information entered repeatedly', 'Automated data extraction and record updates'],
    ['Follow-ups getting missed', 'Automated reminders and follow-up workflows'],
    ['Requests getting stuck', 'Workflow routing and approval steps'],
    ['Reports taking hours to prepare', 'Automated reporting and data checks'],
  ]);
});

test('approach band: Start with the work, not the software (ChatGPT, 15 Nov); checks are not sold as the difference', async () => {
  const html = await page();
  const sec = section(html, 'approach', 'built');
  assert.match(sec, /<h2 id="approach-h">Start with the work, not the software\.<\/h2>/);
  assert.match(sec, /<p>Before choosing a tool, I look at where work begins, where information gets repeated, where follow-ups get missed and which decisions need a person\.<\/p>/);
  assert.match(sec, /<p>Then I build practical AI and automation solutions around the way your business operates\.<\/p>/);
  assert.match(sec, /<p class="rr-approach-note">AI where interpretation helps\. Automation where repetition gets in the way\.<\/p>/);
  assert.doesNotMatch(sec, /Practical solutions built around your business/);
  assert.doesNotMatch(html, /Automation with checks built in|Automation that checks itself|proprietary|my method|framework/i);
});
test('proof: own builds first, plain-text tools line, then two short previous-role results with details closed', async () => {
  const html = await page();
  const sec = section(html, 'built', 'how');
  assert.match(sec, /<span class="anchor" id="samples"><\/span>/, 'old #samples links land here');
  assert.equal((sec.match(/<li class="built-card">/g) || []).length, 2);
  for (const t of ['The booking calendar', 'The chat assistant']) assert.ok(sec.includes(`<h3>${t}</h3>`), t);
  assert.match(sec, /I built these for my own site\. They aren&rsquo;t client projects\./);
  assert.match(sec, /<p class="rr-tools"><span>Tools I work with<\/span> n8n &middot; Gemini &middot; Google Workspace &middot; Microsoft 365 &middot; Power Automate<\/p>/);
  assert.doesNotMatch(sec, /<img[^>]+(logo|n8n|gemini)/i, 'tool names as text, no logos');
  assert.ok(sec.indexOf('built-card') < sec.indexOf('rr-tools') && sec.indexOf('rr-tools') < sec.indexOf('rr-results'));
  const res = sec.slice(sec.indexOf('class="rr-results-h"'));
  assert.match(res, /Examples from my previous employment, not Rework Rescue client projects\./);
  assert.equal((res.match(/<li class="rr-result">/g) || []).length, 2);
  // Card face: title, numbers, bridge line. Tools only inside the closed row.
  for (const card of res.split('<li class="rr-result">').slice(1)) {
    const face = card.slice(0, card.indexOf('<details'));
    assert.match(face, /<p class="rr-nums">/); assert.match(face, /<p class="exp-bridge">In your business/);
    assert.doesNotMatch(face, /Python|Power BI|Power Automate/);
    assert.match(card, /<details class="fold rr-more"><summary>See how it worked<\/summary>/);
  }
  assert.doesNotMatch(res, /<details[^>]*\bopen\b/);
  for (const t of ['1,000+', '~10', '2&ndash;3 hours']) assert.ok(res.includes(`<strong>${t}</strong>`), t);
  assert.doesNotMatch(res, /\d\s?%|saved|savings|per cent|solar|irradiance|inverter|utility|TotalEnergies|SunPower|Eutility/i, 'no invented savings; no employer or industry names');
  assert.equal((res.match(/Illustrative example &middot; Synthetic data/g) || []).length, 2);
});

test('build cards match what the n8n workflows do', async () => {
  const nodes = async (f) => JSON.parse(await read(f)).nodes.map((n) => n.name);
  const booking = await nodes('../n8n/rework-review-booking.json');
  for (const n of ['Google: busy times', 'Google: is it still free?', 'Google: create event + invite', 'Log to Google Sheet', 'Still on? (1 day)', 'Email: 1-day reminder', 'Still on? (1 hour)', 'Email: 1-hour reminder']) assert.ok(booking.includes(n), n);
  const assistant = await nodes('../n8n/rework-assistant.json');
  for (const n of ['Check request', 'Gemini: reply', 'Check reply', 'Log to Google Sheet']) assert.ok(assistant.includes(n), n);
});

test('section order, nav and removed content', async () => {
  const html = await page();
  const ids = ['services', 'approach', 'built', 'experience', 'how', 'about', 'faq', 'start'].map((x) => html.indexOf(`id="${x}"`));
  assert.ok(ids.every((i) => i > 0)); assert.deepEqual([...ids].sort((a, b) => a - b), ids);
  assert.equal((html.match(/<section /g) || []).length, 8, 'hero + seven sections');
  const nav = [...html.slice(0, html.indexOf('<main')).matchAll(/<li><a href="#(\w+)">([^<]+)</g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(nav, ['services:What I automate', 'built:See it working', 'how:How it works', 'about:About', 'faq:FAQ']);
  assert.doesNotMatch(html, /id="fit"|Sound familiar\?|svc-layer|svc-have|What you get|How I can help/);
  assert.doesNotMatch(html, /Can you build a website, booking system or CRM\?|No report to send\?|book-assess|Before Rework Rescue/);
  assert.match(html, /<title>Rework Rescue \| AI and automation for business operations<\/title>/);
});

test('How it works, About, FAQ and Book keep the retained lines', async () => {
  const html = await page();
  const how = section(html, 'how', 'about');
  assert.match(how, /You&rsquo;ll know the scope and price in writing before any work starts\./);
  assert.deepEqual([...how.matchAll(/<li><h3>([^<]+)<\/h3><p>([^<]+)<\/p><\/li>/g)].map((m) => `${m[1]}: ${m[2]}`), [
    'Understand the work: Identify the repetitive tasks, existing tools and operational problems.',
    'Map the solution: Agree on the workflow, scope and what should be automated.',
    'Build and test: Implement the solution and test normal cases, exceptions and handoffs.',
    'Hand over: Document the workflow, explain how it works and provide the agreed solution.']);
  const std = how.slice(how.indexOf('class="rr-standards"'));
  assert.match(std, /<h3>In every project<\/h3>/);
  for (const t of ['Built-in checks flag missing, inconsistent or unexpected information.', 'People review and approve important decisions.', 'Workflows run in accounts controlled by the customer.', '30 days of post-handover fixes for issues within the agreed scope.']) assert.ok(std.includes(t), t);
  assert.match(how, /<summary>Step 2 example: see a sample written scope<\/summary>/);
  assert.match(how, /No system logins to get started\./);
  assert.doesNotMatch(how, /how-approach/, 'intro paragraphs cut to one line');
  const about = section(html, 'about', 'faq');
  assert.match(about, /<p class="about-lead">I&rsquo;m an operations and data specialist who builds practical AI and automation solutions\.<\/p>/);
  assert.match(about, /I bring over eight years of experience working with data, reporting and operational processes\./);
  assert.doesNotMatch(about, /data analyst/);
  assert.match(about, /I build AI and automation workflows with n8n, and I keep training as the tools change\./);
  assert.match(about, /Monday to Friday, 8&nbsp;am to 2&nbsp;am Philippine time \(UTC\+8\)/);
  const faq = section(html, 'faq', 'start');
  assert.deepEqual([...faq.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]), ['What can you automate?', 'How much does it cost, and is there a written agreement?', 'Can you work with confidential or sensitive information?', 'Will this replace anyone on my team?', 'How do you handle access to our systems?', 'You&#39;re in the Philippines. How does working remotely work?']);
  assert.match(faq, /Not every problem needs AI\./);
  assert.match(faq, /Client project data is never put into free AI tools or tools that train on your data\./);
  assert.match(faq, /<summary>Will this replace anyone on my team\?<\/summary><p>No\./);
  const start = section(html, 'start');
  assert.match(start, /<h2 id="cta-h">Bring me the task your team repeats every week\.<\/h2>/);
  assert.match(start, /Get a free written review<\/a>/);
  assert.ok(start.indexOf('class="book-data"') < start.indexOf('id="book-inline"'));
});

test('guard rails: no prices, testimonials or invented results; first person; one button wording; only confirmed tools', async () => {
  const html = await page();
  const visible = visibleText(html);
  assert.doesNotMatch(visible, /[$₱€£]\s?\d|\bPHP\s?\d|\bUSD\b|per hour|\/hr\b|testimonial|what (my )?clients say/i);
  assert.doesNotMatch(visible, /100% accurate|detect(s)? every|all errors detected|fully automate everything|finds every problem/i);
  assert.doesNotMatch(visible, /years (of experience )?in AI|AI (automation )?agency|AI expert|Zapier|GoHighLevel|\bGHL\b|Make\.com/i);
  assert.doesNotMatch(html, /\bwe&rsquo;ll\b|\bWe&rsquo;ll\b|small (service )?businesses/i);
  assert.doesNotMatch(html, /Most projects start|Most first projects|first project usually/);
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html', '../src/booking/popup.js', '../src/assistant/rules.js', '../n8n/rework-assistant.json']) {
    const t = await read(f);
    assert.doesNotMatch(t.replace(/Written(%20| )report(%20| )review/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' '), /(report|rework) review/i, f);
  }
  assert.doesNotMatch(html, /\sstyle="/, 'CSP: no inline styles');
  assert.doesNotMatch(html, /<p[^>]*>[^<]*<p[\s>]/, 'no unclosed paragraph');
});
