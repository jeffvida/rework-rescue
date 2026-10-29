// ============================================================================
//  SITE SETTINGS: the one file to edit for names, contact details, wording and options.
//
//  How to edit: change the text between the quote marks and commit the file to GitHub.
//  There is no build step: Vercel redeploys the site automatically after each commit.
//  Make changes on a separate branch first to get a preview link before they go live.
//  Keep the commas, quotes and brackets exactly as they are.
//  An apostrophe inside text wrapped in 'single quotes' needs a backslash (it\'s) or
//  wrap that text in "double quotes" instead.
//
//  Not in this file: colours and layout (assets/styles.css, see the :root block at the top),
//  the assessment questions and rules (src/finder: approved and tested),
//  the example data (src/sample, src/bills; regenerate with tools/generate_*.py),
//  and each page's title, description and share-preview tags (the <head> of each index.html).
//
//  Nothing here is a secret. Values marked PROVISIONAL must be confirmed before launch.
//  Nothing here may invent testimonials, client names, statistics, certifications or
//  guaranteed savings.
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
  // Assessment length. The questions and result wording live in src/finder/rules.js.
  assessmentDuration: 'about 2 minutes',
  // Booking: the homepage pop-up (src/ui/booking.js) shows example times and ends in an email draft.
  // Replace it with the Cal.com pop-up once a booking link exists.
  bookingUrl: '',
  // Inquiry delivery. Leave empty until a server-side endpoint exists (for example an n8n webhook URL).
  // This repository is public, so the URL is visible to anyone: the endpoint must filter spam itself.
  // The browser never holds an email-provider key; the endpoint must be your own server or a
  // form-handling service that keeps credentials server-side.
  submitEndpoint: '',
  // Funnel events (assessment_started, _completed, _share_started, _lead_submitted) are prepared but
  // send nothing. Leave as null until an analytics tool is chosen, then update the privacy page.
  analytics: null,
  NOTE_MAX: 500,
};

