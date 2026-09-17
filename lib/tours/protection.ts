import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { ingestLead } from "@/lib/lead-intake/pipeline";
import { sendTourConfirmation } from "@/lib/tours/communication";
import { notifyPaidUnbookedTour, runTourBookedSideEffects } from "@/lib/tours/booked-side-effects";
import { createTourProtectionCheckoutSession } from "@/lib/tours/protection-checkout";
import {
  canRefundTourFee,
  isTourProtectionRequired,
  type TourProtectionMode,
  type TourProtectionRequestStatus,
} from "@/lib/tours/protection-rules";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { refundStripePayment } from "@/lib/stripe/refunds";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import type { BookingResult } from "@/lib/tours/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type VenueProtectionRow = {
  id: string;
  name: string;
  timezone: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state_region: string | null;
  primary_color: string | null;
  tour_embed_key: string;
  tour_duration_minutes: number;
  tour_protection_mode: TourProtectionMode;
  tour_protection_fee_cents: number;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
};

export type TourProtectionRequestRow = {
  id: string;
  venue_id: string;
  lead_id: string;
  appointment_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_setup_intent_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_account_id: string;
  mode: "setup" | "fee";
  fee_cents: number;
  refunded_amount_cents: number;
  slot_start: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  notes: string | null;
  status: TourProtectionRequestStatus;
  created_at: string;
};

export type PublicProtectionStatus = {
  status: TourProtectionRequestStatus | "not_found";
  appointmentCreated: boolean;
  scheduledAt: string | null;
  duration: number | null;
  venueName: string | null;
  venuePhone: string | null;
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
  contactEmail: string | null;
  contactName: string | null;
  mode: "setup" | "fee" | null;
};

const TOUR_BOOK_ERRORS: Record<string, string> = {
  slot_taken: "That time is no longer available. Please choose another time.",
  slot_unavailable: "That time is no longer available. Please choose another time.",
  slot_too_soon: "Please choose a time at least 24 hours from now.",
  slot_too_far: "This slot is too far in the future.",
  invalid_key: "This booking link is not valid.",
  event_type_required: "Event type is required.",
  date_unavailable: "That date is no longer available. Please choose another date.",
  protection_required: "This venue requires a payment step before the tour can be booked.",
};

export async function loadVenueProtectionByTourKey(admin: AdminClient, key: string): Promise<VenueProtectionRow | null> {
  const { data } = await admin
    .from("venues")
    .select("id, name, timezone, email, phone, address_line1, city, state_region, primary_color, tour_embed_key, tour_duration_minutes, tour_protection_mode, tour_protection_fee_cents, stripe_account_id, stripe_charges_enabled")
    .eq("tour_embed_key", key)
    .eq("tour_scheduling_enabled", true)
    .maybeSingle<VenueProtectionRow>();
  return data ?? null;
}

export function venueRequiresPublicProtection(venue: VenueProtectionRow): boolean {
  return isTourProtectionRequired({
    tourProtectionMode: venue.tour_protection_mode,
    tourProtectionFeeCents: venue.tour_protection_fee_cents,
    stripeAccountId: venue.stripe_account_id,
    stripeChargesEnabled: venue.stripe_charges_enabled,
  });
}

