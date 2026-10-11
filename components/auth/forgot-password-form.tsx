"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import { type AuthFormState, requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loginPathForAudience,
  type PasswordRecoveryAudience,
} from "@/lib/auth/password-recovery";

const INITIAL_STATE: AuthFormState = {};

function SubmitButton({ done }: { done: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || done}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending…
        </>
      ) : done ? (
        "Email requested"
      ) : (
        "Send reset link"
      )}
    </Button>
  );
}

export function ForgotPasswordForm({
  defaultEmail,
  audience = "venue",
}: {
  defaultEmail?: string;
  audience?: PasswordRecoveryAudience;
}) {
  const [state, formAction] = React.useActionState(requestPasswordReset, INITIAL_STATE);
  const done = Boolean(state.success);
  const signInHref = loginPathForAudience(audience);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="audience" value={audience} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@venue.com"
          defaultValue={defaultEmail}
          required
          disabled={done}
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

      {state.success ? (
        <p
          role="status"
          className="rounded-md border border-[color-mix(in_srgb,var(--heritage-sage)_35%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_35%,transparent)] px-3 py-2 text-sm text-foreground"
        >
          {state.success}
        </p>
      ) : null}

      <SubmitButton done={done} />

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={signInHref}
          className="font-medium text-[var(--forest-sage)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--heritage-sage)]/40"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
