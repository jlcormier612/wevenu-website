"use client";

import * as React from "react";

import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addSectionAction, applyEventOrderTemplateAction, ensureEventOrderAction, finalizeEventOrderAction, getEventOrderPdfUrlAction,
  removeLineAction, removeSectionAction, reopenEventOrderAction, setSectionFloorPlanSetupAction,
  shareEventOrderWithClientAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { ensureClientEventOrderAction } from "@/app/(app)/clients/planning-actions";
import { listSetupsWithMembersAction } from "@/app/(app)/events/[id]/floor-plan-actions";
import { getEventOrderTemplateDetailAction } from "@/app/(app)/library/event-order-templates/actions";
import { ApplyEventOrderTemplateSheet } from "@/components/event-order-templates/apply-event-order-template-sheet";
import { AddLineSheet } from "@/components/event-orders/add-line-sheet";
import { EditLineSheet } from "@/components/event-orders/edit-line-sheet";
import { EventOrderInvoiceLink } from "@/components/event-orders/event-order-invoice-link";
import { EventOrderZeroTotalConfirmDialog } from "@/components/event-orders/zero-total-confirm";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DISPLAY_STATUS_LABEL, eventOrderDisplayStatus, formatMoney, formatOptionalMoney } from "@/lib/event-orders/constants";
import { eventOrderRequiresZeroTotalWarning } from "@/lib/event-orders/zero-total-warning";
import {
  NO_COUPLE_CHOICES_MESSAGE, coupleChoicePreview, pickActiveChoices,
} from "@/lib/client-choices/couple-choice-preview";
import type { ClientChoicesWithHistory } from "@/lib/client-choices/types";
import { isBillableEventOrderLineForInvoice } from "@/lib/client-choices/unbilled-delta";
import type { EventOrderDisplayStatus, EventOrderLine, EventOrderSection, EventOrderWithDetails } from "@/lib/event-orders/types";
import type { EventOrderTemplate, EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";
import { matchChoiceGroupsToSections, splitSetupLines, staffLineNotesLabel } from "@/lib/event-orders/document-view";
import { resolveSectionSetup } from "@/lib/floor-plans/required-vs-placed";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Invoice } from "@/lib/invoices/types";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";
import type { Offering } from "@/lib/offerings/types";
import type { Package, PackageWithItems } from "@/lib/packages/types";
import { useRouter } from "next/navigation";

const STATUS_VARIANT: Record<EventOrderDisplayStatus, "outline" | "accent" | "muted"> = {
  open: "outline", finalized: "accent", amended: "muted",
};

type EventOrderOverview = {
  eventName?: string | null;
  eventDate: string | null;
  eventType?: string | null;
  guestCount: number | null;
  spaceName: string | null;
  ceremonyStartTime: string | null;
  receptionStartTime: string | null;
};

