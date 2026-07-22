"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Action = "approve" | "reject" | "needs_follow_up";

export function WelcomeBackVerifyControl({
  relationshipId,
  venueName,
}: {
  relationshipId: string;
  venueName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onAction(action: Action) {
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/relationships/welcome-back", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId, action }),
      });
      const data = (await res.json()) as { error?: string; action?: Action };
      if (!res.ok) {
        setError(data.error || "Could not update Welcome Back");
        return;
      }
      const label =
        action === "approve"
          ? "Approved — Welcome Back verified"
          : action === "reject"
            ? "Rejected"
            : "Marked needs follow up";
      setDone(label);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  return (
    <div id="welcome-back-verify" className="ws-panel border-[var(--soft-sage)]/50 p-5">
      <p className="ws-eyebrow">Welcome Back Request</p>
      <h2 className="mt-1 font-heading text-xl">Verify eligibility</h2>
      <p className="mt-2 text-sm ws-muted">
        {venueName} self-identified for Welcome Back. Approving confirms Founding
        Member pricing on this Relationship — no separate queue.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void onAction("approve")}
          className="rounded-sm bg-[var(--heritage-sage)] px-4 py-2 text-sm font-medium text-[var(--true-white)] disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void onAction("reject")}
          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-4 py-2 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-60"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void onAction("needs_follow_up")}
          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--warm-gray)] px-4 py-2 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-60"
        >
          Needs Follow Up
        </button>
      </div>

      {pending ? <p className="mt-2 text-xs ws-muted">Saving…</p> : null}
      {done ? <p className="mt-2 text-sm text-[var(--heritage-sage)]">{done}</p> : null}
      {error ? <p className="mt-2 text-sm text-[var(--dusty-rose)]">{error}</p> : null}
    </div>
  );
}
