// Find Your Rework: pure logic. No DOM, no network, no storage, no AI.
// diagnose(answers) -> a plain result object the page renders and the share form sends.

import { QUESTIONS, SCREENS, PILLARS, PER_MONTH, RESULT, LOW_VOLUME_HOURS } from './rules.js';

const find = (list, id) => list.find((o) => o.id === id) || null;

export function taskOptions(area) {
  return QUESTIONS.task.optionsByArea[area] || [];
}

export function taskOf(answers) {
  return find(taskOptions(answers.area), answers.task);
}

/** True when the visitor's task gives no category, so the remaining questions are skipped. */
export function isFallbackTask(answers) {
  const t = taskOf(answers);
  return !!t && t.pillar === null;
}

/** Errors for one screen: { questionId: message }. */
export function validateScreen(answers, n) {
  const errors = {};
  const screen = SCREENS.find((s) => s.n === n);
  if (!screen) return errors;
  for (const q of screen.questions) {
    if (q === 'task' && !answers.area) continue; // shown only after the area is chosen
    const v = answers[q];
    const empty = Array.isArray(v) ? v.length === 0 : !v;
    if (empty) errors[q] = q === 'limits' ? 'Please choose at least one option, or "None of these".' : 'Please choose one option.';
  }
  if (n === 1 && answers.area && answers.task && !taskOf(answers)) errors.task = 'Please choose one option.';
  return errors;
}

/** Next screen number after n, or 'result'. */
export function nextAfter(answers, n) {
  if (n === 1 && isFallbackTask(answers)) return 'result';
  return n < SCREENS.length ? n + 1 : 'result';
}

/** Earliest screen still missing an answer (used when someone jumps ahead via the address bar). */
export function firstIncomplete(answers) {
  for (const s of SCREENS) {
    if (s.n > 1 && isFallbackTask(answers)) return null;
    if (Object.keys(validateScreen(answers, s.n)).length) return s.n;
  }
  return null;
}

/** Toggle a multi-select answer, honouring exclusive options (None / Not sure). */
export function toggleLimit(current, id) {
  const list = Array.isArray(current) ? current : [];
  const exclusive = QUESTIONS.limits.exclusive;
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (exclusive.includes(id)) return [id];
  return [...list.filter((x) => !exclusive.includes(x)), id];
}

// ---------------------------------------------------------------- workload
const round = (n) => {
  if (n >= 100) return Math.round(n / 10) * 10;
  if (n >= 10) return Math.round(n);
  return Math.round(n * 10) / 10;
};
const fmt = (n) => String(round(n)).replace(/\.0$/, '');

function rangeText(lo, hi) {
  if (lo == null && hi == null) return '';
  if (lo == null) return `up to ${fmt(hi)}`;
  if (hi == null) return `at least ${fmt(lo)}`;
  if (round(lo) === round(hi)) return `about ${fmt(lo)}`;
  return `about ${fmt(lo)}–${fmt(hi)}`;
}

/**
 * Current workload only. Never a saving. Never invents a number:
 * - frequency + time known (and convertible) -> per month and per year range
 * - only time known -> time per occurrence (or per working day), no conversion
 * - only frequency known -> frequency only
 * - neither -> null
 */
export function workload(answers) {
  const freq = find(QUESTIONS.frequency.options, answers.frequency);
  const time = find(QUESTIONS.time.options, answers.time);
  const hasTime = !!time && time.id !== 'UNSURE';
  const hasFreq = !!freq && freq.id !== 'UNSURE';
  const perDay = answers.frequency === 'SEVERAL_DAILY';
  if (hasTime && hasFreq && PER_MONTH[freq.id]) {
    const m = PER_MONTH[freq.id];
    const mLo = time.lo == null ? null : time.lo * m.lo;
    const mHi = time.hi == null ? null : time.hi * m.hi;
    return {
      kind: 'annual',
      month: rangeText(mLo, mHi),
      year: rangeText(mLo == null ? null : mLo * 12, mHi == null ? null : mHi * 12),
      monthLo: mLo, monthHi: mHi,
    };
  }
  if (hasTime) return { kind: 'time', text: `${time.phrase} of combined staff time ${perDay ? 'each working day' : 'each time'}` };
  if (hasFreq) return { kind: 'frequency', text: freq.label };
  return null;
}

