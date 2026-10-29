import { SITE } from '../config/site.js';
import { mountInquiryForm, confirmationHtml } from './inquiry-form.js';

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
