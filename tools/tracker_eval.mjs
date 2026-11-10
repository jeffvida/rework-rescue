// Used by tools/check_tracker_xlsx.py: reads {records, period} as JSON on stdin and prints what the website's engine
// (src/tracker/engine.js) makes of them, so the workbook's recalculated results can be compared with it.
import { summarise, flagText } from '../src/tracker/engine.js';

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  const { records, period } = JSON.parse(input);
  const s = summarise(records, period);
  console.log(JSON.stringify({
    metrics: { total: s.total, completed: s.completed, outstanding: s.outstanding, overdue: s.overdue, unassigned: s.unassigned, missing: s.missing, attention: s.attention },
    text: s.text,
    flags: Object.fromEntries(records.map((r) => [r.ref, flagText(r, records, period)])),
    followUps: s.followUps.map((f) => [f.ref, f.title, f.owner, f.due, f.reason]),
  }));
});
