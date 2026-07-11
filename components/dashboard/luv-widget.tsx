/**
 * LuvWidget — "What Luv noticed today"
 *
 * Sprint 95: Luv Story Mode added.
 * When a storyObservation is present it renders FIRST as a named narrative
 * headline ("💗 A strong month overall.") with evidence bullets beneath.
 * Individual trend deltas follow in the "What changed" section.
 *
 * Luv Typography System:
 *   Heart size always matches adjacent text size so it feels natural:
 *     text-sm (14px) → Heart size 14
 *     text-xs (12px) → Heart size 12
 *     text-[10px]    → Heart size 10
 */

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle, Circle, Heart } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RecommendationsPanel } from "@/components/dashboard/recommendations-panel";
import type { LuvBriefingItem, LuvObservation } from "@/lib/luv/types";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";

const DUSTY_ROSE = "#D8A7AA";

/** Heart icon sized to match adjacent text. Pass px size matching the font. */
export function LuvHeart({ size = 14 }: { size?: number }) {
  return (
    <Heart
      aria-hidden
      style={{ width: size, height: size, color: DUSTY_ROSE, fill: DUSTY_ROSE }}
      className="shrink-0"
    />
  );
}

const STORY_EMOJI: Record<string, string> = {
  story_building_momentum: "🌟",
  story_strong_month:      "💗",
  story_couples_loving:    "❤️",
  story_needs_attention:   "⚠️",
  story_steady:            "✨",
};

