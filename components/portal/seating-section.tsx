"use client";

/**
 * Seating Experience — Phase 1: Foundation & Floor Plan Integration.
 *
 * Replaces the disconnected Sprint-74 seating canvas (own 1200x800 grid,
 * own table vocabulary, couple-editable tables) entirely. Tables are no
 * longer created or moved here — they are floor_plan_objects rows on the
 * one Floor Plan the venue has shared (client_access != 'hidden'), read
 * live on every load. This component only ever creates/removes rows in
 * guest_seat_assignments (guest_id <-> table_object_id) — it draws the
 * room, it does not build it.
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { getSeatingObservation } from "@/lib/luv/portal-observations";
import type { SeatingData, SeatingTable, SeatingGuest, SeatingSuggestionHousehold } from "@/lib/portal/types";
import type { DisplayShape } from "@/lib/floor-plans/types";

const INCHES_PER_FOOT = 12;

const DIETARY_EMOJI: Record<string, string> = {
  vegetarian: "🥦", vegan: "🌱", gluten_free: "🌾", dairy_free: "🥛",
  nut_allergy: "🥜", shellfish_allergy: "🦐", kosher: "✡️", halal: "☪️",
};
const MEAL_EMOJI: Record<string, string> = {
  chicken: "🍗", beef: "🥩", fish: "🐟", vegetarian: "🥦", vegan: "🌱", kids: "🍕",
};

function mealEmoji(choice: string | null) {
  if (!choice) return null;
  return MEAL_EMOJI[choice.toLowerCase()] ?? "🍽";
}

function dietaryEmojis(tags: string[]) {
  return tags.map((t) => DIETARY_EMOJI[t]).filter(Boolean);
}

// Auto-assign: pack households into tables in reading order, keeping groups together.
function computeAutoAssign(
  households: SeatingSuggestionHousehold[],
  tables: SeatingTable[],
): Array<{ guestId: string; tableId: string }> {
  if (!tables.length || !households.length) return [];

  const results: Array<{ guestId: string; tableId: string }> = [];
  const loads = new Map(tables.map((t) => [t.id, t.guests.length]));
  const sortedTables = [...tables].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const hh of households) {
    let target = sortedTables.find((t) => (loads.get(t.id) ?? 0) + hh.size <= (t.capacity ?? Infinity));
    if (!target) target = sortedTables.find((t) => (loads.get(t.id) ?? 0) < (t.capacity ?? Infinity));
    if (!target) continue;

    for (const guestId of hh.guestIds) {
      const current = loads.get(target.id) ?? 0;
      if (target.capacity == null || current < target.capacity) {
        results.push({ guestId, tableId: target.id });
        loads.set(target.id, current + 1);
      }
    }
  }

  return results;
}

// ── Guest chip — draggable everywhere it appears (sidebar or a table's roster) ──

function GuestChip({
  guest, onRemove, onDragStart, needsReassignment, highlight,
}: {
  guest: SeatingGuest;
  onRemove?: (id: string) => void;
  onDragStart?: (id: string) => void;
  needsReassignment?: boolean;
  highlight?: boolean;
}) {
  const meal = mealEmoji(guest.mealChoice);
  const diet = dietaryEmojis(guest.dietaryTags);

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart ? (e) => {
        e.dataTransfer.setData("guestId", guest.guestId);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(guest.guestId);
      } : undefined}
      onDragEnd={onDragStart ? () => onDragStart("") : undefined}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-colors select-none ${
        onDragStart ? "cursor-grab active:cursor-grabbing" : ""
      } ${highlight ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-card border-border hover:border-primary/30"}`}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium text-foreground">
          {guest.isChild && <span className="mr-1">👶</span>}
          {guest.isWeddingParty && <span className="mr-1">💍</span>}
          {guest.isVendorMeal && <span className="mr-1">🧑‍🍳</span>}
          {guest.name}
          {guest.plusOneOfGuestId && <span className="text-[10px] text-muted-foreground ml-1">(+1)</span>}
        </div>
        {(guest.householdName || needsReassignment) && (
          <div className="text-[10px] text-muted-foreground truncate">
            {needsReassignment ? "⚠ needs a new table" : guest.householdName}
          </div>
        )}
      </div>
      <div className="flex gap-0.5 shrink-0 text-sm">
        {meal && <span className="opacity-70">{meal}</span>}
        {diet.map((e, i) => <span key={i} className="opacity-70">{e}</span>)}
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(guest.guestId); }}
          className="text-muted-foreground/40 hover:text-destructive shrink-0 leading-none font-bold px-0.5"
          title="Remove from table"
          aria-label={`Remove ${guest.name} from table`}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Table, drawn from the real Floor Plan object — read-only geometry ──────

function SeatingTableShape({
  table, isSelected, isDragOver, onSelect, onDragOver, onDragLeave, onDrop,
}: {
  table: SeatingTable;
  isSelected: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const shape: DisplayShape = table.displayShape ?? "round";
  const style = DISPLAY_SHAPE_STYLE[shape];
  const overCapacity = table.capacity != null && table.guests.length > table.capacity;
  const stroke = overCapacity ? "#ef4444" : isSelected ? "#3D5040" : isDragOver ? "#5D6F5D" : style.stroke;
  const fontSize = Math.max(9, Math.min(14, table.width / 6));

  return (
    <g
      transform={`rotate(${table.rotation}, ${table.x}, ${table.y})`}
      className="cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <FloorPlanShapeSvg
        shape={shape} x={table.x} y={table.y} width={table.width} height={table.height}
        fill={isDragOver ? "#eef4ee" : isSelected ? "#f0f5f0" : style.fill}
        stroke={stroke} strokeWidth={isSelected || isDragOver ? 2.5 : 1.5}
      />
      <text x={table.x} y={table.y - fontSize * 0.4} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fill={style.textFill} fontFamily="sans-serif" fontWeight="600"
        style={{ userSelect: "none", pointerEvents: "none" }}>
        {table.label ?? "Table"}
      </text>
      <text x={table.x} y={table.y + fontSize * 0.7} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize * 0.85} fill={overCapacity ? "#ef4444" : style.textFill} fontFamily="sans-serif"
        style={{ userSelect: "none", pointerEvents: "none" }}>
        {table.guests.length}{table.capacity != null ? `/${table.capacity}` : ""}{overCapacity ? " ⚠" : ""}
      </text>
      {isSelected && (
        <rect
          x={table.x - table.width / 2 - 6} y={table.y - table.height / 2 - 6}
          width={table.width + 12} height={table.height + 12}
          fill="none" stroke="#3D5040" strokeWidth={1.5} strokeDasharray="6,4" rx={4}
        />
      )}
    </g>
  );
}

// ── Filter tabs shared between the browse sidebar and a table's "Add Guests" section ──

const GUEST_FILTERS = [
  { key: "unassigned", label: "Unassigned" },
  { key: "household", label: "Household" },
  { key: "wedding_party", label: "Wedding Party" },
  { key: "children", label: "Children" },
  { key: "vendor_meals", label: "Vendor Meals" },
] as const;
type GuestFilter = (typeof GUEST_FILTERS)[number]["key"];

type PoolGuest = SeatingGuest & { needsReassignment: boolean };

function filterPool(pool: PoolGuest[], filter: GuestFilter, search: string): PoolGuest[] {
  let result = pool;
  if (filter === "unassigned") result = result.filter((g) => !g.needsReassignment);
  else if (filter === "wedding_party") result = result.filter((g) => g.isWeddingParty);
  else if (filter === "children") result = result.filter((g) => g.isChild);
  else if (filter === "vendor_meals") result = result.filter((g) => g.isVendorMeal);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter((g) => g.name.toLowerCase().includes(q));
  }
  return result;
}

function groupByHousehold(pool: PoolGuest[]): { key: string; name: string; guests: PoolGuest[] }[] {
  const groups = new Map<string, { key: string; name: string; guests: PoolGuest[] }>();
  for (const g of pool) {
    const key = g.householdId ?? "__none__";
    const name = g.householdName ?? "No Household";
    if (!groups.has(key)) groups.set(key, { key, name, guests: [] });
    groups.get(key)!.guests.push(g);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function GuestPoolList({
  pool, filter, search, draggingGuestId, onDragStart, onGuestClick, emptyMessage,
}: {
  pool: PoolGuest[];
  filter: GuestFilter;
  search: string;
  draggingGuestId: string;
  onDragStart: (id: string) => void;
  onGuestClick?: (id: string) => void;
  emptyMessage: string;
}) {
  const filtered = filterPool(pool, filter, search);

  if (filtered.length === 0) {
    return <div className="text-center py-8 text-xs text-muted-foreground">{emptyMessage}</div>;
  }

  if (filter === "household") {
    return (
      <div className="space-y-3">
        {groupByHousehold(filtered).map((group) => (
          <div key={group.key}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{group.name}</p>
            <div className="space-y-1">
              {group.guests.map((g) => (
                <div key={g.guestId} onClick={() => onGuestClick?.(g.guestId)}>
                  <GuestChip guest={g} onDragStart={onDragStart} needsReassignment={g.needsReassignment} highlight={draggingGuestId === g.guestId} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {filtered.map((g) => (
        <div key={g.guestId} onClick={() => onGuestClick?.(g.guestId)}>
          <GuestChip guest={g} onDragStart={onDragStart} needsReassignment={g.needsReassignment} highlight={draggingGuestId === g.guestId} />
        </div>
      ))}
    </div>
  );
}

function FilterTabs({ active, onChange }: { active: GuestFilter; onChange: (f: GuestFilter) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {GUEST_FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            active === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── Table Info panel (selected table) — roster + collapsed Add Guests ──────

function TableInfoPanel({
  table, pool, draggingGuestId, onDragStart, onRemove, onAssign, onClose,
}: {
  table: SeatingTable;
  pool: PoolGuest[];
  draggingGuestId: string;
  onDragStart: (id: string) => void;
  onRemove: (guestId: string) => void;
  onAssign: (guestId: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<GuestFilter>("unassigned");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const remaining = table.capacity != null ? Math.max(0, table.capacity - table.guests.length) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-heading truncate">{table.label ?? "Table"}</h3>
          <button onClick={onClose} aria-label="Close table info" className="text-muted-foreground hover:text-foreground text-lg leading-none p-1">×</button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {table.guests.length} seated{table.capacity != null ? ` · ${remaining} remaining` : ""}
          {table.capacity != null && table.guests.length > table.capacity && (
            <span className="text-destructive"> · over capacity</span>
          )}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {table.guests.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">No one seated here yet. Drag a guest onto this table, or add one below.</div>
        ) : (
          table.guests.map((g) => (
            <GuestChip key={g.guestId} guest={g} onRemove={onRemove} onDragStart={onDragStart} highlight={draggingGuestId === g.guestId} />
          ))
        )}
      </div>

      <div className="border-t border-border">
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-foreground hover:bg-muted/30"
        >
          <span>+ Add Guests</span>
          <span className="text-muted-foreground">{addOpen ? "▲" : "▼"}</span>
        </button>
        {addOpen && (
          <div className="px-3 pb-3 space-y-2 max-h-64 overflow-y-auto">
            <Input placeholder="Search guests…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs" />
            <FilterTabs active={filter} onChange={setFilter} />
            <GuestPoolList
              pool={pool} filter={filter} search={search}
              draggingGuestId={draggingGuestId} onDragStart={onDragStart}
              onGuestClick={onAssign}
              emptyMessage="No guests match."
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Browse sidebar (no table selected) ──────────────────────────────────────

function GuestBrowsePanel({
  pool, draggingGuestId, onDragStart,
}: {
  pool: PoolGuest[];
  draggingGuestId: string;
  onDragStart: (id: string) => void;
}) {
  const [filter, setFilter] = useState<GuestFilter>("unassigned");
  const [search, setSearch] = useState("");
  const needsReassignmentCount = pool.filter((g) => g.needsReassignment).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-heading">
            Guests to Seat
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">({pool.length})</span>
          </h3>
        </div>
        <Input placeholder="Search guests…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs mb-2" />
        <FilterTabs active={filter} onChange={setFilter} />
      </div>

      {needsReassignmentCount > 0 && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {needsReassignmentCount} guest{needsReassignmentCount === 1 ? "" : "s"} need{needsReassignmentCount === 1 ? "s" : ""} a new table — their table was removed from the Floor Plan.
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {pool.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-xs">Everyone is seated!</p>
          </div>
        ) : (
          <GuestPoolList
            pool={pool} filter={filter} search={search}
            draggingGuestId={draggingGuestId} onDragStart={onDragStart}
            emptyMessage="No guests match this filter."
          />
        )}
      </div>

      {pool.length > 0 && (
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          Select a table, or drag a guest onto one, to seat them.
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SeatingSection({ token }: { token: string }) {
  const [data, setData] = useState<SeatingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
  const [draggingGuestId, setDraggingGuestId] = useState<string>("");
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [showAutoPreview, setShowAutoPreview] = useState<Array<{ guestId: string; tableId: string }>>([]);

  useEffect(() => {
    fetch(`/api/portal/seating?token=${token}`)
      .then((res) => res.json())
      .then((json) => setData(json as SeatingData))
      .finally(() => setLoading(false));
  }, [token]);

  const assignGuest = async (guestId: string, tableId: string) => {
    if (!data) return;

    setData((d) => {
      if (!d) return d;
      const guest = d.unassignedGuests.find((g) => g.guestId === guestId)
        ?? d.needsReassignment.find((g) => g.guestId === guestId)
        ?? d.tables.flatMap((t) => t.guests).find((g) => g.guestId === guestId);
      if (!guest) return d;

      return {
        ...d,
        tables: d.tables.map((t) => {
          const filtered = t.guests.filter((g) => g.guestId !== guestId);
          return t.id === tableId ? { ...t, guests: [...filtered, guest] } : { ...t, guests: filtered };
        }),
        unassignedGuests: d.unassignedGuests.filter((g) => g.guestId !== guestId),
        needsReassignment: d.needsReassignment.filter((g) => g.guestId !== guestId),
        stats: { ...d.stats, totalAssigned: d.stats.totalAssigned + (d.tables.some((t) => t.guests.some((g) => g.guestId === guestId)) ? 0 : 1) },
      };
    });

    await fetch("/api/portal/seating/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, guestId, tableId }),
    });
  };

  const removeGuest = async (guestId: string) => {
    if (!data) return;
    const assigned = data.tables.flatMap((t) => t.guests).find((g) => g.guestId === guestId);
    if (!assigned) return;

    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        tables: d.tables.map((t) => ({ ...t, guests: t.guests.filter((g) => g.guestId !== guestId) })),
        unassignedGuests: [...d.unassignedGuests, assigned].sort((a, b) => a.name.localeCompare(b.name)),
        stats: { ...d.stats, totalAssigned: Math.max(0, d.stats.totalAssigned - 1) },
      };
    });

    await fetch("/api/portal/seating/assign", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, guestId }),
    });
  };

  const handleAutoAssign = async () => {
    if (!data) return;
    setAutoAssigning(true);
    try {
      const res = await fetch(`/api/portal/seating/suggestions?token=${token}`);
      const json = await res.json();
      const households: SeatingSuggestionHousehold[] = json.households ?? [];

      const unassignedIds = new Set([...data.unassignedGuests, ...data.needsReassignment].map((g) => g.guestId));
      const filteredHouseholds = households
        .map((hh) => ({ ...hh, guestIds: hh.guestIds.filter((id) => unassignedIds.has(id)) }))
        .filter((hh) => hh.guestIds.length > 0);

      setShowAutoPreview(computeAutoAssign(filteredHouseholds, data.tables));
    } finally {
      setAutoAssigning(false);
    }
  };

  const confirmAutoAssign = async () => {
    for (const { guestId, tableId } of showAutoPreview) {
      await assignGuest(guestId, tableId);
    }
    setShowAutoPreview([]);
  };

  const selectedTable = data?.tables.find((t) => t.id === selectedTableId) ?? null;
  const pool: PoolGuest[] = data
    ? [
        ...data.unassignedGuests.map((g) => ({ ...g, needsReassignment: false })),
        ...data.needsReassignment.map((g) => ({ ...g, needsReassignment: true })),
      ]
    : [];

  const stats = data?.stats;
  const pctAssigned = stats && stats.totalAttending > 0 ? Math.round((stats.totalAssigned / stats.totalAttending) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="animate-pulse">Loading seating chart…</div>
      </div>
    );
  }

  if (!data || !data.floorPlan) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <div className="text-3xl mb-3">🪑</div>
        <p className="text-sm font-medium">No floor plan shared for seating yet.</p>
        <p className="text-xs mt-1">Check with your venue — seating opens up once they share the room layout.</p>
      </div>
    );
  }

  const canvasWidth = data.floorPlan.roomWidthFt * INCHES_PER_FOOT;
  const canvasHeight = data.floorPlan.roomDepthFt * INCHES_PER_FOOT;

  return (
    <div className="flex flex-col h-full min-h-0">
      {showAutoPreview.length > 0 && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm w-full border border-border">
            <h3 className="font-semibold text-heading mb-2">Auto-Assign Preview</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We&apos;ll seat <strong>{showAutoPreview.length}</strong> guests across your tables, keeping households together where possible.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmAutoAssign}>Confirm</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowAutoPreview([])}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-wrap">
        <p className="text-sm font-medium text-heading truncate">{data.floorPlan.name}</p>
        <div className="ml-auto flex items-center gap-2">
          {stats && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><strong className={pctAssigned === 100 ? "text-primary" : "text-foreground"}>{stats.totalAssigned}</strong>/{stats.totalAttending} seated</span>
              <span><strong className="text-foreground">{stats.tableCount}</strong> tables</span>
              <span><strong className="text-foreground">{stats.totalCapacity}</strong> seats</span>
              {stats.totalCapacity > 0 && stats.totalCapacity < stats.totalAttending && (
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                  Need {stats.totalAttending - stats.totalCapacity} more seats
                </Badge>
              )}
              {pctAssigned === 100 && stats.totalAttending > 0 && <Badge>Everyone seated 🎉</Badge>}
            </div>
          )}
          <Button
            size="sm" variant="outline" className="text-xs"
            disabled={autoAssigning || pool.length === 0 || !data.tables.length}
            onClick={handleAutoAssign}
          >
            {autoAssigning ? "Calculating…" : "✨ Auto-assign"}
          </Button>
        </div>
      </div>

      {stats && (() => {
        const obs = getSeatingObservation(stats);
        if (!obs) return null;
        return (
          <div className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: "#FDF5F5", border: "1px solid #D8A7AA30" }}>
            <span style={{ color: "#D8A7AA", fontSize: 14, lineHeight: 1.5 }}>💗</span>
            <p className="text-sm leading-relaxed" style={{ color: "#5A3235" }}>{obs.text}</p>
          </div>
        );
      })()}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto bg-muted/20 p-4">
          <svg
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            style={{ width: "100%", maxWidth: canvasWidth, height: "auto" }}
            className="bg-white border border-border rounded-lg"
            onClick={() => setSelectedTableId(null)}
          >
            {data.floorPlan.backgroundImageUrl && (
              <image
                href={data.floorPlan.backgroundImageUrl} x={0} y={0} width={canvasWidth} height={canvasHeight}
                opacity={data.floorPlan.backgroundImageOpacity} preserveAspectRatio="none"
              />
            )}
            {data.tables.map((table) => (
              <SeatingTableShape
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                isDragOver={dragOverTableId === table.id}
                onSelect={() => setSelectedTableId(table.id === selectedTableId ? null : table.id)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverTableId(table.id); }}
                onDragLeave={() => setDragOverTableId((id) => (id === table.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault();
                  const guestId = e.dataTransfer.getData("guestId");
                  if (guestId) assignGuest(guestId, table.id);
                  setDragOverTableId(null);
                }}
              />
            ))}
          </svg>

          {data.tables.length === 0 && (
            <div className="text-center text-muted-foreground mt-8">
              <div className="text-4xl mb-3">🪑</div>
              <p className="text-sm font-medium">No tables on this floor plan yet.</p>
              <p className="text-xs mt-1">Check with your venue — they add tables from their Floor Plan editor.</p>
            </div>
          )}
        </div>

        <div className="w-72 border-l border-border flex flex-col bg-card overflow-hidden">
          {selectedTable ? (
            <TableInfoPanel
              table={selectedTable}
              pool={pool}
              draggingGuestId={draggingGuestId}
              onDragStart={setDraggingGuestId}
              onRemove={removeGuest}
              onAssign={(guestId) => assignGuest(guestId, selectedTable.id)}
              onClose={() => setSelectedTableId(null)}
            />
          ) : (
            <GuestBrowsePanel pool={pool} draggingGuestId={draggingGuestId} onDragStart={setDraggingGuestId} />
          )}
        </div>
      </div>
    </div>
  );
}
