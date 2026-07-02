import { NextResponse } from "next/server";
import { bookTour } from "@/lib/tours/service";
import { sendEmail } from "@/lib/email/send";
import type { BookingResult } from "@/lib/tours/types";

type BookPayload = {
  key: string; slotStart: string;
  firstName: string; lastName: string; partnerName: string;
  email: string; phone: string; eventType: string;
  eventDate: string; guestCount: number | null; notes: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BookPayload;
    if (!body.key || !body.slotStart || !body.firstName || !body.email) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }
    const result: BookingResult = await bookTour(body.key, body.slotStart, {
      firstName: body.firstName, lastName: body.lastName, partnerName: body.partnerName ?? "",
      email: body.email, phone: body.phone ?? "", eventType: body.eventType ?? "",
      eventDate: body.eventDate ?? "", guestCount: body.guestCount ?? null, notes: body.notes ?? "",
    });

    if (result.ok && result.appointmentId) {
      // Fire all post-booking tasks in parallel — none block the response
      void Promise.all([
        sendCoupleConfirmation(result, body).catch(() => {}),
        sendCoordinatorNotification(result).catch(() => {}),
        scheduleTourReminders(result).catch(() => {}),
        trackTourBooked(result).catch(() => {}),
      ]);
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}

// ── Couple confirmation email ─────────────────────────────────────────────────

async function sendCoupleConfirmation(result: BookingResult, body: BookPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !result.scheduledAt || !result.venueName) return;

  const tourDate = new Date(result.scheduledAt);
  const dateStr  = tourDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr  = tourDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const duration = result.duration ?? 60;
  const name     = body.firstName;

  // Google Calendar link
  const dtStart  = tourDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dtEnd    = new Date(tourDate.getTime() + duration * 60000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const gcalUrl  = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Tour at ${result.venueName}`)}&dates=${dtStart}/${dtEnd}&details=${encodeURIComponent(`Your ${duration}-minute venue tour at ${result.venueName}.`)}`;

  const lines = [
    `Hi ${name},`,
    "",
    `You're confirmed for a ${duration}-minute tour at ${result.venueName}.`,
    "",
    `📅 ${dateStr}`,
    `🕐 ${timeStr}`,
    `📍 ${result.venueName}`,
    "",
    "We're looking forward to meeting you!",
    "",
    `Add to Google Calendar: ${gcalUrl}`,
    "",
    "If you need to reschedule or have questions, please reply to this email.",
  ];

  const html = [
    `<p>Hi ${name},</p>`,
    `<p>You're confirmed for a <strong>${duration}-minute tour</strong> at <strong>${result.venueName}</strong>.</p>`,
    `<table style="border:1px solid #E5E0D9;border-radius:12px;padding:16px 20px;margin:16px 0;border-spacing:0">`,
    `  <tr><td style="padding:4px 0;font-size:14px">📅 <strong>${dateStr}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">🕐 <strong>${timeStr}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">📍 ${result.venueName}</td></tr>`,
    `</table>`,
    `<p style="margin-top:16px">`,
    `  <a href="${gcalUrl}" style="background:#5D6F5D;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-size:14px">`,
    `    Add to Calendar`,
    `  </a>`,
    `</p>`,
    `<p style="color:#888;font-size:13px;margin-top:24px">We're looking forward to meeting you! If you need to reschedule, just reply to this email.</p>`,
    `<p style="color:#888;font-size:12px">${result.venueName}</p>`,
  ].join("\n");

  const fromEmail = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [body.email],
      subject: `Tour confirmed — ${dateStr} at ${result.venueName}`,
      text: lines.join("\n"),
      html,
      open_tracking: true,
    }),
  });
}

// ── Coordinator notification ──────────────────────────────────────────────────

async function sendCoordinatorNotification(result: BookingResult): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  // Use venue DB email — fall back to COORDINATOR_NOTIFY_EMAIL env var if not set
  const coordinatorEmail = result.venueEmail ?? process.env.COORDINATOR_NOTIFY_EMAIL;
  if (!apiKey || !coordinatorEmail || !result.scheduledAt) return;

  const fromEmail  = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const scheduledDate = new Date(result.scheduledAt).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: coordinatorEmail,
      subject: `New tour booked — ${scheduledDate}`,
      text: [
        `A new tour has been scheduled at ${result.venueName}.`,
        "",
        `Date: ${scheduledDate}`,
        `Duration: ${result.duration ?? 60} minutes`,
        result.contactName ? `Contact: ${result.contactName}` : null,
        "",
        "A new lead has been created in Wevenu.",
        `${appUrl}/leads`,
      ].filter(Boolean).join("\n"),
    }),
  });
}

// ── Tour reminders (24h before, for coordinator + couple) ─────────────────────

async function scheduleTourReminders(result: BookingResult): Promise<void> {
  if (!result.appointmentId || !result.scheduledAt) return;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !result.venueId) return;

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const remindAt = new Date(new Date(result.scheduledAt).getTime() - 24 * 3600 * 1000);

  const reminders: Array<Record<string, unknown>> = [
    {
      venue_id: result.venueId,
      tour_appointment_id: result.appointmentId,
      reminder_type: "upcoming",
      notify_role: "coordinator",
      scheduled_for: remindAt.toISOString(),
      status: "pending",
    },
  ];
  if (result.contactEmail) {
    reminders.push({
      venue_id: result.venueId,
      tour_appointment_id: result.appointmentId,
      reminder_type: "upcoming",
      notify_role: "couple",
      scheduled_for: remindAt.toISOString(),
      status: "pending",
    });
  }
  await supabase.from("task_reminders").insert(reminders);
}

// ── Tour conversion analytics ─────────────────────────────────────────────────

async function trackTourBooked(result: BookingResult): Promise<void> {
  if (!result.leadId || !result.venueId) return;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  await supabase.from("lead_signal_events").insert({
    venue_id: result.venueId,
    lead_id: result.leadId,
    signal_type: "tour_booked",
    signal_strength: 3,
    metadata: { appointment_id: result.appointmentId, scheduled_at: result.scheduledAt },
  });
}
