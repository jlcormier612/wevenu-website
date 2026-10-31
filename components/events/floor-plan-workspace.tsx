"use client";

/**
 * Booking → Floor Plans operational workspace.
 *
 * Opens the event's working (operational) layout for editing and seating.
 * Offer management lives on Event Setup → Change for this event — not here.
 * When a working layout exists, this tab deep-links into that plan's editor.
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  approveClientFloorPlanLayoutAction,
  applyTemplateAction,
  createFloorPlanAction,
  deleteFloorPlanAction,
  duplicateFloorPlanAction,
  ensureWorkingFloorPlanAction,
  renameFloorPlanAction,
  requestClientFloorPlanChangesAction,
  setClientAccessAction,
  decideCoupleFloorPlanPreferenceAction,
  setCoupleShareAction,
  setFloorPlanCoupleMayAddTablesAction,
  setOperationalFloorPlanAction,
  setSeatingInUseFloorPlanAction,
  setVendorAccessAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import {
  clientLayoutStatusLabel,
  normalizeClientLayoutStatus,
  venueMayReviewSubmission,
} from "@/lib/floor-plans/client-layout-review";
import {
  classifyPreferenceApprovalCase,
  normalizeCouplePreferenceStatus,
  venuePreferenceStatusCopy,
} from "@/lib/floor-plans/preference-lifecycle";
import {
  applyClientFloorPlanTemplateAction,
  createClientFloorPlanAction,
  duplicateClientFloorPlanAction,
} from "@/app/(app)/clients/planning-actions";
import { offeredLayoutsView, preferenceReviewIsActionable } from "@/lib/floor-plans/workspace-status";
import { FloorPlanFlipPanel } from "@/components/events/floor-plan-flip-panel";
import { FloorPlanRequiredStatus } from "@/components/events/floor-plan-required-status";
import {
  FloorPlanReviewFlagsPanel,
  LayoutRoomEditorInline,
} from "@/components/events/floor-plan-review-flags-panel";
import { FloorPlanSetupPackagePanel } from "@/components/events/floor-plan-setup-package";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VenueSpace } from "@/lib/availability/types";
import type { EventFloorPlanOfferWithTemplate } from "@/lib/floor-plan-offers/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { FloorPlanTemplate } from "@/lib/floor-plan-templates/types";
import type { InventoryUsage } from "@/lib/inventory/types";

const NO_SPACE = "__none__";

type Method = "apply" | "duplicate" | "blank";

function spaceName(spaces: VenueSpace[], spaceId: string | null): string | null {
  return spaceId ? spaces.find((s) => s.id === spaceId)?.name ?? null : null;
}

function PlanSwitchRow({
  label, hint, on, pending, onToggle, testId,
}: {
  label: string; hint: string; on: boolean; pending: boolean; onToggle: (e: React.MouseEvent) => void; testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={pending}
        onClick={onToggle}
        data-testid={testId}
        className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${on ? "bg-primary" : "bg-input"}`}
      >
        <span className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

/**
 * Seating access toggle. Layout assignment/selection opens seating
 * automatically (client_access=view). This control remains as an override
 * to pause or re-enable seating — not a required post-selection step.
 */
function ShareForSeatingToggle({ eventId, plan }: { eventId: string; plan: FloorPlan }) {
  const router = useRouter();
  const [access, setAccess] = React.useState(plan.clientAccess);
  const [pending, startTransition] = React.useTransition();
  const shared = access !== "hidden";

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = shared ? "hidden" : "view";
    startTransition(async () => {
      const result = await setClientAccessAction(plan.id, eventId, next);
      if (result.ok) { setAccess(next); router.refresh(); }
      else toast.error(result.message ?? "Could not update sharing.");
    });
  }

  return (
    <PlanSwitchRow
      label="Couple can seat guests"
      hint={shared ? "Seating open — they can assign guests to tables." : "Seating paused."}
      on={shared}
      pending={pending}
      onToggle={toggle}
      testId="floor-plan-switch-seating"
    />
  );
}

/** Phase 1 — Share Floor Plan (couple layout view). Independent of Enable Seating. */
function ShareFloorPlanToggle({ eventId, plan }: { eventId: string; plan: FloorPlan }) {
  const router = useRouter();
  const [shared, setShared] = React.useState(plan.sharedWithCouple);
  const [pending, startTransition] = React.useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !shared;
    startTransition(async () => {
      const result = await setCoupleShareAction(plan.id, eventId, next);
      if (result.ok) { setShared(next); router.refresh(); }
      else toast.error(result.message ?? "Could not update Floor Plan sharing.");
    });
  }

  return (
    <PlanSwitchRow
      label="Couple can see it"
      hint="View only, in their portal under Floor Plan."
      on={shared}
      pending={pending}
      onToggle={toggle}
      testId="floor-plan-switch-couple-view"
    />
  );
}

