"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle, Circle, Clock, FileText, MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  assignVendorAction,
  removeVendorAssignmentAction,
  setVendorAssignmentPaymentAction,
} from "@/app/(app)/events/[id]/vendor-actions";
import { ConversationThread } from "@/components/conversations/conversation-thread";
import { VendorCategoryBadge } from "@/components/vendors/vendor-category-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { Document } from "@/lib/documents/types";
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

// ── Payment control — Sprint 2, Vendor Payment Visibility ──────────────────
// Deliberately a summary only: what the venue owes this vendor, and
// whether it's been paid. No installments, no refunds — that's the
// couple-side payment system's shape, not this. Same inline-edit
// conventions already established elsewhere (window.prompt for the fee,
// matching floor-plan-workspace.tsx's handleRenamePlan; a pill toggle for
// status, matching ShareForSeatingToggle) rather than a new modal.

function VendorPaymentControl({ eventId, assignment }: { eventId: string; assignment: EventVendorAssignment }) {
  const router = useRouter();
  const [fee, setFee] = React.useState(assignment.agreedFee);
  const [status, setStatus] = React.useState(assignment.paymentStatus);
  const [pending, startTransition] = React.useTransition();

  function save(nextFee: number | null, nextStatus: "pending" | "paid") {
    startTransition(async () => {
      const result = await setVendorAssignmentPaymentAction(assignment.id, eventId, nextFee, nextStatus);
      if (result.ok) { setFee(nextFee); setStatus(nextStatus); router.refresh(); }
      else toast.error(result.message ?? "Could not update payment.");
    });
  }

  function handleEditFee(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const input = window.prompt("Agreed fee for this vendor ($)", fee != null ? String(fee) : "");
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) { save(null, status); return; }
    const parsed = parseFloat(trimmed.replace(/[$,]/g, ""));
    if (Number.isNaN(parsed) || parsed < 0) { toast.error("Enter a valid amount."); return; }
    save(parsed, status);
  }

  function toggleStatus(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    save(fee, status === "paid" ? "pending" : "paid");
  }

  if (fee == null) {
    return (
      <button type="button" onClick={handleEditFee} disabled={pending}
        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary/40">
        + Add fee
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={handleEditFee} disabled={pending}
        className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-foreground hover:border-primary/40">
        ${fee.toLocaleString()}
      </button>
      <button type="button" onClick={toggleStatus} disabled={pending}
        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
          status === "paid" ? "border-primary/40 bg-primary/10 text-primary" : "border-amber-300 bg-amber-50 text-amber-700"
        }`}>
        {pending ? "…" : status === "paid" ? "Paid" : "Pending"}
      </button>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function EventVendorsSection({
  eventId,
  initialAssignments,
  availableVendors,
  vendorDocuments = [],
}: {
  eventId: string;
  initialAssignments: EventVendorAssignment[];
  availableVendors: Vendor[];
  vendorDocuments?: (Document & { vendorName: string | null })[];
}) {
  const router = useRouter();
  // See lib/hooks/use-synced-state.ts.
  const [assignments, setAssignments] = useSyncedState(initialAssignments);
  const [showForm, setShowForm]       = React.useState(false);
  const [vendorId, setVendorId]       = React.useState("");
  const [arrivalTime, setArrivalTime] = React.useState("");
  const [setupLocation, setSetupLocation] = React.useState("");
  const [loadInNotes, setLoadInNotes] = React.useState("");
  const [notes, setNotes]             = React.useState("");
  const [addPending, startAdd]        = React.useTransition();
  const [openThreadId, setOpenThreadId] = React.useState<string | null>(null);

  // Deep-link from vendor→venue email / vendor rollup:
  // /events/{id}?conversation={conversationId}#vendors
  React.useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get("conversation");
    if (!cid) return;
    const match = assignments.find((a) => a.conversationId === cid);
    if (match) setOpenThreadId(match.id);
  }, [assignments]);

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
                <div className="flex shrink-0 items-center gap-1">
                  {a.conversationId && (
                    <button type="button"
                      onClick={() => setOpenThreadId(prev => prev === a.id ? null : a.id)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        openThreadId === a.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      aria-label={`Message ${a.vendorName}`}
                      aria-expanded={openThreadId === a.id}>
                      <MessageSquare className="h-3.5 w-3.5" />
                      Message
                    </button>
                  )}
                  <button type="button"
                    onClick={() => handleRemove(a.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    aria-label="Remove vendor">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Check-in status + payment */}
              <div className="flex flex-wrap items-center gap-3 pt-0.5 border-t border-border/50">
                <CheckinBadge label="Arrived"       checked={!!a.checkedInAt} />
                <CheckinBadge label="Setup done"    checked={!!a.setupCompleteAt} />
                <VendorPaymentControl eventId={eventId} assignment={a} />
              </div>

              {/* From vendor — docs they shared onto this event */}
              {(() => {
                const docs = vendorDocuments.filter((d) => d.uploadedById === a.vendorId);
                if (docs.length === 0) return null;
                return (
                  <div className="space-y-1.5 pt-1 border-t border-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From vendor</p>
                    <div className="space-y-1">
                      {docs.map((d) => (
                        <a
                          key={d.id}
                          href={d.storageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{d.category}</Badge>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Message panel — RC2, Milestone 3. Same ConversationThread the
                  main inbox and Relationship tab use; a vendor conversation is
                  read/written no differently than any other Conversation. */}
              {openThreadId === a.id && a.conversationId && (
                <div className="min-h-0 overflow-hidden rounded-lg border border-border" style={{ height: 420 }}>
                  <ConversationThread conversationId={a.conversationId} showHeader={false} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assign form */}
      {showForm ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            An internal note that this vendor is working this event — it doesn&apos;t give them portal access. Use Send Invite on the vendor&apos;s own page for that.
          </p>
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
