"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/integrations/supabase/client";
import { PASSWORD_RESET_PATH } from "@/lib/auth/password-recovery";

/**
 * Completes Supabase Auth email redirects for password recovery.
 *
 * Sandbox recovery links currently deliver tokens in the URL hash (implicit
 * flow). Hash fragments never reach a Route Handler, so session establishment
 * must run in the browser. Also supports PKCE `code` and `token_hash` query
 * params when present.
 */
export function AuthConfirmClient() {
  const [message, setMessage] = React.useState("Confirming your reset link…");

  React.useEffect(() => {
    let cancelled = false;

    async function complete() {
      const supabase = createClient("venue");
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = (url.searchParams.get("type") || hashParams.get("type")) as EmailOtpType | null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !error) {
          window.location.replace(PASSWORD_RESET_PATH);
          return;
        }
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        if (!cancelled && !error) {
          window.location.replace(PASSWORD_RESET_PATH);
          return;
        }
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!cancelled && !error) {
          window.location.replace(PASSWORD_RESET_PATH);
          return;
        }
      }

      // createBrowserClient may auto-detect the hash; wait briefly for that.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled && session) {
        window.location.replace(PASSWORD_RESET_PATH);
        return;
      }

      if (!cancelled) {
        setMessage("That reset link is invalid or has expired.");
        window.location.replace("/forgot-password?error=invalid_link");
      }
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-[var(--forest-sage)]" aria-hidden />
      <p role="status">{message}</p>
    </div>
  );
}
