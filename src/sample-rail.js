// 25 Nov 2026 (preview): sample projects as big tiles, three per row. Hovering a tile shows the short
// version (CSS only); clicking opens a pop-up with Problem / Solution / What improved, How it works,
// the workflow image and the tools used. Without JavaScript the tiles are
// links to the same details, which then show in full below the row.

export function mountSampleRail(doc = document) {
  const track = doc.querySelector('[data-sp-track]');
  const details = doc.querySelector('[data-sp-details]');
  const dlg = doc.getElementById('sp-dialog');
  if (!track || !details) return;
  const tiles = [...track.querySelectorAll('[data-sp-open]')];

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
