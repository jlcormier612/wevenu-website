"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  collapseEventSetupAction,
  decideEventSetupAction,
  reopenEventSetupAction,
} from "@/app/(app)/events/[id]/setup-actions";
import { BookingSetupCard } from "@/components/events/booking-setup-card";
import { TimelineSetupCard } from "@/components/events/timeline-setup-card";
import { PortalLinkWidget } from "@/components/portal/portal-link-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SETUP_PRESENTATION_LABEL,
  setupDecisionCounts,
  setupDecisionsComplete,
  setupStepLabel,
  setupStepPresentation,
  type EventSetupState,
  type SetupStepKey,
} from "@/lib/event-setup/state";
import type { EventPlaybookApplication, EventReadiness, PlaybookTemplateWithStats } from "@/lib/playbooks/types";
import type { TimelineTemplate } from "@/lib/timeline-templates/types";

export function EventSetupPanel({
  eventId,
  clientId,
  eventDate,
  eventName,
  clientName,
  eventType,
  spaceId,
  eventStartTime,
  hasTimeline,
  state,
  applicableSteps,
  playbookTemplates,
  playbookApplications,
  readinessByKind,
  timelineTemplates,
  onNavigateTab,
}: {
  eventId: string;
  clientId: string | null;
  eventDate: string;
  eventName: string;
  clientName: string | null;
  eventType: string | null;
  spaceId: string | null;
  eventStartTime: string | null;
  hasTimeline: boolean;
  state: EventSetupState;
  applicableSteps: SetupStepKey[];
  playbookTemplates: PlaybookTemplateWithStats[];
  playbookApplications: EventPlaybookApplication[];
  readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null };
  timelineTemplates: TimelineTemplate[];
  onNavigateTab: (tab: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const complete = setupDecisionsComplete(applicableSteps, state.decisions);
  const collapsed = Boolean(state.collapsedAt) && complete;
  const counts = setupDecisionCounts(applicableSteps, state.decisions);

  function decide(step: SetupStepKey, decision: "set_up" | "skipped") {
    startTransition(async () => {
      const result = await decideEventSetupAction(eventId, clientId, step, decision);
      if (!result.ok) toast.error(result.message);
      else router.refresh();
    });
  }

  function reopen() {
    startTransition(async () => {
      const result = await reopenEventSetupAction(eventId, clientId);
      if (!result.ok) toast.error(result.message);
      else router.refresh();
    });
  }

  function collapse() {
    startTransition(async () => {
      const result = await collapseEventSetupAction(eventId, clientId);
      if (!result.ok) toast.error(result.message);
      else router.refresh();
    });
  }

  if (applicableSteps.length === 0) return null;

  if (collapsed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm font-medium text-heading">Event setup complete</p>
        <Button type="button" variant="outline" size="sm" onClick={reopen} disabled={pending}>
          Show setup
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-heading">Get this event ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {complete
              ? "Every setup area has a decision. Configured and skipped are finished choices."
              : "Decide Set up or Skip for each area. A capability being available does not mean this event must use it."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.needsDecision} need a decision
            {" · "}
            {counts.configured} configured
            {" · "}
            {counts.skipped} skipped
          </p>
        </div>
        {complete ? (
          <Button type="button" variant="outline" size="sm" onClick={collapse} disabled={pending}>
            Hide setup
          </Button>
        ) : null}
      </div>
      <ul className="space-y-3">
        {applicableSteps.map((step) => {
          const decision = state.decisions[step] ?? null;
          const presentation = setupStepPresentation(decision);
          return (
            <li key={step} className="rounded-lg border border-border px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-heading">{setupStepLabel(step)}</p>
                  <Badge
                    variant={
                      presentation === "configured"
                        ? "success"
                        : presentation === "skipped"
                          ? "outline"
                          : "warning"
                    }
                  >
                    {SETUP_PRESENTATION_LABEL[presentation]}
                  </Badge>
                </div>
                {presentation === "needs_decision" ? (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={pending} onClick={() => decide(step, "set_up")}>
                      Set up
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => decide(step, "skipped")}>
                      Skip
                    </Button>
                  </div>
                ) : null}
              </div>
              {decision === "set_up" ? (
                <div className="mt-3">
                  <SetupTool
                    onWorkApplied={() => router.refresh()}
                    step={step}
                    eventId={eventId}
                    clientId={clientId}
                    eventDate={eventDate}
                    eventName={eventName}
                    clientName={clientName}
                    eventType={eventType}
                    spaceId={spaceId}
                    eventStartTime={eventStartTime}
                    hasTimeline={hasTimeline}
                    playbookTemplates={playbookTemplates}
                    playbookApplications={playbookApplications}
                    readinessByKind={readinessByKind}
                    timelineTemplates={timelineTemplates}
                    onNavigateTab={onNavigateTab}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function OpenTab({ label, tab, onNavigateTab }: { label: string; tab: string; onNavigateTab: (tab: string) => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => onNavigateTab(tab)}>
      {label}
    </Button>
  );
}

function SetupTool(props: {
  onWorkApplied: () => void;
  step: SetupStepKey;
  eventId: string;
  clientId: string | null;
  eventDate: string;
  eventName: string;
  clientName: string | null;
  eventType: string | null;
  spaceId: string | null;
  eventStartTime: string | null;
  hasTimeline: boolean;
  playbookTemplates: PlaybookTemplateWithStats[];
  playbookApplications: EventPlaybookApplication[];
  readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null };
  timelineTemplates: TimelineTemplate[];
  onNavigateTab: (tab: string) => void;
}) {
  const { step, onNavigateTab } = props;
  if (step === "planning") {
    return (
      <div className="space-y-2">
        <BookingSetupCard
          eventId={props.eventId}
          clientId={props.clientId}
          eventDate={props.eventDate}
          eventName={props.eventName}
          clientName={props.clientName}
          eventType={props.eventType}
          templates={props.playbookTemplates}
          applications={props.playbookApplications}
          readinessByKind={props.readinessByKind}
          onApplied={() => { props.onWorkApplied(); onNavigateTab("playbook"); }}
        />
        {props.playbookApplications.length > 0 ? (
          <OpenTab label="Open Planning" tab="playbook" onNavigateTab={onNavigateTab} />
        ) : null}
      </div>
    );
  }
  if (step === "timeline") {
    return (
      <div className="space-y-2">
        <TimelineSetupCard
          eventId={props.eventId}
          eventType={props.eventType}
          spaceId={props.spaceId}
          eventStartTime={props.eventStartTime}
          templates={props.timelineTemplates}
          hasTimeline={props.hasTimeline}
          onApplied={() => { props.onWorkApplied(); onNavigateTab("timeline"); }}
        />
        {props.hasTimeline ? <OpenTab label="Open Timeline" tab="timeline" onNavigateTab={onNavigateTab} /> : null}
      </div>
    );
  }
  if (step === "floor_plans") return <OpenTab label="Open Floor Plans" tab="floorplan" onNavigateTab={onNavigateTab} />;
  if (step === "vendors") return <OpenTab label="Open Vendors" tab="vendors" onNavigateTab={onNavigateTab} />;
  if (step === "questionnaires") return <OpenTab label="Open Questionnaires" tab="questionnaires" onNavigateTab={onNavigateTab} />;
  if (step === "inventory") return <OpenTab label="Open Inventory" tab="inventory" onNavigateTab={onNavigateTab} />;
  if (step === "event_order") return <OpenTab label="Open Event Order" tab="event-order" onNavigateTab={onNavigateTab} />;
  if (step === "portal" && props.clientId) {
    return <PortalLinkWidget clientId={props.clientId} coupleName={props.clientName?.trim() || "your client"} />;
  }
  return null;
}
