"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Action = "approve" | "reject" | "needs_follow_up";

type Variant = "panel" | "inline" | "compact";

export function WelcomeBackVerifyControl({
  relationshipId,
  venueName,
  variant = "panel",
}: {
  relationshipId: string;
  venueName?: string;
  variant?: Variant;
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
          ? "Confirmed returning"
          : action === "reject"
            ? "Marked not returning"
            : "Marked needs follow up";
      setDone(label);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  const primaryBtn =
    variant === "compact"
      ? "rounded-sm bg-[var(--heritage-sage)] px-2 py-1 text-[0.7rem] font-medium text-[var(--true-white)] disabled:opacity-60"
      : "rounded-sm bg-[var(--heritage-sage)] px-4 py-2 text-sm font-medium text-[var(--true-white)] disabled:opacity-60";
  const secondaryBtn =
    variant === "compact"
      ? "rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-2 py-1 text-[0.7rem] font-medium text-[var(--forest-sage)] disabled:opacity-60"
      : "rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-4 py-2 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-60";
  const followUpBtn =
    "rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--warm-gray)] px-4 py-2 text-sm font-medium text-[var(--forest-sage)] disabled:opacity-60";

  const actions = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => void onAction("approve")}
        className={primaryBtn}
      >
        Confirm returning
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => void onAction("reject")}
        className={secondaryBtn}
      >
        Not returning
      </button>
      {variant === "panel" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void onAction("needs_follow_up")}
          className={followUpBtn}
        >
          Needs Follow Up
        </button>
      ) : null}
    </div>
  );

  const feedback = (
    <>
      {pending ? <p className="mt-2 text-xs ws-muted">Saving…</p> : null}
      {done ? (
        <p
          className={`mt-2 text-[var(--heritage-sage)] ${
            variant === "compact" ? "text-[0.7rem]" : "text-sm"
          }`}
        >
          {done}
        </p>
      ) : null}
      {error ? (
        <p
          className={`mt-2 text-[var(--dusty-rose)] ${
            variant === "compact" ? "text-[0.7rem]" : "text-sm"
          }`}
        >
          {error}
        </p>
      ) : null}
    </>
  );

  if (variant === "compact") {
    return (
      <div className="mt-2">
        {actions}
        {feedback}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div id="welcome-back-verify">
        <p className="text-[1.05rem] leading-snug">Pending</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void onAction("approve")}
            className={primaryBtn}
          >
            Confirm returning
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onAction("reject")}
            className={secondaryBtn}
          >
            Not returning
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onAction("needs_follow_up")}
            className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--warm-gray)] px-3 py-1.5 text-xs font-medium text-[var(--forest-sage)] disabled:opacity-60"
          >
            Needs Follow Up
          </button>
        </div>
        {feedback}
      </div>
    );
  }

  return (
    <div id="welcome-back-verify" className="ws-panel border-[var(--soft-sage)]/50 p-5">
      <p className="ws-eyebrow">Welcome Back Request</p>
      <h2 className="mt-1 font-heading text-xl">Verify eligibility</h2>
      <p className="mt-2 text-sm ws-muted">
        {venueName ?? "This venue"} self-identified for Welcome Back. Confirming
        returning applies Founding Member pricing on this Relationship — no
        separate queue.
      </p>

      <div className="mt-4">{actions}</div>
      {feedback}
    </div>
  );
}
