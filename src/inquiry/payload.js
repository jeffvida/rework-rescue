// Builds the payload for the contact-page inquiry form.
// Assessment results are shared separately, from the result page (src/ui/share-form.js and src/leads/lead.js).

/**
 * @param {{fields:object, honeypot?:string}} input
 */
export function buildPayload({ fields, honeypot = '' }) {
  return {
    record_type: 'contact_inquiry',
    contact: {
      name: (fields.name || '').trim(),
      email: (fields.email || '').trim(),
      organization: (fields.organization || '').trim(),
      role: fields.role || '',
      organizationSize: fields.organizationSize || '',
      timeZone: fields.timeZone || '',
      note: (fields.note || '').trim(),
    },
    includesAssessmentSummary: false,
    // Spam trap: real visitors never see or fill this field. The server should reject non-empty values.
    website: honeypot,
  };
}

/** Kept for compatibility with older templates. The contact page never attaches an assessment. */
export function summaryPreview() {
  return '';
}
