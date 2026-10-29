// Run with: node --test tests/finder.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose, workload, nextAfter, validateScreen, toggleLimit, firstIncomplete, shareSummary } from '../src/finder/engine.js';
import { QUESTIONS } from '../src/finder/rules.js';

const full = (o) => ({ frequency: 'MONTHLY', time: 'T_2_4', consistency: 'SAME', limits: ['NONE'], ...o });

test('Scenario 1: recurring monthly report -> Reporting Rework, repeatable first', () => {
  const r = diagnose(full({ area: 'REPORTS', task: 'R_RECURRING' }));
  assert.equal(r.pillarName, 'Reporting Rework');
  assert.equal(r.start.lead, 'Make the reporting process repeatable before trying to automate it.');
});

test('Scenario 2: two sources do not match -> Data Rework', () => {
  const r = diagnose(full({ area: 'DATA', task: 'D_MISMATCH' }));
  assert.equal(r.pillarName, 'Data Rework');
  assert.equal(r.start.lead, 'Agree on what the correct data should look like before trying to automate the checking.');
});

test('Scenario 3: chasing approvals -> Workflow Rework', () => {
  const r = diagnose(full({ area: 'WORKFLOW', task: 'W_APPROVALS' }));
  assert.equal(r.pillarName, 'Workflow Rework');
  assert.equal(r.start.lead, 'Map the workflow from start to finish before changing the tools.');
});

test('Scenario 4: unclear -> Start with one process, remaining questions skipped', () => {
  const a = { area: 'UNSURE', task: 'U_NONE' };
  assert.equal(nextAfter(a, 1), 'result');
  assert.equal(diagnose(a).kind, 'fallback');
  assert.equal(firstIncomplete(a), null);
});

test('The task decides the result: chasing numbers for a report is Workflow Rework', () => {
  assert.equal(diagnose(full({ area: 'REPORTS', task: 'R_CHASE' })).pillar, 'WORKFLOW');
});

test('Every task maps to a valid result, and every area has a "something else" route', () => {
  for (const [area, list] of Object.entries(QUESTIONS.task.optionsByArea)) {
    for (const t of list) {
      const r = diagnose(full({ area, task: t.id }));
      if (t.pillar === null) assert.equal(r.kind, 'fallback');
      else assert.ok(['Reporting Rework', 'Data Rework', 'Workflow Rework'].includes(r.pillarName), t.id);
    }
  }
});

test('Consistency changes only the advice, never the result', () => {
  const some = diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', consistency: 'SOME' }));
  const varies = diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', consistency: 'VARIES' }));
  assert.equal(some.pillar, 'REPORTING');
  assert.match(some.start.lead, /more consistent/);
  assert.match(varies.start.lead, /^Standardize/);
});

test('Workload: monthly 2-4 hours -> 2-4 a month, 24-48 a year', () => {
  const w = workload({ frequency: 'MONTHLY', time: 'T_2_4' });
  assert.equal(w.month, 'about 2–4');
  assert.equal(w.year, 'about 24–48');
});

test('Workload: open-ended and capped ranges never invent a figure', () => {
  assert.match(workload({ frequency: 'WEEKLY', time: 'T_8P' }).month, /^at least/);
  assert.match(workload({ frequency: 'DAILY', time: 'T_LT15' }).month, /^up to/);
});

test('Workload fallbacks: time only, frequency only, neither, and "less often" not annualized', () => {
  assert.equal(workload({ frequency: 'UNSURE', time: 'T_1_2' }).kind, 'time');
  assert.equal(workload({ frequency: 'LESS', time: 'T_1_2' }).kind, 'time');
  assert.equal(workload({ frequency: 'WEEKLY', time: 'UNSURE' }).kind, 'frequency');
  assert.equal(workload({ frequency: 'UNSURE', time: 'UNSURE' }), null);
});