// ---------------------------------------------------------------- diagnosis
export function diagnose(answers) {
  const task = taskOf(answers);
  const areaOpt = find(QUESTIONS.area.options, answers.area);
  if (!task || task.pillar === null) {
    return {
      kind: 'fallback',
      pillar: null,
      pillarName: RESULT.fallback.title,
      area: areaOpt ? areaOpt.label : '',
      task: task ? task.label : '',
    };
  }
  const freq = find(QUESTIONS.frequency.options, answers.frequency);
  const time = find(QUESTIONS.time.options, answers.time);
  const consistency = find(QUESTIONS.consistency.options, answers.consistency);
  const limits = Array.isArray(answers.limits) ? answers.limits : [];
  const p = RESULT[task.pillar];
  const startKey = answers.consistency === 'SOME' || answers.consistency === 'VARIES' ? answers.consistency : 'SAME';
  const start = answers.consistency === 'UNSURE' ? RESULT.startUnsure : p.start[startKey];
  const isOther = /_OTHER$/.test(task.id);
  const wl = workload(answers);
  // "Less often" (quarterly or irregular) is at most about once a month, so the time per occasion is the monthly high end.
  const lowVolume = (!!wl && wl.kind === 'annual' && wl.monthHi != null && wl.monthHi < LOW_VOLUME_HOURS)
    || (answers.frequency === 'LESS' && !!time && time.hi != null && time.hi < LOW_VOLUME_HOURS);
  const flags = limits.filter((id) => RESULT.notes[id]);
  const gated = flags.some((f) => ['SENSITIVE', 'APPROVAL', 'DECISIONS', 'UNSURE'].includes(f));

  // Why this result: 1-2 sentences from the visitor's own answers.
  const parts = [`You said this involves ${task.activity}`];
  if (freq && freq.phrase) parts.push(`and happens ${freq.phrase}`);
  let why = parts.join(' ');
  if (time && time.phrase) why += `, taking ${time.phrase} of staff time ${answers.frequency === 'SEVERAL_DAILY' ? 'a day' : 'each time'}`;
  why += `. That makes ${PILLARS[task.pillar]} the strongest place to start.`;
  if (isOther) why = RESULT.otherWhy(areaOpt ? areaOpt.label.toLowerCase() : 'that area', PILLARS[task.pillar]);

  return {
    kind: 'pillar',
    pillar: task.pillar,
    pillarName: PILLARS[task.pillar],
    diagnosis: p.diagnosis,
    why,
    workload: wl,
    lowVolume: lowVolume ? RESULT.lowVolume : '',
    taskId: task.id,
    closestFit: isOther,
    start,
    fix: p.fix,
    fixTail: RESULT.fixTail,
    gatedTail: gated ? RESULT.gatedTail : '',
    notes: flags.map((f) => RESULT.notes[f]),
    measures: p.measures,
    example: p.example,
    // Plain labels of what the visitor chose (used for the shared summary).
    answers: {
      area: areaOpt ? areaOpt.label : '',
      task: task.label,
      frequency: freq ? freq.label : '',
      time: time ? time.label : '',
      consistency: consistency ? consistency.label : '',
      limits: limits.map((id) => find(QUESTIONS.limits.options, id)?.label).filter(Boolean),
    },
  };
}

/** Plain-text version for "Copy result" and for the shared summary preview. */
export function resultToText(r) {
  const lines = [`${RESULT.eyebrow}: ${r.pillarName}`, ''];
  if (r.kind === 'fallback') {
    lines.push(RESULT.fallback.diagnosis, '', 'Write down:', ...RESULT.fallback.steps.map((s, i) => `${i + 1}. ${s}`));
    return lines.join('\n');
  }
  lines.push(r.diagnosis, '', r.why);
  if (r.workload) {
    lines.push('');
    if (r.workload.kind === 'annual') lines.push(`Estimated current workload: ${r.workload.month} staff-hours a month, ${r.workload.year} a year (an estimate, not a saving).`);
    else if (r.workload.kind === 'time') lines.push(`Estimated time: ${r.workload.text}.`);
    else lines.push(`How often: ${r.workload.text}.`);
  }
  if (r.lowVolume) lines.push('', r.lowVolume);
  lines.push('', `Start here: ${r.start.lead}`, ...r.start.steps.map((s) => `- ${s}`));
  lines.push('', `What a fix usually looks like: ${r.fix}`);
  if (r.notes.length) lines.push('', `${RESULT.notesHeading}:`, ...r.notes.map((n) => `- ${n}`));
  lines.push('', 'What to measure:', ...r.measures.map((m) => `- ${m}`));
  return lines.join('\n');
}

/** What is attached when the visitor chooses to share (shown to them before sending). */
export function shareSummary(r) {
  if (r.kind === 'fallback') {
    return [`Result: ${r.pillarName}`, r.area ? `Area: ${r.area}` : '', r.task ? `Task: ${r.task}` : ''].filter(Boolean).join('\n');
  }
  const w = r.workload;
  const wl = !w ? 'Not given' : w.kind === 'annual' ? `${w.month} staff-hours a month (${w.year} a year)` : w.text;
  return [
    `Result: ${r.pillarName}`,
    `Area: ${r.answers.area}`,
    `Task: ${r.answers.task}`,
    `How often: ${r.answers.frequency}`,
    `Time each time: ${r.answers.time}`,
    `Estimated workload: ${wl}`,
    `Same steps each time: ${r.answers.consistency}`,
    `Things to check: ${r.answers.limits.join('; ') || 'None'}`,
  ].join('\n');
}
