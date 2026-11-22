"use client";

import { useEffect, useState } from "react";

import { LuvDraftPanel } from "@/components/luv/luv-draft-panel";
import { LuvMark } from "@/components/luv/luv-mark";
import { formatLuvGreeting } from "@/lib/luv/time-of-day";
import type { LuvBriefing, LuvDraft } from "@/lib/luv/types";

export function LuvBriefingCard({
  briefing,
  drafts,
  compact = false,
  showGreeting = true,
}: {
  briefing: LuvBriefing;
  drafts: LuvDraft[];
  compact?: boolean;
  /** When false, skip the time-of-day greeting (e.g. page header already shows it). */
  showGreeting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState(briefing.greeting);
  const canDraft = drafts.length > 0 || briefing.followUpInsights.length > 0;

  useEffect(() => {
    setGreeting(briefing.greeting);
  }, [briefing.greeting, briefing.generatedAt]);

  useEffect(() => {
    if (!showGreeting) return;

    const refresh = () => {
      setGreeting(formatLuvGreeting(briefing.firstName, new Date()));
    };

    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [briefing.firstName, briefing.generatedAt, showGreeting]);

  return (
    <>
      <section
        className={
          compact
            ? "ws-panel border-[color-mix(in_srgb,var(--dusty-rose)_28%,var(--taupe-medium))] bg-[linear-gradient(155deg,color-mix(in_srgb,var(--dusty-rose)_10%,var(--natural-cream)),var(--true-white)_55%)] p-5"
            : "ws-panel border-[color-mix(in_srgb,var(--dusty-rose)_28%,var(--taupe-medium))] bg-[linear-gradient(155deg,color-mix(in_srgb,var(--dusty-rose)_12%,var(--natural-cream)),var(--true-white)_50%,color-mix(in_srgb,var(--soft-sage)_12%,var(--true-white)))] p-7 md:p-8"
        }
      >
        <div className="flex items-center gap-2">
          <LuvMark size={compact ? 13 : 15} />
          <p className="ws-eyebrow">Luv · Daily briefing</p>
        </div>

        {showGreeting ? (
          <p
            className={
              compact
                ? "mt-3 font-heading text-2xl tracking-tight"
                : "mt-4 font-heading text-3xl tracking-tight md:text-[2.15rem]"
            }
          >
            {greeting}
          </p>
        ) : null}

        <ul
          className={`mt-5 space-y-2.5 ${compact ? "text-sm" : "text-[1.02rem]"} leading-relaxed`}
        >
          {briefing.bullets.map((b) => (
            <li key={b.id} className="flex gap-2.5">
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dusty-rose)]"
                aria-hidden
              />
              <span>{b.text}</span>
            </li>
          ))}
        </ul>

        <p className={`mt-5 ${compact ? "text-sm" : ""} ws-muted`}>
          {briefing.closing}
        </p>

        {canDraft ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="ws-btn-primary"
            >
              Draft today&apos;s follow-ups
            </button>
          </div>
        ) : null}
      </section>

      <LuvDraftPanel
        open={open}
        onClose={() => setOpen(false)}
        drafts={drafts}
        title="Today's follow-ups"
        subtitle="Suggested drafts from your daily briefing — edit before anything sends."
      />
    </>
  );
}
