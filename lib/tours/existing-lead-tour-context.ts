/**
 * Server-only: resolve a lead-scoped public tour scheduling context from
 * the opaque `o=` origin token. Never trusts a raw leadId from the browser.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { isOpenLeadLifecycle } from "@/lib/leads/open-lifecycle";
import {
  tourOriginSigningSecret,
  verifyTourOriginToken,
} from "@/lib/tours/origin-context";

export type ExistingLeadTourContext = {
  /** Authoritative preferred event date (YYYY-MM-DD), or null when unset. */
  preferredEventDate: string | null;
  firstName: string;
  lastName: string;
  email: string;
  /** Authoritative phone from the lead, when set — required to record SMS consent. */
  phone: string;
  eventType: string;
  /** Authoritative guest count from the lead, when set. */
  guestCount: number | null;
  /** Opaque — never expose raw leadId to the client HTML as an input. */
  hasExistingLead: true;
};

export type ExistingLeadTourContextResult =
  | { ok: true; context: ExistingLeadTourContext }
  | { ok: false; error: "invalid_token" | "lead_not_found" | "lead_not_open" | "venue_mismatch" };

function asIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * Resolve public tour UI context for an origin token bound to a tour embed key.
 * Returns only fields needed to render the form — not full lead records.
 */
export async function resolveExistingLeadTourContext(opts: {
  tourEmbedKey: string;
  originToken: string | null | undefined;
  nowMs?: number;
}): Promise<ExistingLeadTourContextResult | null> {
  const token = opts.originToken?.trim();
  if (!token) return null;

  const secret = tourOriginSigningSecret();
  if (!secret) return { ok: false, error: "invalid_token" };

  const payload = verifyTourOriginToken(token, secret, opts.nowMs);
  if (!payload) return { ok: false, error: "invalid_token" };

  const admin = createAdminClient();
  const { data: venue } = await admin
    .from("venues")
    .select("id")
    .eq("tour_embed_key", opts.tourEmbedKey)
    .eq("tour_scheduling_enabled", true)
    .maybeSingle<{ id: string }>();
  if (!venue || venue.id !== payload.venueId) {
    return { ok: false, error: "venue_mismatch" };
  }

  const { data: lead } = await admin
    .from("leads")
    .select("id, venue_id, sales_stage, event_date, first_name, last_name, email, phone, event_type, guest_count")
    .eq("id", payload.leadId)
    .maybeSingle<{
      id: string;
      venue_id: string;
      sales_stage: string | null;
      event_date: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      event_type: string | null;
      guest_count: number | null;
    }>();

  if (!lead || lead.id !== payload.leadId) {
    return { ok: false, error: "lead_not_found" };
  }
  if (lead.venue_id !== venue.id) {
    return { ok: false, error: "venue_mismatch" };
  }
  if (!isOpenLeadLifecycle(lead.sales_stage)) {
    return { ok: false, error: "lead_not_open" };
  }

  const guestRaw = lead.guest_count;
  const guestCount =
    typeof guestRaw === "number" && Number.isFinite(guestRaw) && guestRaw > 0
      ? Math.floor(guestRaw)
      : null;

  return {
    ok: true,
    context: {
      preferredEventDate: asIsoDate(lead.event_date),
      firstName: (lead.first_name ?? "").trim(),
      lastName: (lead.last_name ?? "").trim(),
      email: (lead.email ?? "").trim(),
      phone: (lead.phone ?? "").trim(),
      eventType: (lead.event_type ?? "").trim(),
      guestCount,
      hasExistingLead: true,
    },
  };
}

/**
 * Client-safe validation for public forms.
 *
 * Tour scheduling (`schedule_tour`) is about the tour appointment slot.
 * Preferred event date must not block tour submission — especially when the
 * prospect's own active hold makes that date unselectable in
 * `choose_available` calendars (generic Calendar tour links).
 *
 * Existing-lead `?o=` links still render the preferred date read-only via
 * `existingLeadTour`; new tour visitors may leave preferred date blank.
 * Request Information keeps the venue's preferred-date requirement.
 */
export function shouldSkipPreferredEventDateRequirement(opts: {
  mode: string | null | undefined;
  existingLeadTour?: boolean;
}): boolean {
  return opts.mode === "schedule_tour";
}
