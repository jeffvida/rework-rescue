// The homepage after the 15 Nov 2026 rework (Jeff + ChatGPT decisions, built on preview/final-page), plus the
// 15 Nov service expansion (preview/services-expansion): problem-led hero, five-step flow, Where I can make work
// easier (six tiles), Start with the work (with the three-part visual), proof (own builds, tools, previous-role
// results), How it works, About, FAQ, Book. Copy from Jeff and ChatGPT is checked word for word.
// The guard rails from the earlier rounds stay: no prices, testimonials or invented results; first person; one
// button wording; booking hours match the calendar; the build cards match the n8n workflows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const noDemo = (h) => { // 23 Nov: the weekly report and the job-to-paid replays show fictional sample amounts, not prices
  for (const [open, label] of [['<dialog class="cs eq-dlg rp-dlg"', /Replayed from a real test run with fictional data/], ['<dialog class="cs eq-dlg rp-dlg jp-dlg"', /Fictional business &middot; Test run/]]) {
    const a = h.indexOf(open); if (a < 0) continue; const d = h.slice(a, h.indexOf('</dialog>', a)); assert.match(d, label, 'sample amounts only inside the labelled demo'); h = h.replace(d, '');
  }
  return h;
};

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const page = () => read('../index.html');
const section = (html, id, next) => html.slice(html.indexOf(`id="${id}"`), next ? html.indexOf(`id="${next}"`) : undefined);
const txt = (h) => h.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
const visibleText = (h) => h.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');

