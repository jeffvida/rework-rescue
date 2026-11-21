// The enquiry tracker demo (build #1, 21 Nov 2026): the third card in "Demos & examples". Its "Try it" button opens
// the demo in the same centred panel as the previous-role examples (dialog.cs), so the page doesn't get longer.
// The customer auto-reply is only shown in the panel, never emailed: the visitor's address can't be verified, so
// emailing it would let anyone send mail from Jeff's Gmail to a stranger (Jeff chose option B, 21 Nov).
// A visitor sends an enquiry as a customer of CoolFix Aircon (a made-up business). The n8n workflow
// "Enquiry Inbox → Tracker (demo)" checks it, has Gemini read it, picks the owner with a fixed rule, logs it in a
// demo Google Sheet, answers this page and emails Jeff (never the visitor). Handover: project doc
// claude/handover-2026-11-21-enquiry-tracker.md.
//
// The workflow answers 200 {ok, name, need, category, urgency, owner, status, check_reason} or 400 when its checks
// reject the request. Anything else (no answer, timeout, other status) shows a plain "try again" message.
// Without SITE.enquiryDemoUrl, or with ?enquiry=preview in the address, it uses sample replies and sends nothing.

import { SITE } from '../site-config.js';
import { esc } from './forms.js';

export const EQ_LIMITS = { nameMin: 2, nameMax: 100, emailMax: 150, msgMin: 10, msgMax: 2000, sendsPerVisit: 5 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EQ_TEXT = {
  invalid: 'Please add your name, a valid email and a message (10 to 2,000 characters).',
  failed: 'Something went wrong. Please try again.',
  limit: 'That’s the limit for this demo. Book a free process review to see it working on your own enquiries.',
};

// Tap-to-fill examples. Names and businesses are made up.
export const EQ_EXAMPLES = [
  { label: 'Quote request', name: 'Maria Lopez', email: 'maria@lopezdental.example', message: 'Hi, can I get a quote for cleaning 3 aircon units at our clinic next Tuesday morning? Thanks, Maria - Lopez Dental' },
  { label: 'Urgent complaint', name: 'Ken Ortiz', email: 'ken@ortizcafe.example', message: 'Your technician came yesterday and the unit is leaking again. We open at 7am, please call today. - Ken, Ortiz Cafe' },
  { label: 'Unclear message', name: 'Ana Cruz', email: 'ana@example.com', message: 'Hello, is this still available? Thanks' },
];

// Sample replies for preview mode (same shape as the workflow's reply).
const PREVIEW_REPLIES = [
  { company: 'Lopez Dental', need: 'Quote for cleaning 3 aircon units next Tuesday morning', category: 'Quote', urgency: 'Normal', owner: 'Sales', status: 'New', check_reason: '' },
  { company: 'Ortiz Cafe', need: 'Unit leaking again after yesterday’s repair, call today', category: 'Complaint', urgency: 'High', owner: 'Manager', status: 'New', check_reason: '' },
  { company: '', need: 'Asks if something is available, not clear what', category: 'Other', urgency: 'Normal', owner: 'Manager', status: 'Needs check', check_reason: 'Not clear what they’re asking about.' },
];

/** The same checks the workflow runs. Returns '' when the enquiry can be sent, otherwise the message to show. */
export function checkEnquiry({ name = '', email = '', message = '', website = '' } = {}) {
  const n = String(name).trim(); const e = String(email).trim(); const m = String(message).trim();
  if (String(website)) return EQ_TEXT.invalid;
  if (n.length < EQ_LIMITS.nameMin || n.length > EQ_LIMITS.nameMax) return EQ_TEXT.invalid;
  if (!EMAIL_RE.test(e) || e.length > EQ_LIMITS.emailMax) return EQ_TEXT.invalid;
  if (m.length < EQ_LIMITS.msgMin || m.length > EQ_LIMITS.msgMax) return EQ_TEXT.invalid;
  return '';
}

/** Keeps only the fields the page shows, so nothing unexpected from the reply reaches the page. */
export function readReply(data) {
  if (!data || data.ok !== true) return null;
  const s = (v, max = 160) => String(v ?? '').slice(0, max);
  const status = data.status === 'New' ? 'New' : 'Needs check';
  return { name: s(data.name, 100), company: s(data.company, 100), need: s(data.need) || 'See message', category: s(data.category, 20) || 'Other', urgency: data.urgency === 'High' ? 'High' : 'Normal', owner: s(data.owner, 30) || 'Manager', status, check_reason: s(data.check_reason) };
}

/** The subject line of the owner's alert, as the workflow writes it. */
export function alertSubject(r) {
  return `${r.status === 'Needs check' ? 'CHECK: ' : ''}${r.urgency === 'High' ? 'URGENT ' : ''}${r.category} from ${r.name} → ${r.owner}`;
}

/** The auto-reply a real customer would get (shown on the page only, never sent). Fixed wording, no customer text. */
export function autoReply(r) {
  const first = String(r.name).trim().split(/\s+/)[0] || 'there';
  const when = r.urgency === 'High' ? 'today' : 'within 1 business day';
  if (r.status !== 'New') return `Thanks ${first}, we got your message. Someone from our team will get back to you ${when}.`;
  if (r.category === 'Complaint') return `Thanks ${first}, we got your message and we’re sorry about the trouble. Our ${r.owner} will get back to you ${when}.`;
  const what = { Quote: 'quote request', Booking: 'booking request' }[r.category] || 'message';
  return `Thanks ${first}, we got your ${what}. Our ${r.owner} team will get back to you ${when}.`;
}

export function previewReply(fields) {
  const i = EQ_EXAMPLES.findIndex((x) => x.message === String(fields.message).trim());
  const base = i >= 0 ? PREVIEW_REPLIES[i] : { company: '', need: String(fields.message).trim().slice(0, 60), category: 'Other', urgency: 'Normal', owner: 'Manager', status: 'Needs check', check_reason: 'Sample reply: preview mode doesn’t read your message.' };
  return { ok: true, name: String(fields.name).trim(), ...base };
}

async function send(url, body) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 30000) : null;
  try {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const STATUSES = [['New', 'New'], ['Needs check', 'Needs check'], ['Contacted', 'Contacted'], ['Booked', 'Booked'], ['Closed', 'Closed']];
/** Counts per status, for the "what's waiting" strip above the tracker. */
export function countStatuses(list) {
  return STATUSES.map(([k, label]) => ({ label, n: list.filter((x) => x === k).length }));
}
/** Received time as the tracker shows it, in the visitor's own time, e.g. "Sat 21 Nov, 9:50 am". */
export function whenLabel(d = new Date()) {
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s/g, ' ');
  return `${day}, ${time}`;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountEnquiryDemo(root) {
  if (!root || typeof HTMLDialogElement !== 'function' || typeof root.showModal !== 'function') return;
  let opener = null;
  document.querySelectorAll('[data-eq-only]').forEach((el) => { el.hidden = false; });
  document.querySelectorAll('[data-eq-open]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); opener = a;
    document.documentElement.classList.add('cs-lock');
    root.showModal();
    root.querySelector('[data-eq-close]')?.focus();
  }));
  root.addEventListener('close', () => { document.documentElement.classList.remove('cs-lock'); opener?.focus({ preventScroll: true }); });
  root.querySelector('[data-eq-close]')?.addEventListener('click', () => root.close());
  root.addEventListener('click', (e) => { if (e.target === root) root.close(); });
  const form = root.querySelector('[data-eq-form]');
  const err = root.querySelector('[data-eq-error]');
  const btn = root.querySelector('[data-eq-send]');
  const steps = [...root.querySelectorAll('[data-eq-step]')];
  const rows = root.querySelector('[data-eq-rows]');
  const mail = root.querySelector('[data-eq-mail]');
  const auto = root.querySelector('[data-eq-reply]');
  const status = root.querySelector('[data-eq-status]');
  if (!form || !btn) return;

  const preview = !SITE.enquiryDemoUrl || /[?&]enquiry=preview\b/.test(location.search);
  if (preview) root.querySelector('[data-eq-preview]')?.removeAttribute('hidden');
  let sends = 0; let busy = false;

  root.querySelectorAll('[data-eq-example]').forEach((b) => b.addEventListener('click', () => {
    const x = EQ_EXAMPLES[Number(b.dataset.eqExample)]; if (!x) return;
    form.elements.name.value = x.name; form.elements.email.value = x.email; form.elements.message.value = x.message;
    err.textContent = '';
  }));
  form.addEventListener('input', () => { err.textContent = ''; });

  const sum = root.querySelector('[data-eq-sum]');
  const drawSum = () => {
    if (!sum) return;
    const counts = countStatuses([...rows.children].map((tr) => tr.dataset.status));
    sum.innerHTML = counts.map((c) => `<li class="eq-sum-${c.label.toLowerCase().replace(' ', '-')}"><strong>${c.n}</strong> ${esc(c.label)}</li>`).join('');
  };
  drawSum();
  const setStep = (n) => steps.forEach((s, i) => { s.classList.toggle('is-done', i < n); s.classList.toggle('is-on', i === n); });
  const say = (t) => { if (status) status.textContent = t; };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const fields = { name: form.elements.name.value, email: form.elements.email.value, message: form.elements.message.value, website: form.elements.website.value };
    if (sends >= EQ_LIMITS.sendsPerVisit) { err.textContent = EQ_TEXT.limit; return; }
    const problem = checkEnquiry(fields);
    if (problem) { err.textContent = problem; form.elements[!fields.name.trim() ? 'name' : 'message']?.focus(); return; }

    busy = true; sends += 1; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); err.textContent = '';
    mail.hidden = true; auto.hidden = true; setStep(1); say('Sending your enquiry…');
    // Phones: the result sits under the form, so bring the steps into view.
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 52rem)').matches) root.querySelector('.eq-result')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    const slow = !reduceMotion();
    const body = { name: fields.name.trim(), email: fields.email.trim(), message: fields.message.trim(), website: fields.website };
    const reply = preview ? (await wait(900), { status: 200, data: previewReply(fields) }) : await send(SITE.enquiryDemoUrl, body);

    const r = reply.status === 200 ? readReply(reply.data) : null;
    if (!r) {
      setStep(-1); steps.forEach((s) => s.classList.remove('is-done', 'is-on'));
      err.textContent = reply.status === 400 ? EQ_TEXT.invalid : EQ_TEXT.failed;
      say(''); busy = false; btn.disabled = false; btn.removeAttribute('aria-busy');
      return;
    }
    for (let i = 2; i <= steps.length; i += 1) { if (slow) await wait(380); setStep(i); }

    const pill = r.status === 'New' ? '<span class="pill pill-ok">New</span>' : '<span class="pill pill-amber">Needs check</span>';
    const dash = '&ndash;';
    rows.insertAdjacentHTML('afterbegin', `<tr class="eq-new" data-status="${r.status}"><td class="eq-c-when">${esc(whenLabel())}</td><td class="eq-c-name">${esc(r.name)}</td><td class="eq-c-co">${r.company ? esc(r.company) : dash}</td><td class="eq-c-need">${esc(r.need)}</td><td class="eq-c-cat">${esc(r.category)}</td><td class="eq-c-urg">${r.urgency === 'High' ? '<span class="eq-urgent">High</span>' : 'Normal'}</td><td class="eq-c-owner">${esc(r.owner)}</td><td class="eq-c-status">${pill}</td><td class="eq-c-why">${r.check_reason ? esc(r.check_reason) : dash}</td></tr>`);
    while (rows.children.length > 8) rows.lastElementChild.remove();
    drawSum();
    mail.innerHTML = `<p class="eq-mail-k">Alert sent to ${esc(r.owner)} <span>(in this demo, to me)</span></p><p class="eq-mail-s">${esc(alertSubject(r))}</p>${r.check_reason ? `<p class="eq-mail-c">Please check: ${esc(r.check_reason)}</p>` : ''}`;
    mail.hidden = false;
    auto.innerHTML = `<p class="eq-mail-k">Auto-reply your customer would get <span>(shown here, not sent)</span></p><p class="eq-mail-r">${esc(autoReply(r))}</p>`;
    auto.hidden = false;
    say(`Logged. Owner: ${r.owner}. Status: ${r.status}.`);
    busy = false; btn.disabled = false; btn.removeAttribute('aria-busy');
  });
}
