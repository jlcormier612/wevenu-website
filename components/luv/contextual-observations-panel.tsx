/**
 * Compact L3 "Luv noticed" rows for the record currently being viewed.
 * Dashboard L1 is gated separately — these stay on lead/event/contract context.
 */
"use client";

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

import { LuvHeart } from "@/components/dashboard/luv-widget";
import { observationActionCta } from "@/lib/luv/observation-quality";
import { isSameRecordDraftRecommendation } from "@/lib/luv/same-record-draft-cta";
import type { LuvObservation } from "@/lib/luv/types";

export function ContextualLuvObservationsPanel({
  observations,
  emptyHint,
  currentPath,
  onSameRecordDraft,
  sameRecordDraftBusy = false,
  sameRecordDraftEligible = true,
  sameRecordDraftIneligibleReason,
}: {
  observations: LuvObservation[];
  emptyHint?: string;
  /** When set, a navigate CTA that points at this same record path is omitted. */
  currentPath?: string;
  /**
   * When the recommendation is a same-record draft (`?luv=`), invoke this
   * instead of a soft Link — Links to the open lead do not open drafting.
   */
  onSameRecordDraft?: () => void;
  sameRecordDraftBusy?: boolean;
  sameRecordDraftEligible?: boolean;
  sameRecordDraftIneligibleReason?: string;
}) {
  if (observations.length === 0) {
    if (!emptyHint) return null;
    return (
      <p className="text-xs text-muted-foreground">{emptyHint}</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <LuvHeart size={14} />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Luv noticed
        </p>
      </div>
      <ul className="space-y-3">
        {observations.map((obs) => {
          const cta = observationActionCta(obs, currentPath);
          const sameRecordDraft = isSameRecordDraftRecommendation(obs, currentPath);
          const draftLabel = obs.recommendation?.label ?? "Ask Luv to draft a follow-up";
          return (
            <li
              key={obs.id}
              className="rounded-sm border border-[#D8A7AA]/25 bg-[#D8A7AA]/5 px-3 py-3 space-y-1.5"
            >
              <p className="text-sm font-medium text-heading leading-snug">{obs.message}</p>
              {obs.detail ? (
                <p className="text-xs text-muted-foreground leading-relaxed">{obs.detail}</p>
              ) : null}
              {sameRecordDraft && onSameRecordDraft && sameRecordDraftEligible ? (
                  <button
                    type="button"
                    data-testid="luv-noticed-draft-follow-up"
                    onClick={onSameRecordDraft}
                    disabled={sameRecordDraftBusy}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2 disabled:opacity-60 disabled:no-underline"
                  >
                    {sameRecordDraftBusy ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Luv is drafting…
                      </>
                    ) : (
                      <>
                        {draftLabel}
                        <ArrowRight className="h-3 w-3" />
                      </>
                    )}
                  </button>
              ) : sameRecordDraft && !sameRecordDraftEligible && sameRecordDraftIneligibleReason ? (
                  <p className="text-xs text-muted-foreground" data-testid="luv-noticed-draft-ineligible">
                    {sameRecordDraftIneligibleReason}
                  </p>
              ) : cta ? (
                <Link
                  href={cta.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2"
                >
                  {cta.label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
