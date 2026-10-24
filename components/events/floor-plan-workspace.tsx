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
  setCoupleShareAction,
  setFloorPlanCoupleMayAddTablesAction,
  setOperationalFloorPlanAction,
  setVendorAccessAction,
} from "@/app/(app)/events/[id]/floor-plan-actions";
import {
  clientLayoutStatusLabel,
  normalizeClientLayoutStatus,
  venueMayReviewSubmission,
} from "@/lib/floor-plans/client-layout-review";
import {
  applyClientFloorPlanTemplateAction,
  createClientFloorPlanAction,
  duplicateClientFloorPlanAction,
} from "@/app/(app)/clients/planning-actions";
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
    <Tooltip>
      <TooltipTrigger render={
        <button type="button" onClick={toggle} disabled={pending}
          className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
            shared ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
          }`}>
          {pending ? "…" : shared ? "Seating open" : "Seating paused"}
        </button>
      } />
      <TooltipContent>
        {shared
          ? "Couple can assign guests to tables. Click to pause seating access."
          : "Seating is paused. Assignment and selection open seating automatically; use this only to re-enable."}
      </TooltipContent>
    </Tooltip>
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
    <Tooltip>
      <TooltipTrigger render={
        <button type="button" onClick={toggle} disabled={pending}
          className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
            shared ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
          }`}>
          {pending ? "…" : shared ? "Shared Floor Plan" : "Share Floor Plan"}
        </button>
      } />
      <TooltipContent>
        {shared
          ? "Couple can view this layout in Your Wedding → Floor Plan. Click to unshare."
          : "Share this layout for the couple to view (reference-only). Independent of Seating."}
      </TooltipContent>
    </Tooltip>
  );
}

/** Phase 1 — venue sets the durable operational Floor Plan for the event. */
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
      else toast.error(result.message ?? "Could not update operational Floor Plan.");
    });
  }

  return (
    <Tooltip>
      <TooltipTrigger render={
        <button type="button" onClick={toggle} disabled={pending}
          className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
            isOperational ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
          }`}>
          {pending ? "…" : isOperational ? "Operational plan" : "Set as operational"}
        </button>
      } />
      <TooltipContent>
        {isOperational
          ? "This is the event's operational Floor Plan. Click to clear."
          : "Mark this as the Floor Plan this event is actually using."}
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
    <Tooltip>
      <TooltipTrigger render={
        <button type="button" onClick={toggle} disabled={pending}
          className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
            shared ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
          }`}>
          {pending ? "…" : shared ? "Shared with Vendors" : "Share with Vendors"}
        </button>
      } />
      <TooltipContent>
        {shared ? "Visible to any vendor assigned to this event. Click to unshare." : "Not visible to vendors yet. Click to share."}
      </TooltipContent>
    </Tooltip>
  );
}

function FloorPlanCard({
  eventId, planningClientId = null, plan, spaces, busy, isOperational, isCoupleSelected, canEdit, canDelete, onRename, onDelete,
}: {
  eventId: string; planningClientId?: string | null; plan: FloorPlan; spaces: VenueSpace[]; busy: boolean;
  isOperational: boolean; isCoupleSelected: boolean;
  canEdit: boolean; canDelete: boolean;
  onRename: () => void; onDelete: () => void;
}) {
  const preBooking = Boolean(planningClientId) && !eventId;
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
                {canDelete && <DropdownMenuItem onClick={onDelete} className="text-destructive">Delete</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{spaceName(spaces, plan.spaceId) ?? "No space assigned"}</p>
      {(isOperational || isCoupleSelected || plan.finalizedAt || plan.clientLayoutStatus !== "working") && (
        <div className="flex flex-wrap gap-1">
          {plan.finalizedAt && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent-foreground">
              Ready
            </span>
          )}
          {plan.clientLayoutStatus === "submitted" && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900"
              data-testid="floor-plan-card-submitted"
            >
              Client submitted
            </span>
          )}
          {plan.clientLayoutStatus === "changes_requested" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              Changes requested
            </span>
          )}
          {plan.clientLayoutStatus === "approved" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary">
              Client approved
            </span>
          )}
          {isCoupleSelected && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              Couple selected
            </span>
          )}
          {isOperational && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary">
              Operational
            </span>
          )}
        </div>
      )}
      {canEdit && !preBooking && (
        <div className="flex flex-wrap gap-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <ShareFloorPlanToggle eventId={eventId} plan={plan} />
          <ShareForSeatingToggle eventId={eventId} plan={plan} />
          <ShareWithVendorsToggle eventId={eventId} plan={plan} />
          <SetOperationalToggle eventId={eventId} plan={plan} isOperational={isOperational} />
          <CoupleMayAddTablesToggle eventId={eventId} plan={plan} />
        </div>
      )}
    </Link>
  );
}

function CoupleMayAddTablesToggle({ eventId, plan }: { eventId: string; plan: FloorPlan }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const allowed = plan.coupleMayAddTables !== false;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 text-[11px]"
      disabled={pending}
      data-testid="floor-plan-couple-may-add"
      onClick={() => {
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
    >
      {allowed ? "Client may add tables" : "Client cannot add tables"}
    </Button>
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
        Client submitted: <span className="font-semibold">{plan.name}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Submitted{" "}
        {plan.clientSubmittedAt
          ? new Date(plan.clientSubmittedAt).toLocaleString()
          : "recently"}
        . Open the layout to inspect, then approve or request changes. The operational plan is this
        working layout — approval does not create a second copy.
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
              toast.success("Client layout approved.");
              router.refresh();
            });
          }}
        >
          Approve layout
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

