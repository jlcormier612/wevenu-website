"use client";

/**
 * Venue Seating Assistance — the coordinator's editing surface while a
 * client has asked the venue to assist with a floor plan's seating.
 *
 * List/dropdown interaction (not a pixel rebuild of the couple canvas).
 * Same data model and RPC-authorized write path, gated on active
 * delegation + owner/manager/coordinator role.
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
    return fetch(`/api/venue/seating?eventId=${eventId}&floorPlanId=${floorPlanId}`)
      .then((r) => r.json())
      .then((d: OperationalSeatingData) => setData(d));
  }

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const r = await fetch(
          `/api/venue/seating?eventId=${eventId}&floorPlanId=${floorPlanId}`,
          { signal: controller.signal },
        );
        const d = await r.json() as OperationalSeatingData & { error?: string };
        if (cancelled) return;
        setData(!r.ok || d.error ? null : d);
      } catch {
        if (cancelled) return;
        setData(null);
      } finally {
        // Always leave the loading gate even if this run was superseded —
        // a remounted editor starts with loading=true again via useState.
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [eventId, floorPlanId]);

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
      if (json.ok) toast.success("Seating changes submitted — this is now the committed seating snapshot.");
      else toast.error("Couldn't submit seating changes.");
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
      if (json.ok) { toast.success(`Seating assistance handed back to ${coupleName}.`); load(); }
      else toast.error("Couldn't end seating assistance.");
    } finally { setRevoking(false); }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!data || !data.isDelegated) {
    return (
      <div className="rounded-sm border border-dashed border-border py-10 text-center px-4">
        <p className="text-sm font-medium text-heading">Venue seating assistance is not active</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          The client has not asked the venue to assist with this seating plan, or assistance was revoked. Venue staff do not get seating authority from event access alone.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-amber-900">Assisting with seating for {coupleName}</p>
          <p className="text-xs text-amber-800 mt-0.5">
            You are helping under the client&apos;s request — this does not transfer ownership of the seating plan.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={revoking} onClick={revoke}>
          {revoking ? "Ending…" : "End Venue Assistance"}
        </Button>
      </div>

      {data.floorPlan?.name && (
        <p className="text-xs text-muted-foreground">Floor plan: {data.floorPlan.name}</p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {data.stats.totalAssigned} of {data.stats.totalAttending} guests seated
        </p>
        <Button type="button" size="sm" disabled={submitting} onClick={submit}>
          {submitting ? "Submitting…" : "Submit Seating Changes"}
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
