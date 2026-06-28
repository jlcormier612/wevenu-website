/**
 * Public inquiry form — /form/{embedKey}
 *
 * No auth, no sidebar. Venue-branded using the embed_key to look up
 * branding data via the get_venue_by_embed_key() SECURITY DEFINER function.
 *
 * This page can be:
 *   1. Embedded in an iFrame on the venue's website
 *   2. Shared as a direct link (QR code, social media, email signature)
 *   3. Rendered by future third-party integrations
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InquiryForm } from "@/components/form/inquiry-form";
import { createClient } from "@/integrations/supabase/server";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_venue_by_embed_key", { p_key: key });
  const venue = data?.[0];
  return {
    title: venue ? `Inquire — ${venue.name}` : "Venue Inquiry",
    description: venue ? `Submit an inquiry to ${venue.name}` : "Submit an inquiry",
  };
}

export default async function PublicFormPage({ params }: Props) {
  const { key } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_venue_by_embed_key", { p_key: key });
  const venue = data?.[0];
  if (!venue) notFound();

  // Check if this venue has tour scheduling enabled — look up by venue_id from embed key
  const { data: tourData } = await supabase
    .from("venues")
    .select("tour_embed_key, tour_scheduling_enabled")
    .eq("id", venue.id)
    .maybeSingle<{ tour_embed_key: string | null; tour_scheduling_enabled: boolean }>();

  const tourKey = tourData?.tour_scheduling_enabled ? tourData.tour_embed_key : null;

  return (
    <InquiryForm
      embedKey={key}
      venue={{
        name: venue.name,
        logoUrl: venue.logo_url ?? null,
        primaryColor: venue.primary_color ?? "#5D6F5D",
        secondaryColor: venue.secondary_color ?? "#4F5F4F",
        email: venue.email ?? null,
      }}
      tourKey={tourKey}
    />
  );
}
