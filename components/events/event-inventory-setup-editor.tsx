"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventInventoryItemAction,
  ensureEventInventoryAction,
  removeEventInventoryItemAction,
  replaceEventInventoryFromTemplateAction,
  updateEventInventoryItemAction,
} from "@/app/(app)/events/[id]/event-inventory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type {
  EventInventoryItem,
  EventInventoryWithDetails,
  InventoryTemplate,
} from "@/lib/event-inventory/types";

type DraftRow = {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
  isIncluded: boolean;
  updatedAt: string;
  dirty: boolean;
  addedToEventOrderAt: string | null;
};

function toDraftRows(items: EventInventoryItem[]): DraftRow[] {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({
      id: i.id,
      name: i.name,
      quantity: String(i.quantity),
      unitPrice: i.unitPrice == null ? "" : String(i.unitPrice),
      isIncluded: i.isIncluded,
      updatedAt: i.updatedAt,
      dirty: false,
      addedToEventOrderAt: i.addedToEventOrderAt,
    }));
}

export function EventInventorySetupEditor({
  open,
  onOpenChange,
  eventId,
  eventName,
  profileName,
  preferredTemplateId,
  templates,
  eventInventory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  profileName: string | null;
  preferredTemplateId: string | null;
  templates: InventoryTemplate[];
  eventInventory: EventInventoryWithDetails | null;
}) {
  const router = useRouter();
  const activeTemplates = templates.filter((t) => !t.isArchived);
  const [mode, setMode] = React.useState<"template" | "customize">("customize");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(
    preferredTemplateId && activeTemplates.some((t) => t.id === preferredTemplateId)
      ? preferredTemplateId
      : activeTemplates[0]?.id ?? "",
  );
  const [rows, setRows] = React.useState<DraftRow[]>(() => toDraftRows(eventInventory?.items ?? []));
  const [newName, setNewName] = React.useState("");
  const [newQty, setNewQty] = React.useState("1");
  const [pending, startTransition] = React.useTransition();
  const [ensuring, setEnsuring] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelectedTemplateId(
      (eventInventory?.templateId && activeTemplates.some((t) => t.id === eventInventory.templateId)
        ? eventInventory.templateId
        : null)
      ?? (preferredTemplateId && activeTemplates.some((t) => t.id === preferredTemplateId)
        ? preferredTemplateId
        : activeTemplates[0]?.id ?? ""),
    );
    setRows(toDraftRows(eventInventory?.items ?? []));
    setMode("customize");
    setNewName("");
    setNewQty("1");
  }, [open, eventInventory, preferredTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recover missing draft once via established ensure (idempotent) — not a second Prepare CTA.
  React.useEffect(() => {
    if (!open || eventInventory || !preferredTemplateId) return;
    if (!activeTemplates.some((t) => t.id === preferredTemplateId)) return;
    let cancelled = false;
    setEnsuring(true);
    void (async () => {
      const result = await ensureEventInventoryAction(eventId, preferredTemplateId);
      if (cancelled) return;
      setEnsuring(false);
      if (!result.ok) toast.error(result.message ?? "Could not prepare Event Inventory for this event.");
      else router.refresh();
    })();
    return () => { cancelled = true; };
  }, [open, eventInventory, preferredTemplateId, eventId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyCustomize = rows.some((r) => r.dirty) || Boolean(newName.trim());
  const currentTemplateName =
    activeTemplates.find((t) => t.id === (eventInventory?.templateId ?? preferredTemplateId))?.name
    ?? null;
  const templateChanged = Boolean(
    selectedTemplateId
    && eventInventory?.templateId
    && selectedTemplateId !== eventInventory.templateId,
  );
  const locked = eventInventory != null && eventInventory.status !== "draft";

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
      if (!confirm("You have unsaved inventory edits. Switch anyway?")) return;
    }
    if (mode === "template" && templateChanged) {
      if (!confirm("You selected a different offering but have not applied it. Switch anyway?")) return;
    }
    setMode(next);
  }

  function applyTemplate() {
    if (!selectedTemplateId) {
      toast.error("Choose an Inventory offering template.");
      return;
    }
    if (
      !confirm(
        "Replace this event's inventory items with the selected offering?\n\n"
        + "Current draft items on this event will be removed and replaced. "
        + "The Library template will not change. This does not share inventory or create invoices.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await replaceEventInventoryFromTemplateAction(eventId, selectedTemplateId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not switch the inventory offering.");
        return;
      }
      toast.success("This event's inventory now uses the selected offering. The Library was not changed.");
      router.refresh();
      onOpenChange(false);
    });
  }

  function saveRow(row: DraftRow) {
    if (!eventInventory) return;
    startTransition(async () => {
      const result = await updateEventInventoryItemAction(
        eventInventory.id,
        eventId,
        row.id,
        {
          name: row.name,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          isIncluded: row.isIncluded,
          category: "",
          notes: "",
          inventoryItemId: null,
        },
        row.updatedAt,
      );
      if (!result.ok) {
        toast.error(result.message ?? "Could not save inventory item.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, dirty: false } : r)));
      toast.success("Inventory item saved for this event.");
      router.refresh();
    });
  }

  function removeRow(row: DraftRow) {
    if (!eventInventory) return;
    if (row.addedToEventOrderAt) {
      toast.error("This item was already added to the Event Order. Remove it from the Inventory workspace if needed.");
      return;
    }
    if (!confirm(`Remove "${row.name}" from this event's inventory only?`)) return;
    startTransition(async () => {
      const result = await removeEventInventoryItemAction(eventInventory.id, eventId, row.id, row.name);
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove item.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Item removed from this event.");
      router.refresh();
    });
  }

  function addRow() {
    if (!eventInventory) {
      toast.error("Inventory draft is still preparing — try again in a moment.");
      return;
    }
    const name = newName.trim();
    if (!name) {
      toast.error("Enter an item name.");
      return;
    }
    startTransition(async () => {
      const result = await addEventInventoryItemAction(eventInventory.id, eventId, {
        name,
        quantity: newQty,
        unitPrice: "",
        isIncluded: true,
        category: "",
        notes: "",
        inventoryItemId: null,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not add item.");
        return;
      }
      setNewName("");
      toast.success("Item added to this event's inventory.");
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="event-inventory-setup-editor"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Edit inventory for this event</SheetTitle>
          <SheetDescription>
            {eventName}
            {profileName ? ` · from ${profileName}` : ""}
            . Changes apply only to this event and do not update the reusable Library offering.
            Sharing and Event Order handoff stay in the Inventory workspace — not here.
          </SheetDescription>
        </SheetHeader>

        {ensuring ? (
          <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing this event&apos;s inventory draft…
          </p>
        ) : null}

        {locked ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This Event Inventory is {eventInventory?.status}. Use Open Inventory for share/finalize/reopen.
            Setup edits are available while the draft is open.
          </p>
        ) : null}

        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "template" ? "default" : "outline"}
            data-testid="inventory-setup-mode-template"
            onClick={() => switchMode("template")}
            disabled={pending || locked}
          >
            Choose a different offering
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "customize" ? "default" : "outline"}
            data-testid="inventory-setup-mode-customize"
            onClick={() => switchMode("customize")}
            disabled={pending || locked}
          >
            Customize this event&apos;s inventory
          </Button>
        </div>

        {mode === "template" ? (
          <div className="space-y-3" data-testid="inventory-setup-template-path">
            <p className="text-sm text-muted-foreground">
              Current offering:{" "}
              <span className="font-medium text-foreground">{currentTemplateName ?? "None yet"}</span>
            </p>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              items={activeTemplates.map((t) => ({ value: t.id, label: t.name }))}
            >
              <SelectTrigger data-testid="inventory-setup-template-select">
                <SelectValue placeholder="Select an Inventory offering" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Applying replaces this event&apos;s draft items. Blocked after share/finalize or when items
              were already added to the Event Order. The Library offering is unchanged.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={pending || locked || !selectedTemplateId}
              data-testid="inventory-setup-apply-template"
              onClick={applyTemplate}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply offering to this event"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="inventory-setup-customize-path">
            {!eventInventory && !ensuring ? (
              <p className="text-sm text-muted-foreground">
                No inventory draft on this event yet. Choose an offering first, or confirm the Setup Profile
                has a starting offering selected.
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {rows.map((row) => (
                    <li key={row.id} className="rounded-md border border-border p-3 space-y-2">
                      <Input
                        value={row.name}
                        aria-label="Inventory item name"
                        disabled={pending || locked}
                        onChange={(e) => {
                          const name = e.target.value;
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, name, dirty: true } : r)),
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
                          disabled={pending || locked || Boolean(row.addedToEventOrderAt)}
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
                  <p className="text-sm font-medium text-heading">Add an item for this event</p>
                  <Input
                    placeholder="Item name"
                    value={newName}
                    disabled={pending || locked || !eventInventory}
                    data-testid="inventory-setup-new-name"
                    onChange={(e) => setNewName(e.target.value)}
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
                      disabled={pending || locked || !eventInventory}
                      data-testid="inventory-setup-add-item"
                      onClick={addRow}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add item
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
