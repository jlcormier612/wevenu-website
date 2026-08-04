/**
 * Portal-message email notify for venue↔vendor Conversations.
 * Mirrors lib/messages/notify.ts (couple Messages) — best-effort, never
 * blocks the send path. Only fires for the in-app `portal` channel;
 * email/SMS already leave the system via their own providers.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { sendMessageEmail } from "@/lib/messages/notify";

type NotifyDirection = "vendor_to_venue" | "venue_to_vendor";

type VendorConvoNotifyContext = {
  conversationId: string;
  eventId: string;
  eventName: string;
  venueId: string;
  venueName: string;
  venueEmail: string | null;
  assignedStaffEmail: string | null;
  vendorName: string;
  vendorEmail: string | null;
};

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
}

function tryAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function dedupeEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

async function loadVendorConversationNotifyContext(
  conversationId: string,
): Promise<VendorConvoNotifyContext | null> {
  const admin = tryAdminClient();
  const client = admin ?? await createClient();

  const { data: convo } = await client
    .from("conversations")
    .select("id, venue_id, assigned_staff_id, event_vendor_assignment_id")
    .eq("id", conversationId)
    .maybeSingle<{
      id: string;
      venue_id: string;
      assigned_staff_id: string | null;
      event_vendor_assignment_id: string | null;
    }>();

  if (!convo?.event_vendor_assignment_id) return null;

  const { data: assignment } = await client
    .from("event_vendor_assignments")
    .select("event_id, vendor_id, events(id, name), vendors(id, business_name, email)")
    .eq("id", convo.event_vendor_assignment_id)
    .maybeSingle<{
      event_id: string;
      vendor_id: string;
      events: { id: string; name: string } | { id: string; name: string }[] | null;
      vendors:
        | { id: string; business_name: string | null; email: string | null }
        | { id: string; business_name: string | null; email: string | null }[]
        | null;
    }>();

  if (!assignment) return null;

  const event = Array.isArray(assignment.events) ? assignment.events[0] : assignment.events;
  const vendor = Array.isArray(assignment.vendors) ? assignment.vendors[0] : assignment.vendors;

  const [{ data: venue }, { data: staff }] = await Promise.all([
    client
      .from("venues")
      .select("name, email")
      .eq("id", convo.venue_id)
      .maybeSingle<{ name: string; email: string | null }>(),
    convo.assigned_staff_id
      ? client
          .from("venue_staff")
          .select("email")
          .eq("id", convo.assigned_staff_id)
          .maybeSingle<{ email: string | null }>()
      : Promise.resolve({ data: null as { email: string | null } | null }),
  ]);

  return {
    conversationId: convo.id,
    eventId: event?.id ?? assignment.event_id,
    eventName: event?.name ?? "your event",
    venueId: convo.venue_id,
    venueName: venue?.name ?? "Your venue",
    venueEmail: venue?.email ?? null,
    assignedStaffEmail: staff?.email ?? null,
    vendorName: vendor?.business_name || "Vendor",
    vendorEmail: vendor?.email ?? null,
  };
}

async function activeSenderEmail(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

async function notifyVendorPortalMessage(
  conversationId: string,
  bodyPreview: string,
  direction: NotifyDirection,
): Promise<void> {
  try {
    const ctx = await loadVendorConversationNotifyContext(conversationId);
    if (!ctx) return;

    const senderEmail = await activeSenderEmail();
    const preview = bodyPreview.trim() || "(attachment)";
    const base = appBaseUrl();

    if (direction === "vendor_to_venue") {
      const recipients = dedupeEmails([ctx.assignedStaffEmail, ctx.venueEmail])
        .filter((email) => !senderEmail || email !== senderEmail);
      if (recipients.length === 0) return;

      const ctaUrl = `${base}/events/${ctx.eventId}#vendors`;
      const subject = `You have a new message — ${ctx.eventName}`;
      await Promise.all(
        recipients.map((to) =>
          sendMessageEmail({
            to,
            senderName: ctx.vendorName,
            bodyPreview: preview.slice(0, 200),
            ctaUrl,
            ctaLabel: "Open Messages",
            subject,
            eventName: ctx.eventName,
          }),
        ),
      );
      return;
    }

    const recipients = dedupeEmails([ctx.vendorEmail])
      .filter((email) => !senderEmail || email !== senderEmail);
    if (recipients.length === 0) return;

    const ctaUrl = `${base}/vendor/messages/${ctx.conversationId}`;
    const subject = `You have a new message — ${ctx.eventName}`;
    await Promise.all(
      recipients.map((to) =>
        sendMessageEmail({
          to,
          senderName: ctx.venueName,
          bodyPreview: preview.slice(0, 200),
          ctaUrl,
          ctaLabel: "Open Messages",
          subject,
          eventName: ctx.eventName,
        }),
      ),
    );
  } catch (err) {
    console.error("[conversations] vendor portal notify failed:", err);
  }
}

/** Vendor portal → venue staff. Fire-and-forget after a successful portal send. */
export function notifyVenueOfVendorPortalMessage(conversationId: string, bodyPreview: string): void {
  void notifyVendorPortalMessage(conversationId, bodyPreview, "vendor_to_venue");
}

/**
 * Venue app → vendor contact, for vendor-anchored Conversations on the
 * portal channel only. Fire-and-forget after a successful send.
 */
export function notifyVendorOfVenuePortalMessage(conversationId: string, bodyPreview: string): void {
  void notifyVendorPortalMessage(conversationId, bodyPreview, "venue_to_vendor");
}
