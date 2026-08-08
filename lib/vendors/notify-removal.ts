/**
 * Notify a vendor they've been removed from an event by the venue.
 * Best-effort — never blocks the remove itself.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  buildVendorRemovedHtml,
  buildVendorRemovedText,
} from "@/lib/email/vendor-removed";
import { createVendorNotification } from "@/lib/vendor-notifications/create";

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

export type RemovalNotifyInput = {
  venueId: string;
  venueName: string;
  eventId: string;
  vendorId: string;
  eventLabel?: string;
};

export function notifyVendorOfEventRemoval(input: RemovalNotifyInput): void {
  void notifyVendorOfEventRemovalAsync(input);
}

export async function notifyVendorOfEventRemovalAsync(
  input: RemovalNotifyInput,
): Promise<void> {
  try {
    const admin = tryAdmin();
    if (!admin) return;

    const [{ data: vendor }, { data: event }] = await Promise.all([
      admin
        .from("vendors")
        .select("id, business_name, email")
        .eq("id", input.vendorId)
        .maybeSingle<{
          id: string;
          business_name: string | null;
          email: string | null;
        }>(),
      admin
        .from("events")
        .select("id, name, clients(first_name, last_name, partner_first_name)")
        .eq("id", input.eventId)
        .maybeSingle<{
          id: string;
          name: string;
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
      ?? "an event";

    const vendorName = vendor.business_name || "your business";
    const deepLinkPath = "/vendor/events";

    await createVendorNotification({
      vendorId: input.vendorId,
      eventId: input.eventId,
      assignmentId: null,
      type: "removed_from_event",
      title: "Removed from an event",
      body: `${eventLabel} · ${input.venueName}`,
      link: deepLinkPath,
      emoji: "👋",
    });

    if (!vendor.email) return;

    await sendEmail({
      to: vendor.email,
      subject: `You've been removed from ${eventLabel} at ${input.venueName}`,
      text: buildVendorRemovedText({
        vendorName,
        venueName: input.venueName,
        eventLabel,
      }),
      html: buildVendorRemovedHtml({
        vendorName,
        venueName: input.venueName,
        eventLabel,
      }),
    });
  } catch (err) {
    console.error("[notifyVendorOfEventRemoval]", err);
  }
}