/** Phase 1 — venue sets the durable working-layout pointer for the event (not approval). */
function SetOperationalToggle({
  eventId, plan, isOperational,
}: {
  eventId: string; plan: FloorPlan; isOperational: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await setOperationalFloorPlanAction(eventId, isOperational ? null : plan.id);
      if (result.ok) router.refresh();
      else toast.error(result.message ?? "Could not update working layout.");
    });
  }

  return (
    <Tooltip>
      <TooltipTrigger render={
        <button type="button" onClick={toggle} disabled={pending}
          className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
            isOperational ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
          }`}>
          {pending ? "…" : isOperational ? "Working layout" : "Set as working layout"}
        </button>
      } />
      <TooltipContent>
        {isOperational
          ? "This is the event's working layout pointer. Click to clear. Sharing and seating access stay separate."
          : "Mark this as the working layout for venue prep. This is not approval, and does not grant seating access."}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Vendor Event Assets (Sprint 1) — the only UI that sets shared_with_vendors.
 * A vendor assigned to this event sees this plan in their own "Floor Plans"
 * section the moment it's shared — no PDF export, no manual send required.
 */
function ShareWithVendorsToggle({ eventId, plan }: { eventId: string; plan: FloorPlan }) {
  const router = useRouter();
  const [shared, setShared] = React.useState(plan.sharedWithVendors);
  const [pending, startTransition] = React.useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !shared;
    startTransition(async () => {
      const result = await setVendorAccessAction(plan.id, eventId, next);
      if (result.ok) { setShared(next); router.refresh(); }
      else toast.error(result.message ?? "Could not update sharing.");
    });
  }

  return (
    <PlanSwitchRow
      label="Vendors can see it"
      hint="Any vendor assigned to this event."
      on={shared}
      pending={pending}
      onToggle={toggle}
      testId="floor-plan-switch-vendors"
    />
  );
}

type LayoutTool = "setups" | "flip";

function FloorPlanCard({
  eventId, planningClientId = null, plan, spaces, busy, isOperational, isCoupleSelected, canEdit, canDelete, onRename, onDelete,
  onOpenTool,
}: {
  eventId: string; planningClientId?: string | null; plan: FloorPlan; spaces: VenueSpace[]; busy: boolean;
  isOperational: boolean; isCoupleSelected: boolean;
  canEdit: boolean; canDelete: boolean;
  onRename: () => void; onDelete: () => void;
  onOpenTool?: (tool: LayoutTool) => void;
}) {
  const router = useRouter();
  const preBooking = Boolean(planningClientId) && !eventId;
  function clearWorking() {
    void setOperationalFloorPlanAction(eventId, null).then((result) => {
      if (result.ok) router.refresh();
      else toast.error(result.message ?? "Could not update working layout.");
    });
  }
  return (
    <Link
      href={preBooking
        ? `/clients/${planningClientId}/floor-plans/${plan.id}`
        : `/events/${eventId}/floor-plans/${plan.id}`}
      className="flex flex-col gap-1.5 rounded-sm border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-heading">{plan.name}</p>
        {(canEdit || canDelete) && (
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} aria-label="Floor plan actions" />}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>}
                {canEdit && !preBooking && isOperational && (
                  <DropdownMenuItem onClick={clearWorking} data-testid="floor-plan-clear-working">Clear working layout</DropdownMenuItem>
                )}
                {canEdit && onOpenTool && (
                  <>
                    <DropdownMenuItem onClick={() => onOpenTool("setups")} data-testid="floor-plan-open-setups">
                      Organize wedding setups…
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onOpenTool("flip")} data-testid="floor-plan-open-flip">
                      Link before/after layouts…
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && <DropdownMenuItem onClick={onDelete} className="text-destructive">Delete</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {canEdit && !preBooking ? (
        <LayoutRoomEditorInline eventId={eventId} plan={plan} spaces={spaces} canEdit={canEdit} />
      ) : (
        <p className="text-xs text-muted-foreground">{spaceName(spaces, plan.spaceId) ?? "No space assigned"}</p>
      )}
      {(isOperational || isCoupleSelected || plan.finalizedAt || plan.clientLayoutStatus !== "working") && (
        <div className="flex flex-col gap-1" data-testid="floor-plan-card-status">
          <div className="flex flex-wrap gap-1">
            {isCoupleSelected && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                title="The couple chose this layout as their preference. This is not furniture-placement approval."
                data-testid="floor-plan-card-couple-preference"
              >
                Couple preference
              </span>
            )}
            {isOperational && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary"
                title="Venue working layout for prep. Separate from sharing, seating, and preference."
                data-testid="floor-plan-card-working"
              >
                Working layout
              </span>
            )}
            {plan.finalizedAt && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent-foreground"
                title="Marked Ready for print/setup. Couple furniture edits stay locked until you Make Changes."
                data-testid="floor-plan-card-ready"
              >
                Ready
              </span>
            )}
          </div>
          {plan.clientLayoutStatus !== "working" ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                Furniture placement
              </span>
              {plan.clientLayoutStatus === "submitted" && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900"
                  title="Couple submitted furniture placement for venue review. Separate from layout preference."
                  data-testid="floor-plan-card-submitted"
                >
                  Submitted for review
                </span>
              )}
              {plan.clientLayoutStatus === "changes_requested" && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                  title="You asked the couple to update furniture placement."
                  data-testid="floor-plan-card-changes-requested"
                >
                  Changes requested
                </span>
              )}
              {plan.clientLayoutStatus === "approved" && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary"
                  title="You approved the couple's furniture placement. Not the same as approving their layout preference."
                  data-testid="floor-plan-card-furniture-approved"
                >
                  Venue approved placement
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}
      {canEdit && !preBooking && (
        <div
          className="mt-1 divide-y divide-border/60 border-t border-border/60 pt-1"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          data-testid="floor-plan-card-switches"
        >
          <ShareFloorPlanToggle eventId={eventId} plan={plan} />
          <ShareForSeatingToggle eventId={eventId} plan={plan} />
          <CoupleMayAddTablesToggle eventId={eventId} plan={plan} />
          <ShareWithVendorsToggle eventId={eventId} plan={plan} />
          {!isOperational ? (
            <div className="pt-2">
              <SetOperationalToggle eventId={eventId} plan={plan} isOperational={isOperational} />
            </div>
          ) : null}
        </div>
      )}
      <span className="mt-1 text-xs font-medium text-primary">Open layout →</span>
    </Link>
  );
}

function CoupleMayAddTablesToggle({ eventId, plan }: { eventId: string; plan: FloorPlan }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const allowed = plan.coupleMayAddTables !== false;
  return (
    <PlanSwitchRow
      label="Couple can add tables"
      hint={allowed ? "Client may add tables to this layout." : "Client cannot add tables."}
      on={allowed}
      pending={pending}
      testId="floor-plan-couple-may-add"
      onToggle={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          const result = await setFloorPlanCoupleMayAddTablesAction(plan.id, eventId, !allowed);
          if (!result.ok) {
            toast.error(result.message ?? "Could not update add-furniture setting.");
            return;
          }
          toast.success(allowed ? "Client table adds turned off." : "Client table adds allowed.");
          router.refresh();
        });
      }}
    />
  );
}

function ClientSubmissionReviewPanel({
  eventId,
  plan,
}: {
  eventId: string;
  plan: FloorPlan;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  if (!venueMayReviewSubmission({ clientLayoutStatus: plan.clientLayoutStatus })) return null;

  return (
    <div
      className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-3 space-y-2"
      data-testid="floor-plan-client-submission-review"
    >
      <p className="text-sm font-medium text-heading">
        Furniture placement submitted: <span className="font-semibold">{plan.name}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Submitted{" "}
        {plan.clientSubmittedAt
          ? new Date(plan.clientSubmittedAt).toLocaleString()
          : "recently"}
        . Open the layout to inspect table and furniture placement, then approve or request changes.
        This is not the same as approving their layout preference. Approving placement keeps this
        working layout — it does not create a second copy.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          data-testid="floor-plan-approve-submission"
          onClick={() => {
            startTransition(async () => {
              const result = await approveClientFloorPlanLayoutAction(plan.id, eventId);
              if (!result.ok) {
                toast.error(result.message ?? "Could not approve.");
                return;
              }
              toast.success("Furniture placement approved.");
              router.refresh();
            });
          }}
        >
          Approve furniture placement
        </Button>
        <Link
          href={`/events/${eventId}/floor-plans/${plan.id}`}
          className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium"
          data-testid="floor-plan-open-submission"
        >
          Inspect layout
        </Link>
      </div>
      <div className="space-y-1.5 pt-1">
        <Label htmlFor={`fp-changes-${plan.id}`} className="text-xs">Request changes</Label>
        <Input
          id={`fp-changes-${plan.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What should the couple update?"
          data-testid="floor-plan-changes-note-input"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !note.trim()}
          data-testid="floor-plan-request-changes"
          onClick={() => {
            startTransition(async () => {
              const result = await requestClientFloorPlanChangesAction(plan.id, eventId, note);
              if (!result.ok) {
                toast.error(result.message ?? "Could not request changes.");
                return;
              }
              toast.success("Changes requested — couple can edit again.");
              setNote("");
              router.refresh();
            });
          }}
        >
          Request changes
        </Button>
      </div>
    </div>
  );
}

