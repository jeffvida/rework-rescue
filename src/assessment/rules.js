// ============================================================================
//  FIND YOUR REWORK: the one file that defines the assessment.
//
//  Edit wording here: question text, answer labels, and every sentence on the result page.
//  Logic is a simple lookup: the task chosen in question 2 decides the result (Reporting, Data or
//  Workflow; Reporting and Data both display as Data & Reporting Rework). The other answers only change the advice, the workload figure and the notes.
//
//  Keep the ids (the short CAPITAL codes) unchanged unless you also update tests/assessment.test.mjs.
//  No AI, no scoring. Nothing here is sent anywhere.
// ============================================================================

// What the visitor sees. Reporting and Data are still decided separately (each keeps its own advice and
// example), but both are shown as the one service, Data & Reporting Rework.
export const PILLARS = {
  REPORTING: 'Data & Reporting Rework',
  DATA: 'Data & Reporting Rework',
  WORKFLOW: 'Workflow Rework',
};

// ---------------------------------------------------------------- the 6 questions (3 screens of 2)
export const SCREENS = [
  { n: 1, title: 'What to look at', questions: ['area', 'task'] },
  { n: 2, title: 'How often and how long', questions: ['frequency', 'time'] },
  { n: 3, title: 'How it runs today', questions: ['consistency', 'limits'] },
];