export async function startProtectedTour(opts: {
  key: string;
  slotStart: string;
  fields: {
    firstName: string;
    lastName: string;
    partnerName: string;
    email: string;
    phone: string;
    eventType: string;
    eventDate: string;
    guestCount: number | null;
    notes: string;
  };
  turnstileToken?: string | null;
  ipAddress?: string | null;
  qrCampaignId?: string | null;
  sourceData?: Record<string, unknown>;
}): Promise<BookingResult> {
  const admin = createAdminClient();
  const venue = await loadVenueProtectionByTourKey(admin, opts.key);
  if (!venue) return { ok: false, error: TOUR_BOOK_ERRORS.invalid_key };
  if (!venueRequiresPublicProtection(venue) || !venue.stripe_account_id) {
    return { ok: false, error: TOUR_BOOK_ERRORS.invalid_key };
  }

  const mode: "setup" | "fee" = venue.tour_protection_mode === "fee" ? "fee" : "setup";
  const feeCents = mode === "fee" ? venue.tour_protection_fee_cents : 0;
  const contactName = `${opts.fields.firstName} ${opts.fields.lastName}`.trim();

  const outcome = await ingestLead({
    supabase: admin,
    venueId: venue.id,
    source: "tour_scheduling",
    trustTier: "direct",
    ipAddress: opts.ipAddress ?? null,
    turnstileToken: opts.turnstileToken ?? null,
    rawPayload: { key: opts.key, slotStart: opts.slotStart, fields: opts.fields, protection: mode },
    input: {
      firstName: opts.fields.firstName,
      lastName: opts.fields.lastName,
      partnerFirstName: opts.fields.partnerName,
      email: opts.fields.email,
      phone: opts.fields.phone,
      eventType: opts.fields.eventType,
      eventDate: opts.fields.eventDate || null,
      guestCount: opts.fields.guestCount,
      inquiryMessage: opts.fields.notes,
    },
    create: async (normalized) => {
      const { data, error } = await admin.rpc("ingest_lead", {
        p_venue_id: venue.id,
        p_source: "tour_scheduling",
        p_input: {
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          partnerFirstName: normalized.partnerFirstName ?? opts.fields.partnerName,
          email: normalized.email ?? "",
          phone: normalized.phone ?? "",
          eventType: normalized.eventType ?? "",
          eventDate: normalized.eventDate,
          guestCount: normalized.guestCount,
          inquiryMessage: normalized.inquiryMessage ?? "",
          sourceData: {
            ...(opts.sourceData ?? {}),
            inquiry_mode: "schedule_tour",
            slot: opts.slotStart,
            tour_protection: mode,
            custom_answers: (opts.sourceData?.custom_answers as Record<string, unknown> | undefined) ?? undefined,
          },
        },
      });
      if (error || !(data as { ok?: boolean } | null)?.ok) {
        return { ok: false, error: (data as { error?: string } | null)?.error ?? error?.message ?? "Could not save your information." };
      }
      const created = data as { leadId: string; relationshipId: string; isReturningRelationship?: boolean };
      return {
        ok: true,
        leadId: created.leadId,
        relationshipId: created.relationshipId,
        isReturningRelationship: created.isReturningRelationship === true,
      };
    },
  });

  if (!outcome.ok) return { ok: false, error: outcome.error };

  const insert = await admin.from("tour_protection_requests").insert({
    venue_id: venue.id,
    lead_id: outcome.leadId,
    stripe_account_id: venue.stripe_account_id,
    mode,
    fee_cents: feeCents,
    slot_start: opts.slotStart,
    contact_name: contactName,
    contact_email: opts.fields.email,
    contact_phone: opts.fields.phone || null,
    event_type: opts.fields.eventType,
    event_date: opts.fields.eventDate || null,
    guest_count: opts.fields.guestCount,
    notes: opts.fields.notes || null,
    source_data: opts.sourceData ?? {},
    qr_campaign_id: opts.qrCampaignId ?? null,
    status: "pending",
  }).select("id").single<{ id: string }>();

  if (insert.error || !insert.data) {
    return { ok: false, error: "Could not start the payment step. Please try again." };
  }

  const requestId = insert.data.id;
  const session = await createTourProtectionCheckoutSession({
    stripeAccountId: venue.stripe_account_id,
    requestId,
    venueId: venue.id,
    leadId: outcome.leadId,
    embedKey: opts.key,
    mode,
    feeCents,
    customerEmail: opts.fields.email,
    customerName: contactName,
  });

  if (!session.ok) {
    await admin.from("tour_protection_requests")
      .update({ status: "failed" })
      .eq("id", requestId)
      .eq("venue_id", venue.id)
      .in("status", ["pending"]);
    return { ok: false, error: session.message };
  }

  await admin.from("tour_protection_requests")
    .update({
      status: "checkout_open",
      stripe_checkout_session_id: session.sessionId,
      stripe_customer_id: session.customerId,
    })
    .eq("id", requestId)
    .eq("venue_id", venue.id)
    .in("status", ["pending"]);

  return {
    ok: true,
    leadId: outcome.leadId,
    relationshipId: outcome.relationshipId,
    venueId: venue.id,
    venueName: venue.name,
    contactEmail: opts.fields.email,
    contactName,
    contactPhone: opts.fields.phone,
    intakeAttemptId: outcome.attemptId,
    protectionRequired: true,
    checkoutUrl: session.checkoutUrl,
    protectionRequestId: requestId,
  };
}

