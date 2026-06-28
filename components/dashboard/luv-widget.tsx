/**
 * LuvWidget — "What Luv noticed today"
 *
 * Luv Typography System:
 *   Heart size always matches adjacent text size so it feels natural:
 *     text-sm (14px) → Heart size 14
 *     text-xs (12px) → Heart size 12
 *     text-[10px]    → Heart size 10
 *   Observation message: text-sm text-heading (warm, readable, consistent)
 *   Detail / meta:      text-xs text-muted-foreground
 */

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle, Circle, Heart } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { LuvBriefingItem, LuvObservation } from "@/lib/luv/types";

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

  const DUSTY_ROSE = "#D8A7AA";

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
      {/* Recommendation — the suggested next step */}
      {obs.recommendation && (
        <div className="ml-5">
          <Link href={obs.recommendation.link}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-90"
            style={{
              background: `color-mix(in oklch, ${DUSTY_ROSE} 12%, var(--card))`,
              border: `1px solid ${DUSTY_ROSE}30`,
              color: "#8B5A5C",
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

export function LuvWidget({ observations }: { observations: LuvObservation[] }) {
  return (
    <Card
      className="border-[#D8A7AA]/25"
      style={{ background: "color-mix(in oklch, #D8A7AA 4%, var(--card))" }}
    >
      <CardHeader className="pb-2">
        {/* Header: heart at 14px matches text-sm font-semibold (~14px) */}
        <div className="flex items-center gap-1.5">
          <LuvHeart size={14} />
          <h2 className="font-heading text-sm font-semibold text-heading">
            What Luv noticed today
          </h2>
        </div>
        {/* Subtitle: text-xs, no heart needed */}
        <p className="text-xs text-muted-foreground">
          Your venue assistant is keeping an eye out for you.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {observations.length === 0 ? (
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
            {/* Signature: heart at 10px matches text-[10px] */}
            <div className="flex items-center justify-end gap-1 pt-3 pb-0.5">
              <LuvHeart size={10} />
              <p className="text-[10px] text-muted-foreground">Luv — your venue assistant</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
