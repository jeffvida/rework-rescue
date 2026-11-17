// "What's taking up your team's time?" (17 Nov 2026, Jeff): the visitor types a task, and the hero shows how that
// task could run as a five-step workflow, in their words. Built-in rules, no AI call: the text is matched against a
// few common task types (enquiries, inbox, re-typing, follow-ups, reports, approvals, invoices, scheduling) and the
// closest one is filled in with where their work arrives and where it's kept.
// Every workflow has the same shape as the rest of the site: two automated steps, one check, and a final step that
// stays with a person. It is an example of how the task could work, never a quote or a promise: no prices, no
// savings figures. What the visitor types never leaves the browser (no fetch, no storage, not carried into booking).

export const MAX_LEN = 200;

const TYPES = {
  enquiries: {
    words: /enquir|inquir|\blead|quote request|website|web form|contact form|new customer|customers ask|prospect|sales/i,
    steps: [
      ['New enquiry arrives', 'Through {src}, with whatever the customer wrote.'],
      ['Details captured', 'Name, contact details and what they need go straight into {store}.', 'auto'],
      ['Reply drafted, follow-up set', 'A first reply is prepared and a reminder is set if they don’t answer.', 'auto'],
      ['Gaps flagged', 'Missing phone numbers, duplicates and unclear requests are flagged.', 'check'],
      ['You decide', 'You approve the reply and choose which enquiries to follow up.', 'you'],
    ],
  },
  inbox: {
    words: /\binbox|emails?\b|mailbox|sort(ing)? (through )?(mail|messages)|messages pil/i,
    steps: [
      ['Emails arrive', 'Requests, questions and updates land in {src}.'],
      ['Sorted and labelled', 'Each email is read and tagged as a request, question, invoice or other, using AI where it helps.', 'auto'],
      ['Logged with an owner', 'Requests are added to {store} with who’s responsible.', 'auto'],
      ['Unclear ones flagged', 'Anything the system isn’t sure about is set aside for a person.', 'check'],
      ['Your team replies', 'People handle the replies that need judgement. Nothing important goes out unchecked.', 'you'],
    ],
  },
  retyping: {
    words: /re-?typ|copy(ing)?\b|copy and paste|paste|data entry|enter(ing)? (the )?(same|data|details)|typ(e|ing) (it|them|the|into)|duplicate|manual(ly)? (enter|input|update)|transfer/i,
    steps: [
      ['Information comes in', 'Details arrive through {src}.'],
      ['Details pulled out once', 'Names, dates, amounts and references are extracted automatically.', 'auto'],
      ['Records updated', 'They’re added to {store} without anyone re-typing them.', 'auto'],
      ['Mismatches flagged', 'Missing fields, duplicates and odd values are flagged before anyone relies on them.', 'check'],
      ['You review the exceptions', 'Your team only deals with the flagged items.', 'you'],
    ],
  },
  followups: {
    words: /follow[- ]?up|chas(e|ing)|remind|forget|forgot|missed|no reply|no response|waiting on|overdue|slip/i,
    steps: [
      ['Something needs a reply', 'A quote, request or task is waiting on someone.'],
      ['Tracked with a due date', 'It’s logged in {store} with an owner and a date.', 'auto'],
      ['Reminders on time', 'The right person gets a nudge before it’s overdue.', 'auto'],
      ['Overdue items flagged', 'Anything still open past its date shows up clearly.', 'check'],
      ['You decide the next step', 'You choose who to call and what to say.', 'you'],
    ],
  },
  reports: {
    words: /report|dashboard|kpi|figures|numbers|metrics|monday|weekly summary|month[- ]end|pivot|chart/i,
    steps: [
      ['Data from your tools', 'Figures come from {store} and the other files you use.'],
      ['Collected automatically', 'The data is pulled together on a schedule, with no copy-pasting.', 'auto'],
      ['The report builds itself', 'Tables and charts update in the same format every time.', 'auto'],
      ['Numbers checked', 'Gaps, duplicates and unusual figures are flagged before it’s shared.', 'check'],
      ['You review and share', 'You read the summary, add context and send it.', 'you'],
    ],
  },
  approvals: {
    words: /approv|sign[- ]?off|authori[sz]|stuck|bottleneck|assign|route|hand[- ]?off|handover between|who('s| is) (doing|responsible)/i,
    steps: [
      ['A request needs sign-off', 'A purchase, job or change comes in through {src}.'],
      ['Sent to the right person', 'It goes to whoever approves that kind of request.', 'auto'],
      ['Reminders if it stalls', 'If nobody acts, a reminder goes out and the request stays visible.', 'auto'],
      ['Missing details flagged', 'Requests without the information needed are sent back first.', 'check'],
      ['A person approves', 'Approvals stay with people. The system just keeps things moving.', 'you'],
    ],
  },
  invoices: {
    words: /invoic|billing|\bbill(s|ed)?\b|payment|receipt|accounts|purchase order|\bpo\b|expense/i,
    steps: [
      ['Job or order completed', 'The details are in {store} or your job system.'],
      ['Invoice details prepared', 'Customer, amounts and references are pulled together.', 'auto'],
      ['Matched against the work', 'Each invoice is checked against the job or order.', 'auto'],
      ['Mismatches flagged', 'Missing jobs, wrong amounts or duplicates are flagged before sending.', 'check'],
      ['You approve and send', 'Nothing goes to a customer until you’ve checked it.', 'you'],
    ],
  },
  scheduling: {
    words: /schedul|appointment|booking|calendar|roster|shift|rota|availability|reschedul/i,
    steps: [
      ['A booking request comes in', 'Through {src} or a phone message.'],
      ['Availability checked', 'Free times are checked against your calendar.', 'auto'],
      ['Booking confirmed', 'The appointment is added and reminders are scheduled.', 'auto'],
      ['Clashes flagged', 'Double bookings and missing details are flagged.', 'check'],
      ['You handle the changes', 'Reschedules and special requests stay with your team.', 'you'],
    ],
  },
  general: {
    words: null,
    steps: [
      ['The task starts', 'Information arrives through {src}.'],
      ['Repeat steps automated', 'Copying, sorting and updating are handled for you.', 'auto'],
      ['Kept in one place', 'Everything is recorded in {store} with an owner and a status.', 'auto'],
      ['Checks catch mistakes', 'Gaps and unusual items are flagged for a person.', 'check'],
      ['People make the decisions', 'Your team handles the judgement calls.', 'you'],
    ],
  },
};

export const TAGS = { auto: 'Automated', check: 'Check', you: 'Stays with you' };

// Where the work arrives, in the visitor's own terms.
export function sourceOf(text) {
  if (/whats\s?app/i.test(text)) return 'WhatsApp';
  if (/viber/i.test(text)) return 'Viber';
  if (/messenger/i.test(text)) return 'Messenger';
  if (/\bsms\b|text messages?/i.test(text)) return 'text messages';
  if (/website|web form|contact form|online form|\bform\b/i.test(text)) return 'your website form';
  if (/phone|call(s)?\b|voicemail/i.test(text)) return 'phone messages';
  if (/paper|printed|hand[- ]?written/i.test(text)) return 'paper forms';
  return 'email';
}

// Where it ends up, in the visitor's own terms.
export function storeOf(text) {
  if (/google sheets?/i.test(text)) return 'your Google Sheet';
  if (/excel|xlsx/i.test(text)) return 'your Excel sheet';
  if (/spreadsheet|sheet\b/i.test(text)) return 'your spreadsheet';
  if (/\bcrm\b|hubspot|salesforce|zoho|pipedrive/i.test(text)) return 'your CRM';
  if (/xero|quickbooks|myob/i.test(text)) return (text.match(/xero|quickbooks|myob/i)[0]).replace(/^xero$/i, 'Xero').replace(/^quickbooks$/i, 'QuickBooks').replace(/^myob$/i, 'MYOB');
  return 'one simple tracker';
}

// The closest task type: the most keyword families matched; ties go to the order above.
export function typeOf(text) {
  let best = 'general'; let score = 0;
  for (const [name, t] of Object.entries(TYPES)) {
    if (!t.words) continue;
    let hits = (String(text).match(new RegExp(t.words.source, 'gi')) || []).length;
    if (name === 'followups') hits = Math.min(hits, 1); // forgetting / chasing usually adds a reminder step to the main task
    if (hits > score) { best = name; score = hits; }
  }
  return best;
}

export function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
}

