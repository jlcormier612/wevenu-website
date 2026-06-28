/**
 * LuvEventBriefing — The Planning Progress coordinator briefing.
 *
 * "The Carter Wedding is in 14 days. Here's where things stand."
 *
 * Score + checklist + suggested next steps.
 * No AI. Pure data orchestration of what already exists in the platform.
 * "Luv doesn't create work. She reveals work that already exists."
 */

import Link from "next/link";
import { ArrowRight, CheckCircle, AlertTriangle, Circle } from "lucide-react";

import { LuvHeart } from "@/components/dashboard/luv-widget";
import type { EventReadiness, ReadinessItem } from "@/lib/luv/event-readiness";

const DUSTY_ROSE = "#D8A7AA";

function inDays(daysUntil: number): string {
  if (daysUntil <= 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
}

function ScoreRing({ score }: { score: number }) {
  // SVG circular progress ring. r=15.9, circumference ≈ 100.
  const color = score >= 80 ? "#5D6F5D" : score >= 50 ? "#C7A66A" : "#D8A7AA";
  const label = score >= 80 ? "Looking good" : score >= 50 ? "Getting there" : "Needs attention";

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--muted)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${score} 100`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-heading">
          {score}%
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-heading">{label}</p>
        <p className="text-xs text-muted-foreground" style={{ color }}>
          {score >= 80 ? "Event is well prepared" : score >= 50 ? "A few items remain" : "Several items need attention"}
        </p>
      </div>
    </div>
  );
}

function ChecklistItem({ item }: { item: ReadinessItem }) {
  const Icon = item.status === "complete" ? CheckCircle
    : item.status === "warning" ? AlertTriangle
    : Circle;
  const iconColor = item.status === "complete" ? "text-success"
    : item.status === "warning" ? "text-warning-foreground"
    : "text-muted-foreground";
  const textClass = item.status === "complete"
    ? "text-muted-foreground line-through"
    : "text-foreground";

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <span className={`text-sm ${textClass}`}>{item.label}</span>
        {item.detail && (
          <span className="ml-2 text-xs text-muted-foreground">{item.detail}</span>
        )}
      </div>
    </div>
  );
}

export function LuvEventBriefing({ readiness }: { readiness: EventReadiness }) {
  const { eventName, daysUntil, score, completedCount, totalCount, items } = readiness;

  const incompleteItems = items.filter((i) => i.status !== "complete" && i.actionLabel);
  const isClose = daysUntil <= 30;

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{
        borderColor: `${DUSTY_ROSE}30`,
        background: `color-mix(in oklch, ${DUSTY_ROSE} 4%, var(--card))`,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <LuvHeart size={14} />
        <div>
          <p className="text-sm font-semibold text-heading">
            {eventName} is {inDays(daysUntil)}.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isClose
              ? "Here's where things stand — a few items may still need attention."
              : "Planning is underway. Here's the current status."}
          </p>
        </div>
      </div>

      {/* Score ring */}
      <ScoreRing score={score} />

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{completedCount} of {totalCount} planning items complete</span>
          <span>{score}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              backgroundColor: score >= 80 ? "var(--success)" : score >= 50 ? "#C7A66A" : DUSTY_ROSE,
            }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="divide-y divide-border/50">
        {items.map((item) => (
          <ChecklistItem key={item.key} item={item} />
        ))}
      </div>

      {/* Suggested next steps */}
      {incompleteItems.length > 0 && (
        <div
          className="rounded-lg px-3 py-3 space-y-2"
          style={{ background: `${DUSTY_ROSE}10`, border: `1px solid ${DUSTY_ROSE}20` }}
        >
          <div className="flex items-center gap-1.5">
            <LuvHeart size={11} />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Suggested next steps
            </p>
          </div>
          <div className="space-y-1.5">
            {incompleteItems.slice(0, 4).map((item) => (
              <Link
                key={item.key}
                href={item.actionLink ?? "#"}
                className="flex items-center gap-1.5 text-xs font-medium hover:underline"
                style={{ color: "#8B5A5C" }}
              >
                <ArrowRight className="h-3 w-3 shrink-0" />
                {item.actionLabel}
              </Link>
            ))}
          </div>
        </div>
      )}

      {score === 100 && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">Everything is in place. {eventName} is ready!</span>
        </div>
      )}
    </div>
  );
}
