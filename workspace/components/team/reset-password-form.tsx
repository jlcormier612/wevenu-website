"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { updatePasswordAfterWorkspaceRecoveryAction } from "@/app/(app)/team/auth-actions";
import {
  activatePasswordInputType,
  activatePasswordToggleLabel,
} from "@/lib/program4/activate-account-form";
import { createWorkspaceBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(
    updatePasswordAfterWorkspaceRecoveryAction,
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("error") === "invalid") {
          if (!cancelled) setLinkError(true);
          return;
        }

        const supabase = createWorkspaceBrowserClient();
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = (url.searchParams.get("type") ||
          hashParams.get("type")) as EmailOtpType | null;

        // Preferred path: /login/reset/complete already verified server-side
        // and set the Workspace Auth cookie. Fallbacks keep older links working
        // once NEXT_PUBLIC_SUPABASE_* is baked into the image.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled && !error) {
            setReady(true);
            return;
          }
        }

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          });
          if (!cancelled && !error) {
            setReady(true);
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
            setReady(true);
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session) {
          setReady(true);
          return;
        }

        if (!cancelled) setLinkError(true);
      } catch {
        if (!cancelled) setLinkError(true);
      }
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state?.ok) {
      window.location.assign("/login");
    }
  }, [state?.ok]);

  if (linkError) {
    return (
      <div className="mt-8 space-y-4">
        <p role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          This reset link is invalid or has expired.
        </p>
        <p className="text-center text-sm ws-muted">
          <Link
            href="/login/forgot"
            className="text-[var(--htc-primary)] underline-offset-4 hover:underline"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 py-6 text-sm ws-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <p role="status">Confirming your reset link…</p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4">
      {state?.error ? (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="workspace-reset-password" className="block">
          <span className="ws-eyebrow">New password</span>
        </label>
        <div className="relative mt-2">
          <input
            id="workspace-reset-password"
            name="password"
            type={activatePasswordInputType(showPassword)}
            required
            minLength={8}
            autoComplete="new-password"
            className="ws-control w-full px-3 py-2.5 pr-10 text-sm outline-none focus:border-[var(--htc-primary)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={activatePasswordToggleLabel(showPassword, "password")}
            aria-controls="workspace-reset-password"
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <label className="block">
        <span className="ws-eyebrow">Confirm password</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="ws-control mt-2 w-full px-3 py-2.5 text-sm outline-none focus:border-[var(--htc-primary)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending || Boolean(state?.ok)}
        className="ws-btn-primary w-full disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
