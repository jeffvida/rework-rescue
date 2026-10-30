// ============================================================================
//  SITE SETTINGS: contact details, booking and form connections, and a few options.
//
//  Page wording is NOT here: it lives in the pages themselves (index.html, contact/index.html,
//  privacy/index.html, assessment/index.html), so each sentence is stored once.
//  Assessment questions and result wording: src/assessment/rules.js (approved and tested).
//  Example data: src/sample and src/bills (regenerate with tools/generate_*.py).
//  Colours and layout: assets/styles.css (see the :root block at the top).
//
//  How to edit: change the text between the quote marks and commit the file to GitHub.
//  There is no build step: Vercel redeploys the site automatically after each commit.
//  Make changes on a separate branch first to get a preview link before they go live.
//  Keep the commas, quotes and brackets exactly as they are. An apostrophe inside text wrapped
//  in 'single quotes' needs a backslash (it\'s), or wrap that text in "double quotes" instead.
//
//  Nothing here is a secret. Values marked PROVISIONAL must be confirmed before launch.
// ============================================================================

// ---------------------------------------------------------------- 1. You and the business
const SPECIALIST_EMAIL = 'jeffhersonvida@gmail.com';

// Public contact details: professional email and LinkedIn only. No mobile number is shown anywhere.
export const SPECIALIST = {
  name: 'Jeff Herson Vida',
  title: 'Data, Reporting & Workflow Automation Specialist',
  email: SPECIALIST_EMAIL,
  linkedin: 'https://www.linkedin.com/in/jeffhersonvida',
  linkedinLabel: 'linkedin.com/in/jeffhersonvida',
  // Profile photo files (assets/photo/). Replace the files to change the photo; keep the same names.
  photo: 'assets/photo/jeff-portrait.jpg',      // 4:5, About section
  photoSmall: 'assets/photo/jeff-avatar.jpg',   // square, final call-to-action
  photoAlt: 'Portrait of Jeff Herson Vida',
  // Public location line. Do not add a town or a phone number here.
  location: 'Based in the Philippines · Available to work remotely with teams worldwide.',
};

export const SITE = {
  name: 'Rework Rescue',
  tagline: 'Less rework. More real work.',
  contactEmail: SPECIALIST_EMAIL,
  // PROVISIONAL (confirm before launch)
  CALL_MINUTES: 30,
  RESPONSE_DAYS: 3,
  // Assessment length. The questions and result wording live in src/assessment/rules.js.
  assessmentDuration: 'about 2 minutes',
  // Booking pop-up (src/booking/popup.js), connected to the n8n workflow in n8n/rework-review-booking.json.
  // Paste the two Production URLs from the workflow's Webhook nodes here. While either is empty, the pop-up
  // shows bookable hours without checking the calendar and ends in an email draft (nothing is sent).
  // Bookable hours live in src/booking/slots.js.
  bookingAvailabilityUrl: 'https://reworkrescue.app.n8n.cloud/webhook/rr-availability', // GET, e.g. https://YOUR-NAME.app.n8n.cloud/webhook/rr-availability
  bookingRequestUrl: 'https://reworkrescue.app.n8n.cloud/webhook/rr-book', // POST, e.g. https://YOUR-NAME.app.n8n.cloud/webhook/rr-book
  // Inquiry delivery. Leave empty until a server-side endpoint exists (for example an n8n webhook URL).
  // This repository is public, so the URL is visible to anyone: the endpoint must filter spam itself.
  // The browser never holds an email-provider key; the endpoint must be your own server or a
  // form-handling service that keeps credentials server-side.
  submitEndpoint: '',
  NOTE_MAX: 500,
};
