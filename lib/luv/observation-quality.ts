/**
 * Coordinator-facing Luv observation quality.
 *
 * Four valid outcomes: actionable, contextual, positive, silence.
 * When Luv speaks, the venue owner should have a good reason to care.
 * Silence is valid. A possible action is not evidence an action is needed.
 */
import type { LuvObservation } from "@/lib/luv/types";
import { isAuthoritativeTourScheduled } from "@/lib/luv/pipeline-stage-evidence";

export type ObservationMode = "actionable" | "contextual" | "positive";

export const TOUR_ALL_SET_MAX_DAYS = 3;

export function isCustomerFacingContactChannel(channel: string | null | undefined): boolean {
  if (!channel) return false;
  return channel !== "internal_note";
}

export function isCustomerFacingContactSender(senderType: string | null | undefined): boolean {
  return (
    senderType === "venue_staff"
    || senderType === "system"
    || senderType === "lead_or_client"
    || senderType === "contact"
  );
}

export function isCustomerFacingContactMessage(msg: {
  channel?: string | null;
  senderType?: string | null;
}): boolean {
  return isCustomerFacingContactChannel(msg.channel)
    && isCustomerFacingContactSender(msg.senderType);
}

/**
 * Authoritative contact — not last_contacted_at alone, not sales_stage.
 * Confirmation emails, outbound/inbound customer messages, and an actual
 * scheduled/confirmed tour record all qualify.
 */
export function hasQualifyingCustomerContact(input: {
  lastContactedAt?: string | null;
  hasCustomerFacingMessage?: boolean;
  tourStatus?: string | null;
}): boolean {
  if (input.lastContactedAt) return true;
  if (input.hasCustomerFacingMessage) return true;
  if (isAuthoritativeTourScheduled({ status: input.tourStatus ?? null })) return true;
  return false;
}

export function coordinatorAddressName(opts: {
  staffCount: number;
  currentUserFirstName?: string | null;
  ownerFirstName?: string | null;
}): string | null {
  const current = opts.currentUserFirstName?.trim() || null;
  const owner = opts.ownerFirstName?.trim() || null;
  if (opts.staffCount === 1) return current ?? owner;
  if (owner) return owner;
  return null;
}

export function withCoordinatorAddress(name: string | null | undefined, sentence: string): string {
  const n = name?.trim();
  if (!n) return sentence;
  if (sentence.startsWith(`${n},`) || sentence.startsWith(`${n} `)) return sentence;
  const rest = sentence.charAt(0).toLowerCase() + sentence.slice(1);
  return `${n}, ${rest}`;
}

export function observationActionCta(
  obs: Pick<LuvObservation, "recommendation" | "actionLabel" | "link">,
  currentPath?: string | null,
): { href: string; label: string } | null {
  const label = obs.recommendation?.label ?? obs.actionLabel ?? null;
  const href = obs.recommendation?.link ?? obs.link;
  if (!label || !href) return null;
  if (currentPath) {
    const dest = href.split(/[?#]/)[0];
    const here = currentPath.split(/[?#]/)[0];
    if (dest === here) return null;
  }
  return { href, label };
}

export function weekdayLabelFromIso(iso: string, timeZone?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: timeZone || "UTC",
    }).format(new Date(iso));
  } catch {
    return "their tour";
  }
}

export function buildTourAllSetObservation(input: {
  tourId: string;
  scheduledAt: string;
  status: string | null;
  contactName: string | null;
  leadId: string | null;
  daysUntil: number;
  coordinatorFirstName?: string | null;
  timeZone?: string | null;
}): LuvObservation | null {
  if (!isAuthoritativeTourScheduled({ status: input.status })) return null;
  if (input.daysUntil < 0 || input.daysUntil > TOUR_ALL_SET_MAX_DAYS) return null;
  const couple = input.contactName?.trim() || "This couple";
  const when = input.daysUntil === 0
    ? "today"
    : weekdayLabelFromIso(input.scheduledAt, input.timeZone);
  const sentence = `${couple} ${couple.includes(" and ") || couple.includes("&") ? "are" : "is"} all set for ${when}. Good luck!`;
  return {
    id: `tour-upcoming-${input.tourId}`,
    kind: "fact",
    priority: input.daysUntil === 0 ? "high" : "medium",
    message: withCoordinatorAddress(input.coordinatorFirstName ?? null, sentence),
    link: input.leadId ? `/leads/${input.leadId}` : "/leads",
  };
}
