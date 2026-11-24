// 25 Nov 2026 (preview): sample projects as one sideways-scrolling row with floating arrows.
// Tapping a project opens a pop-up with Problem / Solution / What improved, a simple
// "How it works" flow, a picture and the technical side. Without JavaScript the tiles are
// links to the same details, which then show in full below the row.

export function mountSampleRail(doc = document) {
  const track = doc.querySelector('[data-sp-track]');
  const details = doc.querySelector('[data-sp-details]');
  const dlg = doc.getElementById('sp-dialog');
  if (!track || !details) return;
  const prev = doc.querySelector('[data-sp-prev]');
  const next = doc.querySelector('[data-sp-next]');
  const dots = doc.querySelector('[data-sp-dots]');
  const tiles = [...track.querySelectorAll('[data-sp-open]')];

  // --- the row: arrows and dots ---
  const step = () => (track.querySelector('.sp-item')?.getBoundingClientRect().width || 280) + 16;
  const sync = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.hidden = track.scrollLeft <= 2;
    next.hidden = track.scrollLeft >= max;
    const at = Math.round(track.scrollLeft / step());
    dots?.querySelectorAll('span').forEach((d, i) => d.classList.toggle('is-on', i === Math.min(at, tiles.length - 1)));
  };
  prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  if (dots) { dots.innerHTML = tiles.map(() => '<span></span>').join(''); dots.hidden = false; }
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  addEventListener('resize', sync);
  sync();

  // --- the pop-up ---
  if (!dlg || typeof dlg.showModal !== 'function') return; // no dialog support: links scroll to the details
  details.hidden = true;
  const body = dlg.querySelector('[data-sp-body]');
  const kicker = dlg.querySelector('#sp-dlg-h');
  const ids = tiles.map((t) => t.dataset.spOpen);
  let cur = -1; let opener = null;

  const put = (i) => {
    if (cur >= 0) details.append(body.firstElementChild); // move the open article back (keeps its listeners)
    cur = (i + ids.length) % ids.length;
    const art = details.querySelector(`[data-sp-detail="${ids[cur]}"]`);
    body.replaceChildren(art);
    kicker.textContent = `${cur + 1} of ${ids.length}`;
    dlg.setAttribute('aria-labelledby', `sp-h-${ids[cur]}`);
    body.scrollTop = 0;
    body.focus({ preventScroll: true });
  };
  tiles.forEach((t, i) => t.addEventListener('click', (e) => {
    e.preventDefault(); opener = t; put(i);
    doc.documentElement.classList.add('cs-lock');
    dlg.showModal();
  }));
  dlg.querySelectorAll('[data-sp-step]').forEach((b) => b.addEventListener('click', () => put(cur + Number(b.dataset.spStep))));
  dlg.querySelector('[data-sp-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  // Links that leave the pop-up (booking page, chat assistant) close it first.
  body.addEventListener('click', (e) => { if (e.target.closest('[data-sp-leave]')) dlg.close(); });
  dlg.addEventListener('close', () => {
    if (cur >= 0) { details.append(body.firstElementChild); cur = -1; }
    doc.documentElement.classList.remove('cs-lock');
    opener?.focus({ preventScroll: true });
  });
}