test('Limits add notes but never change or block the result', () => {
  const r = diagnose(full({ area: 'DATA', task: 'D_CHECKS', limits: ['SENSITIVE', 'APPROVAL', 'DECISIONS'] }));
  assert.equal(r.pillar, 'DATA');
  assert.equal(r.notes.length, 3);
  assert.ok(r.gatedTail.length > 0);
  const clean = diagnose(full({ area: 'DATA', task: 'D_CHECKS', limits: ['NONE'] }));
  assert.equal(clean.notes.length, 0);
  assert.equal(clean.gatedTail, '');
});

test('"None" and "Not sure" are exclusive in the limits question', () => {
  assert.deepEqual(toggleLimit(['SENSITIVE'], 'NONE'), ['NONE']);
  assert.deepEqual(toggleLimit(['NONE'], 'SYSTEM'), ['SYSTEM']);
  assert.deepEqual(toggleLimit(['SYSTEM'], 'SENSITIVE'), ['SYSTEM', 'SENSITIVE']);
});

test('Validation: every screen needs an answer; task appears only after area', () => {
  assert.deepEqual(Object.keys(validateScreen({}, 1)), ['area']);
  assert.deepEqual(Object.keys(validateScreen({ area: 'DATA' }, 1)), ['task']);
  assert.deepEqual(Object.keys(validateScreen({}, 3)).sort(), ['consistency', 'limits']);
});

test('Shared summary contains the result and answers only', () => {
  const s = shareSummary(diagnose(full({ area: 'REPORTS', task: 'R_COMBINE' })));
  assert.match(s, /^Result: Reporting Rework/);
  assert.match(s, /Estimated workload: about 2–4 staff-hours a month/);
});

test('Q5 "Not sure" gets its own find-out-first advice, for every service', () => {
  for (const [area, task] of [['REPORTS', 'R_RECURRING'], ['DATA', 'D_MISMATCH'], ['WORKFLOW', 'W_APPROVALS']]) {
    const r = diagnose(full({ area, task, consistency: 'UNSURE' }));
    assert.match(r.start.lead, /^Find out how it’s actually done today/);
    assert.equal(r.start.steps.length, 3);
  }
});

test('Low-volume note: under 2 staff-hours a month at the high end; the service stays', () => {
  const low = diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', frequency: 'MONTHLY', time: 'T_30_60' }));
  assert.equal(low.pillarName, 'Reporting Rework');
  assert.match(low.lowVolume, /probably isn’t worth it yet/);
  assert.match(low.lowVolume, /mistakes here are costly/);
  assert.equal(diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', frequency: 'MONTHLY', time: 'T_1_2' })).lowVolume, '', 'exactly 2 is not low');
  assert.equal(diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', frequency: 'WEEKLY', time: 'T_15_30' })).lowVolume, '');
  assert.match(diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', frequency: 'LESS', time: 'T_LT15' })).lowVolume, /probably isn’t worth it yet/, 'quarterly or irregular, under 15 minutes');
  assert.match(diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', frequency: 'LESS', time: 'T_30_60' })).lowVolume, /probably/, 'less often, 30-60 minutes');
  assert.equal(diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', frequency: 'LESS', time: 'T_1_2' })).lowVolume, '', 'less often, 1-2 hours: high end is exactly 2');
  assert.equal(diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', frequency: 'UNSURE', time: 'T_LT15' })).lowVolume, '', 'frequency unknown: no note');
  assert.equal(diagnose(full({ area: 'REPORTS', task: 'R_RECURRING', frequency: 'MONTHLY', time: 'T_8P' })).lowVolume, '');
});

test('"Something else" is worded as the closest fit', () => {
  const r = diagnose(full({ area: 'DATA', task: 'D_OTHER' }));
  assert.equal(r.pillarName, 'Data Rework');
  assert.ok(r.closestFit);
  assert.match(r.why, /closest fit/);
  assert.equal(diagnose(full({ area: 'DATA', task: 'D_MISMATCH' })).closestFit, false);
});
