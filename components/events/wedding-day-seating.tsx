"use client";

/**
 * Wedding Day Seating — the venue-side operational lookup (Seating Final
 * Release Completion). Not another seating editor: no assign/remove, no
 * drag-and-drop, no table creation. Reads the exact same data the couple's
 * own Seating tab computes (lib/seating/service.ts's getSeatingDataForVenue,
 * reusing get_seating_data — no second seating data model). Optimized for
 * a coordinator standing in a room full of guests who needs an answer in
 * under five seconds: where does this person sit, who's at this table, who
 * needs a wheelchair-accessible seat, how many chicken dinners.
 */

import { useMemo, useState } from "react";
import { Search, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ACCESSIBILITY_LABELS, MEAL_EMOJI } from "@/lib/portal/types";
import type { SeatingData, SeatingGuest, SeatingTable } from "@/lib/portal/types";

function mealEmoji(choice: string | null) {
  if (!choice) return null;
  return MEAL_EMOJI[choice.toLowerCase()] ?? "🍽";
}

type RosteredGuest = SeatingGuest & { tableLabel: string | null };

function flattenAllGuests(data: SeatingData): RosteredGuest[] {
  return [
    ...data.tables.flatMap((t) => t.guests.map((g) => ({ ...g, tableLabel: t.label }))),
    ...data.unassignedGuests.map((g) => ({ ...g, tableLabel: null })),
    ...data.needsReassignment.map((g) => ({ ...g, tableLabel: null })),
  ];
}

function GuestLine({ guest }: { guest: RosteredGuest }) {
  const meal = mealEmoji(guest.mealChoice);
  return (
    <div className="flex items-center gap-1.5 py-1 text-sm">
      <span className="flex-1 min-w-0 truncate">
        {guest.isChild && <span className="mr-1">👶</span>}
        {guest.isWeddingParty && <span className="mr-1">💍</span>}
        {guest.isVendorMeal && <span className="mr-1">🧑‍🍳</span>}
        {guest.name}
        {guest.householdName && <span className="text-muted-foreground text-xs ml-1">· {guest.householdName}</span>}
      </span>
      <span className="flex items-center gap-1 shrink-0 text-sm">
        {guest.accessibilityTags.length > 0 && (
          <span title={guest.accessibilityTags.map((t) => ACCESSIBILITY_LABELS[t] ?? t).join(", ")}>♿</span>
        )}
        {meal && <span title={guest.mealChoice ?? undefined}>{meal}</span>}
      </span>
    </div>
  );
}

function TableCard({ table, dimmed }: { table: SeatingTable; dimmed: boolean }) {
  const empty = table.capacity != null ? Math.max(0, table.capacity - table.guests.length) : null;
  const overCapacity = table.capacity != null && table.guests.length > table.capacity;
  const guests = [...table.guests].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={`rounded-xl border p-3 bg-card transition-opacity ${dimmed ? "opacity-40" : "border-border"} ${overCapacity ? "border-destructive/50" : !dimmed ? "border-border" : ""}`}>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <p className="font-semibold text-sm text-heading truncate">{table.label ?? "Table"}</p>
        <Badge
          variant="outline"
          className={`shrink-0 ${overCapacity ? "text-destructive border-destructive/40" : empty && empty > 0 ? "text-amber-700 border-amber-300" : "text-muted-foreground"}`}
        >
          {table.guests.length}{table.capacity != null ? `/${table.capacity}` : ""}
          {overCapacity ? " ⚠" : empty && empty > 0 ? ` · ${empty} open` : ""}
        </Badge>
      </div>
      {guests.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No one seated here yet.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {guests.map((g) => <GuestLine key={g.guestId} guest={{ ...g, tableLabel: table.label }} />)}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-xl font-semibold text-heading">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ReportCard({ title, isEmpty, emptyLabel, children }: {
  title: string; isEmpty: boolean; emptyLabel: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="max-h-64 overflow-y-auto">
        {isEmpty ? <p className="text-xs text-muted-foreground">{emptyLabel}</p> : children}
      </div>
    </div>
  );
}

