import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { WeddingWebsite } from "@/components/wedding-website/wedding-website";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isLuvMasterEnabledForVenueId } from "@/lib/luv/settings";
import {
  verifyWeddingWebsiteUnlockToken,
  WEDDING_WEBSITE_UNLOCK_COOKIE,
} from "@/lib/wedding-website/guest-unlock";
import { allowWeddingWebsitePasswordAttempt } from "@/lib/wedding-website/password-rate-limit";
import type { PublicWebsite } from "@/lib/wedding-website/types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string; preview?: string }>; // optional password / preview-token query params
};

function gatedMetadata(site: PublicWebsite | null): Metadata {
  const searchVisible = site?.searchVisible !== false;
  if (!site || site.error === "not_found") return { title: { absolute: "Wedding" } };
  if (site.requires_password) {
    return {
      title: { absolute: "Private Wedding Website" },
      robots: searchVisible ? { index: true, follow: true } : { index: false, follow: false },
    };
  }
  const coupleName = [site.couple?.firstName, site.couple?.partnerFirstName].filter(Boolean).join(" & ");
  return {
    title: { absolute: site.content?.home?.title ?? `${coupleName}'s Wedding` },
    description: site.content?.home?.welcomeMessage ?? `Join us as we celebrate ${coupleName}'s wedding.`,
    robots: searchVisible ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  // Never pass password or unlock into metadata — password-gated sites stay private in previews.
  const { data } = await supabase.rpc("get_wedding_website", {
    p_slug: slug,
    p_password: null,
    p_session_id: null,
    p_page: "home",
    p_preview_token: null,
  });
  return gatedMetadata(data as PublicWebsite | null);
}

async function loadPublicSite(input: {
  slug: string;
  password: string | null;
  preview: string | null;
}): Promise<PublicWebsite | null> {
  const supabase = await createClient();
  const { data: gated } = await supabase.rpc("get_wedding_website", {
    p_slug: input.slug,
    p_password: null,
    p_session_id: null,
    p_page: "home",
    p_preview_token: input.preview,
  });
  const gatedSite = gated as PublicWebsite | null;
  if (!gatedSite || gatedSite.error === "not_found") return gatedSite;
  if (!gatedSite.requires_password) return gatedSite;

  const siteId = gatedSite.siteId;
  const passwordVersion =
    typeof gatedSite.passwordVersion === "number" ? gatedSite.passwordVersion : 0;
  if (siteId) {
    const jar = await cookies();
    const unlock = jar.get(WEDDING_WEBSITE_UNLOCK_COOKIE)?.value;
    if (verifyWeddingWebsiteUnlockToken(unlock, { siteId, passwordVersion })) {
      const admin = createAdminClient();
      const { data: unlocked } = await admin.rpc("get_wedding_website", {
        p_slug: input.slug,
        p_password: null,
        p_session_id: null,
        p_page: "home",
        p_preview_token: input.preview,
        p_service_unlock: true,
      });
      return unlocked as PublicWebsite | null;
    }
  }

  // Legacy / shareable ?p= still verifies against the live hash (revokes on change).
  if (!input.password) return gatedSite;

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown";
  if (!allowWeddingWebsitePasswordAttempt(`${input.slug}:${ip}`)) {
    return {
      requires_password: true,
      searchVisible: gatedSite.searchVisible,
      slug: input.slug,
      error: "rate_limited",
    };
  }

  const { data: authed } = await supabase.rpc("get_wedding_website", {
    p_slug: input.slug,
    p_password: input.password,
    p_session_id: null,
    p_page: "home",
    p_preview_token: input.preview,
  });
  return authed as PublicWebsite | null;
}

export default async function WeddingWebsitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { p: password, preview } = await searchParams;
  const site = await loadPublicSite({
    slug,
    password: password ?? null,
    preview: preview ?? null,
  });

  if (!site || site.error === "not_found") notFound();
  if (site.error === "rate_limited") {
    return (
      <main className="min-h-[50vh] flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Too many password attempts. Please try again later.</p>
      </main>
    );
  }

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