// ---------------------------------------------------------------- 2. Page wording (homepage, FAQ, about, contact, footer)
// Homepage order: hero (with report preview), "You might need Rework Rescue if…" (with the Find Your Rework band),
// what I help with, see the kind of work I do (two examples + rework review prompt), about Jeff,
// how it works (with after handover), FAQ, closing call-to-action and contact.
// Main action everywhere: Book a free rework review. Find Your Rework is the secondary path.
// Voice: "I" for Jeff; "Rework Rescue" for the business. Never imply a team.
// Assessment questions and result wording live in src/finder/rules.js.
export const COPY = {
  tagline: 'Less rework. More real work.',
  positioning: 'Rework Rescue helps small teams reduce manual reporting, data checking, and repetitive workflows using the tools they already have.',
  primaryCta: 'Book a free rework review', // links to contact/#contact-form-area
  secondaryCta: 'Find Your Rework', // links to the assessment
  // The call button. Every one links to the form on the contact page (contact/#contact-form-area).
  // While the form isn't connected, it shows a "Not connected yet" notice and sends nothing.
  review: {
    button: 'Book a free rework review',
    support: "30 minutes. Bring one report or process. You'll leave knowing whether it's worth fixing and roughly what it would take.",
    afterSamples: 'Recognise one of these in your own team?',
  },
  hero: {
    eyebrow: 'Less rework. More real work.',
    headline: 'Fix the reports and checks your team keeps redoing.',
    subheadline: 'I help small operations, admin and finance teams cut the repetitive reporting, data checks and manual steps, using the tools they already have.',
    cta: 'Book a free rework review',
    secondary: 'See a sample report', // links to #samples
    note: 'Not sure where to start? Find Your Rework: 6 questions, about 2 minutes, no sign-up.',
    credibility: { name: 'Jeff Herson Vida', line: 'You work directly with me, not a sales team. 8+ years in data operations and reporting.' },
  },
  fit: {
    heading: 'You might need Rework Rescue if…',
    items: [
      'You rebuild or update the same reports every week or month.',
      'You spend too much time cleaning, checking, or reconciling data.',
      'The same information has to be copied between spreadsheets or systems.',
      'You repeatedly investigate discrepancies or correct avoidable errors.',
      'Your reporting depends on manual steps that are difficult to repeat consistently.',
      'Your existing tools work, but the process around them takes too much effort.',
    ],
    close: "If that sounds familiar, there's probably rework hiding in your process.",
  },
  services: {
    // Each card: number, title, promise, the "I can help with" list and the goal (the longer paragraph was removed).
    heading: 'What I help with',
    items: [
      { num: '01', title: 'Reporting Rework', promise: 'Stop rebuilding the same reports every week.', points: ['Weekly and monthly reports', 'Excel and spreadsheet reporting', 'KPI and operational reports', 'Recurring data consolidation'], goal: 'a reporting process that is repeatable instead of rebuilt from scratch.' },
      { num: '02', title: 'Data Rework', promise: 'Catch problems before they become bigger problems.', points: ['Data cleaning and validation', 'Error and exception checks', 'Reconciliation between sources', 'Duplicate detection'], goal: 'spend less time checking everything and more time reviewing what actually needs attention.' },
      { num: '03', title: 'Workflow Rework', promise: "Remove the repetitive steps your team shouldn't still be doing manually.", points: ['Spreadsheet workflows and handoffs', 'Workflow automation between existing tools', 'CRM data and reporting improvements', 'AI automation, where practical'], goal: 'fewer manual steps and a smoother process.' },
    ],
    tools: 'Works with what you have: exports from accounting, CRM and job-management systems, in Excel or Google Sheets.',
    note: 'Replacing a core business system is outside my initial offer. Sensitive or regulated information needs a review of safeguards before anything is built.',
  },
  samples: {
    heading: 'See the kind of work I do',
    intro: 'Two complete examples you can click through. Pick the one closest to your own work.',
    // The one disclosure for the whole examples area.
    disclosure: "About these examples: they use fictional data and aren't client projects or savings claims. They show the kind of problem I work on.",
    runsOn: 'Usually no new software. In a real project this runs in tools you already use, such as Excel with Power Query, Google Sheets, a scheduled script or your existing systems.',
    // The two interactive examples. Their data and checks live in src/sample (example 1) and src/bills (example 2);
    // every number on screen is calculated from that data and checked by tests/sample.test.mjs and tests/bills.test.mjs.
    // Link to one directly with #example-1 or #example-2.
    examples: [
      { switchLabel: 'Billing gaps: jobs and invoices', title: 'From three messy exports to a reliable weekly report', sub: 'See how a repetitive weekly report becomes a repeatable workflow, with automatic checks and a person making the decisions.', short: "354 rows checked, 12 sent to a person to review, and $4,380 of completed work found that hadn't been invoiced." },
      { switchLabel: 'Recurring bills across sites', title: 'From a pile of monthly bills to a payment run you can trust', sub: 'See how checking 50 recurring bills across 12 sites becomes a short list of exceptions, with a person deciding what gets paid.', short: '53 bills checked, 8 items sent to a person, $998 held because it may not be owed, and 47 bills ($44,657) ready to approve.' },
    ],
    reliable: ['Checks before reporting', 'Exceptions instead of checking everything', 'Inputs reconciled to outputs', 'A person approves'],
    cta: { heading: 'Have a process like this?', button: 'Book a free rework review' },
    // For visitors who can't hire a specialist themselves.
    shareNote: 'Not the one who decides? Find Your Rework takes about 2 minutes and gives you a result you can copy and send to your manager.',
  },
  about: {
    heading: 'About Jeff',
    name: 'Jeff Herson Vida',
    title: 'Data, Reporting & Workflow Automation Specialist',
    paragraphs: [
      // Proof from employment. Do not name employers.
      "I've spent 8+ years working with operational data that has to be right: first validating solar performance data and building recurring reports, and now verifying utility bills and usage data and investigating discrepancies.",
      "In those roles I've used tools such as Excel, Power Query and Python to clean and validate data, reconcile sources and improve recurring reporting workflows.",
      'Rework Rescue brings that practical experience to smaller teams that want to improve the work around the tools they already use.',
    ],
    linkedinLabel: 'View my professional background on LinkedIn →',
  },
  how: {
    heading: 'How it works',
    intro: 'I start with the work—not the technology.',
    steps: [
      { title: "Tell me what's taking too long", text: 'We start with a free 30-minute rework review of the spreadsheet, report or workflow creating the most friction.' },
      { title: 'Identify the rework', text: 'I look at the current process and identify repetitive steps, manual handoffs and opportunities to simplify.' },
      { title: 'Build and test', text: 'I build the agreed practical solution using the tools that make sense, and test it before handover.' },
      { title: 'Handover', text: 'I walk your team through it and hand over everything listed below.' },
    ],
    whatYouGet: {
      heading: 'What you get',
      items: ['The working file, workbook or script, set up in your tools.', 'A test run on your own files before handover.', 'A short run guide: the steps, and what each check means.', 'A handover call to walk your team through it.'],
    },
    afterHandover: {
      heading: 'After handover',
      // 30-day fix period confirmed 28 Oct 2026.
      items: ['It runs in the tools you already use, and you own it.', 'Someone on your team can run it without me.', "If something doesn't work as agreed in the first 30 days, I fix it at no extra cost.", 'Ongoing support is optional, not a requirement.'],
    },
    cta: 'Book a free rework review',
  },
  finder: {
    eyebrow: 'Find Your Rework',
    heading: 'Not sure where the rework is?',
    text: "Answer 6 quick questions about one report, data problem, or repetitive process your team deals with. It doesn't need to be perfectly documented.",
    detail: "You'll see which kind of rework it is, roughly how much time it takes today, and three practical steps to start with.",
    // Keep accurate: the assessment runs in the browser and sends nothing unless the visitor shares their result.
    support: "Free, about 2 minutes, no sign-up or email. Your answers stay in your browser and aren't sent to me unless you choose to share your result.",
    cta: 'Start the Assessment',
  },
  faq: {
    heading: 'Frequently asked questions',
    items: [
      ['Who will I actually work with?', "You work directly with me, Jeff. There's no sales team or account manager in between: the person you talk to is the person who looks at your process and does the work."],
      ['Will this replace anyone on my team?', 'No. It removes the copying and checking, so your team spends its time on the work that needs them. A person still reviews every flagged item and decides what happens.'],
      ['What happens in the free rework review?', "It's a 30-minute conversation about one report, check or process you choose. I ask how it runs today, where the time goes and where errors show up. You'll leave knowing whether it's worth fixing and roughly what it would take. It's a review, not a sales pitch, and there's no obligation."],
      ['What do you need from us to get started?', "Usually a sample of the files or exports the process uses today, with anything confidential removed, and some time with the person who does the work. I don't need logins to your systems to get started."],
      ['How long does a first project take?', "It depends on the process. Most first projects focus on one report, check or workflow, so you can start small rather than commit to a large project. After the review I'll give you a defined scope and an estimated timeline before any work starts."],
      ['Is there a written agreement?', "Yes. Before any work starts, you get a written scope: what will be built, what's included, the price, the timeline and how payment works. Work only begins once you've agreed to it in writing. Anything outside that scope is discussed and agreed separately."],
      ['Do I need to replace my current software?', 'Usually, no. The first question is whether the process can be improved using the tools and systems you already have, before considering anything new. If something needs to run on a schedule, such as a script, where it runs is agreed with you, and your IT team if needed, before anything is built.'],
      ['What happens after handover?', 'What I build runs in the tools you already use, and you own it. It comes with a run guide, so someone on your team can run it without me. If something doesn\'t work as agreed in the first 30 days, I fix it at no extra cost. Ongoing support is optional.'],
      ['What if our exports or files change?', "I build around the exports you already produce and document what the workflow expects. The checks are designed to flag a file that doesn't look right, rather than quietly produce a wrong report. If a source format changes, I can review the change and update the workflow. Ongoing support is optional and agreed separately."],
      ["What if I don't know exactly what's wrong?", "That's okay. A good starting point is simply one task that takes too long or involves repeating the same steps. Working out the rest is part of what I help with."],
      ['Can you help with AI automation or CRM workflows?', 'Yes, within the tools you already use. Depending on the problem, this can include AI automation, CRM data cleanup, reporting improvements, and workflow automation between existing systems. AI is one tool, not the starting point: I start with the process and choose the simplest practical solution, which could be Excel, Power Query, Python, AI or your existing systems.'],
      // NDA sentence confirmed (28 Oct 2026).
      ['Can you work with confidential or sensitive information?', "Ordinary business information, such as invoices or job lists, is fine to work with when it's shared through an agreed, authorised route, and I'm happy to sign a reasonable confidentiality agreement (NDA). Sensitive or regulated information needs a review of safeguards and scope before anything is implemented. I only ask for the files the agreed work needs, and we agree at the start how they're stored and when they're deleted. I don't automate consequential decisions about people: automation may prepare information for a person to review and decide."],
    ],
  },
  cta: {
    heading: 'Get a second pair of eyes on one process.',
    text: 'Bring one report, check or workflow that takes longer than it should. Not sure which one yet? Find Your Rework first.',
    primary: 'Book a free rework review',
    secondary: 'Find Your Rework',
  },
  contact: {
    // Contact page
    heading: "Let's talk about the work that's slowing your team down.",
    text: "Tell me what you're doing today, what's taking too long, and where errors or repeated work are showing up.",
    // Add the reply-time line only once RESPONSE_DAYS is confirmed:
    // "I'll reply within 3 business days to arrange a free 30-minute call. No preparation needed."
    // Homepage closing section and contact page side box
    writeHeading: 'Prefer to write first?',
    writeText: 'Email me, send a message on LinkedIn, or use the contact form. Please keep workflow details general and leave out anything confidential.',
    // The result-page share form appears once submitEndpoint is set. Until then, the result page offers
    // "Email Jeff your result" with the result pre-filled. The contact-page form is always shown.
  },
  footer: {
    // The fictional-data notice now appears once in the examples section (and in captions), not in the footer.
  },
};
