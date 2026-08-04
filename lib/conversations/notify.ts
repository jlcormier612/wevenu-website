/**
 * Portal-message email notify for assignment-anchored Conversations.
 * Mirrors lib/messages/notify.ts (couple Messages) — best-effort, never
 * blocks the send path. Only fires for the in-app `portal` channel;
 * email/SMS already leave the system via their own providers.
 *
 * venue_vendor  → vendor ↔ venue
 * couple_vendor → vendor ↔ couple
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { sendMessageEmail } from "@/lib/messages/notify";
import { createVendorNotification } from "@/lib/vendor-notifications/create";

type VendorConvoNotifyContext = {
  conversationId: string;
  conversationKind: "venue_vendor" | "couple_vendor";
  eventId: string;
  eventName: string;
  venueId: string;
  venueName: string;
  venueEmail: string | null;
  assignedStaffEmail: string | null;
  vendorId: string;
  vendorName: string;
  vendorEmail: string | null;
  assignmentId: string;
  coupleName: string;
  coupleEmail: string | null;
  clientId: string | null;
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
    .select("id, venue_id, assigned_staff_id, event_vendor_assignment_id, conversation_kind")
    .eq("id", conversationId)
    .maybeSingle<{
      id: string;
      venue_id: string;
      assigned_staff_id: string | null;
      event_vendor_assignment_id: string | null;
      conversation_kind: string | null;
    }>();

  if (!convo?.event_vendor_assignment_id) return null;
  if (convo.conversation_kind !== "venue_vendor" && convo.conversation_kind !== "couple_vendor") {
    return null;
  }

  const { data: assignment } = await client
    .from("event_vendor_assignments")
    .select("event_id, vendor_id, events(id, name, client_id), vendors(id, business_name, email)")
    .eq("id", convo.event_vendor_assignment_id)
    .maybeSingle<{
      event_id: string;
      vendor_id: string;
      events:
        | { id: string; name: string; client_id: string | null }
        | { id: string; name: string; client_id: string | null }[]
        | null;
      vendors:
        | { id: string; business_name: string | null; email: string | null }
        | { id: string; business_name: string | null; email: string | null }[]
        | null;
    }>();

  if (!assignment) return null;

  const event = Array.isArray(assignment.events) ? assignment.events[0] : assignment.events;
  const vendor = Array.isArray(assignment.vendors) ? assignment.vendors[0] : assignment.vendors;

  const [{ data: venue }, { data: staff }, { data: coupleClient }] = await Promise.all([
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
    event?.client_id
      ? client
          .from("clients")
          .select("first_name, partner_first_name, email")
          .eq("id", event.client_id)
          .maybeSingle<{ first_name: string; partner_first_name: string | null; email: string | null }>()
      : Promise.resolve({
          data: null as { first_name: string; partner_first_name: string | null; email: string | null } | null,
        }),
  ]);

  const coupleName = [coupleClient?.first_name, coupleClient?.partner_first_name]
    .filter(Boolean)
    .join(" & ") || "Your couple";

  return {
    conversationId: convo.id,
    conversationKind: convo.conversation_kind,
    eventId: event?.id ?? assignment.event_id,
    eventName: event?.name ?? "your event",
    venueId: convo.venue_id,
    venueName: venue?.name ?? "Your venue",
    venueEmail: venue?.email ?? null,
    assignedStaffEmail: staff?.email ?? null,
    vendorId: vendor?.id ?? assignment.vendor_id,
    vendorName: vendor?.business_name || "Vendor",
    vendorEmail: vendor?.email ?? null,
    assignmentId: convo.event_vendor_assignment_id,
    coupleName,
    coupleEmail: coupleClient?.email ?? null,
    clientId: event?.client_id ?? null,
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

/** Vendor portal → venue staff (venue_vendor threads only). */
export function notifyVenueOfVendorPortalMessage(conversationId: string, bodyPreview: string): void {
  void (async () => {
    try {
      const ctx = await loadVendorConversationNotifyContext(conversationId);
      if (!ctx || ctx.conversationKind !== "venue_vendor") return;

      const senderEmail = await activeSenderEmail();
      const preview = bodyPreview.trim() || "(attachment)";
      const recipients = dedupeEmails([ctx.assignedStaffEmail, ctx.venueEmail])
        .filter((email) => !senderEmail || email !== senderEmail);
      if (recipients.length === 0) return;

      const base = appBaseUrl();
      // Venue↔vendor ops thread lives on the event Vendors tab (not /messaging).
      const ctaUrl = `${base}/events/${ctx.eventId}?conversation=${ctx.conversationId}#vendors`;
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
    } catch (err) {
      console.error("[conversations] vendor→venue portal notify failed:", err);
    }
  })();
}

