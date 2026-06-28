import { NextResponse } from "next/server";
import { bookTour } from "@/lib/tours/service";
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

    // Fire coordinator notification (non-blocking)
    if (result.ok && result.leadId) {
      void sendBookingNotification(result).catch(() => {});
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}

async function sendBookingNotification(result: BookingResult): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";
  const coordinatorEmail = process.env.COORDINATOR_NOTIFY_EMAIL;
  if (!apiKey || !coordinatorEmail) return;

  const scheduledDate = result.scheduledAt
    ? new Date(result.scheduledAt).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: coordinatorEmail,
      subject: `New tour booked — ${scheduledDate}`,
      text: `A new tour has been scheduled at ${result.venueName}.\n\nDate: ${scheduledDate}\nDuration: ${result.duration} minutes\n\nA new lead has been created in Wevenu.`,
    }),
  });
}
