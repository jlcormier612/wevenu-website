"use client";

import * as React from "react";

import { VendorAcceptSignupForm } from "@/components/vendor-app/vendor-accept-signup-form";

type Mode = "choose" | "create";

export function VendorAcceptUnauthPanel({
  token,
  inviteEmail,
}: {
  token: string;
  inviteEmail: string | null;
}) {
  const [mode, setMode] = React.useState<Mode>("choose");
  const signInHref = `/vendor/login?next=${encodeURIComponent(`/vendor/accept?token=${token}`)}`;

  if (mode === "create") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Create your account</p>
          <p className="text-sm text-muted-foreground">
            Set a password to claim this profile. You&apos;ll use this email to sign in next time.
          </p>
        </div>
        <VendorAcceptSignupForm
          token={token}
          email={inviteEmail ?? ""}
          emailLocked={Boolean(inviteEmail)}
        />
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Sign in with an existing Hello to Cheers account, or create one to claim this profile.
      </p>
      <a
        href={signInHref}
        className="block w-full text-center rounded-lg bg-foreground text-background font-semibold py-3 text-sm hover:opacity-90 transition-opacity"
      >
        Sign in
      </a>
      <button
        type="button"
        onClick={() => setMode("create")}
        className="block w-full text-center rounded-lg border border-border bg-background font-semibold py-3 text-sm text-foreground hover:bg-muted/50 transition-colors"
      >
        Create account
      </button>
    </div>
  );
}
