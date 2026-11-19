// The homepage after the 15 Nov 2026 rework (Jeff + ChatGPT decisions, built on preview/final-page), plus the
// 15 Nov service expansion (preview/services-expansion): problem-led hero, five-step flow, Where I can make work
// easier (six tiles), Start with the work (with the three-part visual), proof (own builds, tools, previous-role
// results), How it works, About, FAQ, Book. Copy from Jeff and ChatGPT is checked word for word.
// The guard rails from the earlier rounds stay: no prices, testimonials or invented results; first person; one
// button wording; booking hours match the calendar; the build cards match the n8n workflows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const page = () => read('../index.html');
const section = (html, id, next) => html.slice(html.indexOf(`id="${id}"`), next ? html.indexOf(`id="${next}"`) : undefined);
const visibleText = (h) => h.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');

test('hero (19 Nov reference v2): approved copy word for word, one booking button, booking note, three promises', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('<div class="container hz-wrap">'));
  assert.match(hero, /<p class="eyebrow hero-eyebrow">AI &amp; automation for business operations<\/p>/);
  assert.match(hero, /<h1 id="hero-title">Less manual work\. <span class="h1-accent"><span class="hz-mark">Smarter<svg class="hv-swoosh"[^>]*>[\s\S]*?<\/svg><\/span> business operations\.<\/span><\/h1>/);
  assert.match(hero, /<p class="hero-sub">I improve the way your business works by understanding your processes first, then applying practical AI and automation where they make a real difference\.<\/p>/);
  assert.match(hero, /href="contact\/#contact-form-area">[\s\S]*?Book a free rework review <span aria-hidden="true">&rarr;<\/span><\/a>/);
  assert.match(hero, /<p class="hero-note">[\s\S]*?30 minutes &middot; No obligation<\/p>/);
  assert.equal((hero.match(/<a /g) || []).length, 1, 'one call to action, nothing else');
  assert.deepEqual([...hero.matchAll(/<li class="hz-pr-\d">[\s\S]*?<b>([^<]+)<\/b><span>([^<]+)<\/span><\/li>/g)].map((m) => [m[1], m[2]]), [
    ['Understand the work.', 'See where time and effort are being wasted.'],
    ['Agree the solution.', 'A clear scope, cost and expected delivery.'],
    ['Deliver and hand over.', 'A tested solution, project files, a handover guide and 30 days of in-scope fixes.'],
  ]);
  assert.match(hero, /<p class="hz-pr-title" id="hz-pr-title">What you can expect from me<\/p>\s*<ul class="hz-pr-list" aria-labelledby="hz-pr-title">/);
  assert.doesNotMatch(hero, /hv-chips|hv-written|cred-strip|rr-chip/, 'hero kept to the approved elements');
  assert.doesNotMatch(html, /\bCapture\b|>Move<|>See<|Capture \/ Move|Fix the (tools|steps|numbers)/, 'no Capture / Move / See framework anywhere');
});

