"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { markOperationalResourcesReviewedAction } from "@/app/(app)/setup-hub/actions";
import {
  GuidedBackToOverviewLink,
  GuidedSectionComplete,
  GuidedTaskCard,
} from "@/components/setup-hub/phase-b1/guided-task-card";
import { Button } from "@/components/ui/button";
import type {
  OperationalResourceChoice,
  OperationalResourceKey,
} from "@/lib/setup-hub/phase-b1-readiness";
import { withSetupHubReturn } from "@/lib/setup-hub/phase-b1-routes";

const RESOURCES: {
  key: OperationalResourceKey;
  step: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
}[] = [
  {
    key: "playbooks",
    step: "01",
    title: "Planning playbooks and tasks",
    description: "Reusable planning checklists for your team and your clients.",
    actionLabel: "Review playbooks",
    href: "/library/playbooks",
  },
  {
    key: "timelines",
    step: "02",
    title: "Timelines",
    description: "Prepare schedules and important moments for each event.",
    actionLabel: "Review timelines",
    href: "/library/timeline-templates",
  },
  {
    key: "questionnaires",
    step: "03",
    title: "Questionnaires",
    description: "Gather the details you need from clients as they plan.",
    actionLabel: "Review questionnaires",
    href: "/library/questionnaire-templates",
  },
  {
    key: "event_orders",
    step: "04",
    title: "Event Orders",
    description: "Prepare the selections and event details you'll coordinate with clients.",
    actionLabel: "Review Event Orders",
    href: "/library/event-order-templates",
  },
  {
    key: "inventory",
    step: "05",
    title: "Inventory",
    description: "Organize the items and offerings available at your venue.",
    actionLabel: "Review inventory",
    href: "/library/inventory",
  },
  {
    key: "floor_plans",
    step: "06",
    title: "Floor plans and seating",
    description: "Prepare layouts and seating arrangements for your spaces.",
    actionLabel: "Review floor plans",
    href: "/library/floor-plan-templates",
  },
  {
    key: "client_guide",
    step: "07",
    title: "Client Guide",
    description: "Share helpful venue information with your clients.",
    actionLabel: "Review Client Guide",
    href: "/guide",
  },
  {
    key: "documents",
    step: "08",
    title: "Documents",
    description: "Organize the documents you'll use throughout an event.",
    actionLabel: "Review documents",
    href: "/library/documents",
  },
];

export function OperationalResourcesForm({
  initialChoices,
  starterKeys,
}: {
  initialChoices: Partial<Record<OperationalResourceKey, OperationalResourceChoice>>;
  starterKeys: Partial<Record<OperationalResourceKey, boolean>>;
}) {
  const [choices, setChoices] = React.useState(initialChoices);
  const [pending, startTransition] = React.useTransition();

  function toggleNotUsing(key: OperationalResourceKey) {
    setChoices((current) => ({
      ...current,
      [key]: current[key] === "not_using" ? "using" : "not_using",
    }));
  }

  function save() {
    startTransition(async () => {
      const next: Record<string, OperationalResourceChoice> = {};
      for (const resource of RESOURCES) {
        next[resource.key] = choices[resource.key] === "not_using" ? "not_using" : "using";
      }
      const result = await markOperationalResourcesReviewedAction(next);
      if (result.ok) toast.success("Saved.");
      else toast.error(result.error ?? "Could not save your planning tools review yet.");
    });
  }

  return (
    <div className="space-y-4" data-testid="phase-b1-operational-confirm">
      {RESOURCES.map((resource) => {
        const choice = choices[resource.key];
        const statusLabel =
          choice === "not_using"
            ? "Not using"
            : starterKeys[resource.key]
              ? "Starter available"
              : "Not started";
        return (
          <GuidedTaskCard
            key={resource.key}
            step={resource.step}
            title={resource.title}
            description={resource.description}
            statusLabel={statusLabel}
            action={
              <Button
                type="button"
                render={<Link href={withSetupHubReturn(resource.href, "operational-resources")} />}
              >
                {resource.actionLabel}
              </Button>
            }
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={choice === "not_using"}
                onChange={() => toggleNotUsing(resource.key)}
                data-testid={`phase-b1-not-using-${resource.key}`}
              />
              Not using {resource.title}
            </label>
          </GuidedTaskCard>
        );
      })}

      <GuidedSectionComplete
        heading="Your planning tools, your way."
        description="Once you've reviewed the resources and chosen what you'll use, you're ready to continue."
      >
        <Button
          type="button"
          disabled={pending}
          onClick={save}
          data-testid="phase-b1-confirm-operational"
        >
          Confirm your planning tools
        </Button>
      </GuidedSectionComplete>
      <GuidedBackToOverviewLink />
    </div>
  );
}