export const QUESTIONS = {
  area: {
    text: 'What would you most like to improve?',
    help: 'Pick the closest match.',
    type: 'single',
    options: [
      { id: 'REPORTS', label: 'Reports', desc: 'Reports take too long to prepare or get rebuilt every time.' },
      { id: 'DATA', label: 'Checking data', desc: "Numbers don't match, or checking them eats hours." },
      { id: 'WORKFLOW', label: 'Follow-ups and handoffs', desc: 'Work gets copied, chased or passed around by hand.' },
      { id: 'UNSURE', label: 'Not sure yet', desc: "That's fine. The next question helps narrow it down." },
    ],
  },
  task: {
    text: 'Which is closest to your situation?',
    textUnsure: 'Which of these takes your team the most time?',
    help: "Choose one recurring task. Don't worry about describing the whole process.",
    type: 'single',
    // `pillar` decides the result. `activity` is used in "Why this result". pillar: null -> "Start with one process".
    optionsByArea: {
      REPORTS: [
        { id: 'R_RECURRING', label: 'A report or summary we prepare on a regular schedule', pillar: 'REPORTING', activity: 'preparing a recurring report' },
        { id: 'R_COMBINE', label: 'Combining several spreadsheets or files into one report', pillar: 'REPORTING', activity: 'combining several files into one report' },
        { id: 'R_SYSTEMS', label: 'Pulling data from different systems or exports', pillar: 'REPORTING', activity: 'pulling data together from different systems' },
        { id: 'R_DASHBOARD', label: 'Updating a dashboard or performance summary', pillar: 'REPORTING', activity: 'updating a dashboard or summary by hand' },
        { id: 'R_REQUESTS', label: 'Answering the same requests for numbers again and again', pillar: 'REPORTING', activity: 'answering repeated requests for numbers' },
        { id: 'R_CHASE', label: 'Chasing people for the numbers I need before the report', pillar: 'WORKFLOW', activity: 'chasing people for numbers before a report can be built' },
        { id: 'R_OTHER', label: 'Something else about reports', pillar: 'REPORTING', activity: 'recurring reporting work' },
      ],
      DATA: [
        { id: 'D_MISMATCH', label: "Numbers that don't match between two sources", pillar: 'DATA', activity: "matching numbers between sources that don't agree" },
        { id: 'D_CHECKS', label: 'Checking records or totals by hand', pillar: 'DATA', activity: 'checking records or totals by hand' },
        { id: 'D_INVESTIGATE', label: 'Investigating discrepancies and errors', pillar: 'DATA', activity: 'investigating discrepancies and errors' },
        { id: 'D_DUPLICATES', label: 'Duplicate or inconsistent records', pillar: 'DATA', activity: 'cleaning up duplicate or inconsistent records' },
        { id: 'D_CORRECT', label: 'Correcting mistakes or missing information', pillar: 'DATA', activity: 'correcting mistakes and missing information' },
        { id: 'D_OTHER', label: 'Something else about checking data', pillar: 'DATA', activity: 'repeated data checking' },
      ],
      WORKFLOW: [
        { id: 'W_FOLLOWUP', label: 'Following up with people for replies or updates', pillar: 'WORKFLOW', activity: 'following up with people for replies or updates' },
        { id: 'W_APPROVALS', label: 'Approvals that get stuck or take too long', pillar: 'WORKFLOW', activity: 'chasing approvals' },
        { id: 'W_STATUS', label: 'Checking or tracking where work is up to', pillar: 'WORKFLOW', activity: 'tracking where work is up to' },
        { id: 'W_HANDOFF', label: 'Passing requests or information between people or apps', pillar: 'WORKFLOW', activity: 'passing work between people or applications' },
        { id: 'W_REENTRY', label: 'Entering or copying the same information in several places', pillar: 'WORKFLOW', activity: 'copying the same information into several places' },
        { id: 'W_RETYPE', label: 'Re-typing information from emails, forms or PDFs', pillar: 'WORKFLOW', activity: 're-typing information from emails, forms or PDFs' },
        { id: 'W_DOCS', label: 'Reviewing, sorting or filing documents', pillar: 'WORKFLOW', activity: 'reviewing and sorting documents by hand' },
        { id: 'W_OTHER', label: 'Something else about follow-ups or handoffs', pillar: 'WORKFLOW', activity: 'repeated follow-ups and handoffs' },
      ],
      UNSURE: [
        { id: 'U_REPORTS', label: 'Preparing or rebuilding reports', pillar: 'REPORTING', activity: 'preparing or rebuilding reports' },
        { id: 'U_CHECKING', label: 'Checking or correcting data', pillar: 'DATA', activity: 'checking or correcting data' },
        { id: 'U_CHASING', label: 'Chasing people, replies or approvals', pillar: 'WORKFLOW', activity: 'chasing people, replies or approvals' },
        { id: 'U_COPYING', label: 'Copying information between files or systems', pillar: 'WORKFLOW', activity: 'copying information between files or systems' },
        { id: 'U_NONE', label: "None of these, or I'm not sure", pillar: null, activity: '' },
      ],
    },
  },
  frequency: {
    text: 'How often does this task happen?',
    help: 'Roughly is fine.',
    type: 'single',
    options: [
      { id: 'SEVERAL_DAILY', label: 'Several times a day', phrase: 'several times a day' },
      { id: 'DAILY', label: 'Once a day', phrase: 'every working day' },
      { id: 'FEW_WEEKLY', label: 'A few times a week', phrase: 'a few times a week' },
      { id: 'WEEKLY', label: 'Weekly', phrase: 'every week' },
      { id: 'MONTHLY', label: 'Monthly', phrase: 'every month' },
      { id: 'LESS', label: 'Less often (quarterly or irregular)', phrase: 'from time to time' },
      { id: 'UNSURE', label: "I'm not sure", phrase: '' },
    ],
  },
  time: {
    text: 'About how much active staff time does it take each time?',
    textPerDay: 'About how much active staff time does it take on a typical working day?',
    help: "Add up everyone involved, and leave out time spent waiting.",
    type: 'single',
    // Hours. lo: null means "up to"; hi: null means "at least".
    options: [
      { id: 'T_LT15', label: 'Under 15 minutes', lo: null, hi: 0.25, phrase: 'under 15 minutes' },
      { id: 'T_15_30', label: '15–30 minutes', lo: 0.25, hi: 0.5, phrase: '15–30 minutes' },
      { id: 'T_30_60', label: '30–60 minutes', lo: 0.5, hi: 1, phrase: '30–60 minutes' },
      { id: 'T_1_2', label: '1–2 hours', lo: 1, hi: 2, phrase: '1–2 hours' },
      { id: 'T_2_4', label: '2–4 hours', lo: 2, hi: 4, phrase: '2–4 hours' },
      { id: 'T_4_8', label: '4–8 hours', lo: 4, hi: 8, phrase: '4–8 hours' },
      { id: 'T_8P', label: 'More than 8 hours', lo: 8, hi: null, phrase: 'more than 8 hours' },
      { id: 'UNSURE', label: "I'm not sure", lo: null, hi: null, phrase: '' },
    ],
  },
  consistency: {
    text: 'Do people follow the same steps each time?',
    help: "Think about how it's usually done, not how it should be done.",
    type: 'single',
    options: [
      { id: 'SAME', label: 'Yes, mostly the same each time' },
      { id: 'SOME', label: 'Some variation' },
      { id: 'VARIES', label: 'It changes quite a bit' },
      { id: 'UNSURE', label: "I'm not sure" },
    ],
  },
  limits: {
    text: 'Is anything likely to limit changes to this process?',
    help: "Select all that apply. This only adds a note to your result. It won't stop you getting one.",
    type: 'multi',
    exclusive: ['NONE', 'UNSURE'],
    options: [
      { id: 'SENSITIVE', label: 'Sensitive, personal or regulated information', desc: 'For example customer, employee, financial or health details.' },
      { id: 'APPROVAL', label: 'We would need approval to use the data this way' },
      { id: 'DECISIONS', label: 'It feeds decisions about people', desc: 'For example hiring, credit or eligibility.' },
      { id: 'SYSTEM', label: 'It depends on a major system', desc: 'For example accounting, CRM or ERP software.' },
      { id: 'NONE', label: 'None of these' },
      { id: 'UNSURE', label: "I'm not sure" },
    ],
  },
};

