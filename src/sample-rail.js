// 25 Nov 2026 (preview, ChatGPT recommendation applied): two groups of tiles (sample projects; live website
// features). Each tile already shows problem, short solution and outcome; hover is only a visual cue.
// Clicking opens a pop-up: business problem → improved process → result → workflow → checks; Previous/Next
// move within the tile's group. Without JavaScript the tiles are
// links to the same details, which then show in full below the row.

export function mountSampleRail(doc = document) {
  const track = doc.querySelector('[data-sp-track]');
  const details = doc.querySelector('[data-sp-details]');
  const dlg = doc.getElementById('sp-dialog');
  if (!track || !details) return;
  const tiles = [...doc.querySelectorAll('[data-sp-open]')]; // solution tiles (sample) and the experience link (exp)

  // --- the pop-up ---
  if (!dlg || typeof dlg.showModal !== 'function') return; // no dialog support: links scroll to the details
  details.hidden = true;
  const body = dlg.querySelector('[data-sp-body]');
  const kicker = dlg.querySelector('#sp-dlg-h');
  let ids = []; let cur = -1; let opener = null;

  const put = (i) => {
    if (cur >= 0) details.append(body.firstElementChild); // move the open article back (keeps its listeners)
    cur = (i + ids.length) % ids.length;
    const art = details.querySelector(`[data-sp-detail="${ids[cur]}"]`);
    body.replaceChildren(art);
    kicker.textContent = ids.length > 1 ? `${art.querySelector('.sp-tag').textContent} · ${cur + 1} of ${ids.length}` : art.querySelector('.sp-tag').textContent;
    dlg.setAttribute('aria-labelledby', `sp-h-${ids[cur]}`);
    body.scrollTop = 0;
    body.focus({ preventScroll: true });
  };
  tiles.forEach((t) => t.addEventListener('click', (e) => {
    e.preventDefault(); opener = t;
    ids = tiles.filter((x) => x.dataset.spGroup === t.dataset.spGroup).map((x) => x.dataset.spOpen);
    put(ids.indexOf(t.dataset.spOpen));
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
