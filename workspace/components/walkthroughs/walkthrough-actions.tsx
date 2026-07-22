"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusPill } from "@/components/shared/ui";
import type { WalkthroughStatus } from "@/lib/types";
import { WALKTHROUGH_STATUS_LABELS } from "@/lib/utils";

/**
 * Complete / Reschedule / Cancel — persists via PATCH /api/walkthroughs.
 */
export function WalkthroughActions({
  walkthroughId,
  initialStatus,
  venueName,
}: {
  walkthroughId: string;
  initialStatus: WalkthroughStatus;
  venueName: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function act(next: WalkthroughStatus) {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/walkthroughs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walkthroughId, status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update walkthrough");
        return;
      }
      setStatus(next);
      setMessage(
        `Marked ${venueName} as ${WALKTHROUGH_STATUS_LABELS[next]} — timeline updated.`,
      );
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  if (status !== "upcoming") {
    return (
      <div className="space-y-1">
        <StatusPill tone={status === "completed" ? "good" : "muted"}>
          {WALKTHROUGH_STATUS_LABELS[status]}
        </StatusPill>
        {message ? <p className="text-xs ws-muted">{message}</p> : null}
        {error ? <p className="text-xs text-[var(--dusty-rose)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <ActionButton disabled={pending} onClick={() => void act("completed")}>
          Completed
        </ActionButton>
        <ActionButton disabled={pending} onClick={() => void act("rescheduled")}>
          Rescheduled
        </ActionButton>
        <ActionButton disabled={pending} onClick={() => void act("cancelled")}>
          Cancelled
        </ActionButton>
      </div>
      {pending ? <p className="text-xs ws-muted">Saving…</p> : null}
      {message ? <p className="text-xs ws-muted">{message}</p> : null}
      {error ? <p className="text-xs text-[var(--dusty-rose)]">{error}</p> : null}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-sm bg-[var(--warm-gray)] px-2 py-1 text-xs text-[var(--forest-sage)] ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] hover:bg-[var(--header-linen)] disabled:opacity-60"
    >
      {children}
    </button>
  );
}
