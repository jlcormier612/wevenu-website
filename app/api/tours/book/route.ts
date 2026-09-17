import { NextResponse } from "next/server";
import { bookTour } from "@/lib/tours/service";
import { runTourBookedSideEffects } from "@/lib/tours/booked-side-effects";
import type { BookingResult } from "@/lib/tours/types";

type BookPayload = {
  key: string; slotStart: string;
  firstName: string; lastName: string; partnerName: string;
  email: string; phone: string; eventType: string;
  eventDate: string; guestCount: number | null; notes: string;
  turnstileToken?: string | null;
  qrCampaignId?: string | null;
  sourceData?: Record<string, unknown>;
  preferredCommunicationChannels?: unknown;
  smsPermissionGranted?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BookPayload;
    if (!body.key || !body.slotStart || !body.firstName || !body.email || !body.eventType?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
    const result: BookingResult = await bookTour(body.key, body.slotStart, {
      firstName: body.firstName, lastName: body.lastName, partnerName: body.partnerName ?? "",
      email: body.email, phone: body.phone ?? "", eventType: body.eventType ?? "",
      eventDate: body.eventDate ?? "", guestCount: body.guestCount ?? null, notes: body.notes ?? "",
    }, { turnstileToken: body.turnstileToken ?? null, ipAddress, qrCampaignId: body.qrCampaignId ?? null, sourceData: body.sourceData ?? {} });

    if (result.ok && result.appointmentId) {
      void runTourBookedSideEffects(result);
    }

    if (result.ok && result.leadId && result.venueId) {
      try {
        const { applyInquiryCommunicationCapture } = await import("@/lib/communication/apply-inquiry-consent");
        await applyInquiryCommunicationCapture({
          venueId: result.venueId,
          venueName: result.venueName ?? "Venue",
          leadId: result.leadId,
          relationshipId: result.relationshipId ?? null,
          phone: body.phone ?? null,
          preferredChannels: body.preferredCommunicationChannels,
          smsPermissionGranted: body.smsPermissionGranted === true,
          embedKey: body.key,
          source: "tour_form",
        });
      } catch {
        /* lead already created */
      }
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
