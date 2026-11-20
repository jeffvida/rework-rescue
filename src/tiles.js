// "Where I can make work easier" — the six tiles open into a short example workflow (Jeff + ChatGPT, 17 Nov 2026).
// Tap or click a tile: a panel opens right under that tile's row with four plain steps and the one safeguard that
// matters most for that kind of work. Tap the same tile again (or Escape) to close it. The tile wording is unchanged.
// Without JavaScript the tiles stay as plain cards. Examples only: no prices, no savings figures, no promises.
// CSP: classes and attributes only.

export const FLOWS = [
  {
    steps: ['An email arrives in the shared inbox', 'AI reads it and labels it: request, question, invoice or other', 'Requests are logged with an owner', 'Unclear emails are set aside for a person'],
    net: 'If the AI isn’t sure, the email waits for a person instead of being guessed.',
  },
  {
    steps: ['Details arrive once, by form, email or export', 'Required fields are checked', 'The record is created or updated in your tracker', 'Duplicates and gaps are flagged'],
    net: 'A record that already exists is updated, not entered twice.',
  },
  {
    steps: ['The task is logged with an owner and a due date', 'A reminder goes out before it’s due', 'Overdue items are listed for the owner each morning', 'The owner decides the next step'],
    net: 'If a reminder can’t be sent, the owner is told instead of it failing quietly.',
  },
  {
    steps: ['A request is submitted', 'It goes to the person who approves that kind of request', 'A reminder follows if nobody acts', 'It’s approved, or returned with a reason'],
    net: 'Requests missing key details go back before they reach the approver.',
  },
  {
    steps: ['Data is pulled from your sources on a schedule', 'Missing or unusual figures are checked', 'The report is built in the same format every time', 'You review it and share it'],
    net: 'If a source is empty or totals don’t match, the report is held and you’re told.',
  },
  {
    steps: ['A customer fills in the form on your website or landing page', 'The enquiry is added to your customer tracker', 'An owner is assigned and a follow-up reminder is set', 'You reply and track it to a decision'],
    net: 'If saving to the tracker fails, the enquiry is kept and you’re alerted, so it isn’t silently missed.',
  },
];

const SHOW = 'See how it could work';
const HIDE = 'Hide example';

const SHIELD = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.6 12.2l2.3 2.3 4.5-4.6"/></svg>';

export function mountTiles(list) {
  if (!list) return;
  const items = [...list.querySelectorAll(':scope > li')];
  if (items.length !== FLOWS.length) return;
  const hint = list.parentElement.querySelector('.rr-tiles-hint');
  if (hint) hint.hidden = false;
  list.classList.add('is-interactive');

  // One shared panel, moved to sit under the opened tile's row.
  const panel = document.createElement('li');
  panel.className = 'tile-flow';
  panel.id = 'tile-flow';
  panel.hidden = true;
  panel.setAttribute('aria-live', 'polite');

  const buttons = items.map((li, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rr-tile';
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', 'tile-flow');
    b.append(...li.childNodes);
    const more = document.createElement('em');
    more.className = 'rr-tile-more';
    more.setAttribute('aria-hidden', 'true');
    more.textContent = SHOW;
    b.append(more);
    li.append(b);
    // The button's own aria-expanded is the source of truth: if this tile is showing its example, close it.
    b.addEventListener('click', () => { if (b.getAttribute('aria-expanded') === 'true') close(); else toggle(i); });
    return b;
  });

  let open = -1;
  const cols = () => {
    const t = getComputedStyle(list).gridTemplateColumns;
    return Math.max(1, t && t !== 'none' ? t.split(' ').length : 1);
  };

  function render(i) {
    const f = FLOWS[i];
    const title = items[i].querySelector('strong')?.textContent || '';
    panel.replaceChildren();
    const k = document.createElement('p'); k.className = 'tile-flow-k'; k.textContent = `How it could work: ${title.toLowerCase()}`;
    const ol = document.createElement('ol'); ol.className = 'tile-flow-steps';
    f.steps.forEach((s) => { const li = document.createElement('li'); li.textContent = s; ol.append(li); });
    const net = document.createElement('p'); net.className = 'tile-flow-net';
    net.innerHTML = SHIELD; // fixed icon markup from this file, never visitor text
    const strong = document.createElement('strong'); strong.textContent = 'Built-in check: ';
    const words = document.createElement('span'); words.className = 'tile-flow-net-t';
    words.append(strong, f.net);
    net.append(words);
    panel.append(k, ol, net);
  }

  function toggle(i) {
    if (open === i) { close(); return; }
    open = i;
    buttons.forEach((b, n) => {
      b.setAttribute('aria-expanded', String(n === i));
      b.parentElement.classList.toggle('is-open', n === i);
      b.querySelector('.rr-tile-more').textContent = n === i ? HIDE : SHOW;
    });
    panel.dataset.tile = String(i + 1); // matches the tile's colour
    render(i);
    const per = cols();
    const rowEnd = Math.min(items.length - 1, Math.floor(i / per) * per + per - 1);
    items[rowEnd].after(panel);
    panel.hidden = false;
    panel.classList.remove('is-in'); void panel.offsetWidth; panel.classList.add('is-in');
  }

  function close() {
    open = -1;
    panel.hidden = true;
    buttons.forEach((b) => { b.setAttribute('aria-expanded', 'false'); b.parentElement.classList.remove('is-open'); b.querySelector('.rr-tile-more').textContent = SHOW; });
  }

  list.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open > -1) { const b = buttons[open]; close(); b.focus(); } });
  // Only move the panel when the number of columns changes. Phones fire resize while scrolling
  // (the address bar shows and hides), which used to replay the panel and make it flicker.
  let lastCols = cols();
  window.addEventListener('resize', () => {
    const c = cols();
    if (c === lastCols) return;
    lastCols = c;
    if (open > -1) { const i = open; open = -1; toggle(i); }
  });
}