// Frequency -> occurrences per month (low, high). Uses 260 working days and 52 weeks a year.
// LESS and UNSURE are not converted, so no monthly or yearly figure is shown for them.
// High-end monthly estimate below this many staff-hours shows the low-volume note.
export const LOW_VOLUME_HOURS = 2;

export const PER_MONTH = {
  SEVERAL_DAILY: { lo: 260 / 12, hi: 260 / 12, perDay: true }, // time is asked per working day
  DAILY: { lo: 260 / 12, hi: 260 / 12 },
  FEW_WEEKLY: { lo: (52 * 2) / 12, hi: (52 * 4) / 12 },
  WEEKLY: { lo: 52 / 12, hi: 52 / 12 },
  MONTHLY: { lo: 1, hi: 1 },
};

// ---------------------------------------------------------------- result text
export const RESULT = {
  eyebrow: 'Your Rework Result',
  REPORTING: {
    diagnosis: 'The repeated work of preparing, combining and checking information before a report is ready appears to be your main opportunity.',
    start: {
      SAME: { lead: 'Make the reporting process repeatable before trying to automate it.', steps: ['List the files or exports the report uses, and where each one comes from.', 'Write down the rules: what the report must show, and how each figure is worked out.', 'Agree the checks that must pass before the report goes out, and who signs it off.'] },
      SOME: { lead: 'Make the reporting process more consistent before trying to automate it.', steps: ['Agree the basic inputs: which files, which version, by when.', 'Write the steps in the order they usually happen.', 'Agree what the finished report should look like, so everyone produces the same thing.'] },
      VARIES: { lead: 'Standardize the reporting process first.', steps: ['Agree the basic steps, inputs and expected output before changing any tools.', 'Pick one person to own the report and its rules.', 'Run it the agreed way for a few cycles and note where it still varies.'] },
    },
    fix: 'A report that refreshes from your existing files or exports in minutes instead of being rebuilt, with built-in checks that flag anything that doesn’t add up, and a short guide so more than one person can run it.',
    measures: ['Staff-hours per report', 'Time from period end to report delivery', 'Corrections per reporting cycle'],
    example: { label: 'From three messy exports to a reliable weekly report', href: '../#example-1' },
  },
  DATA: {
    diagnosis: 'Repeated checking, correcting or reconciling information appears to be your main opportunity.',
    start: {
      SAME: { lead: 'Agree on what the correct data should look like before trying to automate the checking.', steps: ['Decide which source is the source of truth.', 'List the fields that must match, and the format each should be in.', 'Define what counts as an exception and who decides what happens to it.'] },
      SOME: { lead: 'Make the checking more consistent before trying to automate it.', steps: ['Write down what people check today, in the order they check it.', 'Agree one set of rules everyone uses.', 'Keep a simple list of the errors you find, so the common ones become clear.'] },
      VARIES: { lead: 'Standardize the checking process first.', steps: ['Agree what should be checked and what counts as an exception.', 'Agree what action should happen next for each type of exception.', 'Pick one person to own the rules.'] },
    },
    fix: 'A repeatable check that compares your sources against agreed rules and lists only the items that need a person’s attention, with a simple record of what was checked and corrected.',
    measures: ['Number of discrepancies found each cycle', 'Time spent resolving discrepancies', 'Errors that keep coming back'],
    example: { label: 'Recurring bills across sites: from a pile of bills to a payment run you can trust', href: '../#example-2' },
  },
  WORKFLOW: {
    diagnosis: 'Repeated follow-ups, handoffs or manual coordination appear to be your main opportunity.',
    start: {
      SAME: { lead: 'Map the workflow from start to finish before changing the tools.', steps: ['Write down each step and who owns it.', 'Note what has to happen before the next step can begin.', 'Mark where requests usually wait, or need chasing by hand.'] },
      SOME: { lead: 'Make the workflow more consistent before changing the tools.', steps: ['Agree who owns each step.', 'Agree what “done” means at each step, and what happens next.', 'Keep one shared place where everyone can see where each item is up to.'] },
      VARIES: { lead: 'Make the workflow consistent first.', steps: ['Agree who owns each step and what needs to happen next.', 'Agree how exceptions are handled, and who handles them.', 'Try the agreed way on a handful of real items before changing any tools.'] },
    },
    fix: 'One clear path for each request: a single place to see status, a named owner for each step, and reminders or handoffs that happen automatically where it’s safe, so fewer things need chasing.',
    measures: ['Manual follow-ups per request', 'Waiting time between steps', 'Requests without a clear status'],
    // No dedicated workflow example yet: points at the open-jobs part of example 1 (owners, overdue jobs, follow-ups).
    example: { label: 'Example 1, step 4 (Weekly report): who owns each open job, what’s overdue and who to chase', href: '../#example-1' },
  },
  fixTail: 'Built with the tools you already have where possible, such as Excel, Power Query or your existing systems.',
  // Q5 = "I'm not sure": the same advice for every service, because the visitor doesn't yet know how the task runs.
  startUnsure: { lead: 'Find out how it’s actually done today, before changing anything.', steps: ['Ask two people who do the task to walk you through it.', 'Write down their steps side by side.', 'Note where they differ. That’s where the rework usually hides.'] },
  // Shown when the estimate is under LOW_VOLUME_HOURS staff-hours a month at the high end. The service and booking stay.
  lowVolume: 'At this frequency and effort, automation probably isn’t worth it yet. A simpler fix, like a checklist or a template, is usually enough. Unless mistakes here are costly, in which case it’s still worth a look.',
  // "Something else" tasks: the result is based on the area only, so it's worded as the closest fit.
  otherWhy: (area, pillar) => `You chose “something else” under ${area}, so this result is based on that area: ${pillar} looks like the closest fit. In a review I’d confirm what the task really is.`,
  fallback: {
    title: 'Start with one process',
    diagnosis: "You haven't picked out one specific type of rework yet, and that's okay. The best next step is to focus on one recurring task that takes noticeable staff time.",
    lookFor: ['Happens regularly', 'Takes noticeable staff time', 'Involves copying, checking, preparing, updating or chasing information'],
    steps: ['What starts the task', 'The main steps people take', 'Who does the work', 'How often it happens', 'How much active time it takes'],
    close: 'Once the process is clearer, it becomes easy to tell whether the main opportunity is Data & Reporting Rework or Workflow Rework.',
  },
  notesHeading: 'Worth checking before any changes',
  notes: {
    SENSITIVE: 'Sensitive or personal information is involved, so confirm the permitted data, access and safeguards before anything is built.',
    APPROVAL: 'Confirm who can approve using this information in an improved process. You can still map and improve the process while that’s clarified.',
    DECISIONS: 'Decisions about people always stay with a person. Any change would only prepare information for someone to review.',
    SYSTEM: 'This depends on a major system, so confirm the access, dependencies and any change limits first. The aim is to improve around it, not replace it.',
    UNSURE: 'Check whether the information is sensitive or needs approval to use. You can still map and improve the process in the meantime.',
  },
  // Added after "What a fix usually looks like" when any of these flags is set.
  gatedTail: 'Any automated step would come only after the points below are confirmed.',
  // Shown under the result, next to "Copy result": for visitors who can't hire a specialist themselves.
  shareNote: 'Not the one who decides? Copy your result and send it to your manager.',
  workloadNote: 'This is an estimate of your current workload based on your answers, not a prediction of savings.',
  cta: {
    heading: 'Review this result with me',
    text: 'This result is a starting point, not a final diagnosis. I’ll help you confirm where the rework is happening during the free review: in 30 minutes, we’ll map the current process, find the main source of rework, and identify a practical next step. If it’s worth fixing, I’ll outline a scope and estimate.',
    // Pick a time in the booking pop-up; the result is added to the request automatically.
    attached: 'Pick a time and your result goes with your request, so you don’t need to explain it again.',
    // Used while no lead store is connected: the result is pre-filled into an email instead.
    attachedEmail: 'Pick a time and your result is added to the request email, so you don’t need to explain it again.',
    emailButton: 'Email my result without booking',
    shareButton: 'Send my result without booking',
    emailSubject: 'Find Your Rework result',
    linkedinButton: 'Message on LinkedIn',
    button: 'Book a free rework review',
  },
  method: {
    heading: 'How this result was generated',
    text: [
      'This is a preliminary, rule-based assessment based on the answers you gave. It does not use AI and does not confirm that a particular technical solution will work.',
      'A real implementation would need a review of the actual process, information, systems, access and requirements.',
      'Your answers aren’t saved. If you refresh or leave this page, they’re gone.',
    ],
  },
};

export const INTRO = {
  eyebrow: 'Find Your Rework',
  heading: 'A 2-minute check for one repetitive process',
  lead: 'Think about one specific task your team repeats regularly. For example:',
  examples: ['Preparing a report', 'Checking or reconciling data', 'Updating a spreadsheet', 'Moving information between systems', 'Following up on approvals', 'Reviewing documents'],
  note: "Don't try to describe your whole business. One process gives you a much more useful result.",
  facts: '6 questions · About 2 minutes · No sign-up · Nothing is saved',
  button: 'Find Your Rework',
};
