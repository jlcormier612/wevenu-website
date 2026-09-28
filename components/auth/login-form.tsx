"use client";

import * as React from "react";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { type AuthFormState, signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL_STATE: AuthFormState = {};

function SubmitButton({ redirecting }: { redirecting: boolean }) {
  const { pending } = useFormStatus();
  // Stay disabled through the handoff: the action has resolved by then, so
  // `pending` is false while the browser is still navigating away.
  const busy = pending || redirecting;
  return (
    <Button type="submit" className="w-full" disabled={busy}>
      {busy ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in…
        </>
      ) : (
        "Sign in"
      )}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = React.useActionState(signIn, INITIAL_STATE);
  const [showPassword, setShowPassword] = React.useState(false);

  // Full-document navigation, not router.push: the workspace layout gates
  // (ownership / intake / graduation / suspension) redirect again, and a
  // client-side navigation into a route that redirects leaves the App Router
  // refetching the destination forever on a blank page. See AuthFormState.
  React.useEffect(() => {
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [state.redirectTo]);

  // Defensive: an error message that isn't a real, readable string (empty,
  // or a stringified empty object from an unexpected upstream response)
  // should never be shown to someone trying to sign in — a clear generic
  // message is more honest than a literal "{}" and less alarming.
  const errorMessage =
    state.error && state.error.trim() && state.error.trim() !== "{}"
      ? state.error
      : state.error
        ? "Something went wrong signing you in. Please try again."
        : null;

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@venue.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-foreground"
        >
          {errorMessage}
        </p>
      ) : null}

      <SubmitButton redirecting={Boolean(state.redirectTo)} />
    </form>
  );
}
