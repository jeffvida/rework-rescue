// Homepage chat assistant: a floating icon (desktop), an "Ask" button in the phone booking bar, a one-time
// invitation, and the chat window. Replies come from the n8n workflow (n8n/rework-assistant.json).
//
// - Only appears when site-config.js has assistantUrl. Until then the page looks exactly as before.
// - Preview mode: add ?assistant=preview to the address to see the widget with sample replies (no AI, nothing sent).
// - The conversation lives in this page's memory only. Nothing is stored in the browser except "invitation seen".
// - It never books: "Book a free review" opens the normal booking pop-up (src/booking/popup.js, via data-book).
import { SITE } from '../../site-config.js';
import { ASSISTANT_TEXT as T, ASSISTANT_LIMITS as L } from './rules.js';

const INVITE_KEY = 'rr-assistant-invite-seen';
const INVITE_DELAY_MS = 45000;
const INVITE_SHOW_MS = 8000;

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((k) => k && n.append(k));
  return n;
};
const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode: fine */ } },
};
/** A random ID for this chat, e.g. "rr-k3f9q2ab". Only used to group this chat's rows in the log. */
const newConversationId = () => {
  const a = new Uint8Array(8);
  try { crypto.getRandomValues(a); } catch { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
  return `rr-${[...a].map((b) => (b % 36).toString(36)).join('')}`;
};
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Calls the n8n workflow. Never throws; returns the reply object or null. */
async function askLive(url, payload) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 25000) : null;
  try {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined,
    });
    const data = await res.json().catch(() => null);
    return data && typeof data.reply === 'string' ? data : null;
  } catch { return null; } finally { if (timer) clearTimeout(timer); }
}

/** Preview mode: canned replies so the layout can be reviewed before the workflow is connected. */
async function askPreview(payload) {
  await new Promise((r) => setTimeout(r, 700));
  const asked = payload.history.filter((t) => t.role === 'assistant' && t.stage === 'asking').length;
  if (asked === 0) return { reply: 'Thanks. Roughly how often does that happen, and what usually goes wrong?', stage: 'asking', service: null, serviceLabel: '', bookService: '', showBooking: false };
  const said = [...payload.history.filter((t) => t.role === 'user').map((t) => t.content), payload.message].join(' ').toLowerCase();
  const pick = /tool|website|form|calendar|crm|system|talk/.test(said) ? ['systems', 'Business Tools & Systems', 'systems']
    : /task|follow|call|crack|handoff|remind|copy/.test(said) ? ['workflow', 'Workflows & Processes', 'workflow']
      : ['data_reporting', 'Data & Reporting', 'data'];
  return { reply: `That sounds like ${pick[1]}. In a free 30-minute review, Jeff can look at where it goes wrong with you and suggest a practical next step. Want to pick a time?`, stage: 'suggested', service: pick[0], serviceLabel: pick[1], bookService: pick[2], showBooking: true };
}

