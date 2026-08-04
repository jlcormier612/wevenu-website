"use client";

import * as React from "react";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  createVendorAccountAndClaimAction,
  VENDOR_ACCEPT_INITIAL_STATE,
} from "@/app/vendor/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating your account…
        </>
      ) : (
        "Create account & claim"
      )}
    </Button>
  );
}

export function VendorAcceptSignupForm({
  token,
  email,
  emailLocked,
}: {
  token: string;
  email: string;
  emailLocked: boolean;
}) {
  const [state, formAction] = React.useActionState(
    createVendorAccountAndClaimAction,
    VENDOR_ACCEPT_INITIAL_STATE,
  );
  const [showPassword, setShowPassword] = React.useState(false);

  const errorMessage =
    state.error && state.error.trim() && state.error.trim() !== "{}"
      ? state.error
      : state.error
        ? "Something went wrong creating your account. Please try again."
        : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="vendor-accept-email">Email</Label>
        {/* readOnly (not disabled) so the value still submits with the form */}
        <Input
          id="vendor-accept-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          readOnly={emailLocked}
          required
          placeholder="you@business.com"
          className={emailLocked ? "bg-muted/50" : undefined}
        />
        {emailLocked ? (
          <p className="text-[11px] text-muted-foreground">
            This invitation was sent to this address.
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="vendor-accept-password">Password</Label>
        <div className="relative">
          <Input
            id="vendor-accept-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
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
      <div className="space-y-2">
        <Label htmlFor="vendor-accept-confirm">Confirm password</Label>
        <Input
          id="vendor-accept-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-foreground"
        >
          {errorMessage}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