test('hero (24 Nov v11, dark, from Jeff\'s reference image 12:40): copy word for word, one booking button, booking note', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('</section>', html.indexOf('<section class="hero')));
  const copy = hero.slice(0, hero.indexOf('<figure'));
  assert.match(copy, /<p class="h5-eyebrow">AI &amp; AUTOMATION FOR BUSINESS OPERATIONS<\/p>/);
  assert.match(copy, /<h1 id="hero-title"><span class="hf-l1">Stop chasing details\.<\/span> <span class="hf-l2"><span class="h5-mark">Get work under control\.<\/span><\/span><\/h1>/);
  assert.match(copy, /<p class="hero-sub">AI reads and organises incoming information\. Automation connects your tools and handles repetitive work, with checks and human approval where needed\.<\/p>/);
  assert.match(copy, /needed\.<\/p>\s*<p class="h5-for"><svg[\s\S]*?<\/svg>For small and growing businesses<\/p>\s*<div class="h5-cta">/, 'audience line with a target icon');
  assert.match(copy, /<div class="h5-cta">\s*<a class="btn btn-primary btn-large h5-book" href="contact\/#contact-form-area"><span class="h5-cal" aria-hidden="true"><svg[\s\S]*?<\/svg><\/span><span class="h5-book-t">Book a free process review<\/span><span class="h5-go" aria-hidden="true"><svg[\s\S]*?<\/svg><\/span><\/a>/, 'same words and link; calendar left, arrow right');
  assert.match(copy, /<p class="hero-note"><svg[\s\S]*?<\/svg>30 minutes &middot; No obligation<\/p>\s*<p class="h5-write"><a href="#written-review">Prefer writing\? Get a free written review within <span class="h5-nw">1 working day <span aria-hidden="true">&rarr;<\/span><\/span><\/a><\/p>/, '24 Nov: written-review option under the booking note');
  assert.ok(html.includes('id="written-review"'), 'hero written-review link has a target');
  assert.doesNotMatch(hero, /How I can help|h5-more/, 'no How I can help link in the hero');
  assert.deepEqual([...hero.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]), ['contact/#contact-form-area', '#written-review'], 'two links only: book, then (24 Nov) the written review');
  assert.equal((hero.match(/class="btn/g) || []).length, 1, 'one button');
  const at = (x) => copy.indexOf(x);
  assert.ok(at('h5-eyebrow') < at('<h1') && at('<h1') < at('hero-sub') && at('hero-sub') < at('h5-for') && at('h5-for') < at('h5-book') && at('h5-book') < at('hero-note'));
  assert.doesNotMatch(hero, /hz-|What you can expect|story-benefits|hero-for|rework review|hx-|hm-|ht-|small and medium-sized businesses/, 'older heroes are gone');
  assert.match(html, /<header class="site-header hdr-dark no-print">/, 'home page header sits on the dark hero ground');
  assert.match(html, /<a class="brand"[^>]*><img class="brand-logo" src="\.\/assets\/brand\/logo-dark-header\.webp"/, 'official logo, dark-background version');
});

test('hero picture (24 Nov v11): Before · Scattered work (3) → AI + Automation (Capture Match Check Organise) → After · Organised operations (5); trust strip', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('</section>', html.indexOf('<section class="hero')));
  const fig = hero.slice(hero.indexOf('<figure'), hero.indexOf('</figure>'));
  assert.match(fig, /<figure class="h5-visual" id="hero-story">\s*<figcaption class="sr-only">[^<]+<\/figcaption>/);
  assert.match(fig, /<p class="h5-pill">Before<\/p>\s*<p class="h5-title">Scattered work<\/p>/);
  assert.deepEqual([...fig.matchAll(/<li class="h5-row h5-b\d"><svg[\s\S]*?<\/svg><span class="h5-t">([^<]+)<\/span><\/li>/g)].map((m) => m[1]), ['Emails &amp; enquiries', 'Spreadsheets &amp; records', 'Forms, requests &amp; invoices']);
  assert.match(fig, /<span class="h5-chip" aria-hidden="true"><svg[\s\S]*?<\/svg><\/span>\s*<p class="h5-name">AI \+ Automation<\/p>/, 'AI chip icon, then the panel name');
  assert.deepEqual([...fig.matchAll(/<li class="h5-step"><svg[\s\S]*?<\/svg><span class="h5-t">([^<]+)<\/span><\/li>/g)].map((m) => m[1]), ['Capture', 'Match', 'Check', 'Organise']);
  assert.match(fig, /<p class="h5-pill">After<\/p>\s*<p class="h5-title">Organised operations<\/p>/);
  assert.deepEqual([...fig.matchAll(/<li class="h5-a\d"><svg[\s\S]*?<\/svg><span>([^<]+)<\/span><\/li>/g)].map((m) => m[1]), ['Enquiries acknowledged, replies ready for approval', 'Customer records updated', 'Follow-ups scheduled', 'Invoices prepared for review', 'Weekly reports ready']);
  assert.equal((fig.match(/class="h5-arrow"/g) || []).length, 2);
  assert.doesNotMatch(txt(fig), /\$\d|%|\d+ (hours?|days?)|saved|Gmail|Outlook|Excel|Xero|QuickBooks/i, 'no figures, results or third-party product names');
  assert.equal((hero.match(/<img /g) || []).length, 0, 'no images: HTML and inline icons only');
  // 24 Nov v12: moving background (decorative, hidden from screen readers)
  assert.match(hero, /<section class="hero hf h5 h11" aria-labelledby="hero-title">\s*<div class="h5-bg" aria-hidden="true"><span class="h5-wave"><\/span>/);
  assert.match(hero, /<div class="h5-bg" aria-hidden="true"><span class="h5-wave"><\/span><\/div>/, '13:05: only the dotted wave is kept');
  assert.doesNotMatch(hero, /h5-net|h5-twk|h5-pulse/, '13:05: network and twinkles removed');
  assert.match(hero.slice(0, hero.indexOf('<div class="container')), /aria-hidden="true"/, 'background is decorative');
  const home0 = await read('../src/home.js');
  assert.match(home0, /mountBackdrop\(\);/, 'the wave pauses off screen');
  assert.ok(hero.indexOf('</figure>') < hero.indexOf('h5-trust'), 'trust strip after the picture');
  const trust = hero.slice(hero.indexOf('<ul class="h5-trust">'));
  assert.deepEqual([...trust.matchAll(/<\/svg><span>([^<]+)<\/span><\/li>/g)].map((m) => m[1]), ['Written scope and price before work starts.', 'You own everything I build.', '30 days of fixes within the agreed scope.']);

  const c = await read('../assets/styles.css');
  const css = c.slice(c.indexOf('/* ===== Hero (24 Nov 2026, v11 dark; v12 moving background)'));
  assert.ok(c.includes('/* ===== Hero (24 Nov 2026, v11 dark; v12 moving background)') && css.length > 3000, 'hero block exists');
  assert.doesNotMatch(c, /Hero \(24 Nov 2026, v5 reference\)|\.h5-st \{|\.h5-logo \{/, 'the v5–v10 hero styles are gone');
  assert.doesNotMatch(c, /\.hz-flow|\.hz-promises|\.hz \{|\.hf-wires|\.hf-bit|\.hm-visual|\.ht-visual/, 'older hero styles are gone');
  // 24 Nov v12: only the decorative background wave keeps moving; everything else runs once
  assert.deepEqual([...css.matchAll(/\.(h5-[a-z]+)[^{]*\{ animation: [^}]*infinite/g)].map((m) => m[1]), ['h5-wave'], 'only the background wave loops');
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference) {'), css.indexOf('@keyframes h5-shine'));
  assert.match(motion, /h5-in/); assert.match(motion, /h5-pop/); assert.match(motion, /h5-lit/); assert.match(motion, /h5-glow/); assert.match(motion, /h5-shine/);
  assert.equal((css.match(/animation:/g) || []).length, (motion.match(/animation:/g) || []).length, 'every animation sits behind reduced-motion');
  assert.match(css, /\.h5 h1 \.hf-l2 \{ color: var\(--h5-mint\); \}/, 'two-tone headline: white, then mint');
  assert.match(css, /\.h5 \.container \{ max-width: none; padding-left: max\(1rem, calc\(\(100% - 70rem\) \/ 2 \+ 1rem\)\)/, 'hero lines up with the header logo');
  assert.match(css, /\.h5 h1 \.hf-l1, \.h5 h1 \.hf-l2 \{ display: block; white-space: nowrap; \}/, 'headline stays on two lines');
  const home = await read('../src/home.js');
  assert.doesNotMatch(home, /mountZones|hero-zones/, 'no hero script; CSS only');
  // closing Book section: the repeated price / ownership ticks are gone, everything else stays
  const start = section(html, 'start');
  assert.match(start, /<ul class="cta-facts"><li>Work directly with me<\/li><\/ul>/);
  assert.doesNotMatch(start, /Written scope and price before any work|You own what I build/);
  assert.match(start, /<h2 id="cta-h">Tell me what you&rsquo;d like to make easier\.<\/h2>/);
  assert.match(start, /id="book-inline"/); assert.match(start, /Get a free written review/);
});

test('23 Nov page review: the Dana Cruz example is gone (it repeated demo ①); the hero has no Today / With panel', async () => {
  const html = await page();
  assert.doesNotMatch(html, /Dana Cruz|id="hero-flow"|svc-example/);
  assert.doesNotMatch(html, /id="hero-visual"|hx-toggle|With Rework Rescue/);
  const home = await read('../src/home.js');
  assert.doesNotMatch(home, /mountFlow|mountHero|hero=panel|get\('hero'\)/);
});
test('Where I can make work easier: six tiles, the customer problem first, then what gets built; 3 / 2 / 1 columns', async () => {
  const sec = section(await page(), 'services', 'approach');
  assert.match(sec, /<p class="eyebrow">How I help<\/p>\s*<h2 id="services-h">Where I can make work easier<\/h2>/);
  assert.deepEqual([...sec.matchAll(/<strong>([^<]+)<\/strong><span>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]), [
    ['Emails piling up', 'AI reads and sorts emails, and tracks each request'],
    ['Information entered repeatedly', 'Details pulled out and records updated automatically'],
    ['Follow-ups getting missed', 'Automatic reminders and follow-ups'],
    ['Requests getting stuck', 'Requests sent to the right person, with approval steps'],
    ['Reports taking hours to prepare', 'Reports pulled together and checked automatically, ready to act on'],
    ['Customer enquiries are hard to manage', 'Enquiries captured, assigned and followed up in one tracker'],
  ]);
  assert.match(sec, /<p class="rr-tracker-note"><strong>What&rsquo;s a customer tracker\?<\/strong> A simple place to record customer enquiries, contact details, request status, who is responsible and what needs following up\.<\/p>/);
  const c = await read('../assets/styles.css');
  assert.match(c, /\.rr-tiles \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(c, /@media \(max-width: 62rem\) \{ \.rr-tiles \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \} \}/);
  assert.match(c, /@media \(max-width: 40rem\) \{\n  \.rr-tiles \{ grid-template-columns: minmax\(0, 1fr\);/);
});

test('approach (20 Nov): folded into How I help as one panel; headline, one short lead, three decision cards; extra paragraphs gone', async () => {
  const html = await page();
  const svc = section(html, 'services', 'built');
  const sec = svc.slice(svc.indexOf('id="approach"'));
  assert.match(sec, /id="approach">\s*<p class="eyebrow">My approach<\/p>\s*<h3 class="rr-approach-h" id="approach-h">Start with the work, not the software\.<\/h3>/);
  assert.match(sec, /<p class="rr-approach-lead">I find where the work gets stuck, then choose the simplest fix\.<\/p>/);
  assert.match(sec, /<h4 class="rr-decide-h">AI or simple automation\? Three questions decide it\.<\/h4>/);
  // 23 Nov: answer pill sits beside the icon on top, so the questions and examples line up across the cards.
  assert.deepEqual([...sec.matchAll(/<p class="rr-d-a">([^<]+)<\/p><\/div><h4>([^<]+)<\/h4><p class="rr-d-eg">([^<]+)<\/p>/g)].map((m) => `${m[2]} | ${m[1]} | ${m[3]}`), [
    'Are the rules clear? | Automation | Form submitted &rarr; tracker updated &rarr; confirmation sent',
    'Does it need reading, like an email or a document? | AI | AI reads an enquiry email and picks out the customer&rsquo;s details',
    'How costly would an error be? | Human review | Hold a customer reply or high-value quote for approval']);
  assert.doesNotMatch(html, /rr-approach-note|rr-approach-more|You care about missed enquiries/, 'repeated paragraphs removed');
  assert.doesNotMatch(html, /<section class="section rr-diff"/, 'no separate approach band');
  assert.doesNotMatch(html, /Automation with checks built in|Automation that checks itself|proprietary|my method|framework/i);
});

test('client expectations (19 Nov): testing line, weekly updates, closing thought; monitoring stays separate', async () => {
  const html = await page();
  const safety = section(html, 'safety', 'how');
  assert.doesNotMatch(safety, /sn-demo|A demo shows the idea/, 'testing line lives in How it works only (20 Nov)');
  assert.doesNotMatch(html, /keeps working/, 'testing is not sold as a guarantee');
  const how = section(html, 'how', 'about');
  assert.match(how, /<div class="rr-updates">\s*<h3>You won&rsquo;t have to guess where things stand\.<\/h3>\s*<p>While your project is active, I&rsquo;ll send a short written update at least once a week covering what&rsquo;s completed, what&rsquo;s next, and anything waiting on your input\. If a blocker is likely to affect the delivery timeline, I&rsquo;ll explain the reason and let you know as soon as I can\.<\/p>/);
  assert.match(html, /How does working remotely work\?<\/summary><p>You and I talk by video call \(Google Meet\), at times shown in your own time zone\.<\/p><\/details>/, "FAQ trimmed; the weekly update stays in How it works (20 Nov)");
  assert.doesNotMatch(html, /progress updates in writing/);
  assert.match(html, /<p class="rr-closing">Knowing the tools matters\. Understanding your business, keeping you informed and delivering something your team can rely on is what makes the work valuable\.<\/p>/);
  assert.match(html, /ongoing monitoring and maintenance\./, 'monitoring stays outside the 30 days');
  assert.doesNotMatch(html, /24\/7|monitoring included|includes monitoring/i);
});

test('proof: own builds first, plain-text tools line, then two short previous-role results with details closed', async () => {
  const html = await page();
  const sec = section(html, 'built', 'safety');
  assert.match(sec, /<span class="anchor" id="samples"><\/span>/, 'old #samples links land here');
  assert.match(sec, /<p class="eyebrow">Demos &amp; examples<\/p>\s*<h2 id="built-h">See it working on this page\.<\/h2>/);
  assert.equal((sec.match(/<li class="built-card[ "]/g) || []).length, 5, 'booking, chat, (21 Nov) the enquiry tracker and the weekly report, (23 Nov) job done to paid');
  for (const t of ['The booking calendar', 'The chat assistant', 'The enquiry tracker', 'The self-checking weekly report', 'From job done to invoice paid']) assert.ok(sec.includes(`<h4>${t}</h4>`), t);
  // 23 Nov: two groups, the CoolFix story first (steps 1-3 in order, step 3 wide), then what runs this site
  const story = sec.slice(sec.indexOf('id="story-h"'), sec.indexOf('id="site-h"'));
  const site = sec.slice(sec.indexOf('id="site-h"'), sec.indexOf('<dialog'));
  assert.match(sec, /<h3 class="built-group-h" id="story-h">Follow one CoolFix customer<\/h3>\s*<p class="built-group-sub">Carla&rsquo;s aircon is leaking\. Follow her from first email to paid, across three workflows\.<\/p>/);
  // 24 Nov quick wins: CoolFix is an example; the demos work with Microsoft 365 too
  assert.match(sec, /across three workflows\.<\/p>\s*<p class="built-group-note">Not an aircon business\? CoolFix is just an example\. The same approach can help service businesses manage enquiries, jobs, follow-ups and invoices\.<\/p>/);
  assert.match(sec, /not client projects\.<\/p>\s*<p class="built-tools">Shown with Google Workspace\. The same workflows can also be built using Microsoft 365 tools such as Outlook, Excel and Power Automate, depending on your setup\.<\/p>/);
  assert.ok(story.indexOf('The enquiry tracker') < story.indexOf('The self-checking weekly report') && story.indexOf('The self-checking weekly report') < story.indexOf('From job done to invoice paid'));
  assert.match(sec, /<h3 class="built-group-h" id="site-h">Running on this site<\/h3>/);
  assert.ok(site.includes('The booking calendar') && site.includes('The chat assistant') && !site.includes('CoolFix'));
  assert.match(sec, /<h2 id="built-h">See it working on this page\.<\/h2>\s*<p class="built-intro">Built and run by me\. Try them: they&rsquo;re real workflows, not client projects\.<\/p>/, '21 Nov: one honest line up top');
  assert.equal((sec.match(/built-status built-status-live">Live on this site</g) || []).length, 2, 'booking and chat run the site');
  assert.equal((sec.match(/built-status">Demo &middot; fictional business</g) || []).length, 3, 'enquiry, report and job-to-paid are demos');
  assert.equal((sec.match(/<figure class="built-shot">/g) || []).length, 4, 'one workflow screenshot per card, inside the steps fold (job to paid: added after the 30 Nov run)');
  for (const m of sec.matchAll(/<img src="(assets\/workflows\/[a-z-]+\.webp)"[^>]*>/g)) { assert.match(m[0], /loading="lazy"/); assert.match(m[0], /alt="Workflow diagram for /); }
  const lists = sec.slice(0, sec.indexOf('<dialog')).replace(/<ul class="built-gets">[\s\S]*?<\/ul>/g, '');
  assert.equal((lists.match(/<li class="built-card/g) || []).length, (lists.match(/<\/li>\s*(<li class="built-card|<\/ul>)/g) || []).length, 'every card is closed');
  // 23 Nov: the "Tools I work with" strip moved to About; each card's tool line sits inside its steps fold.
  const about = section(html, 'about', 'faq');
  assert.match(about, /<p class="rr-tools about-tools"><span>Tools I work with<\/span> n8n &middot; Google Apps Script &middot; Power Automate &middot; Gemini &middot; Google Workspace &middot; Microsoft 365<\/p>/);
  assert.doesNotMatch(about.match(/<p class="rr-tools[^"]*">[\s\S]*?<\/p>/)[0], /Excel|Power Query|Python|Power BI/, 'main strip stays AI and automation');
  assert.doesNotMatch(sec, /class="rr-tools"/);
  assert.doesNotMatch(sec, /<img[^>]+(logo|n8n|gemini)/i, 'tool names as text, no logos');
  for (const card of sec.slice(0, sec.indexOf('rr-results-h')).split(/<li class="built-card/).slice(1)) {
    const fold = card.slice(card.indexOf('<details'), card.indexOf('</details>'));
    assert.match(fold, /<p class="built-tools">/, 'tool line inside the fold');
  }
  assert.doesNotMatch(sec, /The real n8n workflow/, 'no tool name in screenshot captions');
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
  for (const n of ['Google: busy times', 'Google: is it still free?', 'Google: create event + invite', 'Log to Google Sheet', 'Email: 1-day reminder', 'Email: 1-hour reminder', 'Google: move the event', 'Google: cancel the event']) assert.ok(booking.includes(n), n);
  const assistant = await nodes('../n8n/rework-assistant.json');
  for (const n of ['Check request', 'Gemini: reply', 'Check reply', 'Log to Google Sheet']) assert.ok(assistant.includes(n), n);
});

test('section order, nav and removed content', async () => {
  const html = await page();
  const ids = ['services', 'approach', 'built', 'experience', 'safety', 'how', 'about', 'faq', 'start'].map((x) => html.indexOf(`id="${x}"`));
  assert.ok(ids.every((i) => i > 0)); assert.deepEqual([...ids].sort((a, b) => a - b), ids);
  assert.equal((html.match(/<section /g) || []).length, 8, 'hero + seven sections (approach folded into How I help, 20 Nov)');
  assert.ok(html.indexOf('id="approach"') < html.indexOf('</section>', html.indexOf('id="services"')), 'approach panel sits inside How I help');
  const nav = [...html.slice(0, html.indexOf('<main')).matchAll(/<li><a href="#(\w+)">([^<]+)</g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(nav, ['services:How I help', 'built:Demos &amp; examples', 'how:How it works', 'about:About', 'faq:FAQ']);
  assert.doesNotMatch(html, /id="fit"|Sound familiar\?|svc-layer|svc-have|What you get|How I can help/, '24 Nov v9: no How I can help link anywhere (nav keeps "How I help")');
  assert.doesNotMatch(html, /Can you build a website, booking system or CRM\?|No report to send\?|book-assess|Before Rework Rescue/);
  assert.match(html, /<title>Rework Rescue \| Practical AI &amp; Automation for Small Businesses<\/title>/);
  assert.ok(html.includes('<meta property="og:title" content="Rework Rescue | Practical AI &amp; Automation for Small Businesses">'), 'og:title matches the page title');
  const desc = 'Rework Rescue helps small and growing businesses organise information, improve reporting and automate repetitive work with practical AI, connected workflows and human checks.';
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
    'Understand the work: See how the work is done today and where it gets stuck.',
    'Check your tools: Check your existing tools, data and access, and whether they can support the solution.',
    'Written plan and fixed price: What you&rsquo;ll get, what&rsquo;s not included, how it will be tested, the fixed fee and the expected delivery date.',
    'Build and test: Test the usual cases, unusual situations and what happens when something goes wrong.',
    'Handover and 30&#8209;day fixes: Explain the solution, provide documentation and include 30 days of fixes.']);
  const std = how.slice(how.indexOf('class="rr-standards"'));
  assert.match(std, /<h3>What you&rsquo;ll have after handover<\/h3>/);
  assert.doesNotMatch(std, /rr-standards-intro|hs-t1|Handover day/, '23 Nov: filler line and the repeated handover-day row removed');
  assert.doesNotMatch(how, /demo-after-solo/, '23 Nov: no extra booking button inside How it works');
  assert.deepEqual([...std.matchAll(/<li class="hs-\d"><span class="hs-ic"[\s\S]*?<\/span><strong>([^<]+)<\/strong>/g)].map((m) => m[1]),
    ['A working solution', 'Project files and access', 'A practical guide and walkthrough', 'Error alerts and a fix guide']);
  assert.deepEqual([...std.matchAll(/<li class="hs-t\d"><b>([^<]+)<\/b><strong>([^<]+)<\/strong>/g)].map((m) => `${m[1]}: ${m[2]}`),
    ['Days 1&ndash;30: 30 days of fixes', 'After 30 days: It&rsquo;s yours']);
  // 24 Nov quick wins: the repeated failure explanation in How it works is one sentence; the safeguards stay in Checks and control.
  const err = std.slice(std.indexOf('class="hs-err"'), std.indexOf('</div>', std.indexOf('class="hs-err"')));
  assert.match(err, /<p class="hs-err-lead">If something goes wrong, the workflow records the issue, alerts the responsible person and provides a clear next step\.<\/p>/);
  assert.doesNotMatch(std, /hs-ef|hs-alert|Example alert, fictional|If something stops working/, 'detailed alert example removed from How it works');
  assert.doesNotMatch(std, /rr-standards-note/, 'repeat of the Safety net card removed (20 Nov)');
  assert.doesNotMatch(how, /how-scope|sample written scope|Northstar/, 'sample written scope removed (19 Nov)');
  assert.match(how, /No system logins to get started\./);
  assert.doesNotMatch(how, /how-approach/, 'intro paragraphs cut to one line');
  const about = section(html, 'about', 'faq');
  assert.match(about, /<p class="about-lead">I&rsquo;m an operations and data specialist who builds practical AI and automation solutions for small and medium-sized businesses\.<\/p>/);
  assert.match(about, /I have over eight years of experience with data, reporting and day-to-day operations\./);
  assert.doesNotMatch(about, /data analyst/);
  assert.match(about, /I build AI and automation workflows with n8n, and I keep my skills current as the tools change\./);
  assert.match(about, /Based in the Philippines, with call times that fit the US, UK, Europe and Australia\./);
  const faq = section(html, 'faq', 'start');
  assert.deepEqual([...faq.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]), ['What can you automate?', 'What happens if something breaks or a connected app changes?', 'Can you set up a simple CRM, website or landing page?', 'How much does it cost, and is there a written agreement?', 'Can you work with confidential or sensitive information?', 'Will this replace anyone on my team?', 'How do you handle access to our systems?', 'You&#39;re in the Philippines. How does working remotely work?']);
  assert.match(faq, /Not every problem needs AI\./);
  assert.match(faq, /<p>Each project is priced around one clearly defined improvement\. Where the requirements and deliverables can be agreed upfront, I use a fixed project fee rather than an open-ended hourly rate\.<\/p><p>The price depends on the work, which tools need connecting, and any setup or getting your data ready\.<\/p><p>After the free review, you&rsquo;ll get a written proposal showing what you&rsquo;ll get, what&rsquo;s not included, the estimated timeline, payment schedule and any costs for other providers&rsquo; software, hosting or usage\.<\/p>/);
  assert.doesNotMatch(faq, /one report or one process/);
  assert.match(faq, /<p>Yes, when it helps enquiries and customer information flow into one organised place\.<\/p><p>I can build simple, mobile-friendly business websites and landing pages, enquiry forms, and simple customer trackers or CRM setups, using suitable existing tools\.<\/p><p>These can stand alone or connect\. For example, a website enquiry can be added to a customer tracker and trigger a follow-up reminder\.<\/p><p>I focus on clear layouts and practical features rather than complex designs or software\. For online stores, custom applications or advanced CRM systems, I&rsquo;ll explain when a specialist solution is needed\.<\/p>/);
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
  assert.match(html, /<dt>Solution<\/dt><dd>Clients pick a free time\. The invite, video link and reminders go out by themselves\.<\/dd>/, 'booking card: problem, solution, what you get (21 Nov)');
  for (const f of ['../index.html', '../404.html', '../assessment/index.html', '../contact/index.html', '../privacy/index.html']) assert.match(await read(f), /Jeff Herson Vida, AI and Automation Specialist/, f);
  assert.ok(start.indexOf('class="book-data"') < start.indexOf('id="book-inline"'));
});

test('guard rails: no prices, testimonials or invented results; first person; one button wording ("Book a free process review" on every booking button, 19 Nov); only confirmed tools', async () => {
  const html = await page();
  const visible = visibleText(noDemo(html)); // the weekly report demo shows fictional sample amounts, not prices
  assert.doesNotMatch(visible, /[$₱€£]\s?\d|\bPHP\s?\d|\bUSD\b|per hour|\/hr\b|testimonial|what (my )?clients say/i);
  assert.doesNotMatch(visible, /100% accurate|detect(s)? every|all errors detected|fully automate everything|finds every problem/i);
  assert.doesNotMatch(visible, /years (of experience )?in AI|AI (automation )?agency|AI expert|Zapier|GoHighLevel|\bGHL\b|Make\.com/i);
  // 24 Nov: Jeff approved "Small Businesses" in the page title (and its social copy) only
  assert.doesNotMatch(html.replaceAll('Practical AI &amp; Automation for Small Businesses', ''), /\bwe&rsquo;ll\b|\bWe&rsquo;ll\b|small (service )?businesses/i);
  assert.doesNotMatch(html, /Most projects start|Most first projects|first project usually/);
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html', '../src/booking/popup.js', '../src/assistant/rules.js', '../n8n/rework-assistant.json']) {
    const t = await read(f);
    assert.doesNotMatch(t.replace(/Written(%20| )report(%20| )review/g, '').replace(/Book a (free rework |<span class="cta-long">free rework <\/span>)review/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' '), /(report|rework) review/i, f);
  }
  assert.doesNotMatch(html, /\sstyle="/, 'CSP: no inline styles');
  assert.doesNotMatch(html, /<p[^>]*>[^<]*<p[\s>]/, 'no unclosed paragraph');
});

test('middle simplified (20 Nov): after-30-days line visible, bridge line before the numbers, hero on the page container, process review wording', async () => {
  const html = await page();
  const how = section(html, 'how', 'about');
  assert.match(how, /<b>After 30 days<\/b><strong>It&rsquo;s yours<\/strong><span class="how-after">Your solution remains yours\. Ongoing monitoring, maintenance and improvements can be arranged separately\.<\/span><\/li>\s*<\/ol>/, 'visible, not in the dropdown');
  assert.ok(how.indexOf('class="how-after"') < how.indexOf('<details class="fold how-30">'), 'outside the dropdown');
  for (const card of html.split('<li class="rr-result">').slice(1)) assert.ok(card.indexOf('class="exp-bridge"') < card.indexOf('class="rr-nums"'), 'In your business… comes first');
  const css = await read('../assets/styles.css');
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html', '../src/assistant/rules.js', '../n8n/rework-assistant.json', '../n8n/paste-2026-11-19/check-request.js']) {
    const t = await read(f); assert.doesNotMatch(t, /free rework (<\/span>)?review/i, f);
  }
});

test('How I help tiles (20 Nov): own colour per tile, same colour on the open example, click again to close', async () => {
  const html = await page();
  assert.deepEqual([...html.matchAll(/<li data-tile="(\d)"><svg/g)].map((m) => m[1]), ['1', '2', '3', '4', '5', '6']);
  const css = await read('../assets/styles.css');
  for (let i = 1; i <= 6; i++) assert.match(css, new RegExp(`\\.rr-tiles > li\\[data-tile="${i}"\\] \\{ --tc: #[0-9a-f]{6}; --tt: #[0-9a-f]{6}; \\}`));
  const js = await read('../src/tiles.js');
  assert.match(js, /if \(open === i\) \{ close\(\); return; \}/, 'second click closes');
  assert.match(js, /const HIDE = 'Hide example';/);
  assert.match(js, /if \(c === lastCols\) return;/, 'phone scroll no longer replays the panel');
});

test('tile example (20 Nov): closes only by clicking its tile again (or Escape); no Hide button, no click-on-panel', async () => {
  const js = await read('../src/tiles.js');
  assert.match(js, /if \(open === i\) \{ close\(\); return; \}/);
  assert.doesNotMatch(js, /tile-flow-close|panel\.addEventListener\('click'/);
});

test('closed tile example is really hidden (20 Nov bug): no display rule beats [hidden] on the panel', async () => {
  const css = await read('../assets/styles.css');
  assert.match(css, /\.rr-tiles > li\.tile-flow\[hidden\] \{ display: none; \}/);
  assert.ok(css.lastIndexOf('.rr-tiles > li.tile-flow[hidden]') > css.lastIndexOf('.rr-tiles > li.tile-flow {'), 'the hide rule comes after the display rule');
});

test('previous-role examples (20 Nov): slide-in three-step panel; the dropdown stays as the no-JS fallback', async () => {
  const js = await read('../src/casestudy.js');
  assert.match(js, /const STEPS = \['The problem', 'What I built', 'The result'\];/);
  assert.match(js, /dlg\.showModal\(\)/); assert.match(js, /if \(e\.target === dlg\) dlg\.close\(\)/, 'tap outside closes');
  assert.match(js, /cur\.btn\.focus/, 'focus returns to the card');
  assert.doesNotMatch(js, /style\s*=|\.style\./, 'CSP: no inline styles');
  const home = await read('../src/home.js');
  assert.match(home, /mountCaseStudies\(document\.querySelector\('#built \.rr-results'\)\);/);
  const html = await page();
  assert.equal((html.match(/<details class="fold rr-more"><summary>See how it worked<\/summary>/g) || []).length, 2, 'no-JS fallback kept');
  const css = await read('../assets/styles.css');
  assert.match(css, /\.rr-result\.has-cs > details\.rr-more \{ display: none; \}/);
  assert.match(css, /dialog\.cs, dialog\.cs:not\(\[open\]\) \{ inset: 0; margin: auto;/, 'centred on screen');
});
