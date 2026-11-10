// Shared state for the hero and the main demo: one state, many views. Every view subscribes and repaints from the
// same state, so a change in Actions or Workflows updates Data, Reports, the workspace overview and the hero.
// Kept in page memory only (no storage); Reset or a refresh starts again. The engine refuses anything its rules
// don't allow (starting a task nobody owns, a sixth sample request): the state is then unchanged and nothing is
// emitted, and the action returns false.

import * as E from './engine.js';

let state = E.initialState();
const subs = new Set();
const emit = (why) => subs.forEach((fn) => fn(state, why));
const apply = (next, why) => { if (next === state) return false; state = next; emit(why); return true; };

export const getState = () => state;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export const decide = (issue, choice) => apply(E.decide(state, issue, choice), { type: 'decision' });
export const assign = (id, owner) => apply(E.assign(state, id, owner), { type: 'task' });
export const setStatus = (id, st) => apply(E.setStatus(state, id, st), { type: 'task' });
export const review = (id) => apply(E.review(state, id), { type: 'task' });
export const remind = (id) => apply(E.remind(state, id), { type: 'reminder' });
export const submitRequest = (d) => apply(E.submitRequest(state, d), { type: 'request' });
export function reset() { state = E.initialState(); emit({ type: 'reset' }); }
