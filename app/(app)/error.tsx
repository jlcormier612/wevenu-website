"use client";

import { useEffect } from "react";

import {
  consumeSkewReload,
  shouldAutoRecoverFromFatal,
} from "@/lib/deploy/client-skew-recovery";

/**
 * Venue workspace segment error boundary.
 * Deploy-skew / digest-less client fatals hard-reload once instead of trapping
 * the customer in a dead end. Persistent failures stay as in-shell recovery.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!shouldAutoRecoverFromFatal(error)) return;
    const path = `${window.location.pathname}${window.location.search}`;
    if (!consumeSkewReload(path)) return;
    window.location.reload();
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-heading">This page couldn’t load</h1>
      <p className="text-sm text-muted-foreground">
        Reload to try again, or go back. If the app was just updated, a full reload usually recovers.
      </p>
      {process.env.NODE_ENV === "development" && error?.message ? (
        <p className="text-xs text-muted-foreground/80">{error.message}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-heading px-4 py-2 text-sm font-medium text-background"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-heading"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
