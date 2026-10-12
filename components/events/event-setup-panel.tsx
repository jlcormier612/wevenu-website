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
  SETUP_READINESS_LABEL,
  setupReadinessDetail,
  type EventOrderReadinessInput,
  type QuestionnaireReadinessInput,
} from "@/lib/event-setup/readiness-detail";
import {
  effectiveDecisionMap,
  effectiveSetupDecision,
  setupDecisionCounts,
  setupDecisionsComplete,
  setupStepLabel,
  setupStepSource,
  type EventSetupState,
  type SetupStepKey,
} from "@/lib/event-setup/state";
import type { EventPlaybookApplication, EventReadiness, PlaybookTemplateWithStats } from "@/lib/playbooks/types";
import type { TimelineTemplate } from "@/lib/timeline-templates/types";

function readinessBadgeVariant(
  status: keyof typeof SETUP_READINESS_LABEL,
): "success" | "outline" | "warning" | "secondary" {
  if (status === "included" || status === "shared") return "success";
  if (status === "not_included") return "outline";
  if (status === "draft") return "secondary";
  return "warning";
}

export function EventSetupPanel({
  eventId,
  clientId,
  eventDate,
  eventName,
  clientName,
  clientEmail,
  eventType,
  spaceId,
  eventStartTime,
  hasTimeline,
  timelineItemCount = 0,
  state,
  applicableSteps,
  playbookTemplates,
  playbookApplications,
  readinessByKind,
  timelineTemplates,
  questionnaires = [],
  vendorRecommendationCount = 0,
  floorPlanOfferCount = 0,
  preferredFloorPlanName = null,
  hasEventInventory = false,
  eventOrder = null,
  templateNames = { planning: null, timeline: null, inventory: null, eventOrder: null },
  onNavigateTab,
}: {
  eventId: string;
  clientId: string | null;
  eventDate: string;
  eventName: string;
  clientName: string | null;
  clientEmail: string | null;
  eventType: string | null;
  spaceId: string | null;
  eventStartTime: string | null;
  hasTimeline: boolean;
  timelineItemCount?: number;
  state: EventSetupState;
  applicableSteps: SetupStepKey[];
  playbookTemplates: PlaybookTemplateWithStats[];
  playbookApplications: EventPlaybookApplication[];
  readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null };
  timelineTemplates: TimelineTemplate[];
  questionnaires?: QuestionnaireReadinessInput[];
  vendorRecommendationCount?: number;
  floorPlanOfferCount?: number;
  preferredFloorPlanName?: string | null;
  hasEventInventory?: boolean;
  eventOrder?: EventOrderReadinessInput | null;
  templateNames?: {
    planning: string | null;
    timeline: string | null;
    inventory: string | null;
    eventOrder: string | null;
  };
  onNavigateTab: (tab: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [changing, setChanging] = React.useState<SetupStepKey | null>(null);
  const effective = effectiveDecisionMap(state);
  const complete = setupDecisionsComplete(applicableSteps, effective);
  const collapsed = Boolean(state.collapsedAt) && complete;
  const counts = setupDecisionCounts(applicableSteps, effective);
  const usingProfile = Boolean(state.usesProfile && state.profileName);
  const inheritedRefs = state.inheritedTemplateRefs ?? {};

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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm font-medium text-heading">Event setup complete</p>
          <Button type="button" variant="outline" size="sm" onClick={reopen} disabled={pending}>
            Show setup
          </Button>
        </div>
        {clientId ? (
          <ClientWorkspaceInvite
            clientId={clientId}
            clientName={clientName}
            clientEmail={clientEmail}
          />
        ) : null}
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-heading">Get this event ready</h2>
          {usingProfile ? (
            <>
              <p className="mt-1 text-sm text-foreground">Using: {state.profileName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This Setup Profile supplies your venue&apos;s normal starting setup for this event.
                You can change anything for this event without updating the reusable profile.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {complete
                ? "Every setup area has a decision. Included and not included are finished choices."
                : "Decide Set up or Skip for each area. A capability being available does not mean this event must use it."}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.needsDecision} need a decision
            {" · "}
            {counts.included} included
            {" · "}
            {counts.skipped} not included
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
          const decision = effectiveSetupDecision(state, step) ?? null;
          const source = setupStepSource(state, step);
          const inherited = state.inheritedDecisions?.[step];
          const detail = setupReadinessDetail({
            step,
            decision,
            inheritedRefs,
            playbookApplications,
            hasTimeline,
            timelineItemCount,
            questionnaires,
            vendorRecommendationCount,
            floorPlanOfferCount,
            preferredFloorPlanName,
            hasEventInventory,
            eventOrder,
            templateNames,
          });
          const showChooser = decision == null || changing === step;
          return (
            <li key={step} className="rounded-lg border border-border px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-heading">{setupStepLabel(step)}</p>
                  <Badge variant={readinessBadgeVariant(detail.status)}>
                    {SETUP_READINESS_LABEL[detail.status]}
                    {source === "profile" && state.profileName && detail.status !== "not_included"
                      ? ` · ${state.profileName}`
                      : ""}
                    {source === "event" && state.usesProfile ? " · This event" : ""}
                  </Badge>
                </div>
                {showChooser ? (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={pending} onClick={() => { setChanging(null); decide(step, "set_up"); }}>
                      Set up
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => { setChanging(null); decide(step, "skipped"); }}>
                      Skip
                    </Button>
                  </div>
                ) : state.usesProfile ? (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setChanging(step)}>
                      Change for this event
                    </Button>
                    {source === "event" && inherited ? (
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => decide(step, inherited)}>
                        Use {state.profileName}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{detail.summary}</p>
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
                    clientEmail={clientEmail}
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
      {clientId ? (
        <ClientWorkspaceInvite
          clientId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
        />
      ) : null}
    </section>
  );
}

function ClientWorkspaceInvite({
  clientId,
  clientName,
  clientEmail,
}: {
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
}) {
  return (
    <div
      className="rounded-lg border border-border px-3 py-3 space-y-3"
      data-testid="client-workspace-invite"
    >
      <div>
        <h3 className="text-sm font-medium text-heading">Your client&apos;s planning workspace</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your venue&apos;s setup provides the starting point for this event. Review what&apos;s ready,
          finish any essentials, and invite your client to plan with you in one shared workspace.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Your client will receive an invitation to create or access their account and open the planning
        tools and materials made available for this event. Drafts and other items that require a
        separate send or share action will remain private until you share them.
      </p>
      <PortalLinkWidget
        clientId={clientId}
        coupleName={clientName?.trim() || "your client"}
        primaryEmail={clientEmail}
        inviteLabel="Invite client to workspace"
      />
    </div>
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
  clientEmail: string | null;
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
  return null;
}
