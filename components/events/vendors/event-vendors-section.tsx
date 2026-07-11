"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle, Circle, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  assignVendorAction,
  removeVendorAssignmentAction,
} from "@/app/(app)/events/[id]/vendor-actions";
import { VendorCategoryBadge } from "@/components/vendors/vendor-category-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, vendorCategoryLabel } from "@/lib/vendors/constants";
import type { EventVendorAssignment, Vendor } from "@/lib/vendors/types";

// ── Check-in badge ────────────────────────────────────────────────────────────

function CheckinBadge({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold"
      style={{ color: checked ? "#3D6B4F" : "#AAA" }}>
      {checked
        ? <CheckCircle className="h-3 w-3" />
        : <Circle className="h-3 w-3" />}
      {label}
    </span>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function EventVendorsSection({
  eventId,
  initialAssignments,
  availableVendors,
}: {
  eventId: string;
  initialAssignments: EventVendorAssignment[];
  availableVendors: Vendor[];
}) {
  const router = useRouter();
  const [assignments, setAssignments] = React.useState(initialAssignments);
  const [showForm, setShowForm]       = React.useState(false);
  const [vendorId, setVendorId]       = React.useState("");
  const [arrivalTime, setArrivalTime] = React.useState("");
  const [setupLocation, setSetupLocation] = React.useState("");
  const [loadInNotes, setLoadInNotes] = React.useState("");
  const [notes, setNotes]             = React.useState("");
  const [addPending, startAdd]        = React.useTransition();

  const preferred    = availableVendors.filter(v => v.isPreferred);
  const others       = availableVendors.filter(v => !v.isPreferred);
  const assignedIds  = new Set(assignments.map(a => a.vendorId));
  const unassigned   = availableVendors.filter(v => !assignedIds.has(v.id));

  function resetForm() {
    setVendorId(""); setArrivalTime(""); setSetupLocation("");
    setLoadInNotes(""); setNotes(""); setShowForm(false);
  }

  function handleAdd() {
    if (!vendorId) return;
    startAdd(async () => {
      const result = await assignVendorAction(eventId, {
        vendorId, arrivalTime, setupLocation, loadInNotes, notes,
      });
      if (result.ok && "assignment" in result) {
        setAssignments(prev => [...prev, result.assignment]);
        resetForm();
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.message ?? "Could not assign vendor.");
      }
    });
  }

  async function handleRemove(assignmentId: string) {
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    const result = await removeVendorAssignmentAction(assignmentId, eventId);
    if (!result.ok) { toast.error("Could not remove vendor."); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      {/* Assignment list */}
      {assignments.length === 0 && !showForm && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No vendors assigned. Assign vendors from your directory to track who&apos;s involved and when they arrive.
        </p>
      )}

      {assignments.length > 0 && (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id}
              className="group rounded-lg border border-border bg-card p-3 space-y-2">

              {/* Row 1: Name + remove */}
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/vendors/${a.vendorId}`}
                      className="text-sm font-medium text-foreground hover:text-primary">
                      {a.vendorName}
                    </Link>
                    <VendorCategoryBadge category={a.vendorCategory} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {a.arrivalTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Arriving {formatTime(a.arrivalTime)}
                      </span>
                    )}
                    {a.setupLocation && (
                      <span className="italic">{a.setupLocation}</span>
                    )}
                    {a.vendorPhone && <span>{a.vendorPhone}</span>}
                    {a.notes && <span className="italic">{a.notes}</span>}
                  </div>
                </div>
                <button type="button"
                  onClick={() => handleRemove(a.id)}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="Remove vendor">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Row 2: Check-in status */}
              <div className="flex items-center gap-3 pt-0.5 border-t border-border/50">
                <CheckinBadge label="Arrived"       checked={!!a.checkedInAt} />
                <CheckinBadge label="Setup done"    checked={!!a.setupCompleteAt} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign form */}
      {showForm ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          {/* Vendor select */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-vendor" className="text-xs">Vendor *</Label>
            <Select
              value={vendorId}
              onValueChange={setVendorId}
              items={[...preferred, ...others]
                .filter(v => !assignedIds.has(v.id))
                .map(v => ({ value: v.id, label: `${v.businessName}${v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}` }))}
            >
              <SelectTrigger id="ev-vendor">
                <SelectValue placeholder="Select a vendor…" />
              </SelectTrigger>
              <SelectContent>
                {preferred.filter(v => !assignedIds.has(v.id)).length > 0 && (
                  <>
                    <SelectItem value="__pref__" disabled>⭐ Preferred Vendors</SelectItem>
                    {preferred.filter(v => !assignedIds.has(v.id)).map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.businessName}{v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}
                      </SelectItem>
                    ))}
                  </>
                )}
                {others.filter(v => !assignedIds.has(v.id)).length > 0 && (
                  <>
                    {preferred.filter(v => !assignedIds.has(v.id)).length > 0 && (
                      <SelectItem value="__other__" disabled>Other Vendors</SelectItem>
                    )}
                    {others.filter(v => !assignedIds.has(v.id)).map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.businessName}{v.category ? ` · ${vendorCategoryLabel(v.category)}` : ""}
                      </SelectItem>
                    ))}
                  </>
                )}
                {unassigned.length === 0 && (
                  <SelectItem value="__none__" disabled>All vendors assigned</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Arrival time + setup location */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-arrival" className="text-xs">
                Arrival time <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="ev-arrival" type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-location" className="text-xs">
                Setup location <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="ev-location" placeholder="e.g. Garden terrace, Ballroom north"
                value={setupLocation} onChange={e => setSetupLocation(e.target.value)} />
            </div>
          </div>

          {/* Load-in notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-loadin" className="text-xs">
              Load-in instructions <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="ev-loadin" value={loadInNotes} onChange={e => setLoadInNotes(e.target.value)}
              placeholder="Entrance to use, elevator access, parking, setup window…" rows={2} />
          </div>

          {/* Internal notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-notes" className="text-xs">
              Internal notes <span className="font-normal text-muted-foreground">(optional, not shown to vendor)</span>
            </Label>
            <Textarea id="ev-notes" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Coordinator reminders, special requirements…" rows={2} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
            <Button type="button" size="sm" disabled={!vendorId || addPending} onClick={handleAdd}>
              {addPending ? "Assigning…" : "Assign Vendor"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Assign Vendor
          </Button>
          {availableVendors.length === 0 && (
            <p className="text-xs text-muted-foreground">
              <Link href="/vendors/new" className="font-medium text-primary hover:underline">
                Add vendors to your directory
              </Link>{" "}first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