function LineRow({
  line, sections, eventOrderId, eventId, canEdit, onRemove, removing, inventoryName,
}: {
  line: EventOrderLine;
  sections: EventOrderSection[];
  eventOrderId: string;
  eventId: string;
  canEdit: boolean;
  onRemove: () => void;
  removing: boolean;
  inventoryName?: string | null;
}) {
  const notesLabel = staffLineNotesLabel(line.notes);
  return (
    <div
      className="grid grid-cols-1 gap-2 border-b border-border py-3 last:border-0 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center sm:gap-2 text-sm"
      data-testid="eo-line"
      data-provenance={line.provenance}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground">{line.description}</span>
          {line.isIncluded ? (
            <span className="text-[10px] text-muted-foreground" data-testid="eo-line-included-extra">Included · $0 extra</span>
          ) : null}
        </div>
        {(notesLabel || line.unit || inventoryName) && (
          <p className="mt-0.5 text-xs text-muted-foreground" data-testid="eo-line-meta">
            {[
              line.unit ? `Unit: ${line.unit}` : null,
              inventoryName ? `Uses inventory: ${inventoryName}` : null,
              notesLabel,
            ].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <span className="text-muted-foreground sm:text-right sm:w-14">{line.quantity}×</span>
      <span className="text-muted-foreground sm:text-right sm:w-20">{formatOptionalMoney(line.unitPrice)}</span>
      <span className="font-medium sm:text-right sm:w-20">{formatMoney(line.amount)}</span>
      {canEdit && (
        <div className="flex items-center gap-1 sm:justify-end">
          <EditLineSheet eventOrderId={eventOrderId} eventId={eventId} line={line} sections={sections} />
          <button type="button" onClick={onRemove} disabled={removing}
            className="rounded p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Remove">
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

type CouplePreview = ReturnType<typeof coupleChoicePreview>;
type CoupleGroup = Extract<CouplePreview, { groups: unknown }>["groups"][number];

/** Source line + any choice groups that don't belong to an Event Order section. */
function CoupleWillChooseSection({
  loading, preview, unmatched,
}: {
  loading: boolean;
  preview: CouplePreview;
  unmatched: CoupleGroup[];
}) {
  const showSelected = preview.kind === "packet" && preview.showAnswers;
  return (
    <div className="space-y-2" data-testid="eo-couple-will-choose">
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading this Event Order&apos;s template…
        </p>
      ) : preview.kind === "none" ? (
        <p className="text-xs text-muted-foreground" data-testid="eo-couple-will-choose-empty">
          {NO_COUPLE_CHOICES_MESSAGE}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" data-testid="eo-couple-will-choose-source" data-source={preview.kind}>
            {preview.kind === "packet"
              ? `Couple choices from “${preview.name}” · ${preview.statusLabel}.`
              : `Couple choices from template “${preview.templateName}” — not sent yet.`}
          </p>
          {unmatched.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-heading">The couple will choose</p>
              <ul className="space-y-2">
                {unmatched.map((group) => (
                  <CoupleChoiceGroupCard key={group.id} group={group} showSelected={showSelected} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function useCoupleChoicePreview(eventOrder: EventOrderWithDetails | null, choices: ClientChoicesWithHistory[]) {
  const hasActivePacket = pickActiveChoices(choices) != null;
  const templateId = hasActivePacket || !eventOrder ? null : eventOrder.templateId;
  const [templateDetail, setTemplateDetail] = React.useState<EventOrderTemplateWithDetails | null>(null);
  const [loadedTemplateId, setLoadedTemplateId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    void getEventOrderTemplateDetailAction(templateId).then((detail) => {
      if (cancelled) return;
      setTemplateDetail(detail);
      setLoadedTemplateId(templateId);
    });
    return () => { cancelled = true; };
  }, [templateId]);

  const loading = Boolean(templateId) && loadedTemplateId !== templateId;
  const preview = coupleChoicePreview({
    choices,
    eventOrderTemplate: templateId && loadedTemplateId === templateId ? templateDetail : null,
  });
  return { loading, preview };
}

function CoupleChoiceGroupCard({ group, showSelected }: { group: CoupleGroup; showSelected: boolean }) {
  return (
    <li className="rounded-sm border border-dashed border-border p-3 space-y-1.5" data-testid="eo-couple-choice-group" data-group-id={group.id}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Couple chooses</span>
        <span className="text-sm font-medium text-heading">{group.name}</span>
        <span className="text-xs text-muted-foreground" data-testid="eo-couple-choice-rule">
          {group.ruleLabel}
          {group.allowQuantity ? " · quantity per option" : ""}
          {group.shownWhen.length > 0 ? ` · only if ${group.shownWhen.map((l) => `“${l}”`).join(" or ")}` : ""}
        </span>
      </div>
      {group.options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No options configured.</p>
      ) : (
        <ul className="space-y-1">
          {group.options.map((opt) => (
            <li key={opt.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm" data-testid="eo-couple-choice-option" data-option-id={opt.id}>
              <span className="text-foreground">
                {opt.label}
                {showSelected && opt.chosen ? (
                  <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-primary">
                    Selected{opt.chosenQuantity != null ? ` ×${opt.chosenQuantity}` : ""}
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">{opt.priceLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function AddSectionInline({ eventOrderId, eventId, disabled }: { eventOrderId: string; eventId: string; disabled: boolean }) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleAdd() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await addSectionAction(eventOrderId, eventId, name);
      if (result.ok) { setAdding(false); setName(""); }
      else toast.error(result.message ?? "Could not add section.");
    });
  }

  if (!adding) {
    return (
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setAdding(true)}>
        + Add Section
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ceremony, Reception, Bar…" className="h-9 w-56 text-sm" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }} />
      <Button type="button" size="sm" disabled={!name.trim() || pending} onClick={handleAdd}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setName(""); }} disabled={pending}>Cancel</Button>
    </div>
  );
}

type SetupOption = { id: string; name: string };

function useEventFloorPlanSetups(eventId: string | null | undefined): SetupOption[] {
  const [setups, setSetups] = React.useState<SetupOption[]>([]);
  React.useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    void listSetupsWithMembersAction(eventId).then((rows) => {
      if (!cancelled) setSetups(rows.map((r) => ({ id: r.id, name: r.name })));
    });
    return () => { cancelled = true; };
  }, [eventId]);
  return setups;
}

/**
 * Which floor plan setup this section's items are compared with. Comparison
 * only — never changes lines or the couple's copy. Shown on sections that
 * hold floor-plan items, or that already carry a venue choice.
 */
function SectionSetupLink({
  eventOrderId, eventId, section, setups, hasFloorPlanItems, floorPlans,
}: {
  eventOrderId: string; eventId: string; section: EventOrderSection; setups: SetupOption[]; hasFloorPlanItems: boolean; floorPlans: FloorPlan[];
}) {
  const [pending, startTransition] = React.useTransition();
  const resolution = resolveSectionSetup(
    section,
    setups.map((s) => ({ ...s, memberPlanIds: [], operationalPlanId: null })),
  );
  const explicit = Boolean(section.notOnFloorPlan || section.floorPlanSetupId || section.floorPlanId);
  if (!hasFloorPlanItems && !explicit) return null;

  const autoLabel = resolution.kind === "setup" && resolution.how !== "chosen"
    ? `Floor plan: ${resolution.setupName} (matched by name)`
    : resolution.kind === "plan"
      ? `Floor plan: ${floorPlans.find((p) => p.id === resolution.planId)?.name ?? "linked layout"}`
      : setups.length === 0
      ? "Floor plan: every layout"
      : "Floor plan: no matching setup";
  const value = section.notOnFloorPlan ? "none" : section.floorPlanSetupId ? `setup:${section.floorPlanSetupId}` : "auto";
  const options = [
    { value: "auto", label: autoLabel },
    ...setups.map((s) => ({ value: `setup:${s.id}`, label: `Floor plan: ${s.name}` })),
    { value: "none", label: "Not on a floor plan" },
  ];
  const unmatched = resolution.kind === "every_layout" && resolution.reason === "unmatched" && hasFloorPlanItems;

  function handleChange(next: string) {
    const choice = next === "auto" ? "auto" as const : next === "none" ? "none" as const : { setupId: next.slice("setup:".length) };
    startTransition(async () => {
      const result = await setSectionFloorPlanSetupAction(eventOrderId, eventId, section.id, choice);
      if (!result.ok) toast.error(result.message ?? "Could not save the floor plan setup.");
    });
  }

  return (
    <>
      <Select value={value} onValueChange={(v) => { if (v) handleChange(v); }} items={options} disabled={pending}>
        <SelectTrigger
          className={`h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs hover:text-foreground ${unmatched ? "text-amber-800" : "text-muted-foreground"}`}
          data-testid={`eo-section-setup-${section.id}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function EventOrderPanel({
  eventId, planningClientId = null, clientId, clientName, clientEmail, venueName, eventOrder, packages, packagesWithItems = [],
  selectedPackageName = null, offerings = [], inventoryItems, invoices, bookingCommitmentInvoiceIds = [], floorPlans, overview,
  templates = [],
  linkedScheduleId = null,
  preferredTemplateId = null,
  shareCommitmentStale = false,
  choices = [],
}: {
  eventId: string;
  planningClientId?: string | null;
  clientId: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  venueName?: string;
  eventOrder: EventOrderWithDetails | null;
  packages: Package[];
  packagesWithItems?: PackageWithItems[];
  selectedPackageName?: string | null;
  offerings?: Offering[];
  inventoryItems: InventoryItem[];
  invoices: Invoice[];
  bookingCommitmentInvoiceIds?: string[];
  floorPlans: FloorPlan[];
  overview?: EventOrderOverview | null;
  templates?: EventOrderTemplate[];
  /** Payment schedule already attached to the EO-linked invoice, if any. */
  linkedScheduleId?: string | null;
  /** Setup Profile starting Event Order template — preselect only; does not auto-create. */
  preferredTemplateId?: string | null;
  /** Live lines differ from the last share the couple still sees. */
  shareCommitmentStale?: boolean;
  /** Event selection packets (already loaded by the page) for the read-only couple-choice preview. */
  choices?: ClientChoicesWithHistory[];
}) {
  const router = useRouter();
  const scopeId = eventId || planningClientId || "";
  const preBooking = Boolean(planningClientId) && !eventId;
  const [starting, startStarting] = React.useTransition();
  const [applying, startApplying] = React.useTransition();
  const preferredExists = Boolean(preferredTemplateId && templates.some((t) => t.id === preferredTemplateId));
  const [templateId, setTemplateId] = React.useState(preferredExists ? preferredTemplateId! : "blank");
  const [lifecyclePending, startLifecycle] = React.useTransition();
  const [downloading, startDownload] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [removingSectionId, setRemovingSectionId] = React.useState<string | null>(null);
  const [zeroTotalConfirm, setZeroTotalConfirm] = React.useState<null | { kind: "finalize" | "share-open" }>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [updateShareOpen, setUpdateShareOpen] = React.useState(false);
  const shareOpenTargetRef = React.useRef<"initial" | "update">("initial");
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [applyTemplate, setApplyTemplate] = React.useState<EventOrderTemplateWithDetails | null>(null);

  function refresh() { router.refresh(); }
  const couple = useCoupleChoicePreview(eventOrder, choices);
  const floorPlanSetups = useEventFloorPlanSetups(eventOrder?.eventId ?? (eventId || null));

  // Profile-configured Event Order should already exist after booking / prepare-release.
  // Recover once so this tab is an editor, not a second setup wizard.
  // Also re-enter ensure when an open EO already exists so booking Selected Package
  // inclusions can seed (idempotent; does not recreate the order).
  const ensuredRef = React.useRef(false);
  React.useEffect(() => {
    if (preBooking || !eventId || ensuredRef.current) return;
    if (!eventOrder && !preferredExists) return;
    ensuredRef.current = true;
    let cancelled = false;
    void (async () => {
      const result = await ensureEventOrderAction(
        eventId,
        preferredExists ? preferredTemplateId : (eventOrder?.templateId ?? null),
      );
      if (cancelled) return;
      if (!result.ok) toast.error(result.message ?? "Could not prepare Event Order.");
      else refresh();
    })();
    return () => { cancelled = true; };
  }, [eventOrder, preferredExists, preferredTemplateId, preBooking, eventId]);

  // Work Package D5E — unified Share experience.
  const shareRecipient = clientName ? { name: clientName, contact: clientEmail ?? null, relationshipLabel: "Client" } : null;
  const shareMergeData = buildMergeData({
    venueName: venueName ?? "Your venue", clientName: clientName ?? "", coordinatorName: venueName ?? "",
    eventDate: overview?.eventDate ?? null,
  });
  const shareDefaultMessage = mergeContent("We've shared your Event Order for {{event_date}}. Please review it when you have a chance.", shareMergeData);

  async function runFinalize(eventOrderId: string) {
    const result = await finalizeEventOrderAction(eventOrderId, scopeId);
    if (!result.ok) toast.error(result.message ?? "Could not finalize.");
    else {
      toast.success("Event Order finalized.");
      refresh();
    }
  }

  async function runShare(eventOrderId: string, message: string) {
    const result = await shareEventOrderWithClientAction(eventOrderId, scopeId, message);
    if (result.ok) toast.success("Shared with client.");
    return result;
  }

  function requestShareDialog(which: "initial" | "update") {
    shareOpenTargetRef.current = which;
    if (eventOrder && eventOrderRequiresZeroTotalWarning(eventOrder.total, eventOrder.lines.length)) {
      setZeroTotalConfirm({ kind: "share-open" });
      return;
    }
    if (which === "update") setUpdateShareOpen(true);
    else setShareOpen(true);
  }

  function requestFinalize(eventOrderId: string, total: number, lineCount: number) {
    if (eventOrderRequiresZeroTotalWarning(total, lineCount)) {
      setZeroTotalConfirm({ kind: "finalize" });
      return;
    }
    startLifecycle(async () => { await runFinalize(eventOrderId); });
  }

  function handleZeroTotalCancel() {
    setZeroTotalConfirm(null);
  }

  function handleZeroTotalContinue() {
    const kind = zeroTotalConfirm?.kind;
    setZeroTotalConfirm(null);
    if (!eventOrder || !kind) return;
    if (kind === "finalize") {
      startLifecycle(async () => { await runFinalize(eventOrder.id); });
      return;
    }
    // share-open: $0 already disclosed — open the Share sheet next.
    if (shareOpenTargetRef.current === "update") setUpdateShareOpen(true);
    else setShareOpen(true);
  }

  function handleDownload(eventOrderId: string) {
    startDownload(async () => {
      const result = await getEventOrderPdfUrlAction(eventOrderId);
      if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
      else toast.error(result.message ?? "Could not open the Event Order PDF.");
    });
  }

  if (!eventOrder) {
    if (preferredExists && !preBooking) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Order</CardTitle>
            <CardDescription>
              Preparing the profile starting Event Order template for this event. Draft only — not an invoice, contract, or payment plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing Event Order draft…</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Order</CardTitle>
          <CardDescription>
            Manage this event&apos;s Event Order — the agreed deliverables record. An Event Order is
            not itself an invoice, contract, or payment plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            {selectedPackageName && (
              <p className="text-sm text-muted-foreground">
                Package on this event: <span className="font-medium text-foreground">{selectedPackageName}</span>
              </p>
            )}
            <p className="max-w-md text-sm text-muted-foreground">
              Optional — use when you need a detailed delivery list. Events that use a sales Package only can skip this.
              Event Order templates copy selected sections and offerings into this event. That snapshot is not an invoice, contract, or payment.
              When a Setup Profile starting Event Order template is configured, use Release to client portal from Overview instead of starting here.
            </p>
            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button type="button" size="sm" disabled={starting}
                onClick={() => startStarting(async () => {
                  const result = preBooking
                    ? await ensureClientEventOrderAction(planningClientId!, null)
                    : await ensureEventOrderAction(eventId, null);
                  if (!result.ok) toast.error(result.message ?? "Could not start Event Order.");
                  else refresh();
                })}>
                {starting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Starting…</> : "Start blank"}
              </Button>
              {templates.length > 0 && (
                <>
                  <Select
                    value={templateId}
                    onValueChange={setTemplateId}
                    items={[{ value: "blank", label: "Choose a template…" }, ...templates.map((t) => ({
                      value: t.id,
                      label: t.name,
                    }))]}
                  >
                    <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blank">Choose a template…</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" disabled={starting || templateId === "blank"}
                    onClick={() => startStarting(async () => {
                      const detail = await getEventOrderTemplateDetailAction(templateId);
                      if (!detail) {
                        toast.error("Could not load that template.");
                        return;
                      }
                      setApplyTemplate(detail);
                      setApplyOpen(true);
                    })}>
                    Use a template
                  </Button>
                </>
              )}
            </div>
            <ApplyEventOrderTemplateSheet
              open={applyOpen}
              onOpenChange={setApplyOpen}
              template={applyTemplate}
              pending={applying}
              onApply={async (selections) => {
                if (!applyTemplate) return;
                await new Promise<void>((resolve) => {
                  startApplying(async () => {
                    const result = preBooking
                      ? await ensureClientEventOrderAction(planningClientId!, applyTemplate.id, selections)
                      : await ensureEventOrderAction(eventId, applyTemplate.id, selections);
                    if (!result.ok) toast.error(result.message ?? "Could not start Event Order.");
                    else {
                      setApplyOpen(false);
                      refresh();
                    }
                    resolve();
                  });
                });
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Narrowed to a stable, non-null binding — the closures below are only
  // ever invoked from JSX rendered after this point, but TS can't follow
  // that through a mutable outer-scope prop on its own.
  const order = eventOrder;
  const displayStatus = eventOrderDisplayStatus(order);
  const isFinalized = order.status === "finalized";
  const unsectioned = order.lines.filter((l) => !l.sectionId);
  const inventoryNameById = new Map(inventoryItems.map((i) => [i.id, i.printableName || i.name]));
  const unsectionedSplit = splitSetupLines(unsectioned);
  const coupleGroups = couple.preview.kind === "none" ? [] : couple.preview.groups;
  const groupPlacement = matchChoiceGroupsToSections(coupleGroups, order.sections);
  const showSelectedChoices = couple.preview.kind === "packet" && couple.preview.showAnswers;
  const floorPlanItemIds = new Set(inventoryItems.filter((i) => i.availableForFloorPlans).map((i) => i.id));
  const offeringItemById = new Map(offerings.map((o) => [o.id, o.inventoryItemId]));
  function sectionHasFloorPlanItems(sectionId: string): boolean {
    return order.lines.some((l) => {
      if (l.sectionId !== sectionId) return false;
      const itemId = l.inventoryItemId ?? (l.offeringId ? offeringItemById.get(l.offeringId) : null);
      return Boolean(itemId && floorPlanItemIds.has(itemId));
    });
  }
  function sectionUnmatched(section: EventOrderSection): boolean {
    if (!order.eventId || floorPlanSetups.length === 0 || !sectionHasFloorPlanItems(section.id)) return false;
    const r = resolveSectionSetup(
      section,
      floorPlanSetups.map((x) => ({ ...x, memberPlanIds: [], operationalPlanId: null })),
    );
    return r.kind === "every_layout" && r.reason === "unmatched";
  }

  function renderLine(line: EventOrderLine) {
    return (
      <LineRow
        key={line.id}
        line={line}
        sections={order.sections}
        eventOrderId={order.id}
        eventId={scopeId}
        canEdit={!isFinalized}
        inventoryName={line.inventoryItemId ? inventoryNameById.get(line.inventoryItemId) : null}
        removing={removingId === line.id}
        onRemove={() => handleRemoveLine(line)}
      />
    );
  }

  async function handleRemoveLine(line: EventOrderLine) {
    setRemovingId(line.id);
    const result = await removeLineAction(order.id, scopeId, line.id, line.description);
    setRemovingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not remove line.");
  }

  async function handleRemoveSection(sectionId: string, name: string) {
    if (!confirm(`Remove "${name}"? Its lines will stay, unsectioned.`)) return;
    setRemovingSectionId(sectionId);
    const result = await removeSectionAction(order.id, scopeId, sectionId, name);
    setRemovingSectionId(null);
    if (!result.ok) toast.error(result.message ?? "Could not remove section.");
  }

  return (
    <>
    <Card>
      <CardHeader>
        <BusinessAssetHeader
          compact
          whatIsThis="Event Order"
          title="Event Order"
          status={
            <Badge variant={STATUS_VARIANT[displayStatus]}>
              {DISPLAY_STATUS_LABEL[displayStatus]}{eventOrder.revision > 0 ? ` · v${eventOrder.revision}` : ""}
            </Badge>
          }
          lastUpdated={new Date(eventOrder.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          primaryAction={
            preBooking ? undefined : !isFinalized ? (
              <Button type="button" size="sm" disabled={lifecyclePending || (eventOrder.lines.length === 0)}
                onClick={() => requestFinalize(eventOrder.id, eventOrder.total, eventOrder.lines.length)}>
                {lifecyclePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Finalize Event Order"}
              </Button>
            ) : eventOrder.sharedAt ? (
              <Button type="button" size="sm" disabled={downloading} onClick={() => handleDownload(eventOrder.id)}>
                {downloading ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Opening…</> : "Download PDF"}
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" onClick={() => requestShareDialog("initial")}>Share with Client</Button>
                <ShareDialog
                  open={shareOpen}
                  onOpenChange={setShareOpen}
                  title="Share Event Order"
                  recipient={shareRecipient}
                  whatHappensNext="They'll review the Event Order. Applying a Library template earlier only built this working order — Share is what makes it visible to the client."
                  defaultMessage={shareDefaultMessage}
                  sendLabel="Share"
                  onSend={(message) => runShare(eventOrder.id, message)}
                  onSent={() => { setShareOpen(false); refresh(); }}
                />
              </>
            )
          }
        />
        <p className="text-xs text-muted-foreground -mt-1" data-testid="eo-additional-extra-total">
          Total <span className="font-medium text-foreground">{formatMoney(eventOrder.total)}</span>
          {" · "}Extra charges{" "}
          <span className="font-medium text-foreground">
            {formatMoney(eventOrder.lines.filter(isBillableEventOrderLineForInvoice).reduce((sum, l) => sum + l.amount, 0))}
          </span>
          {selectedPackageName ? <>{" · "}Package <span className="font-medium text-foreground">{selectedPackageName}</span></> : null}
        </p>
        {preBooking && (
          <p className="text-xs text-muted-foreground -mt-1">
            Finalize, share with the client, and the invoice link wait until this relationship is Booked. They describe the booked occasion.
          </p>
        )}
        {eventOrder.sharedAt && (shareCommitmentStale || !isFinalized) && (
          <div
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground space-y-1"
            data-testid="event-order-share-stale-banner"
            role="status"
          >
            <p>
              The couple still sees the copy shared{" "}
              {new Date(eventOrder.sharedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {shareCommitmentStale
                ? ", which no longer matches these lines. Re-share before invoicing."
                : ". Re-share when you're ready to publish changes."}
            </p>
          </div>
        )}
        {isFinalized && (
          <div className="flex items-center gap-2 -mt-1">
            {eventOrder.sharedAt && (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => requestShareDialog("update")}>Update Shared Copy</Button>
                <ShareDialog
                  open={updateShareOpen}
                  onOpenChange={setUpdateShareOpen}
                  title="Update Shared Copy"
                  recipient={shareRecipient}
                  whatHappensNext="They'll see the current version — you're sharing an updated version of what they already have."
                  defaultMessage={shareDefaultMessage}
                  sendLabel="Share"
                  onSend={(message) => runShare(eventOrder.id, message)}
                  onSent={() => { setUpdateShareOpen(false); refresh(); }}
                />
              </>
            )}
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={lifecyclePending}
              onClick={() => startLifecycle(async () => {
                const result = await reopenEventOrderAction(eventOrder.id, scopeId);
                if (!result.ok) toast.error(result.message ?? "Could not reopen.");
                else refresh();
              })}>
              {lifecyclePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reopen for Editing"}
            </Button>
          </div>
        )}
        {eventOrder.sharedAt && isFinalized && (
          <p className="text-xs text-muted-foreground -mt-1">
            Shared with client {new Date(eventOrder.sharedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
          </p>
        )}
        {clientId && (
          <div className="pt-3 mt-3 border-t border-border/60">
            {!preBooking && (
            <EventOrderInvoiceLink
              eventOrderId={eventOrder.id}
              eventId={scopeId}
              clientId={clientId}
              invoices={invoices}
              bookingCommitmentInvoiceIds={bookingCommitmentInvoiceIds}
              hasPricedContent={eventOrder.total > 0}
              linkedScheduleId={linkedScheduleId}
            />
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {(overview || clientName || venueName) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm" data-testid="eo-overview">
            {(overview?.eventName || clientName) && (
              <div><span className="text-muted-foreground">Event </span><span className="font-medium text-foreground">{overview?.eventName || clientName}</span></div>
            )}
            {clientName && (
              <div><span className="text-muted-foreground">Client </span><span className="font-medium text-foreground">{clientName}</span></div>
            )}
            {overview?.eventDate && (
              <div><span className="text-muted-foreground">Date </span><span className="font-medium text-foreground">{new Date(overview.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></div>
            )}
            {overview?.guestCount != null && (
              <div><span className="text-muted-foreground">Guests </span><span className="font-medium text-foreground">{overview.guestCount}</span></div>
            )}
            {overview?.spaceName && (
              <div><span className="text-muted-foreground">Spaces </span><span className="font-medium text-foreground">{overview.spaceName}</span></div>
            )}
          </div>
        )}

        {!preBooking && (
          <CoupleWillChooseSection loading={couple.loading} preview={couple.preview} unmatched={groupPlacement.unmatched} />
        )}

        {eventOrder.sections.map((section) => {
          const { main, setup } = splitSetupLines(eventOrder.lines.filter((l) => l.sectionId === section.id));
          const sectionGroups = groupPlacement.bySectionId.get(section.id) ?? [];
          return (
            <div key={section.id} className="space-y-2" data-testid="eo-section" data-section-id={section.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-heading">{section.name}</p>
                  {order.eventId ? (
                    <SectionSetupLink
                      eventOrderId={eventOrder.id}
                      eventId={order.eventId}
                      section={section}
                      setups={floorPlanSetups}
                      hasFloorPlanItems={sectionHasFloorPlanItems(section.id)}
                      floorPlans={floorPlans}
                    />
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {!isFinalized && (
                    <AddLineSheet
                      eventOrderId={eventOrder.id}
                      eventId={scopeId}
                      sectionId={section.id}
                      offerings={offerings}
                      packages={packages}
                      packagesWithItems={packagesWithItems}
                      inventoryItems={inventoryItems}
                      onAdded={() => refresh()}
                    />
                  )}
                  {!isFinalized && (
                    <button type="button" onClick={() => handleRemoveSection(section.id, section.name)} disabled={removingSectionId === section.id}
                      className="rounded p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Remove section">
                      {removingSectionId === section.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              {sectionUnmatched(section) ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid={`eo-section-setup-unmatched-${section.id}`}>
                  &ldquo;{section.name}&rdquo; doesn&apos;t match a floor plan setup by name, so its items are counted on every layout. Pick the setup it belongs to above, or choose &ldquo;Not on a floor plan&rdquo;.
                </p>
              ) : null}
              {main.length === 0 && setup.length === 0 && sectionGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No items yet.</p>
              ) : null}
              {main.length > 0 ? <div>{main.map(renderLine)}</div> : null}
              {sectionGroups.length > 0 ? (
                <ul className="space-y-2">
                  {sectionGroups.map((group) => (
                    <CoupleChoiceGroupCard key={group.id} group={group} showSelected={showSelectedChoices} />
                  ))}
                </ul>
              ) : null}
              {setup.length > 0 ? (
                <details className="rounded-md border border-border/70 px-3 py-2" data-testid="eo-included-setup-items">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                    Included setup items ({setup.length})
                  </summary>
                  <div className="mt-1">{setup.map(renderLine)}</div>
                </details>
              ) : null}
            </div>
          );
        })}

        {(unsectionedSplit.main.length > 0 || unsectionedSplit.setup.length > 0) && (
          <div className="space-y-2">
            {eventOrder.sections.length > 0 && <p className="text-sm font-semibold text-heading">General</p>}
            {unsectionedSplit.main.length > 0 ? <div>{unsectionedSplit.main.map(renderLine)}</div> : null}
            {unsectionedSplit.setup.length > 0 ? (
              <details className="rounded-md border border-border/70 px-3 py-2" data-testid="eo-included-setup-items">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Included setup items ({unsectionedSplit.setup.length})
                </summary>
                <div className="mt-1">{unsectionedSplit.setup.map(renderLine)}</div>
              </details>
            ) : null}
          </div>
        )}
        {eventOrder.lines.length === 0 && eventOrder.sections.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Nothing added yet. Add items from Offerings, or add sections first.</p>
        )}

        {!isFinalized && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <AddSectionInline eventOrderId={eventOrder.id} eventId={scopeId} disabled={lifecyclePending} />
              <AddLineSheet
                eventOrderId={eventOrder.id}
                eventId={scopeId}
                sectionId={null}
                offerings={offerings}
                packages={packages}
                packagesWithItems={packagesWithItems}
                inventoryItems={inventoryItems}
                onAdded={() => refresh()}
              />
            </div>
            {templates.length > 0 && (
              <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center" data-testid="eo-apply-template">
                <Select
                  value={templateId}
                  onValueChange={setTemplateId}
                  items={[{ value: "blank", label: "Choose a template…" }, ...templates.map((t) => ({
                    value: t.id,
                    label: t.name,
                  }))]}
                >
                  <SelectTrigger className="w-full min-w-0 sm:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">Choose a template…</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" disabled={starting || templateId === "blank"}
                  onClick={() => startStarting(async () => {
                    const detail = await getEventOrderTemplateDetailAction(templateId);
                    if (!detail) {
                      toast.error("Could not load that template.");
                      return;
                    }
                    setApplyTemplate(detail);
                    setApplyOpen(true);
                  })}>
                  Apply a template
                </Button>
              </div>
            )}
          </div>
        )}

        {eventOrder.activities.length > 0 && (
          <details className="pt-2 border-t border-border/60">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Activity ({eventOrder.activities.length})</summary>
            {/* Same activity presentation Contracts already use (BA4, Step 4) — not a second timeline design. */}
            <div className="mt-2">
              <ActivityTimeline activities={eventOrder.activities} />
            </div>
          </details>
        )}
      </CardContent>
    </Card>
    <ApplyEventOrderTemplateSheet
      open={applyOpen}
      onOpenChange={setApplyOpen}
      template={applyTemplate}
      pending={applying}
      onApply={async (selections) => {
        if (!applyTemplate) return;
        await new Promise<void>((resolve) => {
          startApplying(async () => {
            const result = await applyEventOrderTemplateAction(order.id, scopeId, applyTemplate.id, selections);
            if (!result.ok) toast.error(result.message ?? "Could not apply this template.");
            else {
              setApplyOpen(false);
              refresh();
            }
            resolve();
          });
        });
      }}
    />
    <EventOrderZeroTotalConfirmDialog
      open={zeroTotalConfirm !== null}
      actionLabel={zeroTotalConfirm?.kind === "share-open" ? "Share" : "Finalize"}
      onCancel={handleZeroTotalCancel}
      onContinue={handleZeroTotalContinue}
    />
    </>
  );
}
