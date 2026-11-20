// "Examples from my previous roles" (20 Nov, Jeff approved option A): "See how it worked" opens a slide-in panel
// (a bottom sheet on phones) with a three-step mini presentation: The problem / What I built / The result.
// The page stays where it was; closing (✕, Escape, tapping outside) returns focus to the card's button.
// The content is copied from each card's own <details>, which stays in the HTML as the no-JavaScript fallback,
// so nothing new is claimed here. CSP: no inline styles; the only markup set as HTML is the fixed frame below.

const STEPS = ['The problem', 'What I built', 'The result'];

const FRAME = `
  <div class="cs-sheet">
    <header class="cs-head">
      <p class="cs-k">Example from a previous role</p>
      <h3 class="cs-title" id="cs-title"></h3>
      <button type="button" class="cs-close" aria-label="Close">&times;</button>
      <ol class="cs-steps">${STEPS.map((s, i) => `<li><button type="button" data-cs-go="${i}"><span aria-hidden="true">${i + 1}</span>${s}</button></li>`).join('')}</ol>
    </header>
    <div class="cs-body" tabindex="-1"></div>
    <footer class="cs-foot">
      <button type="button" class="btn btn-quiet cs-back">&larr; Back</button>
      <p class="cs-count" aria-live="polite"></p>
      <button type="button" class="btn btn-primary cs-next">Next &rarr;</button>
    </footer>
  </div>`;

const pick = (root, sel) => { const el = root.querySelector(sel); return el ? el.cloneNode(true) : null; };

export function mountCaseStudies(list) {
  if (!list || typeof HTMLDialogElement !== 'function') return;
  const cards = [...list.querySelectorAll(':scope > .rr-result')];
  if (!cards.length) return;

  const dlg = document.createElement('dialog');
  dlg.className = 'cs';
  dlg.setAttribute('aria-labelledby', 'cs-title');
  dlg.innerHTML = FRAME; // fixed markup from this file only
  document.body.append(dlg);
  const title = dlg.querySelector('.cs-title');
  const body = dlg.querySelector('.cs-body');
  const back = dlg.querySelector('.cs-back');
  const next = dlg.querySelector('.cs-next');
  const count = dlg.querySelector('.cs-count');
  const tabs = [...dlg.querySelectorAll('[data-cs-go]')];

  // Build each card's three steps from its own content.
  const stories = cards.map((card) => {
    const d = card.querySelector('details.rr-more');
    if (!d) return null;
    const intro = d.querySelector(':scope > p');
    const step = (...nodes) => nodes.filter(Boolean);
    const cta = document.createElement('p');
    cta.className = 'cs-cta';
    const a = document.createElement('a');
    a.className = 'btn btn-primary';
    a.href = 'contact/#contact-form-area';
    a.textContent = 'Book a free process review';
    a.addEventListener('click', () => dlg.close());
    cta.append(a);
    const story = {
      title: card.querySelector('h4')?.textContent || '',
      steps: [
        step(intro && intro.cloneNode(true), pick(d, '.fpanel-before')),
        step(pick(d, '.fpanel-after'), pick(d, '.built-tools')),
        step(pick(card, '.rr-nums'), pick(d, '.exp-sample'), pick(card, '.exp-bridge'), pick(d, '.exp-more'), cta),
      ],
    };
    // The card: "See how it worked" becomes a button that opens the panel; the dropdown stays for no-JS only.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rr-open';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.textContent = 'See how it worked';
    d.before(btn);
    card.classList.add('has-cs');
    story.btn = btn;
    btn.addEventListener('click', () => open(story));
    return story;
  }).filter(Boolean);
  if (!stories.length) return;

  let cur = null;
  let at = 0;

  function show(i) {
    at = Math.max(0, Math.min(STEPS.length - 1, i));
    body.replaceChildren(...cur.steps[at].map((n) => n.cloneNode(true)));
    body.querySelector('.cs-cta a')?.addEventListener('click', () => dlg.close());
    tabs.forEach((t, n) => { t.setAttribute('aria-current', n === at ? 'step' : 'false'); t.parentElement.classList.toggle('is-done', n < at); });
    back.hidden = at === 0;
    next.hidden = at === STEPS.length - 1;
    count.textContent = `Step ${at + 1} of ${STEPS.length}: ${STEPS[at]}`;
    body.scrollTop = 0;
    body.classList.remove('is-in'); void body.offsetWidth; body.classList.add('is-in');
  }

  function open(story) {
    cur = story;
    title.textContent = story.title;
    show(0);
    document.documentElement.classList.add('cs-lock');
    dlg.showModal();
    dlg.querySelector('.cs-close').focus();
  }

  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('cs-lock');
    if (cur) cur.btn.focus({ preventScroll: true });
  });
  dlg.querySelector('.cs-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // tap outside the sheet
  back.addEventListener('click', () => show(at - 1));
  next.addEventListener('click', () => show(at + 1));
  tabs.forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.csGo))));
  dlg.addEventListener('keydown', (e) => {
    if (e.target.closest('summary, a, input')) return;
    if (e.key === 'ArrowRight') show(at + 1);
    if (e.key === 'ArrowLeft') show(at - 1);
  });
  // Swipe between steps on phones.
  let x0 = null;
  body.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  body.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 60) show(at + (dx < 0 ? 1 : -1));
  }, { passive: true });
}