/**
 * Venue app → vendor contact, for venue_vendor Conversations on the
 * portal channel only. Fire-and-forget after a successful send.
 */
export function notifyVendorOfVenuePortalMessage(conversationId: string, bodyPreview: string): void {
  void (async () => {
    try {
      const ctx = await loadVendorConversationNotifyContext(conversationId);
      if (!ctx || ctx.conversationKind !== "venue_vendor") return;

      const senderEmail = await activeSenderEmail();
      const preview = bodyPreview.trim() || "(attachment)";
      const deepLinkPath = `/vendor/messages/${ctx.conversationId}`;

      // In-app inbox (message insert trigger also writes; 2m dedupe).
      await createVendorNotification({
        vendorId: ctx.vendorId,
        eventId: ctx.eventId,
        assignmentId: ctx.assignmentId,
        type: "new_message",
        title: `New message from ${ctx.venueName}`,
        body: preview.slice(0, 100),
        link: deepLinkPath,
        emoji: "💬",
      });

      const recipients = dedupeEmails([ctx.vendorEmail])
        .filter((email) => !senderEmail || email !== senderEmail);
      if (recipients.length === 0) return;

      const base = appBaseUrl();
      const ctaUrl = `${base}${deepLinkPath}`;
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
      console.error("[conversations] venue→vendor portal notify failed:", err);
    }
  })();
}

/** Vendor portal → couple (couple_vendor threads). */
export function notifyCoupleOfVendorPortalMessage(conversationId: string, bodyPreview: string): void {
  void (async () => {
    try {
      const ctx = await loadVendorConversationNotifyContext(conversationId);
      if (!ctx || ctx.conversationKind !== "couple_vendor") return;
      if (!ctx.coupleEmail) return;

      const admin = tryAdminClient();
      const client = admin ?? await createClient();
      let portalToken: string | null = null;
      if (ctx.clientId) {
        const { data: clientSession } = await client
          .from("client_portal_sessions")
          .select("access_token")
          .eq("client_id", ctx.clientId)
          .eq("venue_id", ctx.venueId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ access_token: string }>();
        portalToken = clientSession?.access_token ?? null;
      }

      const preview = bodyPreview.trim() || "(attachment)";
      const base = appBaseUrl();
      const ctaUrl = portalToken ? `${base}/p/${portalToken}#vendors` : base;

      await sendMessageEmail({
        to: ctx.coupleEmail,
        senderName: ctx.vendorName,
        bodyPreview: preview.slice(0, 200),
        ctaUrl,
        ctaLabel: "Open Messages",
        subject: `You have a new message from ${ctx.vendorName}`,
        eventName: ctx.eventName,
      });
    } catch (err) {
      console.error("[conversations] vendor→couple portal notify failed:", err);
    }
  })();
}

/** Couple portal → vendor (couple_vendor threads). */
export function notifyVendorOfCouplePortalMessage(conversationId: string, bodyPreview: string): void {
  void (async () => {
    try {
      const ctx = await loadVendorConversationNotifyContext(conversationId);
      if (!ctx || ctx.conversationKind !== "couple_vendor") return;

      const preview = bodyPreview.trim() || "(attachment)";
      const deepLinkPath = `/vendor/messages/${ctx.conversationId}`;

      await createVendorNotification({
        vendorId: ctx.vendorId,
        eventId: ctx.eventId,
        assignmentId: ctx.assignmentId,
        type: "new_message",
        title: `New message from ${ctx.coupleName}`,
        body: preview.slice(0, 100),
        link: deepLinkPath,
        emoji: "💬",
      });

      const recipients = dedupeEmails([ctx.vendorEmail]);
      if (recipients.length === 0) return;

      const base = appBaseUrl();
      const ctaUrl = `${base}${deepLinkPath}`;
      const subject = `You have a new message — ${ctx.eventName}`;
      await Promise.all(
        recipients.map((to) =>
          sendMessageEmail({
            to,
            senderName: ctx.coupleName,
            bodyPreview: preview.slice(0, 200),
            ctaUrl,
            ctaLabel: "Open Messages",
            subject,
            eventName: ctx.eventName,
          }),
        ),
      );
    } catch (err) {
      console.error("[conversations] couple→vendor portal notify failed:", err);
    }
  })();
}
