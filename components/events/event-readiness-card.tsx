"use client";

/**
 * Event Readiness — Phase 1: Platform Integration.
 *
 * A single question, answered at a glance: "Is this event ready?" Every
 * number here is read from a completed feature's own already-computed
 * state (see lib/readiness/compute.ts) — this component draws it, it
 * does not decide it. Sections are pre-sorted most-urgent-first by the
 * compute layer, so the coordinator's eye lands on what needs attention
 * before anything else, without having to scan a flat list.
 */
import { ChevronRight } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventReadinessSummary, ReadinessSection, ReadinessStatus } from "@/lib/readiness/types";

const STATUS_VARIANT: Record<ReadinessStatus, BadgeVariant> = {
  complete: "success", needs_attention: "destructive", waiting: "warning", not_started: "muted",
};
const STATUS_LABEL: Record<ReadinessStatus, string> = {
  complete: "Complete", needs_attention: "Needs Attention", waiting: "Waiting", not_started: "Not Started",
};

function SectionRow({ section, onOpen }: { section: ReadinessSection; onOpen: (section: ReadinessSection) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(section)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
    >
      <Badge variant={STATUS_VARIANT[section.status]} className="shrink-0 w-[112px] justify-center">
        {STATUS_LABEL[section.status]}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{section.label}</p>
        <p className="text-xs text-muted-foreground truncate">{section.detail}</p>
      </div>
      {section.metric && <span className="shrink-0 text-xs font-medium text-muted-foreground">{section.metric}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </button>
  );
}

export function EventReadinessCard({
  summary, portalToken, onNavigateTab,
}: {
  summary: EventReadinessSummary;
  portalToken: string | null;
  onNavigateTab: (tab: string) => void;
}) {
  function handleOpen(section: ReadinessSection) {
    const { nav } = section;
    if (nav.kind === "tab") {
      onNavigateTab(nav.tab);
    } else if (nav.kind === "scroll") {
      document.getElementById(nav.elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (nav.kind === "portal") {
      if (!portalToken) return;
      window.open(`/p/${portalToken}#${nav.section}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Event Readiness</CardTitle>
          <Badge variant={STATUS_VARIANT[summary.overallStatus]}>{STATUS_LABEL[summary.overallStatus]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{summary.headline}</p>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {summary.sections.map((section) => (
          <SectionRow key={section.key} section={section} onOpen={handleOpen} />
        ))}
      </CardContent>
    </Card>
  );
}
