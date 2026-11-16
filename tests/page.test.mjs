// The homepage after the 17 Nov 2026 copy round (ChatGPT direct-response copywriter review, 16 Nov, plus Jeff's
// decisions, 17 Nov): question-led hero, "The work that slows a team down", shortened approach, the restored
// "Practical tools to improve how your business works" section (Jeff's exact copy), previous-role examples before
// the demos, two shortened demo cards, "What happens after the free review" with a consolidated handover box,
// shortened About, three FAQs and a tightened Book section. The Northstar sample scope, the tools strip, the
// "What I need from you" line and the separate 30-day fold were removed in the same round. Copy is checked word
// for word. Guard rails stay: no prices, testimonials or invented results; one button wording; the build cards
// match the n8n workflows. Booking form and assistant were deliberately not touched (option 4 still matches n8n).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const page = () => read('../index.html');
const section = (html, id, next) => html.slice(html.indexOf(`id="${id}"`), next ? html.indexOf(`id="${next}"`) : undefined);
const visibleText = (h) => h.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');

test('hero: question-led copy word for word, one primary button, proof chip, no framework', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('<figure'));
  assert.match(hero, /<p class="eyebrow hero-pill">AI &amp; automation analysis for small businesses<\/p>/);
  assert.match(hero, /<h1 id="hero-title">Still re-typing details, chasing updates and rebuilding <span class="h1-accent">the same report\?/);
  assert.match(hero, /<p class="hero-sub">I map the work, find where time and errors are lost, and assess whether a process change, automation or AI will help\. When it makes sense, I build and test the agreed improvement\.<\/p>/);
  assert.match(hero, /href="contact\/#contact-form-area">[\s\S]*?Book a free 30-minute review<\/a>/);
  assert.doesNotMatch(hero, /hv-explore|Try a live automation/, 'secondary hero CTA removed (ChatGPT, 16 Nov); demos stay below');
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

