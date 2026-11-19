import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WeddingWebsite } from "@/components/wedding-website/wedding-website";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isLuvMasterEnabledForVenueId } from "@/lib/luv/settings";
import type { PublicWebsite } from "@/lib/wedding-website/types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string; preview?: string }>;  // optional password / preview-token query params
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_wedding_website", { p_slug: slug, p_password: null, p_session_id: null, p_page: "home", p_preview_token: null });
  const site = data as PublicWebsite | null;
  // Venue Brand Experience Phase 1: `absolute` stops the root layout's
  // "%s · Hello to Cheers" template from appending to this customer-facing tab title.
  if (!site || site.error === "not_found") return { title: { absolute: "Wedding" } };
  if (site.requires_password) return { title: { absolute: "Private Wedding Website" } };
  const coupleName = [site.couple?.firstName, site.couple?.partnerFirstName].filter(Boolean).join(" & ");
  return {
    title: { absolute: site.content?.home?.title ?? `${coupleName}'s Wedding` },
    description: site.content?.home?.welcomeMessage ?? `Join us as we celebrate ${coupleName}'s wedding.`,
  };
}

export default async function WeddingWebsitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { p: password, preview } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_wedding_website", {
    p_slug: slug, p_password: password ?? null, p_session_id: null, p_page: "home",
    p_preview_token: preview ?? null,
  });
  const site = data as PublicWebsite | null;

  if (!site || site.error === "not_found") notFound();

  // Venue id from published site row — not client-supplied.
  let luvEnabled = false;
  try {
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("couple_websites")
      .select("venue_id")
      .eq("slug", slug)
      .maybeSingle<{ venue_id: string }>();
    if (!error && row?.venue_id) {
      luvEnabled = await isLuvMasterEnabledForVenueId(row.venue_id);
    }
  } catch {
    luvEnabled = false;
  }

  return <WeddingWebsite site={site} slug={slug} luvEnabled={luvEnabled} />;
}
