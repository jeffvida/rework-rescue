// Shared review state for the hero and the demo: one state, many views. Every view subscribes and repaints from the
// same state, so a decision in Findings updates the hero, Sources, the Management Summary and the action register.
// Kept in page memory only (no storage); a refresh starts again. The engine refuses anything its rules don't allow
// (publishing with a blocking check open, an assignment without an owner): the state is then unchanged and nothing
// is emitted.

import { initialState, decide, publish as doPublish } from './engine.js';

let state = initialState();
const subs = new Set();
const emit = (why) => subs.forEach((fn) => fn(state, why));
const apply = (next, why) => { if (next === state) return false; state = next; emit(why); return true; };

export const getState = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export const setDecision = (issue, choice, details) => apply(decide(state, issue, choice, details), { type: 'decision', issue });
export const publish = () => apply(doPublish(state), { type: 'publish' });
export function reset() { state = initialState(); emit({ type: 'reset' }); }
