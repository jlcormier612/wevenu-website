/**
 * Dashboard Component System — canonical Progress (Phase 1, Step 4).
 *
 * Implements docs/dashboard-component-system-architecture.md §2.6.
 * `ProgressRing` consolidates the SVG ring math independently
 * hand-written 4 times (portal/budget-section.tsx, portal/guest-
 * section.tsx, analytics/couple-engagement-card.tsx's `Ring`, and
 * portal-shell.tsx's `ReadinessRing` — the last one deferred, see this
 * phase's own validation report) — same radius/circumference/dash-offset
 * calculation every time, differing only in size/stroke/color, which
 * remain fully caller-controlled props here (couple-portal colors are
 * venue-branded and must never be forced through the app's own severity
 * palette; analytics uses the app palette already, also just a prop).
 * No visual change for any existing caller — every default below matches
 * whichever call site is migrated first; callers overriding size/stroke/
 * color keep their exact existing values.
 *
 * `ProgressSteps` is the checklist render variant sharing the same
 * `percent`-complete concept (§2.6's "one input model, two variants") —
 * not migrated onto existing checklist widgets in this pass (see the
 * validation report's Step 6 accounting); provided so a consumer moving
 * forward has one place to reach for either variant.
 */
import type { ReactNode } from "react";

export function ProgressRing({
  pct,
  size = 96,
  stroke = 10,
  color = "var(--venue-accent)",
  trackColor = "#EAE6E1",
  overColor,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  /** If set, used instead of `color` whenever pct > 100 (matches budget-section.tsx's original over-budget treatment). */
  overColor?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const displayColor = overColor && pct > 100 ? overColor : color;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={displayColor}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
      />
    </svg>
  );
}

export type ProgressStep = { id: string; label: string; done: boolean; href?: string };

export function ProgressSteps({ steps, renderStep }: { steps: ProgressStep[]; renderStep?: (step: ProgressStep) => ReactNode }) {
  return (
    <ul className="space-y-1.5">
      {steps.map((step) => (
        <li key={step.id}>{renderStep ? renderStep(step) : step.label}</li>
      ))}
    </ul>
  );
}