// The whole plan for a typed task.
export function planFor(raw) {
  const text = clean(raw);
  const type = typeOf(text);
  const fill = (s) => s.replace('{src}', sourceOf(text)).replace('{store}', storeOf(text));
  const steps = TYPES[type].steps.map(([title, desc, tag]) => ({ title, desc: fill(desc), tag: tag || 'start' }));
  // Mentions forgetting or chasing, but the closest type has no reminder step? Add reminders to step 3.
  if (type !== 'followups' && type !== 'approvals' && type !== 'enquiries' && TYPES.followups.words.test(text)) {
    steps[2] = { ...steps[2], title: `${steps[2].title}, reminders set`, desc: `${steps[2].desc} If anything is still waiting, the right person gets a reminder.` };
  }
  return { text, type, steps };
}

// ---- The hero box (browser only)

const EXAMPLES_TYPED = [
  'We copy job requests from emails into Excel',
  'Customers wait days because we forget to follow up',
  'Rebuilding the same report every Monday',
];

export function mountTaskBox(root) {
  if (!root) return;
  const form = root.querySelector('.tw-ask');
  const input = root.querySelector('#tw-q');
  const example = root.querySelector('#hero-flow');
  const result = root.querySelector('.tw-result');
  if (!form || !input || !example || !result) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  form.hidden = false;
  root.classList.add('tw-on');

  // Placeholder types out three examples once, then stays on the last. Stops as soon as they focus the box.
  let typing = !reduce; let timers = [];
  const stopTyping = () => { typing = false; timers.forEach(clearTimeout); timers = []; input.setAttribute('placeholder', 'Describe a task your team repeats…'); };
  if (typing) {
    let at = 400;
    EXAMPLES_TYPED.forEach((ex, n) => {
      for (let i = 1; i <= ex.length; i += 1) { const s = ex.slice(0, i); timers.push(setTimeout(() => typing && input.setAttribute('placeholder', s), at)); at += 38; }
      at += n === EXAMPLES_TYPED.length - 1 ? 0 : 1600;
    });
    timers.push(setTimeout(() => typing && input.setAttribute('placeholder', 'Describe a task your team repeats…'), at + 2600));
  }
  input.addEventListener('focus', stopTyping, { once: true });

  const list = result.querySelector('.tw-steps');
  const quote = result.querySelector('.tw-quote');
  let shows = [];

  function show(text) {
    const plan = planFor(text);
    if (!plan.text) { input.focus(); return; }
    shows.forEach(clearTimeout); shows = [];
    quote.textContent = `“${plan.text}”`;
    list.replaceChildren(...plan.steps.map((s, i) => {
      const li = document.createElement('li');
      li.className = `tw-step tw-${s.tag}`;
      const n = document.createElement('span'); n.className = 'tw-n'; n.setAttribute('aria-hidden', 'true'); n.textContent = String(i + 1);
      const body = document.createElement('div'); body.className = 'tw-body';
      const h = document.createElement('p'); h.className = 'tw-t'; h.textContent = s.title;
      if (TAGS[s.tag]) { const tag = document.createElement('span'); tag.className = 'tw-tag'; tag.textContent = TAGS[s.tag]; h.append(' ', tag); }
      const d = document.createElement('p'); d.className = 'tw-d'; d.textContent = s.desc;
      body.append(h, d); li.append(n, body);
      return li;
    }));
    example.hidden = true;
    result.hidden = false;
    result.classList.remove('is-built');
    if (reduce) { result.classList.add('is-built'); list.querySelectorAll('.tw-step').forEach((li) => li.classList.add('is-on')); }
    else {
      void result.offsetWidth;
      result.classList.add('is-building');
      [...list.children].forEach((li, i) => shows.push(setTimeout(() => li.classList.add('is-on'), 120 + i * 420)));
      shows.push(setTimeout(() => { result.classList.remove('is-building'); result.classList.add('is-built'); }, 120 + list.children.length * 420));
    }
    result.focus({ preventScroll: true });
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 52rem)').matches) result.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); stopTyping(); show(input.value); });
  root.querySelectorAll('[data-tw-example]').forEach((b) => b.addEventListener('click', () => { stopTyping(); input.value = b.textContent.trim(); show(input.value); }));
  result.querySelector('[data-tw-reset]')?.addEventListener('click', () => {
    shows.forEach(clearTimeout); shows = [];
    result.hidden = true; example.hidden = false; input.value = ''; input.focus();
  });
}