export function mountAssistant({ base = './' } = {}) {
  const preview = !SITE.assistantUrl && /(?:^|[?&])assistant=preview(?:&|$)/.test(location.search);
  if (!SITE.assistantUrl && !preview) return null;
  const ask = preview ? askPreview : (p) => askLive(SITE.assistantUrl, p);
  const icon = (size) => `${base}assets/brand/assistant-${size}.svg`;

  // ---- Floating button and invitation (one shape: the invitation grows out of the icon)
  const fab = el('button', { type: 'button', class: 'ast-fab', 'aria-expanded': 'false', 'aria-controls': 'ast-panel', 'aria-label': 'Open the Rework Rescue assistant' },
    el('img', { src: icon('48'), width: '56', height: '56', alt: '' }));
  // Two deliberate lines: the question, then the offer.
  const [inviteQ, inviteA] = T.invite.split(/(?<=\?)\s+/);
  const inviteText = el('button', { type: 'button', class: 'ast-invite-text' }, el('span', { text: inviteQ }), inviteA && el('span', { text: inviteA }));
  const inviteClose = el('button', { type: 'button', class: 'ast-invite-close', 'aria-label': 'Dismiss' }, el('span', { 'aria-hidden': 'true', text: '×' }));
  const invite = el('div', { class: 'ast-invite', role: 'status', hidden: true }, inviteText, inviteClose);
  const dock = el('div', { class: 'ast-dock no-print' }, invite, fab);

  // ---- Chat window
  const log = el('div', { class: 'ast-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const starters = el('div', { class: 'ast-starters' }, T.starters.map((s, i) => el('button', { type: 'button', class: 'ast-chip', 'data-starter': String(i), text: s })));
  const input = el('textarea', { class: 'ast-input', rows: '1', maxlength: String(L.maxChars), 'aria-label': 'Your message', placeholder: 'Type your message' });
  const trap = el('input', { type: 'text', name: 'website', class: 'ast-trap', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
  const send = el('button', { type: 'submit', class: 'ast-send', 'aria-label': 'Send' }, el('span', { 'aria-hidden': 'true', text: '➤' }));
  const form = el('form', { class: 'ast-form' }, input, trap, send);
  const closeBtn = el('button', { type: 'button', class: 'ast-close', 'aria-label': 'Close the assistant' }, el('span', { 'aria-hidden': 'true', text: '×' }));
  const panel = el('section', { id: 'ast-panel', class: 'ast-panel no-print', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'ast-title', hidden: true },
    el('header', { class: 'ast-head' },
      el('span', { class: 'ast-avatar' }, el('img', { src: icon('24'), width: '24', height: '24', alt: '' })),
      el('div', { class: 'ast-head-text' }, el('h2', { id: 'ast-title', class: 'ast-title', text: T.title }),
        el('p', { class: 'ast-sub', text: preview ? 'Preview: sample replies, not the live AI' : T.subtitle })),
      closeBtn),
    el('div', { class: 'ast-body' },
      el('div', { class: 'ast-welcome' }, el('img', { src: icon('full'), width: '64', height: '64', alt: '' }),
        el('p', { class: 'ast-msg ast-msg-bot', text: T.opening })),
      starters, log),
    form,
    el('p', { class: 'ast-note', text: T.disclaimer }));

  document.body.append(dock, panel);
  const mobileAsk = document.querySelector('[data-assistant-ask]');
  document.querySelectorAll('[data-assistant-only]').forEach((n) => { n.hidden = false; });

  // ---- State: the conversation, in memory only
  const history = [];
  const conversation = newConversationId();
  let busy = false;
  let opener = fab;

  const setOpen = (open, from) => {
    if (open) {
      opener = from || fab;
      hideInvite(true);
      panel.hidden = false;
      document.documentElement.classList.add('ast-open');
      fab.setAttribute('aria-expanded', 'true');
      if (mobileAsk) mobileAsk.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => (history.length ? input : starters.querySelector('button') || input).focus());
    } else {
      panel.hidden = true;
      document.documentElement.classList.remove('ast-open');
      fab.setAttribute('aria-expanded', 'false');
      if (mobileAsk) mobileAsk.setAttribute('aria-expanded', 'false');
      if (opener && opener.isConnected && opener.offsetParent !== null) opener.focus(); else fab.focus();
    }
  };

  const scrollDown = () => { const b = panel.querySelector('.ast-body'); b.scrollTop = b.scrollHeight; };
  const addBubble = (role, text) => { log.append(el('p', { class: `ast-msg ast-msg-${role === 'user' ? 'me' : 'bot'}`, text })); scrollDown(); };
  const addBooking = (service) => {
    const b = el('button', { type: 'button', class: 'btn btn-primary ast-book', 'data-book': true, 'data-book-service': service || '', text: T.book });
    // Close the chat first; the click then reaches the booking pop-up's own listener.
    b.addEventListener('click', () => setOpen(false));
    log.append(el('div', { class: 'ast-book-row' }, b));
    scrollDown();
  };
  const lockInput = (text) => { input.disabled = true; send.disabled = true; input.placeholder = text; };

  async function submit(text) {
    const message = String(text || '').trim();
    if (busy || !message) return;
    if (message.length < L.minChars) { addBubble('bot', 'Could you tell me a little more?'); return; }
    busy = true;
    starters.hidden = true;
    addBubble('user', message);
    input.value = '';
    send.disabled = true;
    const typing = el('p', { class: 'ast-msg ast-msg-bot ast-typing', 'aria-label': 'The assistant is typing' }, el('span'), el('span'), el('span'));
    log.append(typing); scrollDown();

    const data = await ask({ message, history: history.slice(), conversation, website: trap.value });
    typing.remove();
    const r = data || { reply: T.error, stage: 'notice', showBooking: true, bookService: '' };
    history.push({ role: 'user', content: message });
    if (r.stage !== 'notice') history.push({ role: 'assistant', content: r.reply, stage: r.stage });
    addBubble('bot', r.reply);
    if (r.showBooking) addBooking(r.bookService);
    busy = false;
    send.disabled = false;
    if (history.filter((t) => t.role === 'user').length >= L.maxMessages) lockInput('This chat has reached its limit');
    else input.focus();
  }

  // ---- Wiring
  fab.addEventListener('click', () => setOpen(panel.hidden, fab));
  closeBtn.addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(input.value); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(input.value); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; });
  starters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-starter]');
    if (!b) return;
    if (b.dataset.starter === String(T.starters.length - 1)) { starters.hidden = true; input.placeholder = 'Type your question'; input.focus(); return; }
    submit(b.textContent);
  });
  // Any "Ask the assistant" link or the phone bar's Ask button opens the chat.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-assistant-open]');
    if (!t) return;
    e.preventDefault();
    setOpen(true, t);
  });

  // ---- Invitation: once per visit, after the live example (or, on pages without it, the hero) has been scrolled past,
  // or after 45 seconds. It hides itself after 8 seconds unless the visitor is pointing at it or focused in it,
  // so it never sits over the content for long. Never opens the chat itself.
  let inviteTimer = null;
  let inviteHideTimer = null;
  function hideInvite(seen) {
    if (inviteTimer) { clearTimeout(inviteTimer); inviteTimer = null; }
    if (inviteHideTimer) { clearTimeout(inviteHideTimer); inviteHideTimer = null; }
    invite.hidden = true;
    dock.classList.remove('has-invite');
    if (seen) session.set(INVITE_KEY, '1');
  }
  function showInvite() {
    if (session.get(INVITE_KEY) || !panel.hidden) return;
    session.set(INVITE_KEY, '1');
    invite.hidden = false;
    dock.classList.add('has-invite');
    if (!reduceMotion()) dock.classList.add('ast-animate');
    const autoHide = () => {
      inviteHideTimer = setTimeout(() => {
        if (invite.matches(':hover') || invite.contains(document.activeElement)) autoHide(); else hideInvite(false);
      }, INVITE_SHOW_MS);
    };
    autoHide();
  }
  inviteText.addEventListener('click', () => setOpen(true, fab));
  inviteClose.addEventListener('click', () => hideInvite(true));
  if (!session.get(INVITE_KEY)) {
    inviteTimer = setTimeout(showInvite, INVITE_DELAY_MS);
    const mark = document.getElementById('samples') || document.querySelector('.hero');
    if (mark && typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        // Scrolled past = no longer on screen and above the viewport.
        entries.forEach((en) => { if (!en.isIntersecting && en.boundingClientRect.bottom < 0) { showInvite(); io.disconnect(); } });
      });
      io.observe(mark);
    }
  }

  return { open: () => setOpen(true, fab), close: () => setOpen(false), preview };
}
