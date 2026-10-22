"use client";

/**
 * Event Setup → Change for this event (Vendors).
 * Manages booking vendor assignments. Highlights stay on the Vendors tab.
 * Overview keeps the full management workspace entry point.
 */
import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  assignVendorAction,
  removeVendorAssignmentAction,
} from "@/app/(app)/events/[id]/vendor-actions";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { vendorCategoryLabel } from "@/lib/vendors/constants";
import type { EventVendorAssignment, Vendor } from "@/lib/vendors/types";

export type VendorAssignmentEditorRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string | null;
  vendorPhone: string | null;
};

export function EventVendorsSetupEditor({
  open,
  onOpenChange,
  eventId,
  eventName,
  profileName,
  availableVendors,
  assignments: initialAssignments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  clientName?: string | null;
  profileName: string | null;
  /** Kept for panel compatibility; highlights are managed on the Vendors tab. */
  recommendations?: unknown;
  availableVendors: Vendor[];
  assignments: VendorAssignmentEditorRow[];
  /** Kept for panel wiring; management workspace entry lives on Overview. */
  onOpenManagement?: () => void;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = React.useState(initialAssignments);
  const [vendorId, setVendorId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setAssignments(initialAssignments);
    setVendorId("");
    setRemovingId(null);
  }, [open, initialAssignments]);

  const assignedIds = new Set(assignments.map((a) => a.vendorId));
  const selectable = availableVendors.filter((v) => !assignedIds.has(v.id));

  function requestClose() {
    if (pending || removingId) return;
    onOpenChange(false);
  }

  function addVendor() {
    if (!vendorId) {
      toast.error("Choose a vendor from your Vendor Network.");
      return;
    }
    if (assignedIds.has(vendorId)) {
      toast.error("That vendor is already assigned to this booking.");
      return;
    }
    startTransition(async () => {
      const result = await assignVendorAction(eventId, {
        vendorId,
        arrivalTime: "",
        setupLocation: "",
        loadInNotes: "",
        notes: "",
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not assign vendor.");
        return;
      }
      const assignment = (result as { ok: true; assignment: EventVendorAssignment }).assignment;
      setAssignments((prev) => {
        if (prev.some((a) => a.vendorId === assignment.vendorId || a.id === assignment.id)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: assignment.id,
            vendorId: assignment.vendorId,
            vendorName: assignment.vendorName,
            vendorCategory: assignment.vendorCategory,
            vendorPhone: assignment.vendorPhone,
          },
        ];
      });
      setVendorId("");
      toast.success("Vendor assigned to this booking.");
      router.refresh();
    });
  }

  function removeVendor(row: VendorAssignmentEditorRow) {
    if (!confirm(`Remove ${row.vendorName} from this booking? They remain in your Vendor Network.`)) {
      return;
    }
    setRemovingId(row.id);
    setAssignments((prev) => prev.filter((a) => a.id !== row.id));
    void (async () => {
      const result = await removeVendorAssignmentAction(row.id, eventId);
      setRemovingId(null);
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove vendor.");
        router.refresh();
        return;
      }
      toast.success(`${row.vendorName} removed from this booking.`);
      router.refresh();
    })();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="event-vendors-setup-editor"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Vendors for this event</SheetTitle>
          <SheetDescription>
            {eventName}
            {profileName ? ` · ${profileName}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3" data-testid="vendors-setup-assignments-path">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="vendors-setup-no-assignments">
              No vendors assigned to this booking yet.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="vendors-setup-assignments-list">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                  data-testid={`vendors-setup-assignment-${a.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading truncate">{a.vendorName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {a.vendorCategory ? vendorCategoryLabel(a.vendorCategory) : "Vendor"}
                      {a.vendorPhone ? ` · ${a.vendorPhone}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || removingId === a.id}
                    data-testid={`vendors-setup-remove-assignment-${a.id}`}
                    onClick={() => removeVendor(a)}
                  >
                    {removingId === a.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-md border border-dashed border-border p-3 space-y-2">
            <p className="text-sm font-medium text-heading">Add a vendor</p>
            <Select
              value={vendorId}
              onValueChange={setVendorId}
              items={selectable.map((v) => ({
                value: v.id,
                label: `${v.businessName}${v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}`,
              }))}
            >
              <SelectTrigger data-testid="vendors-setup-vendor-select">
                <SelectValue placeholder={selectable.length === 0 ? "All network vendors are assigned" : "Select a vendor…"} />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.businessName}
                    {v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={pending || !vendorId || selectable.length === 0}
              data-testid="vendors-setup-add-assignment"
              onClick={addVendor}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
              Add vendor
            </Button>
            {availableVendors.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add vendors in Vendor Network first, then assign them here.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={pending || Boolean(removingId)}>
            Back to Overview
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
