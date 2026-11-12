// "Pick the one that sounds like your week" (12 Nov 2026, option 1 live sample).
// Three taps, one per problem (chasing updates, re-typing, reports). Each shows the problem in the customer's words,
// then four tagged steps: what AI, an automation, a check and a person each do.
// - A scripted sample replay. Runs entirely in the page: no AI or n8n call. The caption says so.
// - The served HTML is the finished frame of the first sample. Tapping a button swaps the words and replays the steps.
// - No inline styles (CSP): steps are shown by toggling classes.

export const SAMPLES = [
  { key: 'chasing', chip: 'Chasing updates', kicker: 'In the group chat',
    start: 'Who’s doing unit 4? Has anyone called them back?',
    steps: [['Automation', 'Every new job gets an owner when it’s logged'],
      ['Automation', 'A reminder goes to the owner when the due date passes'],
      ['Check', 'A job with no owner is flagged the same day'],
      ['Person', 'You see who has what, without asking']] },
  { key: 'retyping', chip: 'Re-typing', kicker: 'In the inbox',
    start: 'A request comes in by email. Someone copies it into the tracker, then into the invoice list.',
    steps: [['AI', 'Reads the email and fills in the job record'],
      ['Check', 'Customer name unclear. Not guessed.'],
      ['Person', 'Ana confirms it'],
      ['Automation', 'The tracker and the invoice list update together']] },
  { key: 'reports', chip: 'Reports', kicker: 'On Monday morning',
    start: 'Three files pasted together by hand. The total is one job out.',
    steps: [['Automation', 'This week’s files are combined the same way every time'],
      ['Check', 'A job counted twice is caught before the report'],
      ['AI', 'Drafts a short summary from the checked figures'],
      ['Person', 'You review it, then send it']] },
];
export const TAGS = ['AI', 'Automation', 'Check', 'Person'];
export const STEP_MS = 1100;

export function mountSteps(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s) => fig.querySelector(s);
  const rows = [...fig.querySelectorAll('.st-row')];
  const chips = [...fig.querySelectorAll('[data-st-sample]')];
  const kicker = q('[data-st="kicker"]'); const start = q('[data-st="start"]'); const box = q('.st-start');
  if (!rows.length || !kicker || !start || !box) return;
  let timers = [];
  function play() {
    timers.forEach(clearTimeout); timers = [];
    if (reduce) return;
    fig.classList.add('st-anim');
    [box, ...rows].forEach((el) => el.classList.remove('is-on'));
    [box, ...rows].forEach((el, i) => timers.push(setTimeout(() => el.classList.add('is-on'), 150 + i * STEP_MS)));
  }
  function show(key) {
    const s = SAMPLES.find((x) => x.key === key) || SAMPLES[0];
    kicker.textContent = s.kicker; start.textContent = s.start;
    rows.forEach((r, i) => {
      const [tag, text] = s.steps[i];
      for (const t of TAGS) r.classList.toggle(`st-${t.toLowerCase()}`, t === tag);
      r.querySelector('.st-tag').textContent = tag; r.querySelector('.st-t').textContent = text;
    });
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.stSample === s.key)));
  }
  chips.forEach((c) => c.addEventListener('click', () => { show(c.dataset.stSample); play(); }));
}
