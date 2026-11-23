import { NextResponse } from "next/server";

import { workspaceAppBaseUrl } from "@shared/support-access";
import { createClient } from "@/integrations/supabase/server";

export const dynamic = "force-dynamic";

/** End HTC support context and return to CRM (or /dashboard). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();
  await supabase.rpc("htc_end_support_context");

  const returnTo =
    url.searchParams.get("returnTo")?.trim() ||
    `${workspaceAppBaseUrl()}/business`;

  const res = NextResponse.redirect(returnTo);
  res.cookies.set("htc_support_banner", "", { path: "/", maxAge: 0 });
  res.cookies.set("htc_support_mode", "", { path: "/", maxAge: 0 });
  res.cookies.set("htc_support_portal", "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST(request: Request) {
  return GET(request);
}
