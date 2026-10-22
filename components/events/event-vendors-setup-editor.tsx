"use client";

/**
 * Event Setup → Change for this event (Vendors).
 * Booking assignments + client-facing recommendations for this event only.
 * Overview keeps the full Vendors management workspace entry point.
 */
import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  assignVendorAction,
  recommendVendorAction,
  removeVendorAssignmentAction,
  unrecommendVendorAction,
} from "@/app/(app)/events/[id]/vendor-actions";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { vendorCategoryLabel } from "@/lib/vendors/constants";
import type { EventVendorRecommendation } from "@/lib/vendor-recommendations/types";
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
  recommendations: initialRecommendations = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  clientName?: string | null;
  profileName: string | null;
  recommendations?: EventVendorRecommendation[];
  availableVendors: Vendor[];
  assignments: VendorAssignmentEditorRow[];
  /** Kept for panel wiring; management workspace entry lives on Overview. */
  onOpenManagement?: () => void;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = React.useState(initialAssignments);
  const [recommendations, setRecommendations] = React.useState(initialRecommendations);
  const [assignVendorId, setAssignVendorId] = React.useState("");
  const [recommendVendorId, setRecommendVendorId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setAssignments(initialAssignments);
      setRecommendations(initialRecommendations);
      setAssignVendorId("");
      setRecommendVendorId("");
      setBusyId(null);
    }
    wasOpen.current = open;
  }, [open, initialAssignments, initialRecommendations]);

  const assignedIds = new Set(assignments.map((a) => a.vendorId));
  const recommendedIds = new Set(recommendations.map((r) => r.vendorId));
  const assignable = availableVendors.filter((v) => !assignedIds.has(v.id));
  const recommendable = availableVendors.filter((v) => !recommendedIds.has(v.id));

  function requestClose() {
    if (pending || busyId) return;
    onOpenChange(false);
  }

  function addAssignment() {
    if (!assignVendorId) {
      toast.error("Choose a vendor from your Vendor Network.");
      return;
    }
    if (assignedIds.has(assignVendorId)) {
      toast.error("That vendor is already assigned to this booking.");
      return;
    }
    startTransition(async () => {
      const result = await assignVendorAction(eventId, {
        vendorId: assignVendorId,
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
      setAssignVendorId("");
      toast.success("Vendor assigned to this booking.");
      router.refresh();
    });
  }

  function removeAssignment(row: VendorAssignmentEditorRow) {
    if (!confirm(`Remove ${row.vendorName} from this booking? They remain in your Vendor Network.`)) {
      return;
    }
    setBusyId(row.id);
    setAssignments((prev) => prev.filter((a) => a.id !== row.id));
    void (async () => {
      const result = await removeVendorAssignmentAction(row.id, eventId);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove vendor.");
        router.refresh();
        return;
      }
      toast.success(`${row.vendorName} removed from this booking.`);
      router.refresh();
    })();
  }

  function replaceAssignment(row: VendorAssignmentEditorRow, nextVendorId: string) {
    if (!nextVendorId || nextVendorId === row.vendorId) return;
    if (assignedIds.has(nextVendorId)) {
      toast.error("That vendor is already assigned to this booking.");
      return;
    }
    const next = availableVendors.find((v) => v.id === nextVendorId);
    if (!next) {
      toast.error("Choose an available vendor.");
      return;
    }
    setBusyId(row.id);
    void (async () => {
      const removed = await removeVendorAssignmentAction(row.id, eventId);
      if (!removed.ok) {
        setBusyId(null);
        toast.error(removed.message ?? "Could not replace vendor.");
        router.refresh();
        return;
      }
      const added = await assignVendorAction(eventId, {
        vendorId: nextVendorId,
        arrivalTime: "",
        setupLocation: "",
        loadInNotes: "",
        notes: "",
      });
      setBusyId(null);
      if (!added.ok) {
        toast.error(added.message ?? "Removed the prior vendor but could not assign the replacement.");
        router.refresh();
        return;
      }
      const assignment = (added as { ok: true; assignment: EventVendorAssignment }).assignment;
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === row.id
            ? {
                id: assignment.id,
                vendorId: assignment.vendorId,
                vendorName: assignment.vendorName,
                vendorCategory: assignment.vendorCategory,
                vendorPhone: assignment.vendorPhone,
              }
            : a,
        ).filter((a, i, arr) => arr.findIndex((x) => x.vendorId === a.vendorId) === i),
      );
      toast.success(`Replaced with ${assignment.vendorName}.`);
      router.refresh();
    })();
  }

  function addRecommendation() {
    if (!recommendVendorId) {
      toast.error("Choose a vendor to recommend.");
      return;
    }
    if (recommendedIds.has(recommendVendorId)) {
      toast.error("That vendor is already recommended for this event.");
      return;
    }
    startTransition(async () => {
      const result = await recommendVendorAction(eventId, recommendVendorId, null);
      if (!result.ok) {
        toast.error(result.message ?? "Could not add recommendation.");
        return;
      }
      const vendor = availableVendors.find((v) => v.id === recommendVendorId);
      setRecommendations((prev) => {
        if (prev.some((r) => r.vendorId === recommendVendorId)) return prev;
        return [
          ...prev,
          {
            id: `optimistic-${recommendVendorId}`,
            venueId: "",
            eventId,
            vendorId: recommendVendorId,
            note: null,
            recommendedAt: new Date().toISOString(),
            selectedAt: null,
            createdAt: new Date().toISOString(),
            vendorName: vendor?.businessName ?? "Vendor",
            vendorCategory: vendor?.category ?? null,
          },
        ];
      });
      setRecommendVendorId("");
      toast.success("Vendor recommended for this event.");
      router.refresh();
    });
  }

  function removeRecommendation(row: EventVendorRecommendation) {
    if (!confirm(`Remove ${row.vendorName} from this event's recommendations? They stay in your Vendor Network.`)) {
      return;
    }
    setBusyId(row.id);
    setRecommendations((prev) => prev.filter((r) => r.id !== row.id));
    void (async () => {
      const result = await unrecommendVendorAction(row.id, eventId);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove recommendation.");
        router.refresh();
        return;
      }
      toast.success("Recommendation removed for this event.");
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

        <div className="space-y-6">
          <div className="space-y-3" data-testid="vendors-setup-assignments-path">
            <p className="text-sm font-medium text-heading">Assigned to this booking</p>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="vendors-setup-no-assignments">
                No vendors assigned yet.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="vendors-setup-assignments-list">
                {assignments.map((a) => {
                  const replaceOptions = availableVendors.filter(
                    (v) => v.id === a.vendorId || !assignedIds.has(v.id),
                  );
                  return (
                    <li
                      key={a.id}
                      className="space-y-2 rounded-md border border-border px-3 py-2"
                      data-testid={`vendors-setup-assignment-${a.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
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
                          disabled={pending || busyId === a.id}
                          data-testid={`vendors-setup-remove-assignment-${a.id}`}
                          onClick={() => removeAssignment(a)}
                        >
                          {busyId === a.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                          Remove
                        </Button>
                      </div>
                      <Select
                        value={a.vendorId}
                        onValueChange={(v) => { if (v) replaceAssignment(a, v); }}
                        items={replaceOptions.map((v) => ({
                          value: v.id,
                          label: `${v.businessName}${v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}`,
                        }))}
                        disabled={pending || busyId === a.id}
                      >
                        <SelectTrigger data-testid={`vendors-setup-replace-assignment-${a.id}`}>
                          <SelectValue placeholder="Replace with…" />
                        </SelectTrigger>
                        <SelectContent>
                          {replaceOptions.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.businessName}
                              {v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="rounded-md border border-dashed border-border p-3 space-y-2">
              <p className="text-sm font-medium text-heading">Add assignment</p>
              <Select
                value={assignVendorId}
                onValueChange={setAssignVendorId}
                items={assignable.map((v) => ({
                  value: v.id,
                  label: `${v.businessName}${v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}`,
                }))}
              >
                <SelectTrigger data-testid="vendors-setup-vendor-select">
                  <SelectValue placeholder={assignable.length === 0 ? "All network vendors are assigned" : "Select a vendor…"} />
                </SelectTrigger>
                <SelectContent>
                  {assignable.map((v) => (
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
                disabled={pending || !assignVendorId || assignable.length === 0}
                data-testid="vendors-setup-add-assignment"
                onClick={addAssignment}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                Add vendor
              </Button>
            </div>
          </div>

          <div className="space-y-3" data-testid="vendors-setup-recommendations-path">
            <p className="text-sm font-medium text-heading">Client-facing recommendations</p>
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="vendors-setup-no-recommendations">
                No recommendations for this event yet.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="vendors-setup-recommendations-list">
                {recommendations.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                    data-testid={`vendors-setup-recommendation-${r.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-heading truncate">{r.vendorName}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.vendorCategory ? vendorCategoryLabel(r.vendorCategory) : "Vendor"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending || busyId === r.id || r.id.startsWith("optimistic-")}
                      data-testid={`vendors-setup-remove-recommendation-${r.id}`}
                      onClick={() => removeRecommendation(r)}
                    >
                      {busyId === r.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-md border border-dashed border-border p-3 space-y-2">
              <p className="text-sm font-medium text-heading">Add recommendation</p>
              <Select
                value={recommendVendorId}
                onValueChange={setRecommendVendorId}
                items={recommendable.map((v) => ({
                  value: v.id,
                  label: `${v.businessName}${v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}`,
                }))}
              >
                <SelectTrigger data-testid="vendors-setup-recommend-select">
                  <SelectValue placeholder={recommendable.length === 0 ? "All network vendors are recommended" : "Select a vendor…"} />
                </SelectTrigger>
                <SelectContent>
                  {recommendable.map((v) => (
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
                disabled={pending || !recommendVendorId || recommendable.length === 0}
                data-testid="vendors-setup-add-recommendation"
                onClick={addRecommendation}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                Add recommendation
              </Button>
              {availableVendors.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add vendors in Vendor Network first.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={pending || Boolean(busyId)}>
            Back to Overview
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
