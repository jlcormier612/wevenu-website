"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createStandardClientPlanningTemplateAction,
  createStandardVenueWorkflowTemplateAction,
} from "@/app/(app)/playbooks/actions";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { Button } from "@/components/ui/button";
import {
  STANDARD_CLIENT_PLANNING_MILESTONES,
  STANDARD_CLIENT_PLANNING_TASKS,
  STANDARD_VENUE_WORKFLOW_MILESTONES,
  STANDARD_VENUE_WORKFLOW_TASKS,
} from "@/lib/playbooks/constants";
import type { PlaybookTemplateWithStats } from "@/lib/playbooks/types";

export function PlanningStarterExamples({ templates }: { templates: PlaybookTemplateWithStats[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"client" | "venue" | null>(null);

  const hasClient = templates.some((t) => t.kind === "client");
  const hasVenue = templates.some((t) => t.kind === "venue");
  if (hasClient && hasVenue) return null;

  async function create(kind: "client" | "venue") {
    setPending(kind);
    const result = kind === "client"
      ? await createStandardClientPlanningTemplateAction()
      : await createStandardVenueWorkflowTemplateAction();
    setPending(null);
    if (!result.ok) {
      toast.error(result.message ?? "Could not create starter.");
      return;
    }
    toast.success("Starter created — opening the editor.");
    router.push(`/library/playbooks/${result.templateId}`);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-heading">Hello to Cheers starter examples</p>
          <p className="text-xs text-muted-foreground">Start with a complete checklist, then make it your own.</p>
        </div>
      </div>

      {!hasClient && (
        <LibraryAssetCard
          title="Standard Wedding — Client Planning"
          description="A client-facing checklist from booking through post-event, ready for your venue to customize."
          meta={`${STANDARD_CLIENT_PLANNING_TASKS.length} tasks · ${STANDARD_CLIENT_PLANNING_MILESTONES.length} milestones`}
          isStarter
          primaryActions={[{
            id: "use-client",
            label: pending === "client" ? "Creating…" : "Use this starter",
            onClick: () => create("client"),
            emphasis: "use",
            disabled: pending !== null,
          }]}
        />
      )}

      {!hasVenue && (
        <LibraryAssetCard
          title="Standard Wedding — Venue Planning"
          description="An internal team checklist from booking through post-event, ready for your venue to customize."
          meta={`${STANDARD_VENUE_WORKFLOW_TASKS.length} tasks · ${STANDARD_VENUE_WORKFLOW_MILESTONES.length} milestones`}
          isStarter
          primaryActions={[{
            id: "use-venue",
            label: pending === "venue" ? "Creating…" : "Use this starter",
            onClick: () => create("venue"),
            emphasis: "use",
            disabled: pending !== null,
          }]}
        />
      )}

      {pending && <Button variant="ghost" size="sm" disabled><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Creating starter…</Button>}
    </section>
  );
}
