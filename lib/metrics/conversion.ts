/**
 * Reporting & Analytics — Canonical Metric Implementation.
 *
 * Canonical Conversion metrics (§4 of the brief). "Booking Conversion
 * Rate" (Inquiry -> Booking) is the only metric permitted to carry the
 * name "Conversion Rate" — every other stage below has its own explicit
 * name. All seven are read from the single `canonical_conversion_funnel()`
 * SQL function, which computes every stage from the same underlying
 * counts in one call — never seven independent queries.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type DateWindow = { from?: string; to?: string };

export type ConversionFunnel = {
  counts: {
    inquiry: number; tourScheduled: number; proposalSent: number;
    contractSent: number; contractSigned: number; depositReceived: number; booked: number;
  };
  stages: {
    inquiryToTourScheduled: number; tourToProposal: number; proposalToContractSent: number;
    contractSentToSigned: number; contractSignedToDeposit: number; depositToBooking: number;
  };
  /** The one metric permitted to be named "Booking Conversion Rate" — Inquiry -> Booking. */
  bookingConversionRate: number;
};

/**
 * The full canonical conversion funnel for the current venue — one call,
 * seven named stages, never independently recomputed per-stage. Not
 * cached at the module level: server-side module state in this
 * environment is shared across concurrent requests from different
 * venues, so a naive cache here would risk leaking one venue's numbers
 * into another's response. A caller that needs multiple stages in one
 * request should call this once and read the fields it needs, rather
 * than relying on caching inside this function.
 *
 * Work Package R1 — optional date window (each stage filtered by the
 * originating lead's created_at; see migration 20261257000000's own
 * comment for why that's the one consistent semantic across all seven
 * stages). Omitted window = the original all-time behavior, unchanged.
 */
export async function getConversionFunnel(window?: DateWindow): Promise<ConversionFunnel | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("canonical_conversion_funnel", {
    p_from: window?.from ?? null,
    p_to: window?.to ?? null,
  });
  if (error || !data) return null;
  return data as ConversionFunnel;
}

/** The one metric named "Booking Conversion Rate" — Inquiry -> Booking. */
export async function getBookingConversionRate(): Promise<number | null> {
  const funnel = await getConversionFunnel();
  return funnel?.bookingConversionRate ?? null;
}

export async function getInquiryToTourScheduledRate(): Promise<number | null> {
  return (await getConversionFunnel())?.stages.inquiryToTourScheduled ?? null;
}
export async function getTourToProposalRate(): Promise<number | null> {
  return (await getConversionFunnel())?.stages.tourToProposal ?? null;
}
export async function getProposalToContractSentRate(): Promise<number | null> {
  return (await getConversionFunnel())?.stages.proposalToContractSent ?? null;
}
export async function getContractSentToSignedRate(): Promise<number | null> {
  return (await getConversionFunnel())?.stages.contractSentToSigned ?? null;
}
export async function getContractSignedToDepositRate(): Promise<number | null> {
  return (await getConversionFunnel())?.stages.contractSignedToDeposit ?? null;
}
export async function getDepositToBookingRate(): Promise<number | null> {
  return (await getConversionFunnel())?.stages.depositToBooking ?? null;
}