test('hero (19 Nov): three zones, full width; problem, solution, outcome; no slider, no mascot, no copy of the six tiles', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('</section>', html.indexOf('<section class="hero')));
  const txt = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.doesNotMatch(hero, /role="slider"|rx-runner|rx-reset|Replay|mark\.png/, 'the logo slider and Replay are gone');
  assert.doesNotMatch(hero, /bot-|robot|mascot/i, 'no robot or mascot');
  // benefits strip at the bottom of the hero, after the scene
  assert.ok(hero.indexOf('id="hero-story"') < hero.indexOf('class="story-benefits"'));
  assert.deepEqual([...hero.matchAll(/<li><svg[^>]*>[\s\S]*?<\/svg><span>([^<]+)<\/span><\/li>/g)].map((m) => m[1]), ['Keep follow-ups on track.', 'Stop repeating data entry.', 'Know who&rsquo;s responsible and what&rsquo;s next.']);
  const fig = hero.slice(hero.indexOf('id="hero-story"'), hero.indexOf('</figure>'));
  const zones = [...fig.matchAll(/<p class="hz-tag">[\s\S]*?<\/svg>([^<]+)<\/p>[\s\S]*?<p class="hz-desc">([^<]+)<\/p>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(zones, [
    ['Scattered work', 'Information from different places, repeated work and things that are easy to miss.'],
    ['A better way of working', 'A process designed around your business, using the right mix of AI, automation and human review.'],
    ['Organised operations', 'A clear view of work, ownership and next steps.'],
  ]);
  assert.deepEqual([...fig.matchAll(/<ul class="hz-flags">[\s\S]*?<\/ul>/g)].flatMap((m) => [...m[0].matchAll(/<\/svg>([^<]+)<\/li>/g)].map((x) => x[1])), ['Duplicate?', 'Missing detail?', 'Who owns this?']);
  assert.doesNotMatch(fig, /Phone missing|Phone: missing/, 'the universal "Missing detail", not a phone example');
  assert.match(fig, /<li class="hz-in-sheet"><span class="hz-sheet-copy">[\s\S]*?Customer list \(v2\)<\/span>[\s\S]*?Customer list \(v3\)\.xlsx/, 'two overlapping spreadsheet files show the duplicate');
  // the three roles, each with its job, in the colour language order
  assert.deepEqual([...fig.matchAll(/<li class="hz-(ai|auto|human)">[\s\S]*?<b>([^<]+)<\/b><small>([^<]+)<\/small><\/li>/g)].map((m) => [m[1], m[2], m[3]]), [
    ['ai', 'AI', 'Reads and interprets details'],
    ['auto', 'Automation', 'Updates records and moves work forward'],
    ['human', 'Human review', 'Checks exceptions and approves important decisions'],
  ]);
  // the tracker: owners are team roles, never the automation or AI
  const rows = [...fig.matchAll(/<tr><th scope="row">[\s\S]*?<\/svg>([^<]+)<\/th><td data-label="Owner">([^<]+)<\/td><td><span class="hz-st[^"]*">([^<]+)<\/span><\/td><td data-label="Next">([^<]+)<\/td><\/tr>/g)].map((m) => m.slice(1));
  assert.deepEqual(rows, [
    ['Customer request', 'Office team', 'In progress', 'Prepare response'],
    ['Service task', 'Field team', 'Needs review', 'Confirm details'],
    ['Follow-up', 'Office team', 'Scheduled', 'Send update'],
    ['Record update', 'Operations team', 'Completed', 'No action needed'],
  ]);
  for (const [, owner] of rows) assert.match(owner, / team$/, 'owners are team roles');
  assert.doesNotMatch(fig, /JM|AK|SR\b/, 'no arbitrary initials');
  assert.match(fig, /<caption class="sr-only">Example tracker<\/caption>/);
  const svc = html.slice(html.indexOf('id="services"'), html.indexOf('</section>', html.indexOf('id="services"')));
  for (const tile of [...svc.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1])) assert.ok(!txt(fig).includes(tile), `hero doesn't repeat the tile "${tile}"`);
  assert.doesNotMatch(fig, /<img|background-image|\d+\s?%|hours? saved|Dana|Outlook|Excel|Teams|Power Automate|Zapier|n8n|Make\.com/i, 'no photos, figures or vendor names');

  const c = await read('../assets/styles.css');
  const css = c.slice(c.indexOf('/* ---- Hero (19 Nov 2026): three zones'), c.indexOf('/* the Dana Cruz flow'));
  assert.ok(css.length > 2000, 'three-zone block exists');
  assert.doesNotMatch(c, /\.rx-runner|\.rx-stage|@property --p\b/, 'slider styles removed');
  assert.doesNotMatch(css, /infinite/, 'the flow plays a few cycles, then rests');
  for (const m of css.matchAll(/animation: hz-[\w-]+ [\d.]+s [\w-]+ (\d+);/g)) assert.ok(Number(m[1]) <= 18, 'finite repeats');
  const motionRule = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.match(motionRule, /^@media \(prefers-reduced-motion: no-preference\) \{\n(  \.hz-flow\.is-live [^\n]+\n)+\}/, 'every animation is behind reduced-motion and .is-live');
  assert.match(css, /\.hz-steps \.hz-ai \{[^}]*var\(--ai-tint\)/, 'AI violet');
  assert.match(css, /\.hz-steps \.hz-human \{[^}]*var\(--human-tint\)/, 'human review amber');
  assert.match(css, /\.hz-steps li \{[^}]*var\(--teal-tint\)/, 'automation teal');
  assert.match(css, /@media \(max-width: 40rem\) \{[\s\S]*?\.hz-table tr \{ display: grid;[^}]*grid-template-areas: "item status" "owner owner" "next next";/, 'phones: the tracker becomes compact records');
  assert.match(css, /td\[data-label\]::before \{ content: attr\(data-label\) ": "; \}|td\[data-label\]::before \{ content: attr\(data-label\) ": ";/);

  const js = await read('../src/hero-zones.js');
  assert.doesNotMatch(js, /\.style\.|setInterval|setTimeout|innerHTML/, 'CSP: classes only');
  assert.match(js, /IntersectionObserver/); assert.match(js, /prefers-reduced-motion: reduce/);
  const { shouldPlay, LIVE_CLASS } = await import('../src/hero-zones.js');
  assert.equal(LIVE_CLASS, 'is-live');
  assert.equal(shouldPlay(true, false), true); assert.equal(shouldPlay(false, false), false); assert.equal(shouldPlay(true, true), false);
  const home = await read('../src/home.js');
  assert.match(home, /mountZones\(document\.getElementById\('hero-story'\)\)/);
  assert.doesNotMatch(home, /hero-slider|mountSlider/);
});

test('the Dana Cruz example moved under How I help, still working', async () => {
  const html = await page();
  const svc = html.slice(html.indexOf('id="services"'), html.indexOf('</section>', html.indexOf('id="services"')));
  assert.match(svc, /<h3>One request, step by step<\/h3>/);
  assert.match(svc, /<figure class="rf no-print" id="hero-flow"/);
  assert.ok(!html.slice(0, html.indexOf('id="services"')).includes('Dana Cruz'), 'not in the hero');
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
test('Where I can make work easier: six tiles, the customer problem first, then what gets built; 3 / 2 / 1 columns', async () => {
  const sec = section(await page(), 'services', 'approach');
  assert.match(sec, /<p class="eyebrow">How I help<\/p>\s*<h2 id="services-h">Where I can make work easier<\/h2>/);
  assert.deepEqual([...sec.matchAll(/<strong>([^<]+)<\/strong><span>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]), [
    ['Emails piling up', 'AI reads and sorts emails, and tracks each request'],
    ['Information entered repeatedly', 'Details pulled out and records updated automatically'],
    ['Follow-ups getting missed', 'Automated reminders and follow-up workflows'],
    ['Requests getting stuck', 'Requests sent to the right person, with approval steps'],
    ['Reports taking hours to prepare', 'Reports built and checked automatically'],
    ['Customer enquiries are hard to manage', 'Simple websites, enquiry forms and customer trackers to capture and organise requests'],
  ]);
  assert.match(sec, /<p class="rr-tracker-note"><strong>What&rsquo;s a customer tracker\?<\/strong> A simple place to record customer enquiries, contact details, request status, who is responsible and what needs following up\.<\/p>/);
  const c = await read('../assets/styles.css');
  assert.match(c, /\.rr-tiles \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(c, /@media \(max-width: 62rem\) \{ \.rr-tiles \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \} \}/);
  assert.match(c, /@media \(max-width: 40rem\) \{\n  \.rr-tiles \{ grid-template-columns: minmax\(0, 1fr\);/);
});

test('approach band (19 Nov): headline kept; one lead; three decision cards replace the old list; the goal line', async () => {
  const html = await page();
  const sec = section(html, 'approach', 'built');
  assert.match(sec, /<p class="eyebrow">My approach<\/p>\s*<h2 id="approach-h">Start with the work, not the software\.<\/h2>/);
  assert.match(sec, /<p class="rr-approach-lead">You care about missed enquiries, slow replies and hours spent copying the same details &mdash; not which platform fixes them\. I start by finding where the work actually gets stuck, then choose the simplest solution that fits\.<\/p>/);
  assert.doesNotMatch(sec, /rr-approach-steps|Look at the work|Keep it simple<\/li>/, 'the old three-item list is replaced, not stacked');
  assert.match(sec, /<h3 class="rr-decide-h">AI or simple automation\? Three questions decide it\.<\/h3>/);
  assert.deepEqual([...sec.matchAll(/<h3>([^<]+)<\/h3><p class="rr-d-a">([^<]+)<\/p><p class="rr-d-eg">([^<]+)<\/p>/g)].map((m) => `${m[1]} | ${m[2]} | ${m[3]}`), [
    'Are the rules clear? | Automation | Form submitted &rarr; tracker updated &rarr; confirmation sent',
    'Does it need interpretation? | AI step | Read an enquiry email and extract customer details',
    'How costly would an error be? | Human review | Hold a customer reply or high-value quote for approval']);
  assert.match(sec, /<p class="rr-approach-note">The goal isn&rsquo;t to use AI everywhere\. It&rsquo;s to build the right solution for the problem\.<\/p>\s*<p class="rr-approach-more">Some projects need just one improvement\. Others benefit from connecting a few simple tools\. I&rsquo;ll recommend what makes sense for your business, not add technology you don&rsquo;t need\.<\/p>/);
  assert.doesNotMatch(sec, /rr-connect|Reach customers|Follow through/);
  assert.doesNotMatch(sec, /Practical solutions built around your business/);
  assert.doesNotMatch(html, /Automation with checks built in|Automation that checks itself|proprietary|my method|framework/i);
});

test('client expectations (19 Nov): testing line, weekly updates, closing thought; monitoring stays separate', async () => {
  const html = await page();
  const safety = section(html, 'safety', 'built');
  assert.match(safety, /<p class="sn-demo">A demo shows the idea\. Testing checks how it handles normal cases, exceptions and failures\.<\/p>\s*<p class="sn-quote">/);
  assert.doesNotMatch(html, /keeps working/, 'testing is not sold as a guarantee');
  const how = section(html, 'how', 'about');
  assert.match(how, /<div class="rr-updates">\s*<h3>You won&rsquo;t have to guess where things stand\.<\/h3>\s*<p>While your project is active, I&rsquo;ll send a short written update at least once a week covering what&rsquo;s completed, what&rsquo;s next, and anything waiting on your input\. If a blocker is likely to affect the delivery timeline, I&rsquo;ll explain the reason and let you know as soon as I can\.<\/p>/);
  assert.match(html, /How does working remotely work\?<\/summary><p>[^<]*I&rsquo;ll send a short written update at least once a week\.<\/p><\/details>/, "the FAQ uses the same commitment");
  assert.doesNotMatch(html, /progress updates in writing/);
  assert.match(html, /<p class="rr-closing">Knowing the tools matters\. Understanding your business, keeping you informed and delivering something your team can rely on is what makes the work valuable\.<\/p>/);
  assert.match(html, /ongoing monitoring and maintenance\./, 'monitoring stays outside the 30 days');
  assert.doesNotMatch(html, /24\/7|monitoring included|includes monitoring/i);
});

test('proof: own builds first, plain-text tools line, then two short previous-role results with details closed', async () => {
  const html = await page();
  const sec = section(html, 'built', 'how');
  assert.match(sec, /<span class="anchor" id="samples"><\/span>/, 'old #samples links land here');
  assert.match(sec, /<p class="eyebrow">Demos &amp; examples<\/p>\s*<h2 id="built-h">See it working on this page\.<\/h2>/);
  assert.equal((sec.match(/<li class="built-card( built-card-ai)?">/g) || []).length, 2);
  for (const t of ['The booking calendar', 'The chat assistant']) assert.ok(sec.includes(`<h3>${t}</h3>`), t);
  assert.match(sec, /I built these for my own site\. They aren&rsquo;t client projects\./);
  assert.match(sec, /<p class="rr-tools"><span>Tools I work with<\/span> n8n &middot; Google Apps Script &middot; Power Automate &middot; Gemini &middot; Google Workspace &middot; Microsoft 365<\/p>/);
  assert.doesNotMatch(sec.match(/<p class="rr-tools">[\s\S]*?<\/p>/)[0], /Excel|Power Query|Python|Power BI/, 'main strip stays AI and automation');
  assert.doesNotMatch(sec, /<img[^>]+(logo|n8n|gemini)/i, 'tool names as text, no logos');
  assert.ok(sec.indexOf('built-card') < sec.indexOf('rr-tools') && sec.indexOf('rr-tools') < sec.indexOf('rr-results'));
  const res = sec.slice(sec.indexOf('class="rr-results-h"'));
  assert.match(res, /class="rr-results-h" id="experience">Examples from my previous roles<\/h3>/);
  assert.match(res, /<p class="rr-results-note">These are from previous employment, not Rework Rescue client projects\.<\/p>/);
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
  const ids = ['services', 'approach', 'safety', 'built', 'experience', 'how', 'about', 'faq', 'start'].map((x) => html.indexOf(`id="${x}"`));
  assert.ok(ids.every((i) => i > 0)); assert.deepEqual([...ids].sort((a, b) => a - b), ids);
  assert.equal((html.match(/<section /g) || []).length, 9, 'hero + eight sections (safety net added 17 Nov)');
  const nav = [...html.slice(0, html.indexOf('<main')).matchAll(/<li><a href="#(\w+)">([^<]+)</g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(nav, ['services:How I help', 'built:Demos &amp; examples', 'how:How it works', 'about:About', 'faq:FAQ']);
  assert.doesNotMatch(html, /id="fit"|Sound familiar\?|svc-layer|svc-have|What you get|How I can help/);
  assert.doesNotMatch(html, /Can you build a website, booking system or CRM\?|No report to send\?|book-assess|Before Rework Rescue/);
  assert.match(html, /<title>Rework Rescue \| Smarter Business Operations<\/title>/);
  assert.ok(html.includes('<meta property="og:title" content="Rework Rescue | Smarter Business Operations">'), 'og:title matches the page title');
  const desc = 'Rework Rescue helps businesses reduce repetitive admin, organise information and improve everyday operations with practical automation, simple websites and customer tracking systems.';
  assert.ok(html.includes(`<meta name="description" content="${desc}">`)); assert.ok(html.includes(`<meta property="og:description" content="${desc}">`));
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html']) {
    const t = await read(f); assert.doesNotMatch(t, /What I automate/, f); assert.match(t, /#services">How I help<\/a>/, f); assert.match(t, /#built">Demos &amp; examples<\/a>/, f);
  }
});

test('How it works, About, FAQ and Book keep the retained lines', async () => {
  const html = await page();
  const how = section(html, 'how', 'about');
  assert.match(how, /You&rsquo;ll know the scope and price in writing before any work starts\./);
  assert.deepEqual([...how.matchAll(/<li><h3>([^<]+)<\/h3><p>([^<]+)<\/p><\/li>/g)].map((m) => `${m[1]}: ${m[2]}`), [
    'Discovery: Understand how the work happens today and where it gets stuck.',
    'Technical assessment: Check your existing tools, data and access, and whether they can support the solution.',
    'Written scope and agreement: Confirm deliverables, exclusions, testing plan, fixed project fee and estimated delivery date.',
    'Build and test: Test the usual cases, unusual situations and what happens when something goes wrong.',
    'Handover and 30&#8209;day fixes: Explain the solution, provide documentation and include 30 days of fixes.']);
  const std = how.slice(how.indexOf('class="rr-standards"'));
  assert.match(std, /<h3>What you&rsquo;ll have after handover<\/h3>/);
  assert.match(std, /<p class="rr-standards-intro">Every project is handed over as a usable solution, not just a build\. You&rsquo;ll receive:<\/p>/);
  assert.deepEqual([...std.matchAll(/<li><strong>([^<]+)<\/strong>/g)].map((m) => m[1]),
    ['A working solution', 'Project files and access', 'A practical guide and walkthrough', '30 days of fixes', 'Safety net']);
  assert.match(std, /<p class="rr-standards-note">For AI, automation and reporting projects, handover also covers the agreed checks, unusual cases and review steps your team needs to know\.<\/p>/);
  assert.doesNotMatch(how, /how-scope|sample written scope|Northstar/, 'sample written scope removed (19 Nov)');
  assert.match(how, /No system logins to get started\./);
  assert.doesNotMatch(how, /how-approach/, 'intro paragraphs cut to one line');
  const about = section(html, 'about', 'faq');
  assert.match(about, /<p class="about-lead">I&rsquo;m an operations and data specialist who builds practical AI and automation solutions\.<\/p>/);
  assert.match(about, /I have over eight years of experience with data, reporting and day-to-day operations\./);
  assert.doesNotMatch(about, /data analyst/);
  assert.match(about, /I build AI and automation workflows with n8n, and I keep my skills current as the tools change\./);
  assert.match(about, /Monday to Friday, 8&nbsp;am to 2&nbsp;am Philippine time \(UTC\+8\)/);
  const faq = section(html, 'faq', 'start');
  assert.deepEqual([...faq.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]), ['What can you automate?', 'What happens if something breaks or a connected app changes?', 'Can you build a website or set up a simple CRM?', 'How much does it cost, and is there a written agreement?', 'Can you work with confidential or sensitive information?', 'Will this replace anyone on my team?', 'How do you handle access to our systems?', 'You&#39;re in the Philippines. How does working remotely work?']);
  assert.match(faq, /Not every problem needs AI\./);
  assert.match(faq, /<p>Each project is priced around one clearly defined improvement\. Where the requirements and deliverables can be agreed upfront, I use a fixed project fee rather than an open-ended hourly rate\.<\/p><p>The price depends on the work, which tools need connecting, and any setup or getting your data ready\.<\/p><p>After the free review, you&rsquo;ll get a written proposal showing what you&rsquo;ll get, what&rsquo;s not included, the estimated timeline, payment schedule and any costs for other providers&rsquo; software, hosting or usage\.<\/p><p>Nothing starts until you approve the scope and price\.<\/p>/);
  assert.doesNotMatch(faq, /one report or one process/);
  assert.match(faq, /<p>Yes\. I can build simple, mobile-friendly business websites and landing pages, enquiry forms, and simple customer trackers or CRM setups, using suitable existing tools\.<\/p><p>These can stand alone or connect\. For example, a website enquiry can be added to a customer tracker and trigger a follow-up reminder\.<\/p><p>I focus on clear layouts and practical features rather than complex designs or software\. For online stores, custom applications or advanced CRM systems, I&rsquo;ll explain when a specialist solution is needed\.<\/p>/);
  assert.match(faq, /Client project data is never put into free AI tools or tools that train on your data\./);
  assert.match(faq, /<summary>Will this replace anyone on my team\?<\/summary><p>No\./);
  const start = section(html, 'start');
  assert.match(start, /<h2 id="cta-h">Tell me what you&rsquo;d like to make easier\.<\/h2>/);
  assert.match(start, /<p class="lede">What&rsquo;s taking too much time, getting missed or harder to manage than it should be\? I&rsquo;ll help you work out whether a simpler process, customer tracker, website or automation would help\.<\/p>/);
  assert.match(start, /<p class="book-outcome">Leave with a clearer picture of where work is getting stuck and one practical improvement worth considering &mdash; whether or not you decide to work with me\.<\/p>/);
  assert.match(start, /Describe the task or process your team repeats, or send a sample with confidential details removed\. I&rsquo;ll send a one-page written review within 1 working day, showing where the work gets stuck and what I&rsquo;d improve first\./);
  assert.match(start, /subject=Written%20task%20review">Get a free written review<\/a>/);
  const contact = await read('../contact/index.html');
  assert.match(contact, /<h2>Prefer to write first\?<\/h2>/);
  assert.match(contact, /Describe the task or process your team repeats, or send a sample with confidential details removed\. I&rsquo;ll send a one-page written review within 1 working day, showing where the work gets stuck and what I&rsquo;d improve first\./);
  assert.match(contact, /<a href="mailto:[^"]+\?subject=Written%20task%20review">Request a free written review/);
  assert.doesNotMatch(contact, /Email me a sample report|screenshot of your roster|Written%20report%20review/);
  assert.match(contact, /The first step is a free review\. Bring one task or process your team repeats or that takes too much time\. In 30 minutes, I&rsquo;ll look at how it works, where work gets stuck and what could be simplified or automated\. If it&rsquo;s worth improving, I&rsquo;ll email you a written scope, price and timeline you can share with whoever signs off\. You&rsquo;ll leave with practical recommendations, even if you decide not to work with me\./);
  assert.match(await read('../src/booking/popup.js'), /Just bring one task or process that takes more time than it should\. No preparation needed\. I&rsquo;ll help you understand where the work gets stuck and identify a practical next step\./);
  assert.match(html, /<p class="built-what">Pick a time\. Booking, calendar invites and reminders are handled automatically\.<\/p>/);
  for (const f of ['../index.html', '../404.html', '../assessment/index.html', '../contact/index.html', '../privacy/index.html']) assert.match(await read(f), /Jeff Herson Vida, AI and Automation Specialist/, f);
  assert.ok(start.indexOf('class="book-data"') < start.indexOf('id="book-inline"'));
});

test('guard rails: no prices, testimonials or invented results; first person; one button wording ("Book a free rework review" on every booking button, 19 Nov); only confirmed tools', async () => {
  const html = await page();
  const visible = visibleText(html);
  assert.doesNotMatch(visible, /[$₱€£]\s?\d|\bPHP\s?\d|\bUSD\b|per hour|\/hr\b|testimonial|what (my )?clients say/i);
  assert.doesNotMatch(visible, /100% accurate|detect(s)? every|all errors detected|fully automate everything|finds every problem/i);
  assert.doesNotMatch(visible, /years (of experience )?in AI|AI (automation )?agency|AI expert|Zapier|GoHighLevel|\bGHL\b|Make\.com/i);
  assert.doesNotMatch(html, /\bwe&rsquo;ll\b|\bWe&rsquo;ll\b|small (service )?businesses/i);
  assert.doesNotMatch(html, /Most projects start|Most first projects|first project usually/);
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html', '../src/booking/popup.js', '../src/assistant/rules.js', '../n8n/rework-assistant.json']) {
    const t = await read(f);
    assert.doesNotMatch(t.replace(/Written(%20| )report(%20| )review/g, '').replace(/Book a (free rework |<span class="cta-long">free rework <\/span>)review/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' '), /(report|rework) review/i, f);
  }
  assert.doesNotMatch(html, /\sstyle="/, 'CSP: no inline styles');
  assert.doesNotMatch(html, /<p[^>]*>[^<]*<p[\s>]/, 'no unclosed paragraph');
});