export async function tourProtectionRequestExists(requestId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("tour_protection_requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle<{ id: string }>();
  return Boolean(data);
}

export async function completeProtectedTourFromWebhook(opts: {
  requestId?: string | null;
  checkoutSessionId?: string | null;
  connectedAccountVenueId: string | null;
  metadataVenueId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSetupIntentId?: string | null;
  stripePaymentMethodId?: string | null;
  stripeCustomerId?: string | null;
}): Promise<"handled" | "ignored"> {
  const admin = createAdminClient();
  let request: TourProtectionRequestRow | null = null;

  if (opts.checkoutSessionId) {
    const { data } = await admin.from("tour_protection_requests")
      .select("*")
      .eq("stripe_checkout_session_id", opts.checkoutSessionId)
      .maybeSingle<TourProtectionRequestRow>();
    request = data ?? null;
  }
  if (!request && opts.requestId) {
    const { data } = await admin.from("tour_protection_requests")
      .select("*")
      .eq("id", opts.requestId)
      .maybeSingle<TourProtectionRequestRow>();
    request = data ?? null;
  }
  if (!request) return "ignored";

  if (!opts.connectedAccountVenueId || request.venue_id !== opts.connectedAccountVenueId) {
    console.error("[tour protection] webhook venue mismatch", {
      requestId: request.id,
      requestVenueId: request.venue_id,
      connectedAccountVenueId: opts.connectedAccountVenueId,
    });
    return "handled";
  }
  if (opts.metadataVenueId && opts.metadataVenueId !== request.venue_id) {
    console.error("[tour protection] webhook metadata venue mismatch", {
      requestId: request.id,
      requestVenueId: request.venue_id,
      metadataVenueId: opts.metadataVenueId,
    });
    return "handled";
  }
  if (opts.requestId && opts.requestId !== request.id) {
    console.error("[tour protection] webhook request id mismatch", {
      requestId: request.id,
      metadataRequestId: opts.requestId,
    });
    return "handled";
  }

  const patch: Record<string, unknown> = {};
  if (opts.stripePaymentIntentId) patch.stripe_payment_intent_id = opts.stripePaymentIntentId;
  if (opts.stripeSetupIntentId) patch.stripe_setup_intent_id = opts.stripeSetupIntentId;
  if (opts.stripePaymentMethodId) patch.stripe_payment_method_id = opts.stripePaymentMethodId;
  if (opts.stripeCustomerId) patch.stripe_customer_id = opts.stripeCustomerId;
  if (Object.keys(patch).length > 0) {
    await admin.from("tour_protection_requests")
      .update(patch)
      .eq("id", request.id)
      .eq("venue_id", request.venue_id);
  }

  const { data, error } = await admin.rpc("book_protected_tour", { p_request_id: request.id });
  if (error) {
    console.error("[tour protection] book_protected_tour failed", error);
    return "handled";
  }
  const result = data as Record<string, unknown>;
  const venue = await admin.from("venues")
    .select("name, email, phone, address_line1, city, state_region, primary_color, timezone")
    .eq("id", request.venue_id)
    .maybeSingle<{
      name: string; email: string | null; phone: string | null;
      address_line1: string | null; city: string | null; state_region: string | null;
      primary_color: string | null; timezone: string | null;
    }>();

  if (result?.ok === true && result.appointmentId) {
    const booking: BookingResult = {
      ok: true,
      appointmentId: result.appointmentId as string,
      leadId: result.leadId as string,
      relationshipId: (result.relationshipId as string | null) ?? null,
      scheduledAt: result.scheduledAt as string,
      venueName: (result.venueName as string) ?? venue.data?.name,
      venueId: request.venue_id,
      duration: result.duration as number,
      contactEmail: request.contact_email,
      contactName: request.contact_name,
      contactPhone: request.contact_phone ?? undefined,
      venueEmail: venue.data?.email ?? null,
      venuePhone: venue.data?.phone ?? null,
      addressLine1: venue.data?.address_line1 ?? null,
      city: venue.data?.city ?? null,
      stateRegion: venue.data?.state_region ?? null,
    };
    if (result.idempotent !== true) {
      void sendTourConfirmation({
        venueId: request.venue_id,
        leadId: booking.leadId!,
        relationshipId: booking.relationshipId ?? null,
        contactEmail: request.contact_email,
        contactName: request.contact_name,
        venueName: booking.venueName ?? "Venue",
        primaryColor: venue.data?.primary_color ?? null,
        scheduledAt: booking.scheduledAt!,
        durationMinutes: booking.duration ?? 60,
        timezone: venue.data?.timezone,
      }).catch((err) => console.error("sendTourConfirmation failed:", err));
      void runTourBookedSideEffects(booking);
    }
    return "handled";
  }

  if (result?.status === "paid_unbooked" && result.idempotent !== true) {
    void notifyPaidUnbookedTour({
      venueEmail: venue.data?.email ?? null,
      venueName: venue.data?.name ?? "Venue",
      contactName: request.contact_name,
      contactEmail: request.contact_email,
      slotStart: request.slot_start,
      leadId: request.lead_id,
    }).catch(() => {});
  }

  return "handled";
}

export async function abandonTourProtectionFromWebhook(opts: {
  checkoutSessionId: string;
  connectedAccountVenueId: string | null;
}): Promise<"handled" | "ignored"> {
  const admin = createAdminClient();
  const { data } = await admin.from("tour_protection_requests")
    .select("id, venue_id, status")
    .eq("stripe_checkout_session_id", opts.checkoutSessionId)
    .maybeSingle<{ id: string; venue_id: string; status: string }>();
  if (!data) return "ignored";
  if (!opts.connectedAccountVenueId || data.venue_id !== opts.connectedAccountVenueId) {
    return "handled";
  }
  if (data.status !== "pending" && data.status !== "checkout_open") return "handled";
  await admin.from("tour_protection_requests")
    .update({ status: "abandoned", abandoned_at: new Date().toISOString() })
    .eq("id", data.id)
    .eq("venue_id", data.venue_id)
    .in("status", ["pending", "checkout_open"]);
  return "handled";
}

export async function failTourProtectionFromWebhook(opts: {
  requestId?: string | null;
  connectedAccountVenueId: string | null;
}): Promise<"handled" | "ignored"> {
  if (!opts.requestId) return "ignored";
  const admin = createAdminClient();
  const { data } = await admin.from("tour_protection_requests")
    .select("id, venue_id, status")
    .eq("id", opts.requestId)
    .maybeSingle<{ id: string; venue_id: string; status: string }>();
  if (!data) return "ignored";
  if (!opts.connectedAccountVenueId || data.venue_id !== opts.connectedAccountVenueId) {
    return "handled";
  }
  if (data.status !== "pending" && data.status !== "checkout_open") return "handled";
  await admin.from("tour_protection_requests")
    .update({ status: "failed" })
    .eq("id", data.id)
    .eq("venue_id", data.venue_id)
    .in("status", ["pending", "checkout_open"]);
  return "handled";
}

export async function getPublicProtectionStatus(opts: {
  embedKey: string;
  sessionId: string;
}): Promise<PublicProtectionStatus> {
  const admin = createAdminClient();
  const venue = await loadVenueProtectionByTourKey(admin, opts.embedKey);
  if (!venue) {
    return emptyPublicStatus();
  }
  const { data } = await admin.from("tour_protection_requests")
    .select("*")
    .eq("stripe_checkout_session_id", opts.sessionId)
    .eq("venue_id", venue.id)
    .maybeSingle<TourProtectionRequestRow>();
  if (!data) return emptyPublicStatus();

  const reconciled = await reconcileOpenProtectionSession(data, venue.id);
  const row = reconciled ?? data;

  return {
    status: row.status,
    appointmentCreated: Boolean(row.appointment_id) && row.status === "completed",
    scheduledAt: row.status === "completed" ? row.slot_start : null,
    duration: row.status === "completed" ? venue.tour_duration_minutes : null,
    venueName: venue.name,
    venuePhone: venue.phone,
    addressLine1: venue.address_line1,
    city: venue.city,
    stateRegion: venue.state_region,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    mode: row.mode,
  };
}

async function reconcileOpenProtectionSession(
  request: TourProtectionRequestRow,
  venueId: string,
): Promise<TourProtectionRequestRow | null> {
  if (request.status !== "pending" && request.status !== "checkout_open") return request;
  if (!request.stripe_checkout_session_id || !isStripeConfigured()) return request;

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(
      request.stripe_checkout_session_id,
      { expand: ["setup_intent", "payment_intent"] },
      { stripeAccount: request.stripe_account_id },
    );

    if (session.status === "expired") {
      await abandonTourProtectionFromWebhook({
        checkoutSessionId: session.id,
        connectedAccountVenueId: venueId,
      });
    } else if (
      (session.mode === "setup" && session.status === "complete")
      || (session.mode === "payment" && session.payment_status === "paid")
    ) {
      const setup = typeof session.setup_intent === "object" ? session.setup_intent : null;
      const pi = typeof session.payment_intent === "object" ? session.payment_intent : null;
      await completeProtectedTourFromWebhook({
        requestId: request.id,
        checkoutSessionId: session.id,
        connectedAccountVenueId: venueId,
        metadataVenueId: venueId,
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : pi?.id ?? null,
        stripeSetupIntentId: typeof session.setup_intent === "string" ? session.setup_intent : setup?.id ?? null,
        stripePaymentMethodId:
          (typeof setup?.payment_method === "string" ? setup.payment_method : setup?.payment_method?.id)
          ?? (typeof pi?.payment_method === "string" ? pi.payment_method : pi?.payment_method?.id)
          ?? null,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      });
    }
  } catch (err) {
    console.error("[tour protection] session reconcile failed", err);
    return request;
  }

  const admin = createAdminClient();
  const { data } = await admin.from("tour_protection_requests")
    .select("*")
    .eq("id", request.id)
    .eq("venue_id", venueId)
    .maybeSingle<TourProtectionRequestRow>();
  return data ?? request;
}

