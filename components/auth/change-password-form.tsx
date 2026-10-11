"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { type AuthFormState, changePasswordWhileSignedIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const INITIAL_STATE: AuthFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving…
        </>
      ) : (
        "Change password"
      )}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = React.useActionState(changePasswordWhileSignedIn, INITIAL_STATE);

  return (
    <form action={formAction} className="max-w-md space-y-4">
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

      {state.success ? (
        <p
          role="status"
          className="rounded-md border border-[color-mix(in_srgb,var(--heritage-sage)_35%,transparent)] bg-[color-mix(in_srgb,var(--soft-sage)_35%,transparent)] px-3 py-2 text-sm text-foreground"
        >
          {state.success}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
