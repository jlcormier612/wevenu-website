import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { safePasswordRecoveryNextPath } from "@/lib/auth/password-recovery";
import { isSupabaseConfigured, publicAppOrigin } from "@/lib/env";

/**
 * Supabase Auth email callback (PKCE code or token_hash OTP).
 * Recovery links land here, then continue to /reset-password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safePasswordRecoveryNextPath(searchParams.get("next"));
  const origin = publicAppOrigin();

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(`${origin}/forgot-password?error=not_configured`);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`);
}
