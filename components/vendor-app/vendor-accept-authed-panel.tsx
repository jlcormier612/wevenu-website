"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { switchAccountForInviteAction } from "@/app/auth/portal-session-actions";
import { ClaimButton } from "@/components/vendor-app/claim-button";
import { Button } from "@/components/ui/button";

/**
 * Claim UI when a browser session already exists on /vendor/accept.
 * Prevents silently attaching a vendor profile to a venue (or other) login
 * without the user understanding they are linking portals on one identity.
 */
export function VendorAcceptAuthedPanel({
  token,
  sessionEmail,
  inviteEmail,
}: {
  token: string;
  sessionEmail: string | null;
  inviteEmail: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const emailsDiffer =
    Boolean(inviteEmail) &&
    Boolean(sessionEmail) &&
    inviteEmail!.trim().toLowerCase() !== sessionEmail!.trim().toLowerCase();

  function handleUseDifferentAccount() {
    startTransition(async () => {
      await switchAccountForInviteAction(
        `/vendor/accept?token=${encodeURIComponent(token)}`,
      );
      router.refresh();
    });
  }

  if (emailsDiffer) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-foreground space-y-2">
          <p className="font-medium">Wrong account for this invitation</p>
          <p className="text-muted-foreground">
            You&apos;re signed in as <strong className="text-foreground">{sessionEmail}</strong>, but
            this invitation was sent to <strong className="text-foreground">{inviteEmail}</strong>.
            Sign out and continue with the invited email so this vendor profile is not linked to the
            wrong Hello to Cheers login.
          </p>
        </div>
        <Button
          type="button"
          className="w-full"
          size="lg"
          disabled={pending}
          onClick={handleUseDifferentAccount}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Switching…
            </>
          ) : (
            "Sign out and use the invited email"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-foreground space-y-2">
        <p>
          Signed in as{" "}
          <strong>{sessionEmail ?? "your Hello to Cheers account"}</strong>.
        </p>
        <p className="text-muted-foreground">
          Claiming links this vendor profile to the same login. If you also use this email for a
          venue workspace, one browser session can only be in one portal at a time — use{" "}
          <span className="text-foreground">Choose a workspace</span> after sign-in, or a separate
          browser profile to keep venue and vendor open together while testing.
        </p>
      </div>
      <ClaimButton token={token} />
      <button
        type="button"
        onClick={handleUseDifferentAccount}
        disabled={pending}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {pending ? "Signing out…" : "Use a different account"}
      </button>
    </div>
  );
}
