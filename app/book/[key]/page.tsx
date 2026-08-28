import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InquiryForm } from "@/components/form/inquiry-form";
import { getPublicInquiryFormConfig } from "@/lib/inquiry-form/service";
import { createClient } from "@/integrations/supabase/server";

type Props = { params: Promise<{ key: string }> };

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

export default async function TourBookingPage({ params }: Props) {
  const { key } = await params;
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

  return (
    <InquiryForm
      embedKey={venueRow.embed_key}
      config={config}
      initialMode="schedule_tour"
    />
  );
}
