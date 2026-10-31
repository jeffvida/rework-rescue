// Hero demo: Friday's three messy exports, a "Run the checks" button, then the finished report card.
// The finished card is plain HTML in index.html (what visitors see without JavaScript); this script adds the
// "before" panel and the short run in between. It runs once on its own after a few seconds if nobody presses
// the button, so people who only glance still see the result. Figures match src/sample (example 1).

const FILES = [
  { name: 'job-tracker.csv', rows: 140, issue: 'A job listed twice, a date that doesn’t exist' },
  { name: 'invoices.csv', rows: 118, issue: 'An invoice with no job number' },
  { name: 'customers.xlsx', rows: 96, issue: 'A customer with no email address' },
];
const STEPS = ['Tidy the formats', 'Match jobs, invoices and customers', 'List only what needs a person'];
const AUTO_RUN_MS = 3500;

export function mountHeroDemo() {
  const fig = document.querySelector('.hero-preview');
  const link = fig && fig.querySelector('.hp-link');
  if (!fig || !link) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  const panel = document.createElement('div');
  panel.className = 'hd';
  panel.innerHTML = `
    <div class="hd-before">
      <p class="hd-title">Friday, before the weekly report</p>
      <ul class="hd-files">
        ${FILES.map((f) => `<li><span class="hd-file">${f.name}</span><span class="hd-rows">${f.rows} rows</span><span class="hd-issue">${f.issue}</span></li>`).join('')}
      </ul>
      <p class="hd-ask">354 rows across three files. Somewhere in there is money that hasn&rsquo;t been invoiced.</p>
      <button type="button" class="btn btn-primary hd-run">Run the checks</button>
    </div>
    <div class="hd-running" hidden>
      <p class="hd-title">Checking 354 rows</p>
      <ol class="hd-steps">${STEPS.map((s) => `<li>${s}</li>`).join('')}</ol>
    </div>`;
  fig.insertBefore(panel, link);

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'hd-again';
  again.textContent = 'Run it again';
  fig.querySelector('.hp-cap')?.append(' ', again);

  const before = panel.querySelector('.hd-before');
  const running = panel.querySelector('.hd-running');
  const steps = [...panel.querySelectorAll('.hd-steps li')];
  const live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  fig.append(live);

  let busy = false;
  let timer = null;
  const show = (state) => {
    fig.dataset.state = state;
    before.hidden = state !== 'before';
    running.hidden = state !== 'running';
    panel.hidden = state === 'after';
    link.hidden = state !== 'after';
  };

  async function run() {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    steps.forEach((s) => s.classList.remove('is-done'));
    show('running');
    for (const s of steps) { await wait(450); s.classList.add('is-done'); }
    await wait(300);
    show('after');
    const card = link.querySelector('.hp-card');
    card.classList.remove('hp-reveal');
    void card.offsetWidth; // restart the reveal
    card.classList.add('hp-reveal');
    live.textContent = 'Checks finished: $4,380 of completed work not invoiced, 12 items for a person to review.';
    busy = false;
  }

  panel.querySelector('.hd-run').addEventListener('click', run);
  again.addEventListener('click', () => {
    if (busy) return;
    show('before');
    panel.querySelector('.hd-run').focus();
  });

  show('before');
  // Run once on its own, but only while the hero is on screen and nobody has pressed anything yet.
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { timer = setTimeout(run, AUTO_RUN_MS); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(fig);
  } else {
    timer = setTimeout(run, AUTO_RUN_MS);
  }
}
