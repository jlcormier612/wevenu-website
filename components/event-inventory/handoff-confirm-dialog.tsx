"use client";

/**
 * Inventory → Event Order handoff confirmation.
 * Explicit one-way snapshot; name matches are advisory; Add/Skip per row.
 */

import * as React from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildHandoffPreviewRows,
  type EventOrderLineNameRef,
  type InventoryHandoffItem,
} from "@/lib/event-inventory/handoff";

type PendingItem = InventoryHandoffItem & { name: string };

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function HandoffConfirmDialog({
  open,
  onOpenChange,
  pendingItems,
  existingLines,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingItems: PendingItem[];
  existingLines: EventOrderLineNameRef[];
  busy: boolean;
  onConfirm: (itemIdsToAdd: string[]) => void;
}) {
  const rows = React.useMemo(
    () => buildHandoffPreviewRows(pendingItems, existingLines),
    [pendingItems, existingLines],
  );
  const [actions, setActions] = React.useState<Record<string, "add" | "skip">>({});

  React.useEffect(() => {
    if (!open) return;
    const next: Record<string, "add" | "skip"> = {};
    for (const row of rows) next[row.itemId] = row.defaultAction;
    setActions(next);
  }, [open, rows]);

  const addCount = rows.filter((r) => (actions[r.itemId] ?? r.defaultAction) === "add").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="inventory-handoff-confirm">
        <DialogHeader>
          <DialogTitle>Copy items to Event Order</DialogTitle>
          <DialogDescription>
            Creates a one-way snapshot on the Event Order. Later changes to this item list will not
            update the Event Order automatically. This is not an invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="htc-surface-guidance space-y-1 rounded-md px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-heading">Matching names are not automatically the same charge.</p>
          <p>Review each row. Skip when an Event Order line already covers the commercial decision.</p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible items to copy.</p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            <div className="hidden grid-cols-[1.4fr_3rem_5rem_1fr_6.5rem] gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span>Role</span>
              <span>Possible match</span>
              <span className="text-right">Action</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.itemId}
                className="grid grid-cols-1 gap-2 rounded-md border border-border px-3 py-2.5 text-sm sm:grid-cols-[1.4fr_3rem_5rem_1fr_6.5rem] sm:items-center"
                data-testid={`handoff-row-${row.itemId}`}
              >
                <div>
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(row.unitPrice)} each</p>
                </div>
                <p className="text-right text-muted-foreground">×{row.quantity}</p>
                <p>
                  <span className="text-xs text-muted-foreground">
                    {row.isIncluded ? "Included" : "Additional"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.possibleMatch
                    ? `Possible match: ${row.possibleMatch.description}`
                    : "None"}
                </p>
                <div className="sm:justify-self-end">
                  <Select
                    value={actions[row.itemId] ?? row.defaultAction}
                    onValueChange={(v) =>
                      setActions((prev) => ({ ...prev, [row.itemId]: v as "add" | "skip" }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full sm:w-[6.5rem]" data-testid={`handoff-action-${row.itemId}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add</SelectItem>
                      <SelectItem value="skip">Skip</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Items already copied are omitted. Skipped rows stay on this list for a later handoff.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || addCount === 0}
            data-testid="handoff-confirm-add"
            onClick={() => {
              const ids = rows
                .filter((r) => (actions[r.itemId] ?? r.defaultAction) === "add")
                .map((r) => r.itemId);
              onConfirm(ids);
            }}
          >
            {busy ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Adding…</>
            ) : (
              `Add ${addCount} item${addCount === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
