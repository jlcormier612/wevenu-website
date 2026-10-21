"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  recommendVendorAction,
  unrecommendVendorAction,
} from "@/app/(app)/events/[id]/vendor-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { vendorCategoryLabel } from "@/lib/vendors/constants";
import { venueRelationshipAvailableToClients } from "@/lib/vendors/list-presentation";
import type { EventVendorRecommendation } from "@/lib/vendor-recommendations/types";
import type { Vendor } from "@/lib/vendors/types";

type AssignmentSummary = {
  id: string;
  vendorName: string;
};

export function EventVendorsSetupEditor({
  open,
  onOpenChange,
  eventId,
  eventName,
  clientName,
  profileName,
  recommendations,
  availableVendors,
  assignments,
  onOpenManagement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  clientName: string | null;
  profileName: string | null;
  recommendations: EventVendorRecommendation[];
  availableVendors: Vendor[];
  assignments: AssignmentSummary[];
  onOpenManagement: () => void;
}) {
  const router = useRouter();
  const recommendedIds = new Set(recommendations.map((r) => r.vendorId));
  const selectable = availableVendors.filter(
    (v) => venueRelationshipAvailableToClients(v.status) && !recommendedIds.has(v.id),
  );

  const [vendorId, setVendorId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setVendorId("");
    setNote("");
  }, [open, recommendations]);

  function requestClose() {
    if (pending) return;
    onOpenChange(false);
  }

  function addHighlight() {
    if (!vendorId) {
      toast.error("Choose a vendor from your Vendor Network.");
      return;
    }
    startTransition(async () => {
      const result = await recommendVendorAction(eventId, vendorId, note.trim() || null);
      if (!result.ok) {
        toast.error(result.message ?? "Could not add this event highlight.");
        return;
      }
      setVendorId("");
      setNote("");
      toast.success("Highlight added for this event only. Vendor Network classifications were not changed.");
      router.refresh();
    });
  }

  function removeHighlight(recommendationId: string, name: string) {
    if (!confirm(`Remove "${name}" as an optional highlight for this event only?\n\nDoes not change Vendor Network classifications or assigned vendors.`)) {
      return;
    }
    startTransition(async () => {
      const result = await unrecommendVendorAction(recommendationId, eventId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove highlight.");
        return;
      }
      toast.success("Highlight removed for this event.");
      router.refresh();
    });
  }

  function openManagement() {
    onOpenChange(false);
    onOpenManagement();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="event-vendors-setup-editor"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Edit vendor highlights for this event</SheetTitle>
          <SheetDescription>
            {eventName}
            {profileName ? ` · from ${profileName}` : ""}
            . Optional highlights suggest vendors to {clientName?.trim() || "this client"} for this booking.
            Preferred / recommended / required classifications stay in Vendor Network.
            Assigning someone to work the event stays in Open Vendors. This does not email vendors,
            invite clients, or release the portal.
          </SheetDescription>
        </SheetHeader>

        <div
          className="mb-4 rounded-md border border-border bg-muted/20 px-3 py-3 space-y-1"
          data-testid="vendors-setup-assignments-state"
        >
          <p className="text-sm font-medium text-heading">Assigned to this booking</p>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet. Assignments are operational confirmations — separate from optional highlights.
              Use Open Vendors to assign someone to work this event.
            </p>
          ) : (
            <ul className="text-sm text-muted-foreground list-disc pl-4">
              {assignments.map((a) => (
                <li key={a.id}>{a.vendorName}</li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            data-testid="vendors-setup-open-management"
            onClick={openManagement}
          >
            Open Vendors
          </Button>
        </div>

        <div className="space-y-3" data-testid="vendors-setup-highlights-path">
          <div>
            <p className="text-sm font-medium text-heading">Optional highlights for this event</p>
            <p className="text-xs text-muted-foreground mt-1">
              Vendor Network remains authoritative for discovery. Highlights are event-only suggestions
              and do not change Library classifications or other events.
            </p>
          </div>

          {recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="vendors-setup-no-highlights">
              No optional highlights on this event yet. Eligible Vendor Network vendors are still
              available for client discovery by default.
            </p>
          ) : (
            <ul className="space-y-2">
              {recommendations.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                  data-testid={`vendors-setup-highlight-${r.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading truncate">{r.vendorName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {r.vendorCategory ? vendorCategoryLabel(r.vendorCategory) : "Vendor"}
                      {r.selectedAt ? " · chosen by client" : ""}
                    </p>
                    {r.note ? <p className="text-xs italic text-muted-foreground mt-0.5">{r.note}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    data-testid={`vendors-setup-remove-${r.id}`}
                    onClick={() => removeHighlight(r.id, r.vendorName)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-md border border-dashed border-border p-3 space-y-2">
            <p className="text-sm font-medium text-heading">Add a highlight for this event</p>
            <Select
              value={vendorId}
              onValueChange={setVendorId}
              items={selectable.map((v) => ({
                value: v.id,
                label: `${v.businessName}${v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}`,
              }))}
            >
              <SelectTrigger data-testid="vendors-setup-vendor-select">
                <SelectValue placeholder="Choose a Vendor Network vendor" />
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
            <Input
              placeholder="Note to the client (optional)"
              value={note}
              disabled={pending}
              data-testid="vendors-setup-note"
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || !vendorId || selectable.length === 0}
              data-testid="vendors-setup-add-highlight"
              onClick={addHighlight}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
              Add highlight
            </Button>
            {availableVendors.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add vendors in Vendor Network first, then return here to highlight them for this event.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={pending}>
            Back to Overview
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
