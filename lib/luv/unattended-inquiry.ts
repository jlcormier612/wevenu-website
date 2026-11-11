/**
 * Authoritative P-A1 unattended-inquiry eligibility.
 *
 * Product: “Several people actually inquired, and we still have not given
 * them a first response.”
 *
 * This evaluator is the single definition for:
 *   - P-A1 cluster detection
 *   - persisted metadata.lead_ids
 *   - /leads?attention=unattended_inquiry
 *   - S3 “reached out” observations (same inquiry + contact gates; S3 does
 *     not apply the P-A1 14-day cluster cap)
 *
 * Age clock: leads.created_at (not inquiry_date). inquiry_date is an open
 * product question; changing clocks would be a definition change, not a
 * P-A1 implementation fix.
 *
 * sales_stage is never inquiry, booking, or contact evidence.
 */

import { normalizeInquiryMessageOrigin } from "@/lib/leads/inquiry-message-origin";
import {
  isAuthoritativeBooked,
  isAuthoritativeLost,
  isAuthoritativeTourContactForUnattendedInquiry,
} from "@/lib/luv/pipeline-stage-evidence";

export const UNATTENDED_INQUIRY_MIN_HOURS = 48;

export const UNATTENDED_INQUIRY_WINDOW_DAYS = 14;
export const UNATTENDED_INQUIRY_ATTENTION = "unattended_inquiry";
export const UNATTENDED_INQUIRY_LEADS_HREF = "/leads?attention=unattended_inquiry";
export const UNATTENDED_INQUIRY_CTA_LABEL = "Review these inquiries";

const MS_HOUR = 3_600_000;
const MS_DAY = 24 * MS_HOUR;

export type UnattendedInquiryEvidence = {
  id: string;
  venueId: string;
  createdAt: string;
  inquiryMessageOrigin?: string | null;
  firstBookedAt?: string | null;
  lostAt?: string | null;
  lastContactedAt?: string | null;
  /** Venue staff customer-facing outbound. Not system, inbound, or internal_note. */
  hasVenueStaffOutbound?: boolean;
  tourStatus?: string | null;
  tourOrigin?: string | null;
  relationshipId?: string | null;
  acquisitionSource?: string | null;
};

export function isCustomerOriginInquiry(
  origin: string | null | undefined,
): boolean {
  return normalizeInquiryMessageOrigin(origin) === "customer";
}

/**
 * P-A1 / S3 first-response evidence. Independent from Inbox needs_response.
 * last_contacted_at is a staff-editable claim: populated → exclude; it is
 * never the whole definition.
 */
export function hasVenueFirstResponseEvidence(
  lead: Pick<
    UnattendedInquiryEvidence,
    "lastContactedAt" | "hasVenueStaffOutbound" | "tourStatus" | "tourOrigin"
  >,
): boolean {
  if (lead.lastContactedAt) return true;
  if (lead.hasVenueStaffOutbound) return true;
  if (
    isAuthoritativeTourContactForUnattendedInquiry({
      status: lead.tourStatus,
      origin: lead.tourOrigin,
    })
  ) {
    return true;
  }
  return false;
}

/**
 * created_at window.
 * Cluster (P-A1): 48h inclusive through 14d inclusive.
 * Observation (S3): 48h inclusive, no 14-day cap.
 */
export function isUnattendedInquiryCreatedAtWindow(
  createdAt: string,
  opts: {
    nowMs?: number;
    minHours?: number;
    /** Null = no upper bound (S3). */
    maxDays?: number | null;
  } = {},
): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const minHours = opts.minHours ?? UNATTENDED_INQUIRY_MIN_HOURS;
  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return false;
  const ageMs = nowMs - createdMs;
  if (ageMs < minHours * MS_HOUR) return false;
  if (opts.maxDays != null) {
    if (createdMs < nowMs - opts.maxDays * MS_DAY) return false;
  }
  return true;
}

export type UnattendedInquiryWindow = "cluster" | "observation";

/**
 * Complete product question for one lead + already-loaded evidence.
 * Cluster membership must be counted only after this returns true.
 */
export function isQualifyingUnattendedInquiry(
  lead: UnattendedInquiryEvidence,
  opts: {
    venueId: string;
    nowMs?: number;
    window?: UnattendedInquiryWindow;
  },
): boolean {
  if (lead.venueId !== opts.venueId) return false;
  if (!isCustomerOriginInquiry(lead.inquiryMessageOrigin)) return false;
  if (isAuthoritativeBooked({ firstBookedAt: lead.firstBookedAt })) return false;
  if (isAuthoritativeLost({ lostAt: lead.lostAt })) return false;
  const window = opts.window ?? "cluster";
  if (
    !isUnattendedInquiryCreatedAtWindow(lead.createdAt, {
      nowMs: opts.nowMs,
      minHours: UNATTENDED_INQUIRY_MIN_HOURS,
      maxDays: window === "cluster" ? UNATTENDED_INQUIRY_WINDOW_DAYS : null,
    })
  ) {
    return false;
  }
  if (hasVenueFirstResponseEvidence(lead)) return false;
  return true;
}

export function uniqueQualifyingUnattendedInquiryIds(
  leads: UnattendedInquiryEvidence[],
  opts: {
    venueId: string;
    nowMs?: number;
    window?: UnattendedInquiryWindow;
  },
): string[] {
  const ids = new Set<string>();
  for (const lead of leads) {
    if (isQualifyingUnattendedInquiry(lead, opts)) ids.add(lead.id);
  }
  return [...ids];
}
