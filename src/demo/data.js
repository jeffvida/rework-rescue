// Live demo data: one week at Quillfern Home Repairs, a clearly invented business. Everything here is fictional.
// 17 records are in the job list; R-118 is a website request that never left the inbox.
// The engine (./engine.js) works out every number the page shows from these records; tests/demo.test.mjs checks them.
//
// status: 'done' | 'booked' | 'waiting' | 'request'
// markedInvoiced: what the job list says. invoice: what accounting actually has (null = no invoice).

export const BUSINESS = 'Quillfern Home Repairs';
export const WEEK = 'Mon 9 Nov 2026';

export const RECORDS = [
  { ref: 'J-2039', source: 'Phone', customer: 'L. Ramos', job: 'Leaking tap', address: '22 Elm Rd', status: 'done', when: 'Tue 3 Nov', markedInvoiced: true, invoice: 'INV-3311', inList: true },
  { ref: 'J-2040', source: 'Email', customer: 'K. Tan', job: 'Light fitting', address: '8 Bay St', status: 'done', when: 'Wed 4 Nov', markedInvoiced: true, invoice: 'INV-3312', inList: true },
  { ref: 'J-2041', source: 'Phone', customer: 'D. Cruz', job: 'Gutter repair', address: '5 Hill Ave', status: 'done', when: 'Thu 5 Nov', markedInvoiced: true, invoice: null, inList: true },
  { ref: 'J-2042', source: 'Website', customer: 'P. Lim', job: 'Door lock', address: '17 Oak St', status: 'booked', when: 'Mon 9 Nov 10:00', inList: true },
  { ref: 'J-2043', source: 'Phone', customer: 'S. Gomez', job: 'Smoke alarms', address: '3 Reef Ct', status: 'booked', when: 'Mon 9 Nov 14:00', inList: true },
  { ref: 'J-2044', source: 'Email', customer: 'A. Navarro', job: 'Hot water unit', address: '41 Cove Rd', status: 'waiting', reason: 'Part on order, due 12 Nov', inList: true },
  { ref: 'J-2045', source: 'Website', customer: 'R. Chua', job: 'Fence panel', address: '9 Ridge Ln', status: 'booked', when: 'Tue 10 Nov 09:00', inList: true },
  { ref: 'J-2046', source: 'Email', customer: 'T. Reyes', job: 'Bathroom reseal', address: '12 Palm St', status: 'waiting', reason: 'Quote sent 4 Nov, with the customer', inList: true },
  { ref: 'J-2047', source: 'Phone', customer: 'J. Ong', job: 'Ceiling fan', address: '30 Mill Rd', status: 'booked', when: 'Tue 10 Nov 13:00', inList: true },
  { ref: 'J-2048', source: 'Phone', customer: 'E. Diaz', job: 'Window latch', address: '6 Shore Dr', status: 'waiting', reason: 'Customer away until 16 Nov', inList: true },
  { ref: 'J-2049', source: 'Phone', customer: 'M. Santos', job: 'Aircon service', address: '27 Lake St', status: 'booked', when: 'Thu 12 Nov 09:00', inList: true },
  { ref: 'J-2050', source: 'Website', customer: 'F. Garcia', job: 'Tile repair', address: '14 Hill Ave', status: 'booked', when: 'Wed 11 Nov 10:00', inList: true },
  { ref: 'J-2051', source: 'Website', customer: 'M. Santos', job: 'Aircon service', address: '27 Lake St', status: 'booked', when: 'Thu 12 Nov 09:00', inList: true },
  { ref: 'J-2053', source: 'Email', customer: 'H. Lee', job: 'Shelving install', address: '2 Park Pl', status: 'booked', when: 'Wed 11 Nov 15:00', inList: true },
  { ref: 'J-2054', source: 'Phone', customer: 'N. Perez', job: 'Tap replacement', address: '19 Bay St', status: 'booked', when: 'Thu 12 Nov 13:00', inList: true },
  { ref: 'J-2055', source: 'Website', customer: 'B. Yu', job: 'Deck repair', address: '33 Ridge Ln', status: 'booked', when: 'Fri 13 Nov 09:00', inList: true },
  { ref: 'J-2056', source: 'Phone', customer: 'C. Mendoza', job: 'Power point', address: '11 Oak St', status: 'booked', when: 'Fri 13 Nov 13:00', inList: true },
  { ref: 'R-118', source: 'Website form', customer: 'G. Torres', job: 'Water heater service', address: '', status: 'request', inList: false },
];

// What happens during the demo (all simulated).
export const NEW_INVOICE = 'INV-3318';
export const R118_REPLY = { address: '45 Pine St', ref: 'J-2057', when: 'Wed 11 Nov 13:00' };
export const TEST_REQUEST = { request: 'R-119', ref: 'J-2058', source: 'Website form', customer: 'Test request', job: 'Gutter cleaning', address: '8 Cedar Rd', when: 'Thu 12 Nov 15:00' };

// What each problem costs, and why it happened (made-up figures, like everything here).
export const HAND_REPORT = 'about 2 hours every Monday';
export const COSTS = {
  duplicate: 'Two technicians could go to the same job on Thursday.',
  invoice: '$480 of finished work hasn\u2019t been billed.',
  address: 'Waiting four days. The customer may have called someone else.',
};
export const CAUSES = [
  { problem: 'Santos booked twice', why: 'Phone and website bookings are stored separately.', fix: 'Every new booking checks the calendar first.' },
  { problem: 'Cruz not invoiced', why: 'Invoice status depends on a manually updated checkbox.', fix: 'Invoice status is matched against the accounts.' },
  { problem: 'Torres request incomplete', why: 'The website form does not require an address and sends requests to an inbox.', fix: 'Require an address and send requests directly to the job list.' },
];
