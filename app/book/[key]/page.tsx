import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InquiryForm } from "@/components/form/inquiry-form";
import { getPublicInquiryFormConfig } from "@/lib/inquiry-form/service";
import { createClient } from "@/integrations/supabase/server";
import { resolveExistingLeadTourContext } from "@/lib/tours/existing-lead-tour-context";

type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ o?: string; qr?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_venue_by_tour_key", { p_key: key });
  const venue = data as Record<string, unknown> | null;
  if (!venue || venue.error) return { title: { absolute: "Schedule a Tour" } };
  return {
    title: { absolute: `Schedule a Tour — ${venue.name}` },
    description: `Book a venue tour at ${venue.name}`,
  };
}

export default async function TourBookingPage({ params, searchParams }: Props) {
  const { key } = await params;
  const { o: tourOriginToken } = await searchParams;
  const supabase = await createClient();
  const { data: venueRow } = await supabase
    .from("venues")
    .select("embed_key")
    .eq("tour_embed_key", key)
    .eq("tour_scheduling_enabled", true)
    .maybeSingle<{ embed_key: string }>();

  if (!venueRow?.embed_key) notFound();

  const config = await getPublicInquiryFormConfig(venueRow.embed_key);
  if (!config) notFound();

  if (!config.tourSchedulingEnabled) {
    redirect(`/form/${venueRow.embed_key}`);
  }

  const leadCtxResult = await resolveExistingLeadTourContext({
    tourEmbedKey: key,
    originToken: tourOriginToken,
  });
  // Stale/invalid origin tokens: still show the generic scheduler (no lead PII).
  // Booking with that token is rejected server-side at submit.
  const existingLeadTour =
    leadCtxResult?.ok === true ? leadCtxResult.context : null;

  return (
    <InquiryForm
      embedKey={venueRow.embed_key}
      config={config}
      initialMode="schedule_tour"
      tourOriginToken={tourOriginToken ?? null}
      existingLeadTour={existingLeadTour}
    />
  );
}