test('Where I can make work easier: six problem-to-solution tiles word for word, in order; intro and close; nothing else', async () => {
  const html = await page();
  const sec = section(html, 'services', 'approach');
  assert.match(sec, /<p class="eyebrow">How I help<\/p>\s*<h2 id="services-h">Where I can make work easier<\/h2>/);
  assert.match(sec, /<p class="lede rr-build-intro">I help small businesses reduce repetitive admin, keep information organised, manage customer enquiries and make everyday work easier\.<\/p>/);
  assert.deepEqual([...sec.matchAll(/<strong>([^<]+)<\/strong><span>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]), [
    ['Emails piling up', 'Email sorting, request classification and tracking, using AI where it helps.'],
    ['Information entered repeatedly', 'Automated data extraction and record updates to reduce duplicate entry.'],
    ['Follow-ups getting missed', 'Automated reminders and follow-up workflows to keep the next steps visible.'],
    ['Requests getting stuck', 'Workflow routing and approval steps to get work to the right person.'],
    ['Reports taking hours to prepare', 'Automated reporting and data checks that flag missing or unusual information.'],
    ['Customer enquiries are hard to manage', 'Websites, landing pages, enquiry forms and simple CRM tools to capture enquiries, organise customer information and track what happens next.'],
  ]);
  assert.match(sec, /<p class="rr-build-note">Every solution starts with understanding the problem\. Not every problem needs AI or automation\.<\/p>/);
  const text = visibleText(sec).replace(/\s+/g, ' ').trim();
  assert.equal(text.split(' ').length, visibleText(sec).trim().split(/\s+/).length);
  assert.equal((sec.match(/<p[\s>]/g) || []).length, 3, 'eyebrow, intro, close: no other copy');
  assert.doesNotMatch(html, /The work that slows a team down|rr-slow|id="build"|Practical tools to improve how your business works|rr-svc-n|Simple CRM &amp; business tools/, 'the two preview sections and the three-card version are gone (Jeff, 17 Nov)');
  const c = await read('../assets/styles.css');
  assert.match(c, /\.rr-tiles \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});

test('approach band: shortened to the map line, Not every problem needs AI, the gold line and the review line', async () => {
  const html = await page();
  const sec = section(html, 'approach', 'experience');
  assert.match(sec, /<p class="eyebrow">My approach<\/p>\s*<h2 id="approach-h">Start with the work, not the software\.<\/h2>/);
  assert.match(sec, /<p>I map each task: where information comes from, who handles it, what repeats, where it sticks and which decisions need a person\. I then identify what can change&mdash;and what should stay under human control\.<\/p>/);
  assert.match(sec, /<p>Not every problem needs AI\.<\/p>/);
  assert.match(sec, /<p class="rr-approach-note">Automation and AI do the repeat work\. Checks catch the mistakes\. People make the decisions\.<\/p>/);
  assert.match(sec, /<p class="rr-approach-more">For client workflows: Reviewed by a person before sharing\.<\/p>/);
  assert.doesNotMatch(sec, /rr-approach-steps|Look at the work|Build the simplest solution|Keep it simple/, 'three-step labels removed');
  assert.doesNotMatch(html, /Automation with checks built in|Automation that checks itself|proprietary|my method|framework/i);
});

test('previous roles: own section before the demos, two short prose cards with the numbers and bridge lines; details cut', async () => {
  const html = await page();
  const sec = section(html, 'experience', 'built');
  assert.match(sec, /<span class="anchor" id="samples"><\/span>/, 'old #samples links land here');
  assert.match(sec, /<h2 id="experience-h">Examples from previous roles<\/h2>/);
  assert.match(sec, /<p class="rr-results-note">These examples come from previous employment, not Rework Rescue client projects\.<\/p>/);
  assert.equal((sec.match(/<li class="rr-result">/g) || []).length, 2);
  assert.match(sec, /<h4>Catching meter issues before invoicing<\/h4>\s*<p>I built scheduled checks for 1,000\+ commercial meters\. By comparing start and end readings, the process flagged missing, frozen, unusual and potentially swapped readings before invoicing\. A typical run surfaced around 10 issues for review\. Previously, issues were often found at quarterly checks after invoices had gone out\.<\/p>/);
  assert.match(sec, /<h4>Getting the Monday report ready sooner<\/h4>\s*<p>Preparing the Monday report for the 10 largest sites took 2&ndash;3 hours\. I automated daily data extraction and checks, comparing production with expected output and weather, equipment with meter data, and underperformance with open work orders\. Power BI combined the results\. The team still reviewed findings and met each Monday\.<\/p>/);
  assert.equal((sec.match(/<p class="exp-bridge">In your business/g) || []).length, 2, 'both bridge lines kept (not in the 16 Nov cut list)');
  assert.doesNotMatch(sec, /<details|dash-table|flow2|exp-checks|Illustrative example|built-tools|Python|Power Automate/, 'diagrams, tables, folds and tool badges cut; Power BI stays in prose only');
  assert.doesNotMatch(sec, /\d\s?%|saved|savings|per cent|solar|irradiance|inverter|utility|TotalEnergies|SunPower|Eutility/i, 'no invented savings; no employer or industry names');
});

test('live demos: two cards with the condensed copy, fallback behaviour inline, note; steps and tools lists cut', async () => {
  const html = await page();
  const sec = section(html, 'built', 'how');
  assert.match(sec, /<p class="eyebrow">Live demos<\/p>\s*<h2 id="built-h">See two automations working<\/h2>/);
  assert.equal((sec.match(/<li class="built-card">/g) || []).length, 2);
  assert.match(sec, /<h3>Booking assistant<\/h3>\s*<p class="built-what">Checks my calendar, confirms a slot is free, books it, sends the invite and schedules reminders 24 hours and one hour before\. If booking fails, it says nothing was booked and offers email instead\.<\/p>/);
  assert.match(sec, /<h3>AI chat assistant<\/h3>\s*<p class="built-what">Suggests where to start with an operational problem\. It follows written instructions and set limits; it does not quote prices, make promises, book appointments or send emails\. Replies that break a rule are blocked and replaced with a plain message\.<\/p>/);
  assert.match(sec, /<p class="built-note">Both demos were built for this site, not client projects\.<\/p>/);
  assert.match(sec, /Try it: pick a time/); assert.match(sec, /data-assistant-open>Try it: ask the assistant/);
  assert.doesNotMatch(sec, /built-steps|built-more|built-safe|built-tools|rr-tools|Tools I work with/, 'numbered steps, safe rows and tool lists cut');
  assert.doesNotMatch(html, /<p class="rr-tools">/, 'the standalone tools strip is gone');
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
  const ids = ['services', 'approach', 'experience', 'built', 'how', 'about', 'faq', 'start'].map((x) => html.indexOf(`id="${x}"`));
  assert.ok(ids.every((i) => i > 0)); assert.deepEqual([...ids].sort((a, b) => a - b), ids);
  assert.equal((html.match(/<section /g) || []).length, 9, 'hero + eight sections');
  const nav = [...html.slice(0, html.indexOf('<main')).matchAll(/<li><a href="#(\w+)">([^<]+)</g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(nav, ['services:How I help', 'built:Live demos', 'how:How it works', 'about:About', 'faq:FAQ']);
  assert.doesNotMatch(html, /id="fit"|Sound familiar\?|svc-layer|svc-have|What you get|How I can help/);
  assert.doesNotMatch(html, /Northstar|sample written scope|scope-doc|how-scope|What I need from you|how-need|how-30|What the 30 days cover/i, 'sample scope and the separate 30-day fold removed (ChatGPT, 16 Nov)');
  assert.doesNotMatch(html, /Can you build a website, booking system or CRM\?|Can you build a website or set up a simple CRM\?|What can you automate\?|Before Rework Rescue/);
  assert.match(html, /<title>Rework Rescue \| Smarter Business Operations<\/title>/);
  assert.ok(html.includes('<meta property="og:title" content="Rework Rescue | Smarter Business Operations">'), 'og:title matches the page title');
  const desc = 'Rework Rescue helps businesses reduce repetitive admin, organise information and improve everyday operations with practical automation, simple websites and customer tracking systems.';
  assert.ok(html.includes(`<meta name="description" content="${desc}">`)); assert.ok(html.includes(`<meta property="og:description" content="${desc}">`));
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html']) {
    const t = await read(f); assert.doesNotMatch(t, /What I automate/, f); assert.match(t, /#services">How I help<\/a>/, f); assert.match(t, /#built">Live demos<\/a>/, f);
  }
});

test('How it works, handover, About, FAQ and Book carry the 17 Nov copy', async () => {
  const html = await page();
  const how = section(html, 'how', 'about');
  assert.match(how, /<h2 id="how-h">What happens after the free review<\/h2>/);
  assert.deepEqual([...how.matchAll(/<li><h3>([^<]+)<\/h3><p>([^<]+)<\/p><\/li>/g)].map((m) => `${m[1]}: ${m[2]}`), [
    'Understand the task: We discuss the repeated work, who handles it and which tools you use.',
    'Map and assess it: I identify duplication, data issues, bottlenecks and checks that should remain.',
    'Agree the work: You receive a written proposal with the fixed project fee, scope, exclusions, estimated timeline and payment schedule. Third-party software, hosting and usage costs are separate.',
    'Build, test and hand over: I build the agreed improvement, test normal cases and exceptions, and show your team how to use it.']);
  const std = how.slice(how.indexOf('class="rr-standards"'));
  assert.match(std, /<h3>What you&rsquo;ll have after handover<\/h3>/);
  assert.match(std, /<p class="rr-standards-intro">Your solution set up in your own accounts and tested against the approved requirements\. You retain account and admin access, and receive editable project files, templates, assets and supported configuration exports; a short run guide; and a 30&ndash;45-minute walkthrough\.<\/p>/);
  assert.match(std, /<p class="rr-standards-cover"><strong>30 calendar days from handover for defect fixes:<\/strong> defects reported in that period that prevent the delivered solution from working as described in the approved scope\.<\/p>/);
  assert.match(std, /<p class="rr-standards-note">This excludes new features, changed requirements, problems caused by post-handover changes, third-party outages or changes, and ongoing maintenance\. Handover explains the agreed checks, exceptions and review steps; licensed components remain subject to provider terms\.<\/p>/);
  const about = section(html, 'about', 'faq');
  assert.match(about, /<p class="about-lead">I&rsquo;m a data and operations specialist with 8\+ years in data, reporting and operational processes\.<\/p>/);
  assert.match(about, /<p>Previous roles included validation, reporting and workflow improvement in data-intensive teams\.<\/p>/);
  assert.match(about, /You work directly with me from the first conversation through handover\. I&rsquo;m based in the Philippines; calls are by video, and the booking calendar shows your local time\./);
  assert.match(about, /View my professional background on LinkedIn/);
  assert.doesNotMatch(about, /data analyst|n8n|Monday to Friday/, 'tool talk and the hours line cut; the calendar shows real availability');
  const faq = section(html, 'faq', 'start');
  assert.deepEqual([...faq.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]),
    ['Will this replace anyone on my team?', 'How much does it cost?', 'How do you protect our information?']);
  assert.match(faq, /<summary>Will this replace anyone on my team\?<\/summary><p>No\. The aim is to reduce repetitive copying, checking and follow-ups so your team can focus on work that needs their attention\.<\/p>/);
  assert.match(faq, /<p>Each project is for one defined improvement\. When requirements and deliverables can be agreed upfront, I quote a fixed project fee, not an open-ended hourly rate\. The fee depends on the work, connected tools, setup, integration and data preparation\.<\/p><p>After the free review, the written proposal sets out the scope, deliverables, inclusions and exclusions, estimated timeline, payment schedule and third-party software, hosting or usage costs, quoted separately\. Nothing starts until you approve the scope and price\.<\/p>/);
  assert.match(faq, /<p>I can work inside your own accounts and tools, and I&rsquo;m happy to sign an NDA and a data processing agreement before handling personal data\. Client project data is never put into free AI tools\.<\/p>/);
  const start = section(html, 'start');
  assert.match(start, /<h2 id="cta-h">Bring me the task your team repeats every week\.<\/h2>/);
  assert.match(start, /<p class="lede">Book a free 30-minute review\. We&rsquo;ll identify the bottleneck and one practical improvement worth investigating\. No obligation\.<\/p>/);
  assert.match(start, /<p class="book-data">No files or logins needed for the first conversation\. Leave out confidential information\.<\/p>/);
  assert.match(start, /<strong>Prefer writing\?<\/strong> Email <a href="mailto:jeffhersonvida@gmail\.com\?subject=Written%20task%20review">jeffhersonvida@gmail\.com<\/a> with the task or a sample with confidential details removed\. I&rsquo;ll send a free one-page written review within 1 working day\. No obligation to book a call afterwards\./);
  assert.match(start, /subject=Written%20task%20review">Get a free written review<\/a>/);
  assert.doesNotMatch(start, /cta-facts|book-outcome|book-sign|customer tracker, website or automation/, 'repeated assurances cut (ChatGPT, 16 Nov)');
  assert.ok(start.indexOf('class="book-data"') < start.indexOf('id="book-inline"'));
  const contact = await read('../contact/index.html');
  assert.match(contact, /<h2>Prefer to write first\?<\/h2>/);
  assert.match(contact, /Describe the task or process your team repeats, or send a sample with confidential details removed\. I&rsquo;ll send a one-page written review within 1 working day, showing where the work gets stuck and what I&rsquo;d improve first\./);
  assert.match(contact, /<a href="mailto:[^"]+\?subject=Written%20task%20review">Request a free written review/);
  assert.doesNotMatch(contact, /Email me a sample report|screenshot of your roster|Written%20report%20review/);
  assert.match(contact, /The first step is a free review\. Bring one task or process your team repeats or that takes too much time\. In 30 minutes, I&rsquo;ll look at how it works, where work gets stuck and what could be simplified or automated\. If it&rsquo;s worth improving, I&rsquo;ll email you a written scope, price and timeline you can share with whoever signs off\. You&rsquo;ll leave with practical recommendations, even if you decide not to work with me\./);
  assert.match(await read('../src/booking/popup.js'), /Just bring one task or process that takes more time than it should\. No preparation needed\. I&rsquo;ll help you understand where the work gets stuck and identify a practical next step\./);
  for (const f of ['../index.html', '../404.html', '../assessment/index.html', '../contact/index.html', '../privacy/index.html']) assert.match(await read(f), /Jeff Herson Vida, AI and Automation Specialist/, f);
});

test('guard rails: no prices, testimonials or invented results; one button wording; only confirmed tools', async () => {
  const html = await page();
  const visible = visibleText(html);
  assert.doesNotMatch(visible, /[$₱€£]\s?\d|\bPHP\s?\d|\bUSD\b|per hour|\/hr\b|testimonial|what (my )?clients say/i);
  assert.doesNotMatch(visible, /100% accurate|detect(s)? every|all errors detected|fully automate everything|finds every problem/i);
  assert.doesNotMatch(visible, /years (of experience )?in AI|AI (automation )?agency|AI expert|Zapier|GoHighLevel|\bGHL\b|Make\.com/i);
  // "We" only where Jeff and the customer act together on the call (ChatGPT copy, approved 17 Nov): the review lede and step 1.
  assert.equal((visible.match(/\bWe&rsquo;ll\b|\bWe discuss\b|\bwe&rsquo;ll\b/g) || []).length, (visible.match(/We&rsquo;ll identify the bottleneck|We discuss the repeated work/g) || []).length, 'no agency-style "we" beyond the approved lines');
  assert.doesNotMatch(html, /Most projects start|Most first projects|first project usually/);
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html', '../src/booking/popup.js', '../src/assistant/rules.js', '../n8n/rework-assistant.json']) {
    const t = await read(f);
    assert.doesNotMatch(t.replace(/Written(%20| )report(%20| )review/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' '), /(report|rework) review/i, f);
  }
  assert.doesNotMatch(html, /\sstyle="/, 'CSP: no inline styles');
  assert.doesNotMatch(html, /<p[^>]*>[^<]*<p[\s>]/, 'no unclosed paragraph');
});
