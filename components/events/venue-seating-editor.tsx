"use client";

/**
 * Venue Seating Editor — the coordinator's editing surface while a floor
 * plan is delegated (docs/commitment-lifecycle-architecture.md §7).
 *
 * Deliberately not a pixel-for-pixel rebuild of the couple's drag-and-drop
 * canvas — same underlying data model and RPC-authorized write path
 * (assign_guest_to_table_as_venue / remove_guest_assignment_as_venue,
 * gated on an active delegation), same guest/table shapes, but a simpler
 * assign-via-list interaction. A full drag-and-drop canvas reusing the
 * couple's exact component is the natural next iteration once this
 * (correct architecture, real delegated write path, real Submit) is
 * confirmed working end to end — "the UI can start simple and grow."
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ACCESSIBILITY_LABELS, MEAL_EMOJI } from "@/lib/portal/types";
import type { SeatingData } from "@/lib/portal/types";

type OperationalSeatingData = SeatingData & { isDelegated?: boolean; delegationId?: string; delegatedNote?: string | null };

export function VenueSeatingEditor({ eventId, floorPlanId, coupleName }: {
  eventId: string; floorPlanId: string; coupleName: string;
}) {
  const [data, setData] = useState<OperationalSeatingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyGuestId, setBusyGuestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/venue/seating?eventId=${eventId}&floorPlanId=${floorPlanId}`)
      .then((r) => r.json())
      .then((d: OperationalSeatingData) => setData(d))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [eventId, floorPlanId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function assign(guestId: string, tableId: string) {
    setBusyGuestId(guestId);
    try {
      const res = await fetch("/api/venue/seating/assign", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ floorPlanId, guestId, tableId }),
      });
      const json = await res.json() as { ok?: boolean };
      if (json.ok) load();
      else toast.error("Couldn't seat this guest.");
    } finally { setBusyGuestId(null); }
  }

  async function remove(guestId: string) {
    setBusyGuestId(guestId);
    try {
      const res = await fetch("/api/venue/seating/assign", {
        method: "DELETE", headers: { "content-type": "application/json" },
        body: JSON.stringify({ floorPlanId, guestId }),
      });
      const json = await res.json() as { ok?: boolean };
      if (json.ok) load();
      else toast.error("Couldn't remove this guest.");
    } finally { setBusyGuestId(null); }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/venue/seating/submit", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ floorPlanId }),
      });
      const json = await res.json() as { ok?: boolean };
      if (json.ok) toast.success("Seating plan updated — this is now the operational plan.");
      else toast.error("Couldn't submit.");
    } finally { setSubmitting(false); }
  }

  async function revoke() {
    if (!data?.delegationId) return;
    setRevoking(true);
    try {
      const res = await fetch("/api/venue/seating/delegate", {
        method: "DELETE", headers: { "content-type": "application/json" },
        body: JSON.stringify({ delegationId: data.delegationId }),
      });
      const json = await res.json() as { ok?: boolean };
      if (json.ok) { toast.success(`Seating management handed back to ${coupleName}.`); load(); }
      else toast.error("Couldn't revoke delegation.");
    } finally { setRevoking(false); }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!data || !data.isDelegated) {
    return (
      <div className="rounded-sm border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">This plan isn&apos;t currently delegated — nothing to manage here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-900">✋ Managing seating on behalf of {coupleName}</p>
        <Button type="button" size="sm" variant="outline" disabled={revoking} onClick={revoke}>
          {revoking ? "Handing back…" : "Hand Back to Couple"}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.stats.totalAssigned} of {data.stats.totalAttending} guests seated
        </p>
        <Button type="button" size="sm" disabled={submitting} onClick={submit}>
          {submitting ? "Updating…" : "Update Operational Plan"}
        </Button>
      </div>

      {data.stats.unconvertedPlusOnes > 0 && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ {data.stats.unconvertedPlusOnes} plus-one{data.stats.unconvertedPlusOnes === 1 ? "" : "s"} {data.stats.unconvertedPlusOnes === 1 ? "has" : "have"} a name but no guest record — marked below with ⚠, they can&apos;t be seated until converted to a full guest.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unseated ({data.unassignedGuests.length + data.needsReassignment.length})
          </p>
          {[...data.unassignedGuests, ...data.needsReassignment].map((g) => (
            <div key={g.guestId} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
              <span className="text-sm truncate">
                {g.name}
                {g.accessibilityTags.length > 0 && (
                  <span className="ml-1" title={g.accessibilityTags.map(t => ACCESSIBILITY_LABELS[t] ?? t).join(", ")}>♿</span>
                )}
                {g.plusOneName && (
                  <span className="ml-1 text-amber-700" title={`+1 "${g.plusOneName}" has no seat — convert them to a guest first`}>⚠ +1</span>
                )}
              </span>
              <select
                disabled={busyGuestId === g.guestId}
                className="text-xs border border-border rounded-lg px-2 py-1 bg-background"
                value=""
                onChange={(e) => e.target.value && assign(g.guestId, e.target.value)}
              >
                <option value="">Seat at…</option>
                {data.tables.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}{t.capacity ? ` (${t.guests.length}/${t.capacity})` : ""}</option>
                ))}
              </select>
            </div>
          ))}
          {data.unassignedGuests.length + data.needsReassignment.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">Everyone&apos;s seated.</p>
          )}
        </div>

        <div className="rounded-sm border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tables</p>
          {data.tables.map((t) => (
            <div key={t.id} className="space-y-1">
              <p className="text-sm font-medium text-heading">{t.label} {t.capacity ? `(${t.guests.length}/${t.capacity})` : ""}</p>
              {t.guests.map((g) => (
                <div key={g.guestId} className="flex items-center justify-between gap-2 pl-3 text-xs">
                  <span className="truncate">
                    {g.mealChoice && MEAL_EMOJI[g.mealChoice.toLowerCase()]} {g.name}
                    {g.plusOneName && (
                      <span className="ml-1 text-amber-700" title={`+1 "${g.plusOneName}" has no seat — convert them to a guest first`}>⚠ +1</span>
                    )}
                  </span>
                  <button type="button" disabled={busyGuestId === g.guestId} onClick={() => remove(g.guestId)}
                    className="text-muted-foreground hover:text-destructive shrink-0">Remove</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
