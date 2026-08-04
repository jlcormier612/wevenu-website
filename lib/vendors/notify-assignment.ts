/**
 * Notify a vendor they've been assigned to an event.
 * Shared by couple Submit and venue Assign — best-effort, never blocks booking.
 *
 * For unclaimed vendors, upserts vendor_invitations and deep-links the
 * assignment email to /vendor/accept (same accept path as venue invite).
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  buildVendorAssignmentHtml,
  buildVendorAssignmentText,
} from "@/lib/email/vendor-assignment";
import { createVendorNotification } from "@/lib/vendor-notifications/create";

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
}

function tryAdmin() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function clientDisplayName(c: {
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
}): string {
  if (c.partner_first_name) return `${c.first_name} & ${c.partner_first_name}`;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "your couple";
}

export type AssignmentNotifyInput = {
  venueId: string;
  venueName: string;
  eventId: string;
  assignmentId: string;
  vendorId: string;
  /** When set, prefers this over looking up the event/client name. */
  eventLabel?: string;
};

/**
 * Fire-and-forget wrapper — assignment/create path must still succeed if
 * email fails (no address, provider down).
 */
export function notifyVendorOfEventAssignment(input: AssignmentNotifyInput): void {
  void notifyVendorOfEventAssignmentAsync(input);
}

export async function notifyVendorOfEventAssignmentAsync(
  input: AssignmentNotifyInput,
): Promise<void> {
  try {
    const admin = tryAdmin();
    if (!admin) return;

    const [{ data: vendor }, { data: event }] = await Promise.all([
      admin
        .from("vendors")
        .select("id, business_name, email, is_claimed, claim_token")
        .eq("id", input.vendorId)
        .maybeSingle<{
          id: string;
          business_name: string | null;
          email: string | null;
          is_claimed: boolean;
          claim_token: string | null;
        }>(),
      admin
        .from("events")
        .select("id, name, client_id, clients(first_name, last_name, partner_first_name)")
        .eq("id", input.eventId)
        .maybeSingle<{
          id: string;
          name: string;
          client_id: string | null;
          clients:
            | { first_name: string; last_name: string; partner_first_name: string | null }
            | { first_name: string; last_name: string; partner_first_name: string | null }[]
            | null;
        }>(),
    ]);

    if (!vendor) return;

    const client = Array.isArray(event?.clients) ? event.clients[0] : event?.clients;
    const coupleLabel = client ? clientDisplayName(client) : null;
    const eventLabel =
      input.eventLabel
      ?? (coupleLabel ? `${coupleLabel}${event?.name ? ` — ${event.name}` : ""}` : event?.name)
      ?? "an upcoming event";

    const deepLinkPath = `/vendor/events/${input.assignmentId}`;
    const deepLinkUrl = `${appBaseUrl()}${deepLinkPath}`;
    const claimUrl =
      !vendor.is_claimed && vendor.claim_token
        ? `${appBaseUrl()}/vendor/accept?token=${vendor.claim_token}`
        : null;

    const vendorName = vendor.business_name || "your business";

    // In-app inbox even when email can't send (DB trigger also writes; 2m dedupe).
    await createVendorNotification({
      vendorId: input.vendorId,
      eventId: input.eventId,
      assignmentId: input.assignmentId,
      type: "assigned_to_event",
      title: "You've been selected for an event",
      body: `${eventLabel} · ${input.venueName}`,
      link: deepLinkPath,
      emoji: "🎉",
    });

    if (!vendor.email) return;

    await sendEmail({
      to: vendor.email,
      subject: `You've been selected for ${eventLabel} at ${input.venueName}`,
      text: buildVendorAssignmentText({
        vendorName,
        venueName: input.venueName,
        eventLabel,
        deepLinkUrl,
        isUnclaimed: !vendor.is_claimed,
        claimUrl,
      }),
      html: buildVendorAssignmentHtml({
        vendorName,
        venueName: input.venueName,
        eventLabel,
        deepLinkUrl,
        isUnclaimed: !vendor.is_claimed,
        claimUrl,
      }),
    });

    if (!vendor.is_claimed && vendor.claim_token) {
      await admin.from("vendor_invitations").upsert(
        {
          venue_id: input.venueId,
          vendor_id: input.vendorId,
          email: vendor.email,
          token: vendor.claim_token,
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "token" },
      );
    }
  } catch (err) {
    console.error("[notifyVendorOfEventAssignment]", err);
  }
}
