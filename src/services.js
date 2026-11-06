// "What I help with": on wide screens the three services become a list you can pick from (left)
// and one panel with that service's details and its sample-data preview (right).
// On phones, and without JavaScript, the three services stay stacked, each with its preview,
// and a preview plays once when it scrolls into view.

const WIDE = '(min-width: 52.01rem)';

export function mountServices() {
  const list = document.querySelector('#services .svc-flow');
  if (!list) return;
  const items = [...list.querySelectorAll(':scope > .svc-step')];
  if (!items.length) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const play = (li) => {
    const fig = li.querySelector('.svc-preview');
    if (!fig || reduce) return;
    fig.classList.remove('is-playing');
    void fig.getBoundingClientRect(); // restart the CSS animation
    fig.classList.add('is-playing');
  };

  // Phones: play each preview once when it comes on screen.
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || list.classList.contains('is-tabbed')) return;
        play(e.target.closest('.svc-step'));
        io.unobserve(e.target);
      });
    }, { threshold: 0.4 });
    items.forEach((li) => { const fig = li.querySelector('.svc-preview'); if (fig) io.observe(fig); });
  }

  // Wide screens: a tab list built from the service names.
  const tabs = document.createElement('div');
  tabs.className = 'svc-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-orientation', 'vertical');
  tabs.setAttribute('aria-label', 'Services');
  const buttons = items.map((li, i) => {
    const name = li.querySelector('h3')?.textContent || '';
    const when = li.querySelector('.svc-when')?.textContent || '';
    li.id = li.id || `svc-panel-${i + 1}`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `svc-tab ${[...li.classList].find((c) => /^svc-(data|workflow|systems)$/.test(c)) || ''}`;
    b.id = `svc-tab-${i + 1}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', li.id);
    const n = document.createElement('span'); n.className = 'svc-tab-n'; n.textContent = `0${i + 1}`;
    const t = document.createElement('span'); t.className = 'svc-tab-name'; t.textContent = name;
    const w = document.createElement('span'); w.className = 'svc-tab-when'; w.textContent = when;
    b.append(n, t, w);
    tabs.append(b);
    return b;
  });

  let current = 0;
  const select = (i, focus) => {
    current = i;
    buttons.forEach((b, k) => {
      const on = k === i;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      items[k].hidden = !on;
    });
    if (focus) buttons[i].focus();
    play(items[i]);
  };

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => select(i, false));
    b.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (e.key in keys) { e.preventDefault(); select((current + keys[e.key] + items.length) % items.length, true); }
      else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      else if (e.key === 'End') { e.preventDefault(); select(items.length - 1, true); }
    });
  });

  const wrap = document.createElement('div');
  wrap.className = 'svc-ui';
  list.before(wrap);
  wrap.append(tabs, list);

  const mq = typeof matchMedia === 'function' ? matchMedia(WIDE) : null;
  const apply = () => {
    const wide = !!(mq && mq.matches);
    wrap.classList.toggle('is-tabbed', wide);
    list.classList.toggle('is-tabbed', wide);
    if (wide) list.setAttribute('role', 'presentation'); else list.removeAttribute('role');
    tabs.hidden = !wide;
    items.forEach((li, k) => {
      if (wide) { li.setAttribute('role', 'tabpanel'); li.setAttribute('aria-labelledby', buttons[k].id); li.tabIndex = 0; }
      else { li.removeAttribute('role'); li.removeAttribute('aria-labelledby'); li.removeAttribute('tabindex'); li.hidden = false; }
    });
    if (wide) select(current, false);
  };
  if (mq) (mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply));
  apply();
}
