// Contact page: the booking pop-up, plus email and LinkedIn in the page itself.
// Arriving from another page's booking link (contact/#contact-form-area) opens the pop-up straight away,
// and a link can preselect the service, e.g. contact/?service=systems#contact-form-area.
// The written inquiry form was removed until it has somewhere to send to; it is in the git history
// (src/ui/inquiry-form.js before the simplification), and its field checks are still in src/inquiry.js.

import { mountBooking } from './booking/popup.js';

let linkedService = '';
try { linkedService = new URLSearchParams(location.search).get('service') || ''; } catch { /* ignore */ }

const booking = mountBooking({ base: '../', getContext: () => (linkedService ? { service: linkedService } : null) });
if (location.hash === '#contact-form-area') booking.open(linkedService);
