/**
 * Tour confirmation — Coordinator Tour Scheduling completion pass.
 *
 * The one and only place a "your tour is confirmed" message gets sent,
 * used identically whether the tour was booked through the public
 * self-service widget or by a coordinator from a Lead. Previously the
 * public widget had its own raw-fetch-to-Resend implementation
 * (app/api/tours/book/route.ts) that bypassed the entire Communication
 * Trust Experience — no status tracking, no Message History, no sandbox
 * mode, no way to answer "did the confirmation actually go?" for a tour
 * confirmation specifically. This sends through the same sendEmail() +
 * conversation_messages pipeline every other message in this platform
 * goes through.
 *
 * RC2, Milestone 5: the legacy-`messages` mirror this used to also perform
 * (for venues still on the legacy experience) was removed — every venue
 * now defaults onto Conversations, with no toggle UI ever built, so the
 * mirror's "or wherever the coordinator's venue happens to be" condition
 * can no longer be false. lib/messaging/repository.ts's sendMessage/
 * updateMessageStatus remain as compatibility-only functions, still used
 * by the legacy inbox itself, just no longer called from here.
 *
 * System-initiated (no user session either way — the public widget has
 * none, and the coordinator's own action shouldn't require a second
 * round-trip through their session just to send a system message) — uses
 * the admin client throughout, same TR-M7 pattern as every other
 * system-initiated send in this codebase.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { sendEmail } from "@/lib/email/send";

type AdminClient = ReturnType<typeof createAdminClient>;

export type TourConfirmationParams = {
  venueId: string;
  leadId: string;
  relationshipId: string | null;
  contactEmail: string | null;
  contactName: string | null;
  venueName: string;
  /** Venue Brand Experience Phase 1 — falls back to Hello to Cheers' own default if the caller doesn't have it handy. */
  primaryColor?: string | null;
  scheduledAt: string;
  durationMinutes: number;
};

function buildConfirmationContent(params: TourConfirmationParams): { subject: string; text: string; html: string } {
  const tourDate = new Date(params.scheduledAt);
  const dateStr = tourDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = tourDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const name = params.contactName?.split(/[\s&]+/)[0] ?? "there";

  const dtStart = tourDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dtEnd = new Date(tourDate.getTime() + params.durationMinutes * 60000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Tour at ${params.venueName}`)}&dates=${dtStart}/${dtEnd}&details=${encodeURIComponent(`Your ${params.durationMinutes}-minute venue tour at ${params.venueName}.`)}`;

  const text = [
    `Hi ${name},`,
    "",
    `You're confirmed for a ${params.durationMinutes}-minute tour at ${params.venueName}.`,
    "",
    `📅 ${dateStr}`,
    `🕐 ${timeStr}`,
    `📍 ${params.venueName}`,
    "",
    "We're looking forward to meeting you!",
    "",
    `Add to Google Calendar: ${gcalUrl}`,
    "",
    "If you need to reschedule or have questions, just reply to this email.",
  ].join("\n");

  const html = [
    `<p>Hi ${name},</p>`,
    `<p>You're confirmed for a <strong>${params.durationMinutes}-minute tour</strong> at <strong>${params.venueName}</strong>.</p>`,
    `<table style="border:1px solid #E5E0D9;border-radius:12px;padding:16px 20px;margin:16px 0;border-spacing:0">`,
    `  <tr><td style="padding:4px 0;font-size:14px">📅 <strong>${dateStr}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">🕐 <strong>${timeStr}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">📍 ${params.venueName}</td></tr>`,
    `</table>`,
    `<p style="margin-top:16px"><a href="${gcalUrl}" style="background:${params.primaryColor ?? "#5D6F5D"};color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-size:14px">Add to Calendar</a></p>`,
    `<p style="color:#888;font-size:13px;margin-top:24px">We're looking forward to meeting you! If you need to reschedule, just reply to this email.</p>`,
    `<p style="color:#888;font-size:12px">${params.venueName}</p>`,
  ].join("\n");

  return { subject: `Tour confirmed — ${dateStr} at ${params.venueName}`, text, html };
}

async function findOrCreateConversation(client: AdminClient, venueId: string, relationshipId: string): Promise<string | null> {
  const { data: existing } = await client.from("conversations")
    .select("id").eq("relationship_id", relationshipId).maybeSingle<{ id: string }>();
  if (existing) return existing.id;

  const { data: created } = await client.from("conversations")
    .insert({ venue_id: venueId, relationship_id: relationshipId })
    .select("id").single<{ id: string }>();
  return created?.id ?? null;
}

/**
 * Fire-and-forget by design at the call site — a failed confirmation send
 * must never fail the scheduling action itself, exactly like every other
 * post-booking side effect in this codebase (notifications, reminders).
 */
export async function sendTourConfirmation(params: TourConfirmationParams): Promise<void> {
  if (!params.contactEmail) return;

  const supabase = createAdminClient();
  const { subject, text, html } = buildConfirmationContent(params);

  const emailResult = await sendEmail({ to: params.contactEmail, subject, text, html });
  const providerId = emailResult.ok && emailResult.method === "resend" ? emailResult.providerId : undefined;
  // A "mailto" fallback opens the *user's* mail client — meaningless in
  // this fully automated, backend-only send with nobody there to click
  // it, so it must not be reported as delivered. Same distinction already
  // established in lib/messaging/service.ts's Phase 3 fix: never claim
  // "accepted" for a send nothing actually attempted.
  const status = emailResult.ok && (emailResult.method === "resend" || emailResult.method === "disabled") ? "accepted" : "failed";
  const failureReason = !emailResult.ok ? emailResult.message
    : emailResult.method === "mailto" ? "Email isn't fully configured for this venue yet."
    : null;

  if (!params.relationshipId) return; // no Relationship to attach a Conversation record to

  const conversationId = await findOrCreateConversation(supabase, params.venueId, params.relationshipId);
  if (!conversationId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("conversation_messages") as any).insert({
    conversation_id: conversationId,
    venue_id: params.venueId,
    sender_type: "system",
    channel: "email",
    body: text,
    body_html: html,
    provider_id: providerId ?? null,
    status,
    failure_reason: failureReason,
  });
}
