"use client";

import { useMemo, useState } from "react";

import { LuvDraftPanel, LuvInsightActions } from "@/components/luv/luv-draft-panel";
import { LuvMark } from "@/components/luv/luv-mark";
import type { LuvDraft, LuvInsight, LuvSeverity } from "@/lib/luv/types";

const SEVERITY_LABEL: Record<LuvSeverity, string> = {
  info: "Noted",
  suggested: "Suggested",
  attention: "Needs attention",
  urgent: "Urgent",
};

function severityTone(severity: LuvSeverity): string {
  switch (severity) {
    case "urgent":
      return "text-[var(--forest-sage)]";
    case "attention":
      return "text-[var(--heritage-sage)]";
    case "info":
      return "ws-muted";
    default:
      return "text-[var(--heritage-sage)]";
  }
}

export function LuvRelationshipAdvisor({
  venueName,
  insights,
  drafts,
  actorFirstName,
  showWelcomeBackVerify,
}: {
  venueName: string;
  insights: LuvInsight[];
  drafts: LuvDraft[];
  actorFirstName?: string;
  /** Whether Welcome Back verify control is on this page. */
  showWelcomeBackVerify?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focusDraftIds, setFocusDraftIds] = useState<string[] | null>(null);

  const visibleDrafts = useMemo(() => {
    if (!focusDraftIds) return drafts;
    const focused = drafts.filter((d) => focusDraftIds.includes(d.id));
    return focused.length ? focused : drafts;
  }, [drafts, focusDraftIds]);

  function openDraftsFor(insight: LuvInsight) {
    const match = drafts.filter(
      (d) => d.insightId === insight.id || d.kind === insight.draftKind,
    );
    setFocusDraftIds(match.map((d) => d.id));
    setOpen(true);
  }

  return (
    <>
      <section className="ws-panel border-[color-mix(in_srgb,var(--dusty-rose)_25%,var(--taupe-medium))] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--dusty-rose)_9%,var(--true-white)),var(--true-white))] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LuvMark size={14} />
            <h2 className="font-heading text-xl">Luv noticed</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setFocusDraftIds(null);
              setOpen(true);
            }}
            className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Open drafts
          </button>
        </div>

        <p className="mb-5 text-sm ws-muted">
          {actorFirstName
            ? `${actorFirstName} — proactive suggestions for ${venueName}. Suggestions only; nothing sends until you click.`
            : `Proactive suggestions for ${venueName} — suggestions only; nothing sends until you click.`}
        </p>

        {insights.length === 0 ? (
          <p className="text-sm ws-muted">All quiet here. Nothing needs you right now.</p>
        ) : (
          <ul className="space-y-4">
            {insights.map((insight) => (
              <li
                key={insight.id}
                className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_30%,transparent)] pb-4 last:border-0 last:pb-0"
              >
                <p className={`text-xs tracking-wide ${severityTone(insight.severity)}`}>
                  {SEVERITY_LABEL[insight.severity]}
                </p>
                <p className="mt-1.5 font-medium leading-snug">{insight.message}</p>
                {insight.detail ? (
                  <p className="mt-1 text-sm ws-muted">{insight.detail}</p>
                ) : null}
                <LuvInsightActions
                  insight={insight}
                  showWelcomeBackVerify={showWelcomeBackVerify}
                  onDraft={() => openDraftsFor(insight)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <LuvDraftPanel
        open={open}
        onClose={() => setOpen(false)}
        drafts={visibleDrafts}
        title={`Drafts · ${venueName}`}
        subtitle="Edit, copy, or send via shared email — nothing goes out until you choose Send."
      />
    </>
  );
}
