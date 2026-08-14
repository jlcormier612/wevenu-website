"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AutoArrivalDot } from "@/components/relationships/auto-arrival-badge";
import { WelcomeBackVerifyControl } from "@/components/relationships/welcome-back-verify-control";
import { StatusPill } from "@/components/shared/ui";
import {
  CS_STAGE_COLUMNS,
  CS_STAGE_LABELS,
  HEALTH_BADGE_LABELS,
  computeAdoptionCheckpoints,
  computeRiskSection,
  countAutoArrivalsForStage,
  deriveCustomerSuccessStage,
  relationshipHasOpenSupport,
  toCustomerHealthBadge,
  type CustomerSuccessStage,
} from "@/lib/sales-cs";
import type { Relationship, Subscription } from "@/lib/types";
import { formatRelativeDay, welcomeBackBadgeLabel } from "@/lib/utils";

function badgeToneClass(
  badge: ReturnType<typeof toCustomerHealthBadge>,
): string {
  switch (badge) {
    case "healthy":
      return "bg-[color-mix(in_srgb,var(--soft-sage)_40%,var(--true-white))] text-[var(--forest-sage)]";
    case "needs_attention":
      return "bg-[color-mix(in_srgb,var(--taupe-medium)_25%,var(--true-white))] text-[var(--forest-sage)]";
    case "at_risk":
      return "bg-[color-mix(in_srgb,var(--dusty-rose)_22%,var(--true-white))] text-[var(--dusty-rose)]";
    case "critical":
      return "bg-[var(--dusty-rose)] text-[var(--true-white)]";
  }
}

function riskToneLabel(tone: "green" | "yellow" | "red"): string {
  if (tone === "green") return "Green";
  if (tone === "yellow") return "Yellow";
  return "Red";
}

