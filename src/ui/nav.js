// Phone menu. On narrow screens the main navigation collapses behind a "Menu" button.
// Without JavaScript the links stay visible as one row that scrolls sideways (see styles.css).

const header = document.querySelector('.site-header');
const toggle = header && header.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');

if (header && toggle && nav) {
  header.classList.add('nav-ready');
  toggle.hidden = false;

  const setOpen = (open) => {
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('nav-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

// Logo: on the page it links to (the homepage), scroll back to the top instead of reloading.
// On every other page it is an ordinary link to the top of the homepage.
const brandLink = document.querySelector('.site-header .brand');
if (brandLink) {
  brandLink.addEventListener('click', (event) => {
    try {
      const target = new URL(brandLink.getAttribute('href'), location.href);
      const clean = (path) => path.replace(/index\.html$/, '');
      if (clean(target.pathname) !== clean(location.pathname)) return;
      event.preventDefault();
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      if (header) { header.classList.remove('nav-open'); if (toggle) toggle.setAttribute('aria-expanded', 'false'); }
    } catch { /* fall back to the normal link */ }
  });
}

// Carry utm_source / utm_medium / utm_campaign from this page's address into links to the assessment,
// so a shared assessment can record where the visitor came from. Nothing is stored.
try {
  const params = new URLSearchParams(location.search);
  const keep = new URLSearchParams();
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach((k) => { if (params.get(k)) keep.set(k, params.get(k).slice(0, 100)); });
  if ([...keep].length) {
    document.querySelectorAll('a[href*="assessment/"]').forEach((a) => {
      // Keep the link relative (the site may be served from a sub-folder); only add the query string.
      const href = a.getAttribute('href');
      const [base, hash = ''] = href.split('#');
      const [path, query = ''] = base.split('?');
      const merged = new URLSearchParams(query);
      keep.forEach((v, k) => merged.set(k, v));
      a.setAttribute('href', `${path}?${merged.toString()}${hash ? `#${hash}` : ''}`);
    });
  }
} catch { /* never break navigation */ }
