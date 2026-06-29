/**
 * POST /api/portal/invite
 *
 * Sends personalized invitation emails to selected guests.
 * Each email contains the guest's unique rsvp_token link.
 *
 * Body: { token, guestIds: string[], emailType: 'invitation' | 'reminder' }
 * Returns: { ok, sent, failed, errors }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

type InvitePayload = {
  token: string;
  guestIds: string[];
  emailType?: string;
};

export async function POST(request: Request) {
  try {
    const { token, guestIds, emailType = "invitation" } = (await request.json()) as InvitePayload;
    if (!token || !guestIds?.length) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }

    const supabase = await createClient();

    // Resolve portal session → get venue/client context
    const { data: session } = await supabase
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();
    if (!session) return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 401 });

    // Load context for the email
    const { data: client } = await supabase
      .from("clients")
      .select("first_name, partner_first_name")
      .eq("id", session.client_id)
      .maybeSingle<{ first_name: string; partner_first_name: string | null }>();

    const { data: venue } = await supabase
      .from("venues")
      .select("name, email")
      .eq("id", session.venue_id)
      .maybeSingle<{ name: string; email: string | null }>();

    const { data: event } = await supabase
      .from("events")
      .select("event_date, name")
      .eq("client_id", session.client_id)
      .eq("venue_id", session.venue_id)
      .order("event_date")
      .limit(1)
      .maybeSingle<{ event_date: string; name: string }>();

    const { data: website } = await supabase
      .from("couple_websites")
      .select("slug")
      .eq("client_id", session.client_id)
      .eq("venue_id", session.venue_id)
      .eq("is_published", true)
      .maybeSingle<{ slug: string }>();

    // Fetch selected guests with email + rsvp_token
    const { data: guests } = await supabase
      .from("couple_guests")
      .select("id, first_name, last_name, email, rsvp_token")
      .in("id", guestIds)
      .eq("client_id", session.client_id)
      .eq("venue_id", session.venue_id)
      .not("email", "is", null)
      .not("rsvp_token", "is", null);

    if (!guests?.length) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, errors: ["No guests with email addresses found."] });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const coupleName = [client?.first_name, client?.partner_first_name].filter(Boolean).join(" & ");
    const eventDate = event?.event_date
      ? new Date(event.event_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : null;

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const guest of guests as { id: string; first_name: string; email: string; rsvp_token: string }[]) {
      const rsvpUrl = `${appUrl}/rsvp/${guest.rsvp_token}`;
      const websiteUrl = website?.slug ? `${appUrl}/w/${website.slug}` : null;
      const subject = emailType === "reminder"
        ? `Reminder: RSVP for ${coupleName}'s Wedding`
        : `You're invited! ${coupleName}'s Wedding`;

      const html = buildInvitationHtml({
        guestName: guest.first_name,
        coupleName,
        eventDate,
        venueName: venue?.name ?? "",
        rsvpUrl,
        websiteUrl,
        emailType,
      });

      if (apiKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: fromEmail, to: guest.email, subject, html }),
          });
          if (res.ok) results.sent++;
          else { results.failed++; results.errors.push(`${guest.email}: HTTP ${res.status}`); }
        } catch (err) {
          results.failed++;
          results.errors.push(`${guest.email}: ${err instanceof Error ? err.message : "send failed"}`);
        }
      } else {
        // Dev mode: log instead of send
        console.log(`[invite] DEV: would send to ${guest.email}: ${rsvpUrl}`);
        results.sent++;
      }
    }

    // Log in DB (non-blocking)
    void supabase.rpc("log_invitations_sent", {
      p_token: token,
      p_guest_ids: guestIds,
      p_email_type: emailType,
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error." }, { status: 500 });
  }
}

function buildInvitationHtml({ guestName, coupleName, eventDate, venueName, rsvpUrl, websiteUrl, emailType }: {
  guestName: string; coupleName: string; eventDate: string | null;
  venueName: string; rsvpUrl: string; websiteUrl: string | null; emailType: string;
}): string {
  const SAGE = "#5D6F5D";
  const LINEN = "#F7F5F1";
  const isReminder = emailType === "reminder";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${LINEN};font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${LINEN};padding:32px 16px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #DED6CA;">
        <tr><td style="background:${SAGE};padding:28px;text-align:center;">
          <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">${venueName}</p>
          <p style="margin:8px 0 0;color:#fff;font-size:28px;font-weight:600;letter-spacing:-0.5px;">${coupleName}</p>
          ${eventDate ? `<p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">${eventDate}</p>` : ""}
        </td></tr>
        <tr><td style="padding:32px 28px;">
          <p style="margin:0 0 16px;font-size:18px;color:#1a1a1a;">Dear ${guestName},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
            ${isReminder
              ? `Just a friendly reminder — we'd love to know if you can join us! Please take a moment to RSVP using your personal link below.`
              : `We are so excited to share our special day with you and would love for you to celebrate with us.`}
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${rsvpUrl}" style="display:inline-block;background:${SAGE};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
              ${isReminder ? "Submit Your RSVP" : "RSVP Now →"}
            </a>
          </div>
          ${websiteUrl ? `
          <p style="margin:0;font-size:13px;color:#888;text-align:center;">
            Visit our website for event details, schedule, travel info, and more:<br>
            <a href="${websiteUrl}" style="color:${SAGE};text-decoration:none;">${websiteUrl}</a>
          </p>` : ""}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #F0EDE9;text-align:center;">
          <p style="margin:0;font-size:11px;color:#B8AEA1;">
            With love, ${coupleName}
            <br>Powered by Wevenu · ${venueName}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