export function CustomerSuccessBoard({
  relationships,
  subscriptionsByRel,
  onboardingProgressByRel,
  canVerifyWelcomeBack = false,
}: {
  relationships: Relationship[];
  subscriptionsByRel: Record<string, Subscription | undefined>;
  onboardingProgressByRel: Record<string, number>;
  canVerifyWelcomeBack?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byColumn = CS_STAGE_COLUMNS.map((col) => {
    const items = relationships.filter(
      (r) => deriveCustomerSuccessStage(r) === col.stage,
    );
    return {
      ...col,
      items,
      autoArrivals: countAutoArrivalsForStage(items, col.stage, "cs"),
    };
  });

  async function move(relationshipId: string, customerSuccessStage: CustomerSuccessStage) {
    setError(null);
    setMovingId(relationshipId);
    try {
      const res = await fetch("/api/relationships/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId, customerSuccessStage }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not move relationship");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error moving relationship");
    } finally {
      setMovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-[var(--dusty-rose)]">{error}</p> : null}
      {pending || movingId ? (
        <p className="text-xs ws-muted">Updating lifecycle…</p>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {byColumn.map((col) => (
          <div
            key={col.stage}
            className={`flex w-[17.5rem] shrink-0 flex-col rounded-sm border bg-[color-mix(in_srgb,var(--header-linen)_55%,var(--true-white))] ${
              col.autoArrivals > 0
                ? "border-[color-mix(in_srgb,var(--heritage-sage)_45%,transparent)]"
                : "border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)]"
            }`}
          >
            <div className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] px-3 py-3">
              <p className="ws-eyebrow">{col.short}</p>
              <p className="mt-1 flex items-center font-heading text-lg leading-tight">
                <Link
                  href={`/customer-success?stage=${col.stage}`}
                  className="hover:text-[var(--heritage-sage)]"
                >
                  {col.label}
                </Link>
                <AutoArrivalDot count={col.autoArrivals} />
              </p>
              <p
                className={`mt-1 text-xs ${
                  col.stage === "needs_support" && col.items.length > 0
                    ? "font-medium text-[var(--dusty-rose)]"
                    : "ws-muted"
                }`}
              >
                {col.items.length}
                {col.stage === "needs_support" && col.items.length > 0
                  ? " open"
                  : ""}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2 min-h-[12rem]">
              {col.items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs ws-muted">Empty</p>
              ) : (
                col.items.map((r) => {
                  const stage = deriveCustomerSuccessStage(r);
                  const isNewArrival =
                    r.lastAutoArrival?.board === "cs" &&
                    r.lastAutoArrival.stage === stage;
                  const wbPending =
                    r.welcomeBackRequested &&
                    r.welcomeBackVerified === "pending";
                  const wbBadge = r.welcomeBackRequested
                    ? welcomeBackBadgeLabel(r.welcomeBackVerified)
                    : null;
                  const badge = toCustomerHealthBadge(r.health, r.healthScore, {
                    suspended: r.status === "suspended",
                    accessDisabled: r.accessDisabled,
                  });
                  const onboardingPct = onboardingProgressByRel[r.id] ?? 0;
                  const adoption = computeAdoptionCheckpoints(r, {
                    onboardingProgress: onboardingPct,
                  });
                  const doneCount = adoption.filter((a) => a.done).length;
                  const sub = subscriptionsByRel[r.id];
                  const lastActivity =
                    r.lastCustomerActivityAt || r.lastLoginAt || r.lastContactAt;
                  const daysSince = lastActivity
                    ? Math.floor(
                        (Date.now() - new Date(lastActivity).getTime()) /
                          86_400_000,
                      )
                    : null;
                  const risk = computeRiskSection(r, {
                    onboardingProgress: onboardingPct,
                    daysSinceActivity: daysSince,
                  });

                  return (
                    <article
                      key={r.id}
                      className={`rounded-sm bg-[var(--true-white)] p-3 shadow-[0_1px_0_color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] ${
                        wbPending
                          ? "ring-1 ring-[color-mix(in_srgb,var(--dusty-rose)_40%,transparent)]"
                          : isNewArrival
                            ? "ring-1 ring-[color-mix(in_srgb,var(--heritage-sage)_35%,transparent)]"
                            : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/relationships/${r.id}?from=customer-success${
                            relationshipHasOpenSupport(r) ? "&panel=support" : ""
                          }`}
                          className="font-medium hover:text-[var(--heritage-sage)]"
                        >
                          {r.venue.name}
                        </Link>
                        <span
                          className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide ${badgeToneClass(badge)}`}
                        >
                          {HEALTH_BADGE_LABELS[badge]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs ws-muted">
                        {r.owner.firstName} · {r.planName}
                      </p>

                      <div className="mt-2">
                        <p className="text-[0.65rem] uppercase tracking-wider ws-muted">
                          Adoption {doneCount}/{adoption.length}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {adoption.slice(0, 4).map((a) => (
                            <li key={a.id} className="text-[0.7rem] ws-muted">
                              {a.done ? "✓" : "○"} {a.label}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-2 space-y-0.5 text-[0.7rem] ws-muted">
                        <p>Last login: {r.lastLoginAt ? formatRelativeDay(r.lastLoginAt) : "—"}</p>
                        <p>
                          Last activity:{" "}
                          {lastActivity ? formatRelativeDay(lastActivity) : "—"}
                        </p>
                        <p>
                          Days since activity:{" "}
                          {daysSince != null ? String(daysSince) : "—"}
                        </p>
                        <p>Open support: {r.supportOpenCount || 0}</p>
                      </div>

                      <div className="mt-2 space-y-0.5 text-[0.7rem] ws-muted">
                        <p>Plan: {sub?.planName ?? r.planName}</p>
                        <p>
                          MRR:{" "}
                          {sub
                            ? `$${(sub.mrrCents / 100).toFixed(0)}`
                            : "—"}
                        </p>
                        <p>Status: {sub?.status ?? r.paymentStatus ?? "—"}</p>
                        <p>
                          Customer since:{" "}
                          {r.subscribedAt
                            ? formatRelativeDay(r.subscribedAt)
                            : "—"}
                        </p>
                      </div>

                      <div className="mt-2">
                        <p className="text-[0.65rem] uppercase tracking-wider ws-muted">
                          Risk · {riskToneLabel(risk.tone)}
                        </p>
                        {risk.reasons.length > 0 ? (
                          <ul className="mt-1 space-y-0.5">
                            {risk.reasons.slice(0, 3).map((reason) => (
                              <li key={reason} className="text-[0.7rem] ws-muted">
                                · {reason}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[0.7rem] ws-muted">No risk flags</p>
                        )}
                      </div>

                      {r.foundingMember || wbBadge ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.foundingMember ? (
                            <StatusPill tone="good">Founder</StatusPill>
                          ) : null}
                          {wbBadge ? (
                            <StatusPill
                              tone={
                                r.welcomeBackVerified === "pending"
                                  ? "warn"
                                  : r.welcomeBackVerified === "verified"
                                    ? "good"
                                    : "muted"
                              }
                            >
                              {wbBadge}
                            </StatusPill>
                          ) : null}
                        </div>
                      ) : null}

                      {canVerifyWelcomeBack && wbPending ? (
                        <WelcomeBackVerifyControl
                          relationshipId={r.id}
                          venueName={r.venue.name}
                          variant="compact"
                        />
                      ) : null}

                      <label className="mt-3 block text-[0.65rem] uppercase tracking-wider ws-muted">
                        Move to
                        <select
                          className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--natural-cream)] px-2 py-1.5 text-xs text-[var(--forest-sage)]"
                          value={stage}
                          disabled={movingId === r.id}
                          onChange={(e) => {
                            const next = e.target.value as CustomerSuccessStage;
                            if (next !== stage) void move(r.id, next);
                          }}
                        >
                          {CS_STAGE_COLUMNS.map((c) => (
                            <option key={c.stage} value={c.stage}>
                              {CS_STAGE_LABELS[c.stage]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
