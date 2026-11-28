import { NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import {
  mintWeddingWebsiteUnlockToken,
  WEDDING_WEBSITE_UNLOCK_COOKIE,
} from "@/lib/wedding-website/guest-unlock";
import { allowWeddingWebsitePasswordAttempt } from "@/lib/wedding-website/password-rate-limit";
import type { PublicWebsite } from "@/lib/wedding-website/types";

export async function POST(req: Request) {
  let body: { slug?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const slug = body.slug?.trim();
  const password = body.password ?? "";
  if (!slug || !password) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!allowWeddingWebsitePasswordAttempt(`${slug}:${ip}`)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_wedding_website", {
    p_slug: slug,
    p_password: password,
    p_session_id: null,
    p_page: "home",
    p_preview_token: null,
  });
  const site = data as PublicWebsite | null;
  if (!site || site.error === "not_found") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (site.requires_password || !site.siteId) {
    return NextResponse.json({ ok: false, error: "invalid_password" }, { status: 401 });
  }

  const token = mintWeddingWebsiteUnlockToken({
    siteId: site.siteId,
    passwordVersion: typeof site.passwordVersion === "number" ? site.passwordVersion : 0,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WEDDING_WEBSITE_UNLOCK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/w/${slug}`,
    maxAge: 60 * 60 * 12,
  });
  return res;
}
