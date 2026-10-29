import { SITE } from '../config/site.js';
import { mountInquiryForm, confirmationHtml } from './inquiry-form.js';
import { mountBooking } from './booking.js';

// Once live booking is connected, "Book a free rework review" opens the booking pop-up here too,
// and arriving from another page's booking link (contact/#contact-form-area) opens it straight away.
// Until then this page keeps its contact form as the booking route.
if (SITE.bookingAvailabilityUrl && SITE.bookingRequestUrl) {
  const booking = mountBooking({ base: '../' });
  if (location.hash === '#contact-form-area') booking.open();
}

const root = document.getElementById('contact-root');
const area = document.getElementById('contact-form-area');
if (root && area) {
  mountInquiryForm(root, {
    getAnswers: () => ({}),
    getDecision: () => null,
    privacyHref: '../privacy/',
    onSent: () => {
      root.innerHTML = `<section class="confirmation">${confirmationHtml(SITE)}</section>`;
      const h = root.querySelector('#confirm-title');
      if (h) h.focus();
    },
  });
}
