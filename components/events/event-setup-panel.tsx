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
  isOutstandingFollowUp,
  setupStatusBadgeLabel,
} from "@/lib/event-setup/outstanding-follow-ups";
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
  const decisionsComplete = setupDecisionsComplete(applicableSteps, effective);
  const counts = setupDecisionCounts(applicableSteps, effective);
  const usingProfile = Boolean(state.usesProfile && state.profileName);
  const inheritedRefs = state.inheritedTemplateRefs ?? {};

  const stepDetails = applicableSteps.map((step) => {
    const decision = effectiveSetupDecision(state, step) ?? null;
    return {
      step,
      decision,
      detail: setupReadinessDetail({
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
      }),
    };
  });
  /** Included areas that still need work — not undecided Set up / Skip rows. */
  const outstanding = stepDetails.filter((row) =>
    isOutstandingFollowUp(row.decision, row.detail.status),
  );
  const outstandingSteps = new Set(outstanding.map((row) => row.step));
  const outstandingCount = outstanding.length;
  /** Decisions alone are not “setup complete” while drafts or missing artifacts remain. */
  const setupSettled = decisionsComplete && outstandingCount === 0;
  const collapsed = Boolean(state.collapsedAt) && setupSettled;

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
      <div className="space-y-3" data-testid="event-setup-panel" id="event-setup">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium text-heading">Event setup</p>
            <p className="text-xs text-muted-foreground">No outstanding setup actions for this event.</p>
          </div>
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
    <section className="space-y-3 rounded-lg border border-border bg-card px-4 py-4" data-testid="event-setup-panel" id="event-setup">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-heading">Event setup</h2>
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
              {decisionsComplete
                ? "Every area has a Set up or Skip decision. Outstanding drafts and missing preparations still need attention below."
                : "Decide Set up or Skip for each area. A capability being available does not mean this event must use it."}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.needsDecision} need a decision
            {" · "}
            {counts.included} included
            {" · "}
            {counts.skipped} not included
            {outstandingCount > 0 ? ` · ${outstandingCount} need follow-up` : ""}
          </p>
        </div>
        {setupSettled ? (
          <Button type="button" variant="outline" size="sm" onClick={collapse} disabled={pending}>
            Hide setup
          </Button>
        ) : null}
      </div>
      {outstandingCount > 0 ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-3 space-y-2" data-testid="event-setup-outstanding">
          <p className="text-sm font-medium text-heading">Outstanding on this event</p>
          <p className="text-xs text-muted-foreground">
            Included areas that still need a follow-up. Set up or Skip decisions stay on each area below.
          </p>
          <ul className="space-y-2">
            {outstanding.map(({ step, detail }) => (
              <li key={step} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-heading">{setupStepLabel(step)}</p>
                  <p className="text-xs text-muted-foreground">{detail.summary}</p>
                </div>
                {detail.nextAction ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const tab =
                        step === "planning" ? "playbook"
                          : step === "timeline" ? "timeline"
                            : step === "floor_plans" ? "floor-plans"
                              : step === "vendors" ? "vendors"
                                : step === "questionnaires" ? "questionnaires"
                                  : step === "inventory" ? "inventory"
                                    : step === "event_order" ? "event-order"
                                      : "overview";
                      onNavigateTab(tab);
                    }}
                  >
                    {detail.nextAction}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Sharing or releasing content does not send an invitation email. Invite the couple separately when you are ready.
          </p>
        </div>
      ) : null}
      <ul className="space-y-3">
        {stepDetails.map(({ step, decision, detail }) => {
          const source = setupStepSource(state, step);
          const inherited = state.inheritedDecisions?.[step];
          const showChooser = decision == null || changing === step;
          const listedInOutstanding = outstandingSteps.has(step);
          const badgeLabel = setupStatusBadgeLabel(decision, detail.status, SETUP_READINESS_LABEL);
          return (
            <li key={step} className="rounded-lg border border-border px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-heading">{setupStepLabel(step)}</p>
                  <Badge variant={decision == null ? "outline" : readinessBadgeVariant(detail.status)}>
                    {badgeLabel}
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
              {detail.nextAction && decision === "set_up" && !listedInOutstanding ? (
                <p className="mt-1 text-xs font-medium text-foreground">Next: {detail.nextAction}</p>
              ) : null}
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
                    hideOpenTab={listedInOutstanding}
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
          When you are ready, invite them to the planning workspace. Invitation is separate from
          releasing checklists or sharing timeline items.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Invite client to workspace sends an email when an address is on file. Drafts and items that
        still need a separate release, share, or send stay private until you take that action.
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
  /** When true, the Outstanding list already owns the primary open action. */
  hideOpenTab?: boolean;
}) {
  const { step, onNavigateTab, hideOpenTab } = props;
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
        {!hideOpenTab && props.playbookApplications.length > 0 ? (
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
        {!hideOpenTab && props.hasTimeline ? (
          <OpenTab label="Open Timeline" tab="timeline" onNavigateTab={onNavigateTab} />
        ) : null}
      </div>
    );
  }
  if (hideOpenTab) return null;
  if (step === "floor_plans") return <OpenTab label="Open Floor Plans" tab="floorplan" onNavigateTab={onNavigateTab} />;
  if (step === "vendors") return <OpenTab label="Open Vendors" tab="vendors" onNavigateTab={onNavigateTab} />;
  if (step === "questionnaires") return <OpenTab label="Open Questionnaires" tab="questionnaires" onNavigateTab={onNavigateTab} />;
  if (step === "inventory") return <OpenTab label="Open Inventory" tab="inventory" onNavigateTab={onNavigateTab} />;
  if (step === "event_order") return <OpenTab label="Open Event Order" tab="event-order" onNavigateTab={onNavigateTab} />;
  return null;
}
