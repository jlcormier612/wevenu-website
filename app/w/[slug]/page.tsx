import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WeddingWebsite } from "@/components/wedding-website/wedding-website";
import { createClient } from "@/integrations/supabase/server";
import type { PublicWebsite } from "@/lib/wedding-website/types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;  // optional password query param
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_wedding_website", { p_slug: slug, p_password: null });
  const site = data as PublicWebsite | null;
  if (!site || site.error === "not_found") return { title: "Wedding" };
  if (site.requires_password) return { title: "Private Wedding Website" };
  const coupleName = [site.couple?.firstName, site.couple?.partnerFirstName].filter(Boolean).join(" & ");
  return {
    title: site.content?.home?.title ?? `${coupleName}'s Wedding`,
    description: site.content?.home?.welcomeMessage ?? `Join us as we celebrate ${coupleName}'s wedding.`,
  };
}

export default async function WeddingWebsitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { p: password } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_wedding_website", { p_slug: slug, p_password: password ?? null });
  const site = data as PublicWebsite | null;

  if (!site || site.error === "not_found") notFound();

  return <WeddingWebsite site={site} slug={slug} />;
}
