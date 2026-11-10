// Shared review state for the hero card and the live example: one state, many views.
// Every view subscribes and repaints from the same state, so a decision made in either place updates the findings,
// figures, checks, chart and AI findings everywhere. Kept in page memory only (no storage); a refresh starts again.
// The engine refuses anything the rules don't allow (a release without sign-off, Tuesday before the duplicate, an
// assignment without an owner): a refused action leaves the state unchanged and nothing is emitted.

import { initialState, decide, signOff as doSignOff, release as doRelease } from './engine.js';

let state = initialState();
const subs = new Set();
const emit = (why) => subs.forEach((fn) => fn(state, why));
const apply = (next, why) => { if (next === state) return false; state = next; emit(why); return true; };

export const getState = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export const setDecision = (issue, choice, details) => apply(decide(state, issue, choice, details), { type: 'decision', issue });
export const signOff = () => apply(doSignOff(state), { type: 'signoff' });
export const release = () => apply(doRelease(state), { type: 'release' });
export function reset() { state = initialState(); emit({ type: 'reset' }); }