export function FloorPlanWorkspace({
  eventId, planningClientId = null, floorPlans, templates, offers = [], spaces, eventSpaceId,
  operationalFloorPlanId = null, coupleSelectedFloorPlanId = null, inventoryUsage = [],
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
  /** Client's confirmed layout choice — may match operational after portal select. */
  coupleSelectedFloorPlanId?: string | null;
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
      <p className="text-sm text-muted-foreground">
        {preBooking
          ? "Sketch the room for this client. Sharing a plan and client layout choice wait until this relationship is Booked."
          : (
            <>
              Review offers, the event&apos;s <span className="font-medium text-foreground">working layout</span>, and
              whether the client has selected a layout. Open a plan to edit arrangement and seating. Offer Library
              layouts under Event setup → Change for this event.
            </>
          )}
      </p>

      {!preBooking && (
        <div
          className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1"
          data-testid="floor-plan-selection-status"
        >
          {coupleSelectedFloorPlanId ? (
            <>
              <p data-testid="floor-plan-client-selected">
                Client selected:{" "}
                <span className="font-medium text-foreground">
                  {floorPlans.find((p) => p.id === coupleSelectedFloorPlanId)?.name ?? "Saved layout"}
                </span>
                {" "}(working layout view is shared with the couple).
              </p>
              {(() => {
                const selected = floorPlans.find((p) => p.id === coupleSelectedFloorPlanId);
                if (!selected) return null;
                const seatingOpen = selected.clientAccess !== "hidden";
                const ready = Boolean(selected.finalizedAt);
                const status = normalizeClientLayoutStatus(selected.clientLayoutStatus);
                if (status === "submitted") {
                  return (
                    <p data-testid="floor-plan-next-review-submission">
                      Client submitted this layout for review ({clientLayoutStatusLabel(status)}).
                      Use the review panel below to approve or request changes before{" "}
                      <span className="font-medium text-foreground">Mark as Ready</span>.
                    </p>
                  );
                }
                if (!seatingOpen) {
                  return (
                    <p data-testid="floor-plan-next-share-seating">
                      Seating was paused on this layout. Re-open seating from the plan card if the couple should assign guests again.
                    </p>
                  );
                }
                if (status === "changes_requested") {
                  return (
                    <p data-testid="floor-plan-next-awaiting-resubmit">
                      You asked the couple for updates. They can edit again and resubmit.
                    </p>
                  );
                }
                if (status === "approved" && !ready) {
                  return (
                    <p data-testid="floor-plan-next-mark-ready-after-approve">
                      Client layout is approved. When print/setup-ready, open it and{" "}
                      <span className="font-medium text-foreground">Mark as Ready</span>.
                    </p>
                  );
                }
                if (!ready) {
                  return (
                    <p data-testid="floor-plan-next-mark-ready">
                      Layout and seating are available to the couple. They can rearrange unlocked furniture and submit
                      when ready. When the arrangement is print/setup-ready, open it and{" "}
                      <span className="font-medium text-foreground">Mark as Ready</span>.
                    </p>
                  );
                }
                return (
                  <p data-testid="floor-plan-ready-confirmed">
                    Working layout is <span className="font-medium text-foreground">Ready</span> for the event.
                    Couple edits are locked until you Make Changes.
                  </p>
                );
              })()}
            </>
          ) : activeOffers.length === 1 ? (
            <p data-testid="floor-plan-sole-offer-working">
              Sole offered layout is assigned as the working layout
              {workingPlan ? ` (${workingPlan.name})` : ""}. Layout and seating open automatically for the couple.
            </p>
          ) : activeOffers.length > 1 ? (
            <p data-testid="floor-plan-client-pending">
              Client has not selected a layout yet. Working layout
              {workingPlan ? ` is ${workingPlan.name}` : " will initialize from the preferred offer"} for venue prep.
            </p>
          ) : (
            <p data-testid="floor-plan-no-offers-status">
              No layouts are offered for this event yet. Use Event setup → Change for this event to offer a Library layout.
            </p>
          )}
        </div>
      )}

      {!preBooking && coupleSelectedFloorPlanId && (() => {
        const submitted = floorPlans.find((p) => p.id === coupleSelectedFloorPlanId);
        return submitted ? <ClientSubmissionReviewPanel eventId={eventId} plan={submitted} /> : null;
      })()}

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
          <p className="text-sm font-medium text-heading">No working layout for this event yet</p>
          <p className="max-w-md text-xs text-muted-foreground">
            {activeOffers.length > 0
              ? "A working layout should initialize from the offered layouts. Refresh, or open Event setup → Change for this event if it does not appear."
              : "Offer a Library layout under Event setup → Change for this event. That establishes the working layout so you can edit and assign seats here."}
          </p>
          {canEdit && (
            <Button type="button" size="sm" className="mt-2" variant="outline" onClick={() => { reset(); setOpen(true); }}>
              + Additional layout
            </Button>
          )}
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
          />
          {otherPlans.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other layouts on this event</p>
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
            />
          ))}
        </div>
      ) : null}

      {inventoryUsage.length > 0 && (
        <div className="space-y-2 rounded-sm border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inventory Usage</p>
          <ul className="space-y-1">
            {inventoryUsage.map((u) => {
              const remaining = u.quantityAvailable - u.quantityUsed;
              return (
                <li key={u.itemId} className={`flex items-center justify-between text-sm ${remaining < 0 ? "text-destructive" : ""}`}>
                  <span className={remaining < 0 ? "" : "text-foreground"}>{u.name}</span>
                  <span className={remaining < 0 ? "" : "text-muted-foreground"}>
                    {u.quantityUsed} used · {u.quantityAvailable} available · {remaining} remaining
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
