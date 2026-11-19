// Find Your Rework: page controller. Answers live in this closure only: never in the address,
// history, storage or cookies. History entries carry the screen name only (#intro, #step-1..3, #result).
// The only way answers leave the page is the optional share form under the result, when submitted.

import { SITE, SPECIALIST } from '../../site-config.js';
import { QUESTIONS, SCREENS, RESULT, INTRO } from './rules.js';
import {
  taskOptions, validateScreen, nextAfter, firstIncomplete, toggleLimit, diagnose, resultToText, shareSummary,
} from './engine.js';
import { esc } from '../forms.js';
import { mountShareBlock } from './share-form.js';
import { mountBooking } from '../booking/popup.js';
import { readUtm } from '../inquiry.js';

const TOTAL = SCREENS.length;

export function startFinder(app, live, options = {}) {
  const config = { ...SITE, ...(options.config || {}) };
  let answers = {};
  let result = null;
  let first = true;
  const utm = readUtm(typeof location !== 'undefined' ? location.search : '');
  // "Book a free rework review" on the result page opens the booking pop-up; the result travels with the request.
  if (typeof document !== 'undefined' && !options.noBooking) {
    mountBooking({
      base: '../',
      getContext: () => {
        if (!result) return null;
        // "Something else" answers leave the box empty, so the visitor describes the real task.
        const process = result.kind === 'fallback' || result.closestFit ? '' : result.answers.task;
        // The result preselects the matching service in the pop-up (Reporting and Data both show as Data & Reporting Rework).
        const service = { REPORTING: 'data', DATA: 'data', WORKFLOW: 'workflow' }[result.pillar] || '';
        return { process: process.slice(0, 300), summary: shareSummary(result), service };
      },
    });
  }

  const announce = (m) => { if (live) { live.textContent = ''; setTimeout(() => { live.textContent = m; }, 20); } };
  const go = (hash, replace = false) => {
    history[replace ? 'replaceState' : 'pushState'](null, '', location.pathname + location.search + hash);
    route();
  };
  const focusTitle = () => {
    if (first) { first = false; return; }
    const h = app.querySelector('h1');
    if (h) h.focus();
    window.scrollTo(0, 0);
  };

  // ------------------------------------------------------------ question markup
  function optionHtml(q, type, o, checked) {
    return `<label class="choice"><input type="${type}" name="${q}" value="${esc(o.id)}"${checked ? ' checked' : ''}>
      <span class="choice-text"><span class="choice-label">${esc(o.label)}</span>${o.desc ? `<span class="choice-desc">${esc(o.desc)}</span>` : ''}</span></label>`;
  }

  function questionHtml(q) {
    const meta = QUESTIONS[q];
    let text = meta.text;
    let options = meta.options;
    if (q === 'task') {
      text = answers.area === 'UNSURE' ? meta.textUnsure : meta.text;
      options = taskOptions(answers.area);
    }
    if (q === 'time' && answers.frequency === 'SEVERAL_DAILY') text = meta.textPerDay;
    const multi = meta.type === 'multi';
    const chosen = answers[q];
    const body = options.map((o) => optionHtml(q, multi ? 'checkbox' : 'radio', o, multi ? (chosen || []).includes(o.id) : chosen === o.id)).join('');
    return `<fieldset class="question" data-q="${q}" aria-describedby="help-${q} err-${q}">
      <legend>${esc(text)}</legend>
      <p class="help" id="help-${q}">${esc(meta.help)}</p>
      <div class="choices${options.length > 6 ? ' choices-compact' : ''}">${body}</div>
      <p class="error" id="err-${q}" hidden></p>
    </fieldset>`;
  }

  // ------------------------------------------------------------ screens
  function introHtml() {
    return `<section class="finder-intro">
      <p class="eyebrow">${esc(INTRO.eyebrow)}</p>
      <h1 tabindex="-1">${esc(INTRO.heading)}</h1>
      <p class="lede">${esc(INTRO.lead)}</p>
      <ul class="check-list intro-examples">${INTRO.examples.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      <p>${esc(INTRO.note)}</p>
      <p class="intro-facts">${esc(INTRO.facts)}</p>
      <p><button type="button" class="btn btn-primary btn-large" data-action="begin">${esc(INTRO.button)}</button></p>
    </section>`;
  }

  function stepHtml(n) {
    const screen = SCREENS[n - 1];
    const qs = screen.questions.filter((q) => q !== 'task' || answers.area);
    return `<section class="step" data-step="${n}" aria-labelledby="step-title">
      <div class="progress" role="group" aria-label="Progress">
        <p class="progress-text">Step ${n} of ${TOTAL}</p>
        <progress max="${TOTAL}" value="${n}" aria-label="Step ${n} of ${TOTAL}"></progress>
      </div>
      <h1 id="step-title" tabindex="-1">${esc(screen.title)}</h1>
      <form novalidate data-form="step">
        ${qs.map(questionHtml).join('')}
        <div class="step-actions">
          <button type="button" class="btn btn-secondary" data-action="back">Back</button>
          <button type="submit" class="btn btn-primary">${n === TOTAL ? 'See my result' : 'Continue'}</button>
        </div>
      </form>
    </section>`;
  }

  function workloadHtml(w) {
    if (!w) return '';
    let body;
    if (w.kind === 'annual') {
      body = `<p class="wl-figure"><span class="wl-big">${esc(w.month)}</span> staff-hours a month</p>
        <p class="wl-year">${esc(w.year)} staff-hours a year</p>`;
    } else if (w.kind === 'time') {
      body = `<p class="wl-figure"><span class="wl-label">Estimated active time</span> ${esc(w.text)}</p>`;
    } else {
      body = `<p class="wl-figure"><span class="wl-label">How often</span> ${esc(w.text)}</p>`;
    }
    return `<section class="r-block r-workload" aria-labelledby="r-wl"><h2 id="r-wl">Your current estimated workload</h2>${body}
      <p class="muted">${esc(RESULT.workloadNote)}</p></section>`;
  }

  function ctaHtml() {
    return `<section class="r-cta no-print" aria-labelledby="r-cta-h">
      <h2 id="r-cta-h">${esc(RESULT.cta.heading)}</h2>
      <p>${esc(RESULT.cta.text)}</p>
      <p class="muted">${esc(config.submitEndpoint ? RESULT.cta.attached : RESULT.cta.attachedEmail)}</p>
      <div id="share-root"></div>
    </section>`;
  }

  function methodHtml() {
    return `<details class="r-method"><summary>${esc(RESULT.method.heading)}</summary>${RESULT.method.text.map((t) => `<p>${esc(t)}</p>`).join('')}</details>
      <p class="r-tools no-print">
        <button type="button" class="link-button" data-action="print">Print or save</button>
        <button type="button" class="link-button" data-action="copy">Copy result</button>
        <button type="button" class="link-button" data-action="restart">Start over</button>
      </p>
      <p class="r-share no-print">${esc(RESULT.shareNote)}</p>
      <div id="copy-panel" class="copy-panel no-print" hidden></div>`;
  }

  function resultHtml(r) {
    if (r.kind === 'fallback') {
      const f = RESULT.fallback;
      return `<article class="r-result" aria-labelledby="r-title">
        <p class="eyebrow">${esc(RESULT.eyebrow)}</p>
        <h1 id="r-title" tabindex="-1">${esc(f.title)}</h1>
        <p class="r-diagnosis">${esc(f.diagnosis)}</p>
        <section class="r-block"><h2>Look for a task that</h2><ul class="check-list">${f.lookFor.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
        <section class="r-block r-start"><h2>Start here</h2><p>Write down:</p><ol>${f.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>
        <p>${esc(f.close)}</p>
        ${ctaHtml()}${methodHtml()}
      </article>`;
    }
    return `<article class="r-result" aria-labelledby="r-title">
      <p class="eyebrow">${esc(RESULT.eyebrow)}</p>
      <h1 id="r-title" tabindex="-1">${esc(r.pillarName)}</h1>
      <p class="r-diagnosis">${esc(r.diagnosis)}</p>
      ${workloadHtml(r.workload)}
      ${r.lowVolume ? `<p class="callout callout-info r-lowvol">${esc(r.lowVolume)}</p>` : ''}
      <section class="r-block" aria-labelledby="r-why"><h2 id="r-why">Why this result</h2><p>${esc(r.why)}</p></section>
      <section class="r-block r-start" aria-labelledby="r-start"><h2 id="r-start">Start here</h2>
        <p class="r-start-lead">${esc(r.start.lead)}</p>
        <ol>${r.start.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <p class="muted">You can do these this week, before changing any tools.</p>
      </section>
      <section class="r-block" aria-labelledby="r-fix"><h2 id="r-fix">What a fix usually looks like</h2>
        <p>${esc(r.fix)}</p><p class="muted">${esc(r.fixTail)}${r.gatedTail ? ` ${esc(r.gatedTail)}` : ''}</p>
      </section>
      ${r.notes.length ? `<section class="r-block r-notes" aria-labelledby="r-notes"><h2 id="r-notes">${esc(RESULT.notesHeading)}</h2><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}
      <section class="r-block" aria-labelledby="r-measure"><h2 id="r-measure">What to measure</h2><ul class="check-list">${r.measures.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></section>
      <p class="r-example">Similar example (fictional data): <a href="${esc(r.example.href)}">${esc(r.example.label)}</a></p>
      ${ctaHtml()}${methodHtml()}
    </article>`;
  }

  // ------------------------------------------------------------ routing
  function show(view) {
    if (view === 'intro') {
      app.innerHTML = introHtml();
      document.title = `Find Your Rework | ${config.name}`;
      focusTitle();
      return;
    }
    if (view.startsWith('step-')) {
      const n = Number(view.slice(5));
      app.innerHTML = stepHtml(n);
      document.title = `Step ${n} of ${TOTAL}: ${SCREENS[n - 1].title} | ${config.name}`;
      focusTitle();
      announce(`Step ${n} of ${TOTAL}: ${SCREENS[n - 1].title}`);
      return;
    }
    // result
    result = diagnose(answers);
    app.innerHTML = resultHtml(result);
    mountShareBlock(app.querySelector('#share-root'), {
      getResult: () => result,
      getSummary: () => shareSummary(result),
      config,
      utm,
      page: location.pathname,
      privacyHref: '../privacy/',
      contactHref: `mailto:${SPECIALIST.email}`,
      contactLabel: SPECIALIST.email,
      email: SPECIALIST.email,
      linkedin: SPECIALIST.linkedin,
      labels: RESULT.cta,
      fetchImpl: options.fetchImpl,
    });
    document.title = `${RESULT.eyebrow}: ${result.pillarName} | ${config.name}`;
    focusTitle();
    announce(`Your result: ${result.pillarName}.`);
  }

  function route() {
    const h = (location.hash || '#intro').slice(1);
    let view = h;
    const valid = h === 'intro' || h === 'result' || /^step-[1-9]$/.test(h);
    if (!valid) view = 'intro';
    // Answers aren't saved: after a refresh, or a jump ahead, go back to the first unanswered screen.
    if (view !== 'intro') {
      const n = view === 'result' ? TOTAL + 1 : Number(view.slice(5));
      const missing = firstIncomplete(answers);
      if (!answers.area && view !== 'step-1') view = 'intro';
      else if (missing && missing < n) view = `step-${missing}`;
    }
    if (`#${view}` !== location.hash) history.replaceState(null, '', location.pathname + location.search + `#${view}`);
    show(view);
  }

  // ------------------------------------------------------------ events
  function currentStep() {
    const el = app.querySelector('[data-step]');
    return el ? Number(el.dataset.step) : null;
  }

  function setError(q, msg) {
    const el = app.querySelector(`#err-${q}`);
    const fs = app.querySelector(`fieldset[data-q="${q}"]`);
    if (!el || !fs) return;
    el.textContent = msg || '';
    el.hidden = !msg;
    if (msg) fs.setAttribute('data-invalid', 'true'); else fs.removeAttribute('data-invalid');
  }

  function rerender(focusSelector) {
    app.innerHTML = stepHtml(currentStep());
    const el = app.querySelector(focusSelector);
    if (el) el.focus();
  }

  app.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !QUESTIONS[t.name]) return;
    const q = t.name;
    setError(q, '');
    if (q === 'limits') {
      answers = { ...answers, limits: toggleLimit(answers.limits, t.value) };
      app.querySelectorAll('input[name="limits"]').forEach((i) => { i.checked = answers.limits.includes(i.value); });
      return;
    }
    const before = answers[q];
    answers = { ...answers, [q]: t.value };
    if (q === 'area' && before !== t.value) {
      delete answers.task;
      rerender(`input[name="area"][value="${t.value}"]`);
      announce('The matching tasks are now shown below.');
    }
    if (q === 'frequency' && (before === 'SEVERAL_DAILY') !== (t.value === 'SEVERAL_DAILY')) {
      rerender(`input[name="frequency"][value="${t.value}"]`);
      announce('The next question now asks about a typical working day.');
    }
  });

  app.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-form="step"]')) return;
    e.preventDefault();
    const n = currentStep();
    const errors = validateScreen(answers, n);
    Object.keys(QUESTIONS).forEach((q) => setError(q, errors[q]));
    const firstErr = Object.keys(errors)[0];
    if (firstErr) {
      const input = app.querySelector(`fieldset[data-q="${firstErr}"] input`);
      if (input) input.focus();
      announce(errors[firstErr]);
      return;
    }
    const next = nextAfter(answers, n);
    go(next === 'result' ? '#result' : `#step-${next}`);
  });

  app.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'begin') { go('#step-1'); }
    else if (a === 'back') history.back();
    else if (a === 'print') window.print();
    else if (a === 'restart') {
      answers = {}; result = null;
      go('#intro');
    } else if (a === 'copy') {
      const text = resultToText(result);
      const panel = app.querySelector('#copy-panel');
      try {
        await navigator.clipboard.writeText(text);
        panel.hidden = false;
        panel.innerHTML = '<p role="status" class="copy-msg">Result copied.</p>';
      } catch {
        panel.hidden = false;
        panel.innerHTML = '<p role="status" class="copy-msg">Copy this text:</p><label for="copy-text" class="sr-only">Result as plain text</label><textarea id="copy-text" class="copy-text" readonly rows="10"></textarea>';
        const ta = panel.querySelector('textarea'); ta.value = text; ta.focus(); ta.select();
      }
    }
  });

  window.addEventListener('popstate', route);
  route();
  return { getAnswers: () => answers };
}

// ---- Start the assessment on its page
const app = document.getElementById('app');
const live = document.getElementById('live');
if (app) startFinder(app, live);
