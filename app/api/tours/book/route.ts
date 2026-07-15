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
      // The couple's confirmation email is sent inside bookTour() itself now
      // (lib/tours/communication.ts) — through the real sendEmail() +
      // Message History pipeline, the same one every other message in this
      // platform goes through, identically to a coordinator-scheduled tour.
      // Previously this route sent its own raw-fetch confirmation that
      // never touched Message History, sandbox mode, or status tracking —
      // a real, separate communication path this fixes.
      void Promise.all([
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

// ── Coordinator notification ──────────────────────────────────────────────────

async function sendCoordinatorNotification(result: BookingResult): Promise<void> {
  // Use venue DB email — fall back to COORDINATOR_NOTIFY_EMAIL env var if not set
  const coordinatorEmail = result.venueEmail ?? process.env.COORDINATOR_NOTIFY_EMAIL;
  if (!coordinatorEmail || !result.scheduledAt) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const scheduledDate = new Date(result.scheduledAt).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  // Internal ops notification, not a message to the lead — no Message
  // History tracking needed, but still one send implementation, not a
  // second raw fetch to Resend.
  await sendEmail({
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
