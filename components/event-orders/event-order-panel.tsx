"use client";

import * as React from "react";

import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addSectionAction, ensureEventOrderAction, finalizeEventOrderAction, getEventOrderPdfUrlAction,
  removeLineAction, removeSectionAction, reopenEventOrderAction, setSectionFloorPlanAction,
  shareEventOrderWithClientAction,
} from "@/app/(app)/events/[id]/event-order-actions";
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
import { DISPLAY_STATUS_LABEL, PROVENANCE_LABEL, eventOrderDisplayStatus, formatMoney, formatOptionalMoney } from "@/lib/event-orders/constants";
import { eventOrderRequiresZeroTotalWarning } from "@/lib/event-orders/zero-total-warning";
import type { EventOrderDisplayStatus, EventOrderLine, EventOrderSection, EventOrderWithDetails } from "@/lib/event-orders/types";
import type { EventOrderTemplate } from "@/lib/event-order-templates/types";
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
  line, sections, eventOrderId, eventId, canEdit, onRemove, removing,
}: {
  line: EventOrderLine;
  sections: EventOrderSection[];
  eventOrderId: string;
  eventId: string;
  canEdit: boolean;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-border py-3 last:border-0 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center sm:gap-2 text-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground">{line.description}</span>
          <Badge variant={line.isIncluded ? "muted" : "accent"} className="text-[10px]">
            {line.isIncluded ? "Included" : "Additional"}
          </Badge>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{PROVENANCE_LABEL[line.provenance]}</span>
        </div>
        {(line.notes || line.unit) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[line.unit ? `Unit: ${line.unit}` : null, line.notes].filter(Boolean).join(" · ")}
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

/**
 * Phase 4 — which Floor Plan (if any) this Section reconciles against.
 * Purely an Event Order authoring choice: Event Order owns which Floor Plan
 * a Section corresponds to; this never creates, edits, or reads placement
 * data on the Floor Plan itself. Hidden entirely when the event has no
 * Floor Plans at all, so a booking that doesn't use Floor Plans sees
 * nothing new here.
 */
function SectionFloorPlanLink({
  eventOrderId, eventId, section, floorPlans, disabled,
}: {
  eventOrderId: string; eventId: string; section: EventOrderSection; floorPlans: FloorPlan[]; disabled: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  if (floorPlans.length === 0) return null;

  const options = [
    { value: "none", label: "No floor plan linked" },
    ...floorPlans.map((p) => ({ value: p.id, label: p.name })),
  ];

  function handleChange(value: string) {
    startTransition(async () => {
      const result = await setSectionFloorPlanAction(eventOrderId, eventId, section.id, value === "none" ? null : value);
      if (!result.ok) toast.error(result.message ?? "Could not link floor plan.");
    });
  }

  return (
    <Select value={section.floorPlanId ?? "none"} onValueChange={handleChange} items={options} disabled={disabled || pending}>
      <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground hover:text-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EventOrderPanel({
  eventId, clientId, clientName, clientEmail, venueName, eventOrder, packages, packagesWithItems = [],
  selectedPackageName = null, offerings = [], inventoryItems, invoices, floorPlans, overview,
  templates = [],
}: {
  eventId: string;
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
  floorPlans: FloorPlan[];
  overview?: EventOrderOverview | null;
  templates?: EventOrderTemplate[];
}) {
  const router = useRouter();
  const [starting, startStarting] = React.useTransition();
  const [templateId, setTemplateId] = React.useState("blank");
  const [lifecyclePending, startLifecycle] = React.useTransition();
  const [downloading, startDownload] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [removingSectionId, setRemovingSectionId] = React.useState<string | null>(null);
  const [zeroTotalConfirm, setZeroTotalConfirm] = React.useState<null | { kind: "finalize" | "share" }>(null);
  const shareConfirmResolveRef = React.useRef<((result: { ok: boolean; message?: string; cancelled?: boolean }) => void) | null>(null);
  const shareConfirmMessageRef = React.useRef<string>("");

  function refresh() { router.refresh(); }

  // Work Package D5E — unified Share experience.
  const shareRecipient = clientName ? { name: clientName, contact: clientEmail ?? null, relationshipLabel: "Client" } : null;
  const shareMergeData = buildMergeData({
    venueName: venueName ?? "Your venue", clientName: clientName ?? "", coordinatorName: venueName ?? "",
    eventDate: overview?.eventDate ?? null,
  });
  const shareDefaultMessage = mergeContent("We've shared your Event Order for {{event_date}}. Please review it when you have a chance.", shareMergeData);

  async function runFinalize(eventOrderId: string) {
    const result = await finalizeEventOrderAction(eventOrderId, eventId);
    if (!result.ok) toast.error(result.message ?? "Could not finalize.");
    else toast.success("Event Order finalized.");
  }

  async function runShare(eventOrderId: string, message: string) {
    const result = await shareEventOrderWithClientAction(eventOrderId, eventId, message);
    if (result.ok) toast.success("Shared with client.");
    return result;
  }

  async function handleShareSend(eventOrderId: string, message: string) {
    if (eventOrder && eventOrderRequiresZeroTotalWarning(eventOrder.total, eventOrder.lines.length)) {
      return new Promise<{ ok: boolean; message?: string; cancelled?: boolean }>((resolve) => {
        shareConfirmResolveRef.current = resolve;
        shareConfirmMessageRef.current = message;
        setZeroTotalConfirm({ kind: "share" });
      });
    }
    return runShare(eventOrderId, message);
  }

  function requestFinalize(eventOrderId: string, total: number, lineCount: number) {
    if (eventOrderRequiresZeroTotalWarning(total, lineCount)) {
      setZeroTotalConfirm({ kind: "finalize" });
      return;
    }
    startLifecycle(async () => { await runFinalize(eventOrderId); });
  }

  function handleZeroTotalCancel() {
    const resolve = shareConfirmResolveRef.current;
    shareConfirmResolveRef.current = null;
    setZeroTotalConfirm(null);
    if (resolve) resolve({ ok: false, cancelled: true });
  }

  function handleZeroTotalContinue() {
    const kind = zeroTotalConfirm?.kind;
    const resolve = shareConfirmResolveRef.current;
    const message = shareConfirmMessageRef.current;
    shareConfirmResolveRef.current = null;
    setZeroTotalConfirm(null);
    if (!eventOrder || !kind) return;
    if (kind === "finalize") {
      startLifecycle(async () => { await runFinalize(eventOrder.id); });
      return;
    }
    startLifecycle(async () => {
      const result = await runShare(eventOrder.id, message);
      if (resolve) resolve(result);
    });
  }

  function handleDownload(eventOrderId: string) {
    startDownload(async () => {
      const result = await getEventOrderPdfUrlAction(eventOrderId);
      if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
      else toast.error(result.message ?? "Could not open the Event Order PDF.");
    });
  }

  if (!eventOrder) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Order</CardTitle>
          <CardDescription>
            What this event is receiving.
            <br />
            Not your invoice, contract, or task list.
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
              Optional — use when you need a detailed delivery list. Package-only events can skip this.
            </p>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button type="button" size="sm" disabled={starting}
                onClick={() => startStarting(async () => {
                  const result = await ensureEventOrderAction(eventId, null);
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
                    items={[{ value: "blank", label: "Choose a template…" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]}
                  >
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blank">Choose a template…</SelectItem>
                      {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" disabled={starting || templateId === "blank"}
                    onClick={() => startStarting(async () => {
                      const result = await ensureEventOrderAction(eventId, templateId);
                      if (!result.ok) toast.error(result.message ?? "Could not start Event Order.");
                      else refresh();
                    })}>
                    Use a template
                  </Button>
                </>
              )}
            </div>
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

  async function handleRemoveLine(line: EventOrderLine) {
    setRemovingId(line.id);
    const result = await removeLineAction(order.id, eventId, line.id, line.description);
    setRemovingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not remove line.");
  }

  async function handleRemoveSection(sectionId: string, name: string) {
    if (!confirm(`Remove "${name}"? Its lines will stay, unsectioned.`)) return;
    setRemovingSectionId(sectionId);
    const result = await removeSectionAction(order.id, eventId, sectionId, name);
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
            !isFinalized ? (
              <Button type="button" size="sm" disabled={lifecyclePending || (eventOrder.lines.length === 0)}
                onClick={() => requestFinalize(eventOrder.id, eventOrder.total, eventOrder.lines.length)}>
                {lifecyclePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Finalize"}
              </Button>
            ) : eventOrder.sharedAt ? (
              <Button type="button" size="sm" disabled={downloading} onClick={() => handleDownload(eventOrder.id)}>
                {downloading ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Opening…</> : "Download PDF"}
              </Button>
            ) : (
              <ShareDialog
                trigger={<Button type="button" size="sm">Share with Client</Button>}
                title="Share Event Order"
                recipient={shareRecipient}
                whatHappensNext="They'll review the Event Order. Applying a Library template earlier only built this working order — Share is what makes it visible to the client."
                defaultMessage={shareDefaultMessage}
                sendLabel="Share"
                onSend={(message) => handleShareSend(eventOrder.id, message)}
              />
            )
          }
        />
        <p className="text-xs text-muted-foreground -mt-1">
          What this event is receiving. Delivery subtotal (for reference):{" "}
          <span className="font-medium text-foreground">{formatMoney(eventOrder.total)}</span>
          {" "}— amount due is on Invoice / Payments.
        </p>
        {selectedPackageName && (
          <p className="text-xs text-muted-foreground -mt-1">
            Package context: <span className="font-medium text-foreground">{selectedPackageName}</span> (commercial purchase — not this Event Order)
          </p>
        )}
        {!isFinalized && eventOrder.sharedAt && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
            Clients still see the shared version from{" "}
            {new Date(eventOrder.sharedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
            Re-share when you are ready to publish revisions.
          </div>
        )}
        {isFinalized && (
          <div className="flex items-center gap-2 -mt-1">
            {eventOrder.sharedAt && (
              <ShareDialog
                trigger={<Button type="button" variant="ghost" size="sm">Update Shared Copy</Button>}
                title="Update Shared Copy"
                recipient={shareRecipient}
                whatHappensNext="They'll see the current version — you're sharing an updated version of what they already have."
                defaultMessage={shareDefaultMessage}
                sendLabel="Share"
                onSend={(message) => handleShareSend(eventOrder.id, message)}
              />
            )}
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={lifecyclePending}
              onClick={() => startLifecycle(async () => {
                const result = await reopenEventOrderAction(eventOrder.id, eventId);
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
            Re-sharing publishes a new frozen copy for the client.
          </p>
        )}
        {clientId && (
          <div className="pt-3 mt-3 border-t border-border/60">
            <EventOrderInvoiceLink eventOrderId={eventOrder.id} eventId={eventId} clientId={clientId} invoices={invoices} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {(overview || clientName || venueName) && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event Overview</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
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
            <p className="text-xs text-muted-foreground">Drawn from the event booking — edit those details on Overview, not here.</p>
          </div>
        )}

        {eventOrder.sections.map((section) => {
          const lines = eventOrder.lines.filter((l) => l.sectionId === section.id);
          return (
            <div key={section.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-heading">{section.name}</p>
                  <SectionFloorPlanLink eventOrderId={eventOrder.id} eventId={eventId} section={section} floorPlans={floorPlans} disabled={isFinalized} />
                </div>
                <div className="flex items-center gap-2">
                  {!isFinalized && (
                    <AddLineSheet
                      eventOrderId={eventOrder.id}
                      eventId={eventId}
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
              {lines.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No items in this section yet.</p>
              ) : (
                <div>
                  {lines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      sections={eventOrder.sections}
                      eventOrderId={eventOrder.id}
                      eventId={eventId}
                      canEdit={!isFinalized}
                      removing={removingId === line.id}
                      onRemove={() => handleRemoveLine(line)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="space-y-2">
          {eventOrder.sections.length > 0 && <p className="text-sm font-semibold text-heading">General</p>}
          {unsectioned.length === 0 ? (
            eventOrder.sections.length > 0 && <p className="text-xs text-muted-foreground py-2">Nothing unsectioned.</p>
          ) : (
            <div>
              {unsectioned.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  sections={eventOrder.sections}
                  eventOrderId={eventOrder.id}
                  eventId={eventId}
                  canEdit={!isFinalized}
                  removing={removingId === line.id}
                  onRemove={() => handleRemoveLine(line)}
                />
              ))}
            </div>
          )}
          {eventOrder.lines.length === 0 && eventOrder.sections.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Nothing added yet. Add items from Offerings, or add sections first.</p>
          )}
        </div>

        {!isFinalized && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
            <AddSectionInline eventOrderId={eventOrder.id} eventId={eventId} disabled={lifecyclePending} />
            <AddLineSheet
              eventOrderId={eventOrder.id}
              eventId={eventId}
              sectionId={null}
              offerings={offerings}
              packages={packages}
              packagesWithItems={packagesWithItems}
              inventoryItems={inventoryItems}
              onAdded={() => refresh()}
            />
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
    <EventOrderZeroTotalConfirmDialog
      open={zeroTotalConfirm !== null}
      actionLabel={zeroTotalConfirm?.kind === "share" ? "Share" : "Finalize"}
      onCancel={handleZeroTotalCancel}
      onContinue={handleZeroTotalContinue}
    />
    </>
  );
}
