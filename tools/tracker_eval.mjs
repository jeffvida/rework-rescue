// Used by tools/check_tracker_xlsx.py: reads {records, period} as JSON on stdin and prints what the website makes of
// them (src/tracker/engine.js, the hero's checks in src/demo/hero.js and the live example's report in
// src/tracker/ui.js), so the workbook's recalculated results can be compared with it.
import { summarise, flagText, byStatus } from '../src/tracker/engine.js';
import { dataChecks, STATE } from '../src/demo/hero.js';
import { attentionItems } from '../src/tracker/ui.js';

// The workbook writes each check's status with a symbol, and uses the live example's wording for two checks.
const MARK = { pass: '✓ ', flag: '! ', action: '● ' };
const LABEL = {};
const DETAIL = {};

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  const { records, period } = JSON.parse(input);
  const s = summarise(records, period);
  const c = dataChecks(records, period);
  console.log(JSON.stringify({
    metrics: { total: s.total, completed: s.completed, outstanding: s.outstanding, overdue: s.overdue, unassigned: s.unassigned, missing: s.missing, attention: s.attention },
    text: s.text,
    flags: Object.fromEntries(records.map((r) => [r.ref, flagText(r, records, period)])),
    attention: attentionItems(records, { all: true, period }).slice(0, 10).map((x) => [x.ref, x.what, x.owner || 'Unassigned', x.due, x.tag]),
    checks: [...c.capture, ...c.move, ...c.see].map((x) => [LABEL[x.label] || x.label, DETAIL[x.detail] || x.detail, MARK[x.state] + STATE[x.state]]),
    // In the report's order: Completed first, then the open statuses.
    byStatus: ['Completed', 'In Progress', 'Waiting', 'Not Started'].map((st) => byStatus(records, period).find((x) => x.status === st).count),
  }));
});
