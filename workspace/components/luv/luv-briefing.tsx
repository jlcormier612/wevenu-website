"use client";

import { useState } from "react";

import { LuvDraftPanel } from "@/components/luv/luv-draft-panel";
import { LuvMark } from "@/components/luv/luv-mark";
import type { LuvBriefing, LuvDraft } from "@/lib/luv/types";

export function LuvBriefingCard({
  briefing,
  drafts,
  compact = false,
}: {
  briefing: LuvBriefing;
  drafts: LuvDraft[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

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

        <p
          className={
            compact
              ? "mt-3 font-heading text-2xl tracking-tight"
              : "mt-4 font-heading text-3xl tracking-tight md:text-[2.15rem]"
          }
        >
          {briefing.greeting}
        </p>

        <ul className={`mt-5 space-y-2.5 ${compact ? "text-sm" : "text-[1.02rem]"} leading-relaxed`}>
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

        <p className={`mt-5 ${compact ? "text-sm" : ""} ws-muted`}>{briefing.closing}</p>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-sm bg-[var(--forest-sage)] px-4 py-2.5 text-sm text-[var(--natural-cream)] hover:opacity-90"
          >
            Draft today&apos;s follow-ups
          </button>
        </div>
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
