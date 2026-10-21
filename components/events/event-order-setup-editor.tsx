"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addCustomLineAction,
  ensureEventOrderAction,
  removeLineAction,
  replaceEventOrderFromTemplateAction,
  updateLineAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type { EventOrderTemplate } from "@/lib/event-order-templates/types";
import type { EventOrderLine, EventOrderWithDetails } from "@/lib/event-orders/types";

type DraftRow = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  isIncluded: boolean;
  dirty: boolean;
};

function toDraftRows(lines: EventOrderLine[]): DraftRow[] {
  return [...lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      id: l.id,
      description: l.description,
      quantity: String(l.quantity),
      unitPrice: l.unitPrice == null ? "" : String(l.unitPrice),
      isIncluded: l.isIncluded,
      dirty: false,
    }));
}

export function EventOrderSetupEditor({
  open,
  onOpenChange,
  eventId,
  eventName,
  profileName,
  preferredTemplateId,
  templates,
  eventOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  profileName: string | null;
  preferredTemplateId: string | null;
  templates: EventOrderTemplate[];
  eventOrder: EventOrderWithDetails | null;
}) {
  const router = useRouter();
  const activeTemplates = templates.filter((t) => !t.isArchived);
  const [mode, setMode] = React.useState<"template" | "customize">("customize");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(
    preferredTemplateId && activeTemplates.some((t) => t.id === preferredTemplateId)
      ? preferredTemplateId
      : activeTemplates[0]?.id ?? "",
  );
  const [rows, setRows] = React.useState<DraftRow[]>(() => toDraftRows(eventOrder?.lines ?? []));
  const [newDescription, setNewDescription] = React.useState("");
  const [newQty, setNewQty] = React.useState("1");
  const [pending, startTransition] = React.useTransition();
  const [ensuring, setEnsuring] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelectedTemplateId(
      (eventOrder?.templateId && activeTemplates.some((t) => t.id === eventOrder.templateId)
        ? eventOrder.templateId
        : null)
      ?? (preferredTemplateId && activeTemplates.some((t) => t.id === preferredTemplateId)
        ? preferredTemplateId
        : activeTemplates[0]?.id ?? ""),
    );
    setRows(toDraftRows(eventOrder?.lines ?? []));
    setMode("customize");
    setNewDescription("");
    setNewQty("1");
  }, [open, eventOrder, preferredTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!open || eventOrder || !preferredTemplateId) return;
    if (!activeTemplates.some((t) => t.id === preferredTemplateId)) return;
    let cancelled = false;
    setEnsuring(true);
    void (async () => {
      const result = await ensureEventOrderAction(eventId, preferredTemplateId);
      if (cancelled) return;
      setEnsuring(false);
      if (!result.ok) toast.error(result.message ?? "Could not prepare Event Order for this event.");
      else router.refresh();
    })();
    return () => { cancelled = true; };
  }, [open, eventOrder, preferredTemplateId, eventId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyCustomize = rows.some((r) => r.dirty) || Boolean(newDescription.trim());
  const currentTemplateName =
    activeTemplates.find((t) => t.id === (eventOrder?.templateId ?? preferredTemplateId))?.name
    ?? null;
  const templateChanged = Boolean(
    selectedTemplateId
    && eventOrder?.templateId
    && selectedTemplateId !== eventOrder.templateId,
  );
  const locked = Boolean(
    eventOrder && (eventOrder.status !== "open" || eventOrder.sharedAt),
  );

  function requestClose() {
    if (pending) return;
    if ((mode === "customize" && dirtyCustomize) || (mode === "template" && templateChanged)) {
      if (!confirm("You have unsaved changes. Leave without saving?")) return;
    }
    onOpenChange(false);
  }

  function switchMode(next: "template" | "customize") {
    if (next === mode) return;
    if (mode === "customize" && dirtyCustomize) {
      if (!confirm("You have unsaved Event Order edits. Switch anyway?")) return;
    }
    if (mode === "template" && templateChanged) {
      if (!confirm("You selected a different package but have not applied it. Switch anyway?")) return;
    }
    setMode(next);
  }

  function applyTemplate() {
    if (!selectedTemplateId) {
      toast.error("Choose an Event Order package.");
      return;
    }
    if (
      !confirm(
        "Replace this event's Event Order contents with the selected package?\n\n"
        + "Current open lines and sections on this event will be removed and replaced. "
        + "The Library package will not change. This does not share, finalize, or create an invoice.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await replaceEventOrderFromTemplateAction(eventId, selectedTemplateId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not switch the Event Order package.");
        return;
      }
      toast.success("This event's Event Order now uses the selected package. The Library was not changed.");
      router.refresh();
      onOpenChange(false);
    });
  }

  function saveRow(row: DraftRow) {
    if (!eventOrder) return;
    const line = eventOrder.lines.find((l) => l.id === row.id);
    startTransition(async () => {
      const result = await updateLineAction(eventOrder.id, eventId, row.id, {
        description: row.description,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        isIncluded: row.isIncluded,
        sectionId: line?.sectionId ?? null,
        notes: line?.notes ?? "",
        descriptionDetail: line?.descriptionDetail ?? "",
        unit: line?.unit ?? "",
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not save line.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, dirty: false } : r)));
      toast.success("Event Order line saved for this event.");
      router.refresh();
    });
  }

  function removeRow(row: DraftRow) {
    if (!eventOrder) return;
    if (!confirm(`Remove "${row.description}" from this event's Event Order only?`)) return;
    startTransition(async () => {
      const result = await removeLineAction(eventOrder.id, eventId, row.id, row.description);
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove line.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Line removed from this event.");
      router.refresh();
    });
  }

  function addRow() {
    if (!eventOrder) {
      toast.error("Event Order draft is still preparing — try again in a moment.");
      return;
    }
    const description = newDescription.trim();
    if (!description) {
      toast.error("Enter a line description.");
      return;
    }
    startTransition(async () => {
      const result = await addCustomLineAction(eventOrder.id, eventId, {
        description,
        quantity: newQty,
        unitPrice: "",
        sectionId: null,
        isIncluded: true,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not add line.");
        return;
      }
      setNewDescription("");
      toast.success("Line added to this event's Event Order.");
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="event-order-setup-editor"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Edit Event Order for this event</SheetTitle>
          <SheetDescription>
            {eventName}
            {profileName ? ` · from ${profileName}` : ""}
            . Changes apply only to this event and do not update the reusable Library package.
            Sharing, finalization, and invoices stay in the Event Order workspace — not here.
          </SheetDescription>
        </SheetHeader>

        {ensuring ? (
          <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing this event&apos;s Event Order draft…
          </p>
        ) : null}

        {locked ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {eventOrder?.status !== "open"
              ? "This Event Order is finalized. Use Open Event Order to reopen before setup edits."
              : "This Event Order was already shared. Use Open Event Order for further changes so the shared snapshot stays intentional."}
          </p>
        ) : null}

        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "template" ? "default" : "outline"}
            data-testid="event-order-setup-mode-template"
            onClick={() => switchMode("template")}
            disabled={pending || locked}
          >
            Choose a different package
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "customize" ? "default" : "outline"}
            data-testid="event-order-setup-mode-customize"
            onClick={() => switchMode("customize")}
            disabled={pending || locked}
          >
            Customize this event&apos;s order
          </Button>
        </div>

        {mode === "template" ? (
          <div className="space-y-3" data-testid="event-order-setup-template-path">
            <p className="text-sm text-muted-foreground">
              Current package:{" "}
              <span className="font-medium text-foreground">{currentTemplateName ?? "None yet"}</span>
            </p>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              items={activeTemplates.map((t) => ({ value: t.id, label: t.name }))}
            >
              <SelectTrigger data-testid="event-order-setup-template-select">
                <SelectValue placeholder="Select an Event Order package" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Applying replaces this event&apos;s open lines and sections. Blocked after share or finalize.
              The Library package is unchanged. Not an invoice or payment plan.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={pending || locked || !selectedTemplateId}
              data-testid="event-order-setup-apply-template"
              onClick={applyTemplate}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply package to this event"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="event-order-setup-customize-path">
            {!eventOrder && !ensuring ? (
              <p className="text-sm text-muted-foreground">
                No Event Order draft on this event yet. Choose a package first, or confirm the Setup Profile
                has a starting package selected.
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {rows.map((row) => (
                    <li key={row.id} className="rounded-md border border-border p-3 space-y-2">
                      <Input
                        value={row.description}
                        aria-label="Event Order line description"
                        disabled={pending || locked}
                        onChange={(e) => {
                          const description = e.target.value;
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, description, dirty: true } : r)),
                          );
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-muted-foreground">
                          Qty
                          <Input
                            type="number"
                            className="mt-1 w-20"
                            value={row.quantity}
                            disabled={pending || locked}
                            onChange={(e) => {
                              const quantity = e.target.value;
                              setRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, quantity, dirty: true } : r)),
                              );
                            }}
                          />
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || locked || !row.dirty}
                          onClick={() => saveRow(row)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending || locked}
                          onClick={() => removeRow(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                  <p className="text-sm font-medium text-heading">Add a custom line for this event</p>
                  <Input
                    placeholder="Description"
                    value={newDescription}
                    disabled={pending || locked || !eventOrder}
                    data-testid="event-order-setup-new-description"
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-muted-foreground">
                      Qty
                      <Input
                        type="number"
                        className="mt-1 w-20"
                        value={newQty}
                        disabled={pending || locked}
                        onChange={(e) => setNewQty(e.target.value)}
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || locked || !eventOrder}
                      data-testid="event-order-setup-add-line"
                      onClick={addRow}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add line
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={pending}>
            Back to Overview
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