export function WeddingDaySeating({
  eventId, eventName, coupleName, data,
}: {
  eventId: string; eventName: string; coupleName: string; data: SeatingData | null;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const allGuests = useMemo(() => (data ? flattenAllGuests(data) : []), [data]);

  const matchingTableIds = useMemo(() => {
    if (!q || !data) return null;
    const ids = new Set<string>();
    for (const t of data.tables) {
      if ((t.label ?? "").toLowerCase().includes(q)) { ids.add(t.id); continue; }
      if (t.guests.some((g) => g.name.toLowerCase().includes(q))) ids.add(t.id);
    }
    return ids;
  }, [q, data]);

  const sortedTables = useMemo(
    () => (data ? [...data.tables].sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "")) : []),
    [data],
  );

  const unassignedPool: RosteredGuest[] = useMemo(() => {
    const pool = [...(data?.unassignedGuests ?? []), ...(data?.needsReassignment ?? [])]
      .map((g) => ({ ...g, tableLabel: null }));
    if (!q) return pool;
    return pool.filter((g) => g.name.toLowerCase().includes(q));
  }, [data, q]);

  const mealCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of allGuests) {
      if (g.isVendorMeal) continue; // tracked separately below — a caterer isn't a wedding-guest meal count
      const label = g.mealChoice?.trim() || "Not yet chosen";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allGuests]);

  const accessibilityGuests = useMemo(() => allGuests.filter((g) => g.accessibilityTags.length > 0), [allGuests]);
  const vendorMealGuests = useMemo(() => allGuests.filter((g) => g.isVendorMeal), [allGuests]);
  const childGuests = useMemo(() => allGuests.filter((g) => g.isChild), [allGuests]);

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <div className="text-3xl mb-3">🪑</div>
        <p className="text-sm font-medium text-heading">No Wedding Workspace link exists for this couple yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Create one from the Client record to enable seating.</p>
      </div>
    );
  }

  const emptySeatsTotal = data.tables.reduce(
    (sum, t) => sum + (t.capacity != null ? Math.max(0, t.capacity - t.guests.length) : 0), 0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-heading">Wedding Day Seating</h1>
          <p className="text-sm text-muted-foreground">{coupleName} — {eventName}</p>
        </div>
        <a
          href={`/events/${eventId}/seating-print`} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print table rosters
        </a>
      </div>

      {!data.floorPlan ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <div className="text-3xl mb-3">🪑</div>
          <p className="text-sm font-medium text-heading">No floor plan is currently shared for seating.</p>
          <p className="text-xs text-muted-foreground mt-1">Once a plan is shared and the couple seats guests, they&apos;ll show up here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Attending" value={data.stats.totalAttending} />
            <StatCard label="Seated" value={data.stats.totalAssigned} />
            <StatCard label="Tables" value={data.stats.tableCount} />
            <StatCard label="Open seats" value={emptySeatsTotal} />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a guest or table…" className="pl-9 h-10"
            />
          </div>

          {data.needsReassignment.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {data.needsReassignment.length} guest{data.needsReassignment.length === 1 ? "" : "s"} need a table — their table was removed after they were seated.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedTables.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full py-8 text-center">No tables on this floor plan yet.</p>
            ) : (
              sortedTables.map((t) => (
                <TableCard key={t.id} table={t} dimmed={!!matchingTableIds && !matchingTableIds.has(t.id)} />
              ))
            )}
          </div>

          {unassignedPool.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Not yet seated ({unassignedPool.length})</p>
              <div className="divide-y divide-border/60">
                {unassignedPool.map((g) => <GuestLine key={g.guestId} guest={g} />)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-2">
            <ReportCard title="🍽 Meal Counts" isEmpty={mealCounts.length === 0} emptyLabel="No meal choices recorded.">
              {mealCounts.map(([label, count]) => (
                <div key={label} className="flex items-center justify-between text-sm py-0.5">
                  <span>{label}</span><span className="font-medium text-heading">{count}</span>
                </div>
              ))}
            </ReportCard>

            <ReportCard title="♿ Accessibility Notes" isEmpty={accessibilityGuests.length === 0} emptyLabel="No accessibility needs recorded.">
              {accessibilityGuests.map((g) => (
                <div key={g.guestId} className="text-sm py-0.5">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-muted-foreground"> — {g.accessibilityTags.map((t) => ACCESSIBILITY_LABELS[t] ?? t).join(", ")}{g.tableLabel ? ` · ${g.tableLabel}` : " · not yet seated"}</span>
                </div>
              ))}
            </ReportCard>

            <ReportCard title="🧑‍🍳 Vendor Meals & 👶 Children" isEmpty={vendorMealGuests.length === 0 && childGuests.length === 0} emptyLabel="None recorded.">
              {vendorMealGuests.map((g) => (
                <div key={g.guestId} className="text-sm py-0.5">🧑‍🍳 {g.name}{g.tableLabel ? ` · ${g.tableLabel}` : " · not yet seated"}</div>
              ))}
              {childGuests.map((g) => (
                <div key={g.guestId} className="text-sm py-0.5">👶 {g.name}{g.tableLabel ? ` · ${g.tableLabel}` : " · not yet seated"}</div>
              ))}
            </ReportCard>
          </div>
        </>
      )}
    </div>
  );
}
