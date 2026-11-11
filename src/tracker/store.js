// The tracker's current records, shared by the main demonstration and the hero illustration. Page memory only:
// nothing is stored or sent, and Reset or a refresh brings back the sample in src/tracker/data.js.
import { RECORDS } from './data.js';
import * as E from './engine.js';

let records = RECORDS;
const subs = new Set();
const apply = (next) => { records = next; subs.forEach((fn) => fn(records)); };

export const getRecords = () => records;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export const setOwner = (ref, owner) => apply(E.setOwner(records, ref, owner));
export const setStatus = (ref, status) => apply(E.setStatus(records, ref, status));
export const setCustomer = (ref, customer) => apply(E.setCustomer(records, ref, customer));
// Not offered on the page; the browser tests use it to check that a possible duplicate is flagged.
export const addRecord = (rec) => apply(E.addRecord(records, rec));
export const reset = () => apply(RECORDS);