function PreferenceReviewPanel({
  eventId,
  floorPlans,
  operationalFloorPlanId,
  coupleSelectedFloorPlanId,
  couplePreferenceStatus,
  coupleApprovedFloorPlanId,
  seatingInUseFloorPlanId,
  seatCounts,
  canEdit,
}: {
  eventId: string;
  floorPlans: FloorPlan[];
  operationalFloorPlanId: string | null;
  coupleSelectedFloorPlanId: string | null;
  couplePreferenceStatus: string | null;
  coupleApprovedFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
  seatCounts: Record<string, number>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [caseCChoice, setCaseCChoice] = React.useState<string>("");
  const [confirmB3, setConfirmB3] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const status = normalizeCouplePreferenceStatus(
    couplePreferenceStatus,
    coupleSelectedFloorPlanId,
  );
  const preferred = floorPlans.find((p) => p.id === coupleSelectedFloorPlanId) ?? null;
  const approved = floorPlans.find((p) => p.id === coupleApprovedFloorPlanId) ?? null;
  const working = floorPlans.find((p) => p.id === operationalFloorPlanId) ?? null;
  const preferredShared = Boolean(preferred?.sharedWithCouple);
  const copy = venuePreferenceStatusCopy({
    status,
    preferredName: preferred?.name ?? null,
    approvedName: approved?.name ?? null,
    shared: preferredShared,
    isWorking: Boolean(operationalFloorPlanId),
  });

  const currentSeats = operationalFloorPlanId ? (seatCounts[operationalFloorPlanId] ?? 0) : 0;
  const preferredSeats = coupleSelectedFloorPlanId ? (seatCounts[coupleSelectedFloorPlanId] ?? 0) : 0;
  const approvalCase =
    status === "pending" && coupleSelectedFloorPlanId
      ? classifyPreferenceApprovalCase({
          currentOperationalId: operationalFloorPlanId,
          preferredId: coupleSelectedFloorPlanId,
          currentHasSeats: currentSeats > 0,
          preferredHasSeats: preferredSeats > 0,
        })
      : null;

  function runDecision(
    input:
      | { decision: "decline" }
      | { decision: "defer" }
      | { decision: "approve"; seatingChoice?: "start_on_preferred"; seatingInUseFloorPlanId?: string },
  ) {
    if (!canEdit || !eventId) return;
    setError(null);
    startTransition(async () => {
      const result = await decideCoupleFloorPlanPreferenceAction(eventId, input);
      if (!result.ok) {
        setError(result.message ?? "Could not save that decision.");
        toast.error(result.message ?? "Could not save that decision.");
        return;
      }
      setConfirmB3(false);
      toast.success(
        input.decision === "approve"
          ? "Preference approved. Sharing stays a separate control."
          : input.decision === "decline"
            ? "Preference declined. Prior approved preference preserved."
            : "Preference deferred. Prior approved preference preserved.",
      );
      router.refresh();
    });
  }

  const multipleSeated = floorPlans.filter((p) => (seatCounts[p.id] ?? 0) > 0).length > 1 && canEdit;
  if (!preferenceReviewIsActionable({ status, hasPreferred: Boolean(preferred), multipleSeated, hasError: Boolean(error) })) {
    return null;
  }

  return (
    <div
      className="rounded-md border border-primary/30 bg-card px-3 py-3 text-xs text-foreground space-y-2"
      data-testid="floor-plan-preference-review"
    >
      <p className="text-sm font-medium text-heading" data-testid="floor-plan-preference-headline">
        {copy.headline}
      </p>
      <p className="text-muted-foreground" data-testid="floor-plan-preference-detail">
        {copy.detail}
      </p>
      <p className="text-muted-foreground" data-testid="floor-plan-preference-next">
        {copy.nextStep}
      </p>
      {working && (
        <p className="text-muted-foreground" data-testid="floor-plan-preference-working">
          Current working layout: <span className="font-medium text-foreground">{working.name}</span>
          {currentSeats > 0 ? ` · ${currentSeats} seated guest${currentSeats === 1 ? "" : "s"}` : " · no seating yet"}
        </p>
      )}
      {!working && (
        <p className="text-muted-foreground" data-testid="floor-plan-preference-no-working">
          No working layout is designated. Use <span className="font-medium text-foreground">Set as working layout</span> on a plan — preference alone does not set it.
        </p>
      )}

      {status === "pending" && preferred && canEdit && (
        <div className="space-y-2 pt-1" data-testid="floor-plan-preference-actions">
          {approvalCase === "B" && (
            <div className="rounded border border-border bg-background/80 px-2 py-2 space-y-2" data-testid="floor-plan-case-b">
              <p className="text-muted-foreground">
                The current working layout has seating. Approving the preference keeps those seats on{" "}
                <span className="font-medium text-foreground">{working?.name ?? "the current layout"}</span>
                {" "}and starts seating work on{" "}
                <span className="font-medium text-foreground">{preferred.name}</span>
                {" "}(empty for new assignments). Decline or defer to keep the current arrangement without approving.
              </p>
              {!confirmB3 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  data-testid="floor-plan-approve-b3-prompt"
                  onClick={() => setConfirmB3(true)}
                >
                  Approve and start seating on {preferred.name}
                </Button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    data-testid="floor-plan-approve-b3-confirm"
                    onClick={() => runDecision({ decision: "approve", seatingChoice: "start_on_preferred" })}
                  >
                    {pending ? "Saving…" : "Confirm approve"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-testid="floor-plan-approve-b3-cancel"
                    onClick={() => setConfirmB3(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
          {approvalCase === "C" && operationalFloorPlanId && (
            <div className="rounded border border-border bg-background/80 px-2 py-2 space-y-2" data-testid="floor-plan-case-c">
              <p className="text-muted-foreground">
                Both layouts have seating. Choose which seating arrangement is in use. Both layouts and both assignment sets are preserved.
              </p>
              <div className="flex flex-col gap-1.5">
                {[{ id: operationalFloorPlanId, name: working?.name ?? "Current working", seats: currentSeats },
                  { id: preferred.id, name: preferred.name, seats: preferredSeats }].map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="seating-in-use"
                      value={opt.id}
                      checked={caseCChoice === opt.id}
                      onChange={() => setCaseCChoice(opt.id)}
                      data-testid={`floor-plan-case-c-option-${opt.id}`}
                    />
                    <span>
                      {opt.name}
                      {opt.seats > 0 ? ` · ${opt.seats} seated` : ""}
                    </span>
                  </label>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pending || !caseCChoice}
                data-testid="floor-plan-approve-case-c"
                onClick={() =>
                  runDecision({ decision: "approve", seatingInUseFloorPlanId: caseCChoice })
                }
              >
                {pending ? "Saving…" : "Approve preference with this seating in use"}
              </Button>
            </div>
          )}
          {approvalCase === "A" && (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              data-testid="floor-plan-approve-preference"
              onClick={() => runDecision({ decision: "approve" })}
            >
              {pending ? "Saving…" : "Approve preference"}
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              data-testid="floor-plan-decline-preference"
              onClick={() => runDecision({ decision: "decline" })}
            >
              Decline
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              data-testid="floor-plan-defer-preference"
              onClick={() => runDecision({ decision: "defer" })}
            >
              Defer
            </Button>
          </div>
        </div>
      )}

      {floorPlans.filter((p) => (seatCounts[p.id] ?? 0) > 0).length > 1 && canEdit && (
        <div className="pt-2 border-t border-border/60 space-y-1.5" data-testid="floor-plan-seating-in-use">
          <p className="font-medium text-heading">Seating arrangement in use</p>
          <p className="text-muted-foreground">
            Multiple layouts have seats. Designate which seating arrangement is currently in use. This does not move or clear assignments.
          </p>
          <div className="flex flex-wrap gap-2">
            {floorPlans
              .filter((p) => (seatCounts[p.id] ?? 0) > 0)
              .map((p) => {
                const active = seatingInUseFloorPlanId === p.id;
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    disabled={pending}
                    data-testid={`floor-plan-set-seating-in-use-${p.id}`}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await setSeatingInUseFloorPlanAction(
                          eventId,
                          active ? null : p.id,
                        );
                        if (!result.ok) {
                          toast.error(result.message ?? "Could not update seating in use.");
                          return;
                        }
                        toast.success(
                          active
                            ? "Cleared seating-in-use designation."
                            : `Seating in use: ${p.name}`,
                        );
                        router.refresh();
                      });
                    }}
                  >
                    {active ? `In use: ${p.name}` : `Use seating on ${p.name}`}
                  </Button>
                );
              })}
          </div>
        </div>
      )}

      {error && (
        <p className="text-destructive" data-testid="floor-plan-preference-error">
          {error} You can retry — prior state was not partially rewritten.
        </p>
      )}
    </div>
  );
}

export function FloorPlanWorkspace({
  eventId, planningClientId = null, floorPlans, templates, offers = [], spaces, eventSpaceId,
  operationalFloorPlanId = null, coupleSelectedFloorPlanId = null,
  couplePreferenceStatus = null, coupleApprovedFloorPlanId = null, seatingInUseFloorPlanId = null,
  seatCounts = {},
  inventoryUsage = [],
  canEdit = true, canDelete = true,
}: {
  eventId: string;
  planningClientId?: string | null;
  floorPlans: FloorPlan[];
  templates: FloorPlanTemplate[];
  offers?: EventFloorPlanOfferWithTemplate[];
  spaces: VenueSpace[];
  eventSpaceId: string | null;
  /** Durable SoR pointer from events.operational_floor_plan_id (working layout). */
  operationalFloorPlanId?: string | null;
  /** Couple preference pointer — independent of working layout. */
  coupleSelectedFloorPlanId?: string | null;
  couplePreferenceStatus?: string | null;
  coupleApprovedFloorPlanId?: string | null;
  seatingInUseFloorPlanId?: string | null;
  /** guest_seat_assignments counts keyed by floor_plan_id (venue page). */
  seatCounts?: Record<string, number>;
  /** Reporting only (Inventory Foundation task) — never blocks or reserves anything. */
  inventoryUsage?: InventoryUsage[];
  /** Owner/Manager/Coordinator — create, edit, share. Staff: false. */
  canEdit?: boolean;
  /** Owner/Manager only — delete plan rows. */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [method, setMethod] = React.useState<Method>("blank");
  const [name, setName] = React.useState("");
  const [spaceId, setSpaceId] = React.useState(eventSpaceId ?? NO_SPACE);
  const [templateIds, setTemplateIds] = React.useState<string[]>([]);
  const [sourcePlanId, setSourcePlanId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [busyPlanId, setBusyPlanId] = React.useState<string | null>(null);
  const [ensuring, setEnsuring] = React.useState(false);
  const ensureAttempted = React.useRef(false);

  function reset() {
    setMethod("blank"); setName(""); setSpaceId(eventSpaceId ?? NO_SPACE); setTemplateIds([]); setSourcePlanId("");
  }

  function toggleTemplate(id: string) {
    setTemplateIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length === 1) {
        const t = templates.find((x) => x.id === next[0]);
        if (t) {
          if (!name.trim()) setName(t.name);
          setSpaceId(t.spaceId ?? eventSpaceId ?? NO_SPACE);
        }
      } else if (next.length > 1) {
        setName("");
      }
      return next;
    });
  }

  function handleRenamePlan(plan: FloorPlan) {
    const next = window.prompt("Rename floor plan", plan.name);
    if (!next || !next.trim() || next.trim() === plan.name) return;
    setBusyPlanId(plan.id);
    startTransition(async () => {
      const result = await renameFloorPlanAction(plan.id, eventId || planningClientId || "", next.trim());
      setBusyPlanId(null);
      if (result.ok) { toast.success("Floor plan renamed."); router.refresh(); }
      else toast.error(result.message ?? "Could not rename floor plan.");
    });
  }

  function handleDeletePlan(plan: FloorPlan) {
    if (!confirm(`Delete "${plan.name}"? This removes every object on it and can't be undone.`)) return;
    setBusyPlanId(plan.id);
    startTransition(async () => {
      const result = await deleteFloorPlanAction(plan.id, eventId || planningClientId || "");
      setBusyPlanId(null);
      if (result.ok) { toast.success("Floor plan deleted."); router.refresh(); }
      else toast.error(result.message ?? "Could not delete floor plan.");
    });
  }

  function handleSourceChange(id: string) {
    setSourcePlanId(id);
    const p = floorPlans.find((x) => x.id === id);
    if (p) {
      if (!name.trim()) setName(`${p.name} (Copy)`);
      setSpaceId(p.spaceId ?? NO_SPACE);
    }
  }

  function handleSubmit() {
    if (method === "apply" && templateIds.length === 0) return;
    if (method === "apply" && templateIds.length === 1 && !name.trim()) return;
    if (method !== "apply" && !name.trim()) return;
    if (method === "duplicate" && !sourcePlanId) return;
    const resolvedSpaceId = spaceId === NO_SPACE ? null : spaceId;

    startTransition(async () => {
      const preBooking = Boolean(planningClientId) && !eventId;

      if (method === "apply") {
        const createdIds: string[] = [];
        for (const tid of templateIds) {
          const t = templates.find((x) => x.id === tid);
          const planName =
            templateIds.length === 1
              ? name.trim()
              : (t?.name?.trim() || "Floor Plan");
          const planSpace = templateIds.length === 1
            ? resolvedSpaceId
            : (t?.spaceId ?? resolvedSpaceId);
          const result = preBooking
            ? await applyClientFloorPlanTemplateAction(planningClientId!, tid, planName, planSpace)
            : await applyTemplateAction(eventId, tid, planName, planSpace);
          if (!result.ok) {
            toast.error(result.message ?? "Could not apply template.");
            if (createdIds.length > 0) router.refresh();
            return;
          }
          createdIds.push(result.floorPlanId);
        }
        setOpen(false);
        reset();
        if (createdIds.length === 1) {
          router.push(preBooking
            ? `/clients/${planningClientId}/floor-plans/${createdIds[0]}`
            : `/events/${eventId}/floor-plans/${createdIds[0]}`);
        } else {
          toast.success(`Applied ${createdIds.length} floor-plan templates.`);
          router.refresh();
        }
        return;
      }

      const result = method === "duplicate"
        ? (preBooking
          ? await duplicateClientFloorPlanAction(planningClientId!, sourcePlanId, name.trim(), resolvedSpaceId)
          : await duplicateFloorPlanAction(eventId, sourcePlanId, name.trim(), resolvedSpaceId))
        : (preBooking
          ? await createClientFloorPlanAction(planningClientId!, name.trim(), resolvedSpaceId)
          : await createFloorPlanAction(eventId, name.trim(), resolvedSpaceId));

      if (result.ok) {
        setOpen(false);
        reset();
        router.push(preBooking
          ? `/clients/${planningClientId}/floor-plans/${result.floorPlanId}`
          : `/events/${eventId}/floor-plans/${result.floorPlanId}`);
      } else {
        toast.error(result.message ?? "Could not create floor plan.");
      }
    });
  }

  const canSubmit =
    method === "apply"
      ? templateIds.length > 0 && (templateIds.length > 1 || !!name.trim())
      : !!name.trim() && (method !== "duplicate" || !!sourcePlanId);
  const submitLabel =
    method === "apply"
      ? (templateIds.length > 1 ? `Apply ${templateIds.length} templates` : "Apply")
      : method === "duplicate"
        ? "Duplicate"
        : "Create Floor Plan";
  const preBooking = Boolean(planningClientId) && !eventId;

  const sharedPlans = floorPlans.filter((p) => p.clientAccess !== "hidden");
  const activeOffers = offers.filter((o) => o.isOffered);
  const offeredLayouts = offeredLayoutsView(offers, floorPlans, coupleSelectedFloorPlanId);
  const [tool, setTool] = React.useState<LayoutTool | null>(null);
  const openTool = !preBooking && eventId && canEdit ? setTool : undefined;
  const workingPlan =
    (operationalFloorPlanId && floorPlans.find((p) => p.id === operationalFloorPlanId))
    || null;
  const otherPlans = floorPlans.filter((p) => p.id !== workingPlan?.id);

  // Stay on this workspace — do not auto-redirect into the designer.
  // When offers exist but no operational plan yet, ensure once and refresh
  // so the working card appears; staff open the editor via the card link.
  React.useEffect(() => {
    if (preBooking || !eventId || !canEdit) return;
    if (operationalFloorPlanId) return;
    if (ensureAttempted.current) return;
    if (activeOffers.length === 0) return;
    ensureAttempted.current = true;
    setEnsuring(true);
    void (async () => {
      const result = await ensureWorkingFloorPlanAction(eventId, null);
      setEnsuring(false);
      if (!result.ok) {
        toast.error(result.message ?? "Could not initialize working layout.");
        return;
      }
      router.refresh();
    })();
  }, [preBooking, eventId, canEdit, operationalFloorPlanId, activeOffers.length, router]);

  return (
    <div className="space-y-4" data-testid="floor-plan-operational-workspace">
      {!preBooking && eventId ? <FloorPlanRequiredStatus eventId={eventId} floorPlans={floorPlans} /> : null}

      {preBooking ? (
        <p className="text-sm text-muted-foreground" data-testid="floor-plan-workspace-intro">
          Sketch the room for this client. Sharing with the couple waits until this relationship is Booked.
        </p>
      ) : null}

      {!preBooking && (
        <div
          className="rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground"
          data-testid="floor-plan-selection-status"
        >
          {coupleSelectedFloorPlanId ? (
            (() => {
              const selected = floorPlans.find((p) => p.id === coupleSelectedFloorPlanId);
              const pick = (
                <span data-testid="floor-plan-client-selected">
                  Couple&apos;s pick: <span className="font-medium">{selected?.name ?? "Saved layout"}</span>.{" "}
                </span>
              );
              if (!selected) return <p>{pick}</p>;
              const seatingOpen = selected.clientAccess !== "hidden";
              const ready = Boolean(selected.finalizedAt);
              const layoutStatus = normalizeClientLayoutStatus(selected.clientLayoutStatus);
              if (normalizeCouplePreferenceStatus(couplePreferenceStatus, coupleSelectedFloorPlanId) === "pending") {
                return <p data-testid="floor-plan-next-review-preference">{pick}Review it below.</p>;
              }
              if (layoutStatus === "submitted") {
                return (
                  <p data-testid="floor-plan-next-review-submission">
                    {pick}They sent their furniture placement ({clientLayoutStatusLabel(layoutStatus)}) — review it below.
                  </p>
                );
              }
              if (selected.sharedWithCouple && !seatingOpen) {
                return (
                  <p data-testid="floor-plan-next-share-seating">
                    {pick}Shared, but seating is paused — turn on &quot;Couple can seat guests&quot; if they should seat guests.
                  </p>
                );
              }
              if (layoutStatus === "changes_requested") {
                return <p data-testid="floor-plan-next-awaiting-resubmit">{pick}Waiting for them to update their furniture placement.</p>;
              }
              if (ready) {
                return (
                  <p data-testid="floor-plan-ready-confirmed">
                    {pick}Ready for the day. Couple edits are locked until you make changes.
                  </p>
                );
              }
              if (layoutStatus === "approved" || (selected.sharedWithCouple && seatingOpen)) {
                return (
                  <p data-testid="floor-plan-next-mark-ready">
                    {pick}Open it and <span className="font-medium">Mark as Ready</span> when it&apos;s set for the day.
                  </p>
                );
              }
              return (
                <p data-testid="floor-plan-preference-awaiting-share">
                  {pick}Turn on &quot;Couple can see it&quot; when they should see it.
                </p>
              );
            })()
          ) : activeOffers.length === 1 ? (
            <p data-testid="floor-plan-sole-offer-working">
              One layout is offered to the couple
              {workingPlan ? <> — you&apos;re preparing <span className="font-medium">{workingPlan.name}</span>.</> : "."}
            </p>
          ) : activeOffers.length > 1 ? (
            <p data-testid="floor-plan-client-pending">
              The couple is choosing between {activeOffers.length} layouts — nothing picked yet.
            </p>
          ) : workingPlan ? (
            <p data-testid="floor-plan-no-offers-status">
              You&apos;re preparing <span className="font-medium">{workingPlan.name}</span>. Turn on &quot;Couple can see it&quot; when they should see it.
            </p>
          ) : (
            <p data-testid="floor-plan-no-offers-status">No layout yet — add one below.</p>
          )}
        </div>
      )}

      {!preBooking && eventId && offeredLayouts.length > 0 ? (
        <div className="space-y-1.5" data-testid="floor-plan-offered-layouts">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layouts offered to the couple</p>
            <button
              type="button"
              className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
              data-testid="floor-plan-edit-offers"
              onClick={() => {
                window.location.hash = "overview";
                window.setTimeout(() => {
                  document.getElementById("event-setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 80);
              }}
            >
              Edit options
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {offeredLayouts.map((o) => (
              <li
                key={o.id}
                className={`rounded-md border px-3 py-1.5 text-xs ${o.isCouplePick ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground"}`}
                data-testid="floor-plan-offered-layout"
                data-couple-pick={o.isCouplePick ? "true" : "false"}
              >
                {o.label}
                {o.isCouplePick ? <span className="ml-1.5 font-semibold text-primary">· Couple&apos;s pick</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!preBooking && eventId && (
        <PreferenceReviewPanel
          eventId={eventId}
          floorPlans={floorPlans}
          operationalFloorPlanId={operationalFloorPlanId}
          coupleSelectedFloorPlanId={coupleSelectedFloorPlanId}
          couplePreferenceStatus={couplePreferenceStatus}
          coupleApprovedFloorPlanId={coupleApprovedFloorPlanId}
          seatingInUseFloorPlanId={seatingInUseFloorPlanId}
          seatCounts={seatCounts}
          canEdit={canEdit}
        />
      )}

      {!preBooking && eventId ? (
        <FloorPlanReviewFlagsPanel
          eventId={eventId}
          floorPlans={floorPlans}
          spaces={spaces}
          canEdit={canEdit}
          hideWhenEmpty
        />
      ) : null}

      {!preBooking && eventId ? (
        <Sheet open={tool !== null} onOpenChange={(next) => { if (!next) setTool(null); }}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl" data-testid="floor-plan-tool-sheet">
            <SheetHeader>
              <SheetTitle>{tool === "flip" ? "Link before/after layouts" : "Organize wedding setups"}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              {tool === "setups" ? (
                <FloorPlanSetupPackagePanel eventId={eventId} floorPlans={floorPlans} canEdit={canEdit} />
              ) : tool === "flip" ? (
                <FloorPlanFlipPanel eventId={eventId} floorPlans={floorPlans} canEdit={canEdit} />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {!preBooking && eventId
        ? floorPlans
            .filter((p) => venueMayReviewSubmission({ clientLayoutStatus: p.clientLayoutStatus }))
            .map((submitted) => (
              <ClientSubmissionReviewPanel key={submitted.id} eventId={eventId} plan={submitted} />
            ))
        : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!preBooking && sharedPlans.length > 0 && (
          <Button type="button" variant="outline" render={<Link href={`/events/${eventId}/seating`} />}>
            Open Event Day Seating
          </Button>
        )}
        {canEdit ? (
          <Button type="button" variant="outline" onClick={() => { reset(); setOpen(true); }}>
            + Additional layout
          </Button>
        ) : null}
      </div>
      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          View-only — ask an Owner, Manager, or Coordinator to create or edit floor plans.
        </p>
      )}

      {ensuring ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="floor-plan-ensuring-working">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening this event&apos;s working layout…
        </p>
      ) : null}

      {sharedPlans.length > 1 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
          {sharedPlans.length} floor plans are shared for Seating. Each plan is independent — Ceremony,
          Reception, and backup seating stay separate. The couple chooses which plan they are working
          on; sharing one does not replace another.
        </div>
      )}

      {!ensuring && !workingPlan && floorPlans.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border py-12 px-4 text-center"
          data-testid="floor-plan-empty-no-working"
        >
          <p className="text-sm font-medium text-heading">No layout for this event yet</p>
          <p className="max-w-md text-xs text-muted-foreground">
            {activeOffers.length === 1
              ? "One layout is already offered. Refresh if it does not appear, or confirm the offer under Event setup."
              : activeOffers.length > 1
                ? "Several layouts are offered. Open one and choose Set as working layout — the couple's preference alone does not pick it."
                : "Add a layout to arrange the room. Share it when the couple should see it."}
          </p>
          {canEdit && activeOffers.length === 0 ? (
            <div className="mt-2 flex flex-col items-center gap-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  data-testid="floor-plan-first-additional-layout-cta"
                  onClick={() => { reset(); setOpen(true); }}
                >
                  + Add a layout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="floor-plan-first-layout-setup-cta"
                  onClick={() => {
                    window.location.hash = "overview";
                    window.setTimeout(() => {
                      document.getElementById("event-setup")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 80);
                  }}
                >
                  Offer options in Event setup
                </Button>
              </div>
              <p className="max-w-md text-[11px] text-muted-foreground" data-testid="floor-plan-first-use-path-hint">
                Most events start with Add a layout here. Offer options in Event setup only when the couple should choose among layouts.
              </p>
            </div>
          ) : canEdit ? (
            <Button type="button" size="sm" className="mt-2" variant="outline" onClick={() => { reset(); setOpen(true); }}>
              + Add a layout
            </Button>
          ) : null}
        </div>
      ) : !ensuring && workingPlan ? (
        <div className="space-y-3" data-testid="floor-plan-working-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working layout</p>
          <FloorPlanCard
            eventId={eventId}
            planningClientId={planningClientId}
            plan={workingPlan}
            spaces={spaces}
            busy={busyPlanId === workingPlan.id}
            isOperational
            isCoupleSelected={coupleSelectedFloorPlanId === workingPlan.id}
            canEdit={canEdit}
            canDelete={canDelete}
            onRename={() => handleRenamePlan(workingPlan)}
            onDelete={() => handleDeletePlan(workingPlan)}
            onOpenTool={openTool}
          />
          {otherPlans.length > 0 ? (
            <div className="space-y-2" data-testid="floor-plan-other-layouts">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other layouts on this event</p>
              <p className="text-[11px] text-muted-foreground" data-testid="floor-plan-multi-layout-note">
                These layouts coexist on this event. They are independent copies — not a finished setup-package or
                multi-phase system.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherPlans.map((plan) => (
                  <FloorPlanCard
                    key={plan.id}
                    eventId={eventId}
                    planningClientId={planningClientId}
                    plan={plan}
                    spaces={spaces}
                    busy={busyPlanId === plan.id}
                    isOperational={operationalFloorPlanId === plan.id}
                    isCoupleSelected={coupleSelectedFloorPlanId === plan.id}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onRename={() => handleRenamePlan(plan)}
                    onDelete={() => handleDeletePlan(plan)}
                    onOpenTool={openTool}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : !ensuring && floorPlans.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {floorPlans.map((plan) => (
            <FloorPlanCard
              key={plan.id} eventId={eventId} planningClientId={planningClientId} plan={plan} spaces={spaces}
              busy={busyPlanId === plan.id}
              isOperational={operationalFloorPlanId === plan.id}
              isCoupleSelected={coupleSelectedFloorPlanId === plan.id}
              canEdit={canEdit}
              canDelete={canDelete}
              onRename={() => handleRenamePlan(plan)}
              onDelete={() => handleDeletePlan(plan)}
              onOpenTool={openTool}
            />
          ))}
        </div>
      ) : null}

      {inventoryUsage.length > 0 && (
        <div className="space-y-2 rounded-sm border border-border bg-muted/20 p-4" data-testid="floor-plan-workspace-inventory-usage">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inventory Usage</p>
          <p className="text-[11px] text-muted-foreground">
            Available is venue inventory on hand. Used is linked objects across this event&apos;s
            floor plans. Remaining = Available − Used.
          </p>
          <ul className="space-y-1">
            {inventoryUsage.map((u) => {
              const remaining = u.quantityAvailable - u.quantityUsed;
              return (
                <li key={u.itemId} className={`flex items-center justify-between text-sm ${remaining < 0 ? "text-destructive" : ""}`}>
                  <span className={remaining < 0 ? "" : "text-foreground"}>{u.name}</span>
                  <span className={remaining < 0 ? "" : "text-muted-foreground"}>
                    {u.quantityUsed} used on event · {u.quantityAvailable} available at venue · {remaining} remaining
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>How would you like to start?</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)}>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="apply" disabled={templates.length === 0} />
                Apply Template
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="duplicate" disabled={floorPlans.length === 0} />
                Duplicate Existing Floor Plan
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="blank" />
                Blank Floor Plan
              </label>
            </RadioGroup>

            {method === "apply" && (
              <div className="space-y-2" data-testid="floor-plan-apply-templates">
                <Label className="text-xs">Templates</Label>
                <p className="text-[11px] text-muted-foreground">
                  Select one or more. Each template becomes its own independent floor plan on this booking.
                </p>
                {templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No templates in your library yet.</p>
                ) : (
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                    {templates.map((t) => (
                      <li key={t.id}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={templateIds.includes(t.id)}
                            onChange={() => toggleTemplate(t.id)}
                            data-testid={`floor-plan-template-${t.id}`}
                          />
                          <span className="min-w-0">
                            <span className="font-medium text-foreground">{t.name}</span>
                            {t.spaceId ? (
                              <span className="block text-[11px] text-muted-foreground">
                                {spaceName(spaces, t.spaceId) ?? "Linked space"}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {method === "duplicate" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Existing floor plan</Label>
                <Select value={sourcePlanId} onValueChange={handleSourceChange} items={floorPlans.map((p) => ({ value: p.id, label: p.name }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choose a floor plan" /></SelectTrigger>
                  <SelectContent>
                    {floorPlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(method !== "apply" || templateIds.length <= 1) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Floor Plan Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reception" className="h-9 text-sm" />
              </div>
            )}
            {method === "apply" && templateIds.length > 1 ? (
              <p className="text-[11px] text-muted-foreground">
                Each plan is named after its template. You can rename plans afterward.
              </p>
            ) : null}

            {(method !== "apply" || templateIds.length <= 1) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Venue Space (optional if inherited)</Label>
                <Select value={spaceId} onValueChange={setSpaceId} items={[{ value: NO_SPACE, label: "No specific space" }, ...spaces.map((s) => ({ value: s.id, label: s.name }))]}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SPACE}>No specific space</SelectItem>
                    {spaces.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={pending}>Cancel</Button>
            <Button type="button" disabled={!canSubmit || pending} onClick={handleSubmit}>
              {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : submitLabel}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
