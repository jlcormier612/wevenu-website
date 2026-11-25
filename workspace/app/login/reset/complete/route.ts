import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createWorkspaceAuthClient } from "@/lib/supabase/server";

/**
 * Server-side recovery exchange.
 *
 * Browser bundles only see NEXT_PUBLIC_* values baked at image build time.
 * Production workspace historically omitted those build-args, so client
 * verifyOtp always failed. This route uses runtime ECS env (SUPABASE_URL /
 * SUPABASE_ANON_KEY) and sets the Workspace Auth cookie jar before redirecting
 * to the password form.
 */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const tokenHash = (incoming.searchParams.get("token_hash") || "").trim();
  const type = (incoming.searchParams.get("type") || "recovery").trim() as EmailOtpType;
  const resetUrl = new URL("/login/reset", incoming.origin);

  if (!tokenHash || !type) {
    resetUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(resetUrl);
  }

  try {
    const supabase = await createWorkspaceAuthClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      resetUrl.searchParams.set("error", "invalid");
      return NextResponse.redirect(resetUrl);
    }
  } catch {
    resetUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(resetUrl);
  }

  return NextResponse.redirect(resetUrl);
}
