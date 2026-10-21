"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  collapseEventSetupAction,
  decideEventSetupAction,
  prepareAndReleasePortalAction,
  reopenEventSetupAction,
} from "@/app/(app)/events/[id]/setup-actions";
import { EventFloorPlansSetupEditor } from "@/components/events/event-floor-plans-setup-editor";
import { EventInventorySetupEditor } from "@/components/events/event-inventory-setup-editor";
import { EventOrderSetupEditor } from "@/components/events/event-order-setup-editor";
import { EventPlanningSetupEditor } from "@/components/events/event-planning-setup-editor";
import { EventTimelineSetupEditor } from "@/components/events/event-timeline-setup-editor";
import { EventVendorsSetupEditor } from "@/components/events/event-vendors-setup-editor";
import { PortalLinkWidget } from "@/components/portal/portal-link-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EventInventoryWithDetails, InventoryTemplate } from "@/lib/event-inventory/types";
import type { EventFloorPlanOfferWithTemplate } from "@/lib/floor-plan-offers/types";
import type { FloorPlanTemplate } from "@/lib/floor-plan-templates/types";
import type { EventOrderTemplate } from "@/lib/event-order-templates/types";
import type { EventOrderWithDetails } from "@/lib/event-orders/types";
import type { EventVendorRecommendation } from "@/lib/vendor-recommendations/types";
import type { Vendor } from "@/lib/vendors/types";
import type { TimelineEntry } from "@/lib/timeline/types";
import {
  isOutstandingFollowUp,
  setupStatusBadgeLabel,
  setupStepTemplateLabel,
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
import type {
  EventPlaybookApplication,
  EventReadiness,
  EventTask,
  PlaybookTemplateWithStats,
} from "@/lib/playbooks/types";
import type { TimelineTemplateWithStats } from "@/lib/timeline-templates/types";

/** Areas with a dedicated event-specific setup editor (Change ≠ Open). */
const SETUP_EDITOR_STEPS = new Set<SetupStepKey>([
  "planning", "timeline", "inventory", "event_order", "floor_plans", "vendors",
]);

function readinessBadgeVariant(
  status: keyof typeof SETUP_READINESS_LABEL,
  badgeLabel: string,
): "success" | "outline" | "warning" | "secondary" {
  if (badgeLabel === "Included" || badgeLabel === "Released" || status === "included" || status === "shared") {
    return "success";
  }
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
  timelineEntries = [],
  questionnaires = [],
  vendorRecommendationCount = 0,
  floorPlanOfferCount = 0,
  operationalFloorPlanCount = 0,
  preferredFloorPlanName = null,
  floorPlanTemplates = [],
  floorPlanOffers = [],
  operationalFloorPlans = [],
  vendorRecommendations = [],
  availableVendors = [],
  vendorAssignments = [],
  hasEventInventory = false,
  eventOrder = null,
  eventInventory = null,
  inventoryTemplates = [],
  eventOrderDetails = null,
  eventOrderTemplates = [],
  eventTasks = [],
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
  timelineTemplates: TimelineTemplateWithStats[];
  timelineEntries?: TimelineEntry[];
  questionnaires?: QuestionnaireReadinessInput[];
  vendorRecommendationCount?: number;
  floorPlanOfferCount?: number;
  operationalFloorPlanCount?: number;
  preferredFloorPlanName?: string | null;
  floorPlanTemplates?: FloorPlanTemplate[];
  floorPlanOffers?: EventFloorPlanOfferWithTemplate[];
  operationalFloorPlans?: { id: string; name: string }[];
  vendorRecommendations?: EventVendorRecommendation[];
  availableVendors?: Vendor[];
  vendorAssignments?: { id: string; vendorName: string }[];
  hasEventInventory?: boolean;
  eventOrder?: EventOrderReadinessInput | null;
  eventInventory?: EventInventoryWithDetails | null;
  inventoryTemplates?: InventoryTemplate[];
  eventOrderDetails?: EventOrderWithDetails | null;
  eventOrderTemplates?: EventOrderTemplate[];
  eventTasks?: EventTask[];
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
  const [planningEditorOpen, setPlanningEditorOpen] = React.useState(false);
  const [timelineEditorOpen, setTimelineEditorOpen] = React.useState(false);
  const [inventoryEditorOpen, setInventoryEditorOpen] = React.useState(false);
  const [eventOrderEditorOpen, setEventOrderEditorOpen] = React.useState(false);
  const [floorPlansEditorOpen, setFloorPlansEditorOpen] = React.useState(false);
  const [vendorsEditorOpen, setVendorsEditorOpen] = React.useState(false);
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
        operationalFloorPlanCount,
        preferredFloorPlanName,
        hasEventInventory,
        eventOrder,
        templateNames,
      }),
    };
  });
  const outstanding = stepDetails.filter((row) =>
    isOutstandingFollowUp(row.decision, row.detail.status, row.step),
  );
  const clientPlanning = playbookApplications.find((a) => a.kind === "client");
  const outstandingCount = outstanding.length;
  // Genuine blockers only hide the primary release CTA. Draft / recoverable
  // content is recovered by Release itself and must not spawn per-row Prepare buttons.
  const canPrepareRelease = Boolean(clientId && decisionsComplete && outstandingCount === 0);
  const portalReleased = Boolean(clientPlanning?.releasedAt);
  const setupSettled = decisionsComplete && outstandingCount === 0 && portalReleased;
  const collapsed = Boolean(state.collapsedAt) && setupSettled;

  function navigateStep(step: SetupStepKey) {
    const tab =
      step === "planning" ? "playbook"
        : step === "timeline" ? "timeline"
          : step === "floor_plans" ? "floorplan"
            : step === "vendors" ? "vendors"
              : step === "questionnaires" ? "questionnaires"
                : step === "inventory" ? "inventory"
                  : step === "event_order" ? "event-order"
                    : "overview";
    // Open Planning → management workspace (task list), not the setup editor.
    if (step === "planning") {
      onNavigateTab("playbook#planning-task-list");
      return;
    }
    onNavigateTab(tab);
  }

  function changeForEvent(step: SetupStepKey) {
    if (step === "planning") {
      setPlanningEditorOpen(true);
      return;
    }
    if (step === "timeline") {
      setTimelineEditorOpen(true);
      return;
    }
    if (step === "inventory") {
      setInventoryEditorOpen(true);
      return;
    }
    if (step === "event_order") {
      setEventOrderEditorOpen(true);
      return;
    }
    if (step === "floor_plans") {
      setFloorPlansEditorOpen(true);
      return;
    }
    if (step === "vendors") {
      setVendorsEditorOpen(true);
      return;
    }
    // Areas without a dedicated setup editor yet — do not pretend management is Change.
    toast.message("Event-specific setup editing for this area is not available yet. Use Open for ongoing management.");
  }

  function openSetupProfiles() {
    router.push("/settings/leads/setup-profiles");
  }

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

  function prepareAndRelease() {
    if (!clientId) {
      toast.error("Link a client before preparing the portal.");
      return;
    }
    startTransition(async () => {
      const result = await prepareAndReleasePortalAction(
        eventId,
        clientId,
        clientName?.trim() || "your client",
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
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
                Review your event&apos;s standard setup, make any event-specific changes, and release
                the prepared experience to the client portal. Invite the client separately when
                you&apos;re ready. Questionnaires use authorized send when staff choose — not an automated schedule.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {decisionsComplete
                ? "Review included areas below. Edit if needed, then release to the client portal. Invite the client separately."
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
      {clientId && canPrepareRelease ? (
        <div
          className="rounded-lg border border-border bg-muted/30 px-3 py-3 space-y-3"
          data-testid="event-setup-prepare-release"
        >
          <div>
            <h3 className="text-sm font-medium text-heading">
              {portalReleased ? "Client portal released" : "Release to client portal"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {portalReleased
                ? "The prepared experience is released. You can still manage every area from its workspace tab. Re-running release is safe and does not invite the client or send questionnaires."
                : "One action for the reviewed setup: ensures included Inventory and Event Order drafts, releases Client Planning, applies and shares the timeline when present, and keeps floor-plan options ready. Does not invite the client, send questionnaires, or create invoices."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={prepareAndRelease}
            data-testid="prepare-and-release-portal"
          >
            {portalReleased ? "Release to client portal again" : "Release to client portal"}
          </Button>
        </div>
      ) : null}
      {outstandingCount > 0 ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-3 space-y-2" data-testid="event-setup-outstanding">
          <p className="text-sm font-medium text-heading">Outstanding on this event</p>
          <p className="text-xs text-muted-foreground">
            Genuine blockers only. Prepared drafts awaiting release are not listed here —
            use Release to client portal once decisions are complete. Questionnaires use authorized send, separately from release.
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
                    disabled={pending}
                    onClick={() => {
                      if (detail.nextAction === "Open Setup Profiles") {
                        openSetupProfiles();
                        return;
                      }
                      navigateStep(step);
                    }}
                  >
                    {detail.nextAction}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="space-y-3">
        {stepDetails.map(({ step, decision, detail }) => {
          const source = setupStepSource(state, step);
          const inherited = state.inheritedDecisions?.[step];
          const undecided = decision == null;
          const badgeLabel = setupStatusBadgeLabel(decision, detail.status, SETUP_READINESS_LABEL, step);
          // Profile-included cards show the Setup Profile name (matches Timeline).
          // Planning checklist template name stays in the summary / editor.
          const nameLabel =
            source === "profile" && state.profileName && detail.status !== "not_included"
              ? state.profileName
              : setupStepTemplateLabel(step, templateNames, {
                clientChecklistName: clientPlanning?.templateName ?? null,
                preferredFloorPlanName,
              });
          return (
            <li key={step} className="rounded-lg border border-border px-3 py-3" data-testid={`event-setup-card-${step}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-heading">{setupStepLabel(step)}</p>
                  <Badge variant={decision == null ? "outline" : readinessBadgeVariant(detail.status, badgeLabel)}>
                    {badgeLabel}
                    {source === "event" && state.usesProfile ? " · This event" : ""}
                  </Badge>
                  {nameLabel && detail.status !== "not_included" ? (
                    <span className="text-xs text-muted-foreground" data-testid={`event-setup-template-${step}`}>
                      {nameLabel}
                    </span>
                  ) : null}
                </div>
                {undecided ? (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={pending} onClick={() => decide(step, "set_up")}>
                      Set up
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => decide(step, "skipped")}>
                      Skip
                    </Button>
                  </div>
                ) : state.usesProfile ? (
                  <div className="flex flex-wrap gap-2">
                    {decision === "set_up" && SETUP_EDITOR_STEPS.has(step) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        data-testid={`event-setup-change-${step}`}
                        onClick={() => changeForEvent(step)}
                      >
                        Change for this event
                      </Button>
                    ) : null}
                    {decision === "set_up" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => decide(step, "skipped")}
                      >
                        Don&apos;t include for this event
                      </Button>
                    ) : null}
                    {decision === "skipped" && inherited ? (
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
                  <SetupEditorLink
                    step={step}
                    onOpen={() => navigateStep(step)}
                    onOpenSetupProfiles={
                      (step === "inventory" && !hasEventInventory && !inheritedRefs.inventoryTemplateId)
                      || (step === "event_order" && !eventOrder && !inheritedRefs.eventOrderTemplateId)
                        ? openSetupProfiles
                        : undefined
                    }
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
      <EventPlanningSetupEditor
        open={planningEditorOpen}
        onOpenChange={setPlanningEditorOpen}
        eventId={eventId}
        eventName={eventName}
        eventDate={eventDate}
        clientName={clientName}
        profileName={state.profileName ?? null}
        applications={playbookApplications}
        templates={playbookTemplates}
        tasks={eventTasks}
      />
      <EventTimelineSetupEditor
        open={timelineEditorOpen}
        onOpenChange={setTimelineEditorOpen}
        eventId={eventId}
        eventName={eventName}
        eventStartTime={eventStartTime}
        profileName={state.profileName ?? null}
        preferredTemplateId={inheritedRefs.timelineTemplateId ?? null}
        templates={timelineTemplates}
        entries={timelineEntries}
      />
      <EventInventorySetupEditor
        open={inventoryEditorOpen}
        onOpenChange={setInventoryEditorOpen}
        eventId={eventId}
        eventName={eventName}
        profileName={state.profileName ?? null}
        preferredTemplateId={inheritedRefs.inventoryTemplateId ?? null}
        templates={inventoryTemplates}
        eventInventory={eventInventory}
      />
      <EventOrderSetupEditor
        open={eventOrderEditorOpen}
        onOpenChange={setEventOrderEditorOpen}
        eventId={eventId}
        eventName={eventName}
        profileName={state.profileName ?? null}
        preferredTemplateId={inheritedRefs.eventOrderTemplateId ?? null}
        templates={eventOrderTemplates}
        eventOrder={eventOrderDetails}
      />
      <EventFloorPlansSetupEditor
        open={floorPlansEditorOpen}
        onOpenChange={setFloorPlansEditorOpen}
        eventId={eventId}
        eventName={eventName}
        profileName={state.profileName ?? null}
        preferredTemplateId={inheritedRefs.defaultFloorPlanTemplateId ?? null}
        configuredTemplateIds={inheritedRefs.floorPlanTemplateIds ?? []}
        templates={floorPlanTemplates}
        offers={floorPlanOffers}
        operationalPlans={operationalFloorPlans}
        onOpenManagement={() => navigateStep("floor_plans")}
      />
      <EventVendorsSetupEditor
        open={vendorsEditorOpen}
        onOpenChange={setVendorsEditorOpen}
        eventId={eventId}
        eventName={eventName}
        clientName={clientName}
        profileName={state.profileName ?? null}
        recommendations={vendorRecommendations}
        availableVendors={availableVendors}
        assignments={vendorAssignments}
        onOpenManagement={() => navigateStep("vendors")}
      />
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
          After you release to the client portal, invite the client. Invitation is a separate action
          from release and does not re-run setup.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Invite client sends an email when an address is on file. Questionnaires are never sent by
        this invite — staff send them with an authorized send when ready.
      </p>
      <PortalLinkWidget
        clientId={clientId}
        coupleName={clientName?.trim() || "your client"}
        primaryEmail={clientEmail}
        inviteLabel="Invite client"
      />
    </div>
  );
}

function SetupEditorLink({
  step,
  onOpen,
  onOpenSetupProfiles,
}: {
  step: SetupStepKey;
  onOpen: () => void;
  onOpenSetupProfiles?: () => void;
}) {
  if (onOpenSetupProfiles) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={onOpenSetupProfiles}>
        Open Setup Profiles
      </Button>
    );
  }
  const label =
    step === "planning" ? "Open Planning"
      : step === "timeline" ? "Open Timeline"
        : step === "floor_plans" ? "Open Floor Plans"
          : step === "vendors" ? "Open Vendors"
            : step === "questionnaires" ? "Open Questionnaires"
              : step === "inventory" ? "Open Inventory"
                : step === "event_order" ? "Open Event Order"
                  : null;
  if (!label) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid={`event-setup-open-${step}`}
      onClick={onOpen}
    >
      {label}
    </Button>
  );
}
