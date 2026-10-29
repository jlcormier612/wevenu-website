/**
 * Client notifications after Inventory Agreement finalization.
 * Email + portal notification. Must not unlock or roll back finalize.
 * Idempotent: outbound history keyed by sourceType + sourceId.
 */
import { createCoupleNotification } from "@/lib/couple-notifications/create";
import { recordExternalClientOutbound } from "@/lib/conversations/record-external-outbound";
import { sendEmail } from "@/lib/email/send";
import {
  brandButtonHtml,
  emailBrandFromVenue,
  escapeHtml,
  renderBrandedEmailHtml,
} from "@/lib/email/venue-brand";
import { inventoryReviewUrl, pickInventoryPortalSession } from "@/lib/event-inventory/inventory-portal-link";
import { publicAppOrigin } from "@/lib/env";
import { customerFacingVenueName } from "@/lib/venue/identity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type InventoryFinalizeNotifyResult = {
  emailSubmitted: boolean;
  emailMessage?: string;
  portalNotified: boolean;
};

export async function notifyInventoryFinalized(input: {
  supabase: Db;
  venueId: string;
  eventInventoryId: string;
  eventId: string;
  eventName: string;
  clientId: string;
  clientEmail: string | null;
  clientFirstName: string | null;
  venueName: string;
  venueEmail?: string | null;
  brand?: Parameters<typeof emailBrandFromVenue>[0];
}): Promise<InventoryFinalizeNotifyResult> {
  const venueLabel = customerFacingVenueName({ name: input.venueName }) || input.venueName || "Your venue";
  const name = input.clientFirstName?.trim() || "there";
  const eventBit = input.eventName.trim() ? ` for ${input.eventName.trim()}` : "";

  let portalUrl = publicAppOrigin().replace(/\/$/, "") + "/";
  try {
    const { getPortalSessions, createPortalSession } = await import("@/lib/portal/service");
    const sessions = await getPortalSessions(input.clientId);
    const session =
      pickInventoryPortalSession(sessions)
      ?? (await createPortalSession(input.clientId, "Couple", "couple"));
    if (session?.accessToken) {
      portalUrl = inventoryReviewUrl(publicAppOrigin(), session.accessToken);
    }
  } catch {
    /* keep home URL */
  }

  const subject = `${venueLabel} approved your Inventory Agreement`;
  const text = [
    `Hi ${name},`,
    "",
    `${venueLabel} reviewed and finalized your Inventory Agreement${eventBit}.`,
    "",
    "The agreed inventory is now locked. Open it anytime from Documents or this link:",
    portalUrl,
    "",
    venueLabel,
  ].join("\n");

  const brand = emailBrandFromVenue(input.brand ?? { name: venueLabel });
  const html = renderBrandedEmailHtml(
    brand,
    [
      `<p style="margin:0 0 12px;font-size:15px;color:#374151">Hi ${escapeHtml(name)},</p>`,
      `<p style="margin:0 0 12px;font-size:15px;color:#374151"><strong>${escapeHtml(venueLabel)}</strong> reviewed and finalized your <strong>Inventory Agreement</strong>${eventBit ? escapeHtml(eventBit) : ""}.</p>`,
      `<p style="margin:0 0 20px;font-size:15px;color:#374151">The agreed inventory is now locked. Open the finalized document anytime from Documents.</p>`,
      `<p style="margin:0 0 20px">${brandButtonHtml(brand, portalUrl, "View Inventory Agreement")}</p>`,
      `<p style="margin:0;font-size:15px;color:#374151">${escapeHtml(venueLabel)}</p>`,
    ].join(""),
  );

  let emailSubmitted = false;
  let emailMessage: string | undefined;
  if (input.clientEmail?.trim()) {
    const emailResult = await sendEmail({
      to: input.clientEmail.trim(),
      subject,
      text,
      html,
      replyTo: input.venueEmail ?? undefined,
    });
    emailSubmitted = emailResult.ok;
    emailMessage = emailResult.ok ? undefined : emailResult.message;
    try {
      await recordExternalClientOutbound(input.supabase, {
        venueId: input.venueId,
        channel: "email",
        body: text,
        clientId: input.clientId,
        providerId: emailResult.ok ? emailResult.providerId ?? null : null,
        status: emailResult.ok ? "accepted" : "failed",
        failureReason: emailResult.ok ? null : emailResult.message,
        sourceType: "event_inventory_finalized",
        sourceId: input.eventInventoryId,
      });
    } catch {
      /* non-blocking history */
    }
  } else {
    emailMessage = "No client email on file.";
  }

  let portalNotified = false;
  try {
    await createCoupleNotification({
      clientId: input.clientId,
      type: "new_message",
      title: "Inventory Agreement finalized",
      body: `${venueLabel} approved your Inventory Agreement${eventBit}. It is locked in Documents.`,
      link: portalUrl,
    });
    portalNotified = true;
  } catch {
    /* non-blocking */
  }

  return { emailSubmitted, emailMessage, portalNotified };
}
