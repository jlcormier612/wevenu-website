/**
 * Stale-contact opportunity age for Leads filters and Luv recommendations.
 *
 * "Haven't been contacted in 7+ days" must age from the last real contact when
 * one exists, otherwise from when the opportunity started (inquiry/created).
 * A brand-new lead with null last_contacted_at is NOT stale.
 */
export const STALE_CONTACT_DAYS = 7;

export type StaleContactLeadFields = {
  lastContactedAt: string | null;
  /** ISO date or timestamptz — inquiry received. */
  inquiryDate?: string | null;
  createdAt: string;
};

/**
 * Instant used as the start of the "without contact" clock.
 * Prefer last contact; otherwise opportunity start (inquiry, then created).
 */
export function opportunityContactReferenceAt(
  lead: StaleContactLeadFields,
): Date {
  if (lead.lastContactedAt) return new Date(lead.lastContactedAt);
  if (lead.inquiryDate) {
    // inquiry_date is often date-only; treat as start of that UTC day.
    const raw = lead.inquiryDate.length <= 10
      ? `${lead.inquiryDate}T00:00:00.000Z`
      : lead.inquiryDate;
    return new Date(raw);
  }
  return new Date(lead.createdAt);
}

/** True when the opportunity has been without contact for STALE_CONTACT_DAYS+. */
export function isStaleWithoutContact(
  lead: StaleContactLeadFields,
  nowMs: number = Date.now(),
): boolean {
  const ref = opportunityContactReferenceAt(lead).getTime();
  if (Number.isNaN(ref)) return false;
  return nowMs - ref >= STALE_CONTACT_DAYS * 86_400_000;
}
