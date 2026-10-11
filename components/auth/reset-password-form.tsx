"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import { type AuthFormState, updatePasswordAfterRecovery } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import type { PasswordRecoveryAudience } from "@/lib/auth/password-recovery";

const INITIAL_STATE: AuthFormState = {};

function SubmitButton({ redirecting }: { redirecting: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || redirecting;
  return (
    <Button type="submit" className="w-full" disabled={busy}>
      {busy ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving…
        </>
      ) : (
        "Update password"
      )}
    </Button>
  );
}

export function ResetPasswordForm({
  audience = "venue",
}: {
  audience?: PasswordRecoveryAudience;
}) {
  const [state, formAction] = React.useActionState(updatePasswordAfterRecovery, INITIAL_STATE);

  React.useEffect(() => {
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [state.redirectTo]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="audience" value={audience} />
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-foreground"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton redirecting={Boolean(state.redirectTo)} />

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={`/forgot-password?audience=${encodeURIComponent(audience)}`}
          className="font-medium text-[var(--forest-sage)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--heritage-sage)]/40"
        >
          Request a new reset link
        </Link>
      </p>
    </form>
  );
}