function StoryCard({ obs }: { obs: LuvObservation }) {
  const emoji = STORY_EMOJI[obs.id] ?? "✨";
  return (
    <div
      className="rounded-xl p-4 mb-4 space-y-2.5"
      style={{
        background: `color-mix(in oklch, ${DUSTY_ROSE} 8%, var(--card))`,
        border: `1px solid ${DUSTY_ROSE}30`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5 shrink-0" aria-hidden>{emoji}</span>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-base font-semibold text-heading leading-snug">{obs.message}</p>
          {obs.detail && (
            <p className="text-xs text-muted-foreground leading-relaxed">{obs.detail}</p>
          )}
        </div>
      </div>

      {/* Evidence pills */}
      {obs.storyEvidence && obs.storyEvidence.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {obs.storyEvidence.map((e, i) => (
            <span key={i} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-background/60 text-muted-foreground border border-border/50">
              {e}
            </span>
          ))}
        </div>
      )}

      <Link href={obs.link}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2">
        {obs.actionLabel ?? "View →"}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function BriefingRow({ item }: { item: LuvBriefingItem }) {
  const Icon = item.status === "complete" ? CheckCircle : item.status === "warning" ? AlertTriangle : Circle;
  const iconClass = item.status === "complete" ? "text-success" : item.status === "warning" ? "text-warning-foreground" : "text-muted-foreground";
  const content = (
    <div className="flex items-center gap-2 py-0.5">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
      <span className={`text-xs ${item.status === "complete" ? "text-muted-foreground line-through" : "text-foreground"}`}>
        {item.label}
      </span>
      {item.detail && <span className="text-[10px] text-muted-foreground">{item.detail}</span>}
    </div>
  );
  return item.link && item.status !== "complete"
    ? <Link href={item.link}>{content}</Link>
    : content;
}

function CoordinatorBriefingCard({ obs }: { obs: LuvObservation }) {
  return (
    <div className="py-3 border-b border-border/60 last:border-0 space-y-2">
      <div className="flex items-start gap-3">
        <LuvHeart size={14} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-heading font-medium leading-snug">{obs.message}</p>
        </div>
        <Link href={obs.link} className="shrink-0 text-xs font-medium text-primary hover:underline whitespace-nowrap mt-0.5">
          {obs.actionLabel ?? "View →"}
        </Link>
      </div>
      {obs.briefingItems && (
        <div className="ml-5 space-y-0.5">
          {obs.briefingItems.map((item, i) => <BriefingRow key={i} item={item} />)}
        </div>
      )}
    </div>
  );
}

function ObservationRow({ obs }: { obs: LuvObservation }) {
  if (obs.briefingItems) return <CoordinatorBriefingCard obs={obs} />;

  return (
    <div className="py-3 border-b border-border/60 last:border-0 space-y-2">
      <div className="flex items-start gap-3">
        <LuvHeart size={14} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm text-heading leading-snug">{obs.message}</p>
          {obs.detail && (
            <p className="text-xs text-muted-foreground">{obs.detail}</p>
          )}
        </div>
        <Link href={obs.link}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap mt-0.5 transition-colors">
          {obs.actionLabel ?? "View →"}
        </Link>
      </div>
      {obs.recommendation && (
        <div className="ml-5">
          <Link href={obs.recommendation.link}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-90"
            style={{
              background: `color-mix(in oklch, ${DUSTY_ROSE} 12%, var(--card))`,
              border: `1px solid ${DUSTY_ROSE}30`,
              color: "var(--heading)",
            }}>
            <LuvHeart size={11} />
            <span>{obs.recommendation.label}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </Link>
        </div>
      )}
    </div>
  );
}

export function LuvWidget({
  observations,
  trendObservations = [],
  storyObservation = null,
  memoryObservations = [],
  insightObservations = [],
  actionObservations = [],
  pendingActionObservations = [],
  performanceObservations = [],
  recommendations = [],
}: {
  observations:               LuvObservation[];
  trendObservations?:         LuvObservation[];
  storyObservation?:          LuvObservation | null;
  memoryObservations?:        LuvObservation[];
  insightObservations?:       LuvObservation[];
  actionObservations?:        LuvObservation[];
  pendingActionObservations?: LuvObservation[];
  performanceObservations?:   LuvObservation[];
  recommendations?:           VenueRecommendation[];
}) {
  const hasToday       = observations.length > 0;
  const hasTrends      = trendObservations.length > 0;
  const hasStory       = storyObservation !== null;
  const hasMemories    = memoryObservations.length > 0;
  const hasInsights    = insightObservations.length > 0;
  const hasActions     = actionObservations.length > 0;
  const hasPending     = pendingActionObservations.length > 0;
  const hasPerformance = performanceObservations.length > 0;

  return (
    <Card
      className="border-[#D8A7AA]/25"
      style={{ background: "color-mix(in oklch, #D8A7AA 4%, var(--card))" }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1.5">
          <LuvHeart size={14} />
          <h2 className="font-heading text-sm font-semibold text-heading">
            What Luv noticed today
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Your venue assistant is keeping an eye out for you.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Story Mode — named narrative headline, shown first when present */}
        {hasStory && <StoryCard obs={storyObservation!} />}

        {/* Today's observations */}
        {!hasToday ? (
          <div className="flex items-center gap-2 py-4">
            <LuvHeart size={14} />
            <p className="text-sm text-muted-foreground">
              Everything looks good today — nothing needs your attention right now.
            </p>
          </div>
        ) : (
          <div>
            {observations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
          </div>
        )}

        {/* Trend details — "What changed this month" */}
        {hasTrends && (
          <div className="mt-4 border-t border-[#D8A7AA]/20 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <LuvHeart size={12} />
              <p className="text-xs font-semibold text-heading tracking-wide">
                What changed this month
              </p>
            </div>
            {trendObservations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
          </div>
        )}

        {/* Memory observations — "What Luv remembers" */}
        {hasMemories && (
          <div className="mt-4 border-t border-[#D8A7AA]/20 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <LuvHeart size={12} />
              <p className="text-xs font-semibold text-heading tracking-wide">
                What Luv remembers
              </p>
            </div>
            {memoryObservations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
          </div>
        )}

        {/* Insight observations — "What Luv is learning" */}
        {hasInsights && (
          <div className="mt-4 border-t border-[#D8A7AA]/20 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <LuvHeart size={12} />
              <p className="text-xs font-semibold text-heading tracking-wide">
                What Luv is learning
              </p>
            </div>
            {insightObservations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
          </div>
        )}

        {/* Pending actions — "What Luv is watching" */}
        {hasPending && (
          <div className="mt-4 border-t border-[#D8A7AA]/20 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <LuvHeart size={12} />
              <p className="text-xs font-semibold text-heading tracking-wide">
                What Luv is watching
              </p>
            </div>
            {pendingActionObservations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
          </div>
        )}

        {/* Action outcomes — "What Luv tracked" */}
        {hasActions && (
          <div className="mt-4 border-t border-[#D8A7AA]/20 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <LuvHeart size={12} />
              <p className="text-xs font-semibold text-heading tracking-wide">
                What Luv tracked
              </p>
            </div>
            {actionObservations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
          </div>
        )}

        {/* Performance intelligence — "What Luv has learned" */}
        {hasPerformance && (
          <div className="mt-4 border-t border-[#D8A7AA]/20 pt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <LuvHeart size={12} />
              <p className="text-xs font-semibold text-heading tracking-wide">
                What Luv has learned
              </p>
            </div>
            {performanceObservations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
          </div>
        )}

        {/* Recommendations — "Recommended next steps" */}
        <RecommendationsPanel recommendations={recommendations} />

        {(hasToday || hasTrends || hasStory || hasMemories || hasInsights || hasPending || hasActions || hasPerformance || recommendations.length > 0) && (
          <div className="flex items-center justify-end gap-1 pt-3 pb-0.5">
            <LuvHeart size={10} />
            <p className="text-[10px] text-muted-foreground">Luv — your venue assistant</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
