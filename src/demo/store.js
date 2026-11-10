// Shared review state for the hero card and the live example: one state, many views.
// Every view subscribes and repaints from the same state, so a decision made in either place updates the findings,
// figures, checks, chart and AI findings everywhere. Kept in page memory only (no storage); a refresh starts again.

import { initialState, decide, publish as doPublish } from './engine.js';

let state = initialState();
const subs = new Set();
const emit = (why) => subs.forEach((fn) => fn(state, why));

export const getState = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function setDecision(issue, choice) { const next = decide(state, issue, choice); if (next !== state) { state = next; emit({ type: 'decision', issue }); } }
export function publish() { const next = doPublish(state); if (next !== state) { state = next; emit({ type: 'publish' }); } }
export function reset() { state = initialState(); emit({ type: 'reset' }); }