function emptyPublicStatus(): PublicProtectionStatus {
  return {
    status: "not_found",
    appointmentCreated: false,
    scheduledAt: null,
    duration: null,
    venueName: null,
    venuePhone: null,
    addressLine1: null,
    city: null,
    stateRegion: null,
    contactEmail: null,
    contactName: null,
    mode: null,
  };
}

export async function listUnresolvedProtectionRequests(): Promise<TourProtectionRequestRow[]> {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("tour_protection_requests")
    .select("*")
    .eq("venue_id", venue.id)
    .eq("status", "paid_unbooked")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as TourProtectionRequestRow[];
}

export async function refundTourProtectionFee(requestId: string): Promise<{ ok: boolean; message?: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const role = await getCurrentUserRole();
  if (!canRefundTourFee(role)) {
    return { ok: false, message: "Only the venue Owner or Manager can refund a tour fee." };
  }
  const supabase = await createClient();
  const { data } = await supabase.from("tour_protection_requests")
    .select("*")
    .eq("id", requestId)
    .eq("venue_id", venue.id)
    .maybeSingle<TourProtectionRequestRow>();
  if (!data) return { ok: false, message: "This request could not be found." };
  if (data.mode !== "fee") return { ok: false, message: "There is no tour fee to refund." };
  if (!data.stripe_payment_intent_id) return { ok: false, message: "No payment was collected." };
  if (data.status === "refunded") return { ok: true };
  if (data.status !== "completed" && data.status !== "paid_unbooked") {
    return { ok: false, message: "This payment cannot be refunded." };
  }

  const stripeResult = await refundStripePayment(
    data.stripe_account_id,
    data.stripe_payment_intent_id,
    data.fee_cents / 100,
  );
  if (!stripeResult.ok) return { ok: false, message: stripeResult.message };

  const { error } = await supabase.from("tour_protection_requests")
    .update({
      status: "refunded",
      refunded_amount_cents: data.fee_cents,
    })
    .eq("id", requestId)
    .eq("venue_id", venue.id)
    .in("status", ["completed", "paid_unbooked"]);
  if (error) return { ok: false, message: "Refund issued, but the local record could not be updated." };
  return { ok: true };
}

export async function markTourProtectionRefundedFromStripe(paymentIntentId: string, connectedAccountVenueId: string | null): Promise<"handled" | "ignored"> {
  const admin = createAdminClient();
  const { data } = await admin.from("tour_protection_requests")
    .select("id, venue_id, fee_cents, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle<{ id: string; venue_id: string; fee_cents: number; status: string }>();
  if (!data) return "ignored";
  if (!connectedAccountVenueId || data.venue_id !== connectedAccountVenueId) return "handled";
  if (data.status === "refunded") return "handled";
  if (data.status !== "completed" && data.status !== "paid_unbooked") return "handled";
  await admin.from("tour_protection_requests")
    .update({ status: "refunded", refunded_amount_cents: data.fee_cents })
    .eq("id", data.id)
    .eq("venue_id", data.venue_id)
    .in("status", ["completed", "paid_unbooked"]);
  return "handled";
}
