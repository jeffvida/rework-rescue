// Settings now live in ../../site-config.js (the one file to edit).
// This file re-exports them so existing imports keep working, and holds engine tunables.
export { SPECIALIST, SITE } from '../../site-config.js';

// Engine and assessment tunables (Stage 2A/2B defaults). Changing these changes behavior.
export const ENGINE_DEFAULTS = {
  MAX_AUTOMATION_OPTIONS: 4,
  LIMITED_THRESHOLD: 3,
  EFFORT_WARN_HOURS: 100,
};
