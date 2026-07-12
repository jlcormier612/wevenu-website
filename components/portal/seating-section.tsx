"use client";

/**
 * Seating Experience.
 *
 * Phase 1 (Foundation & Floor Plan Integration): tables are floor_plan_objects
 * rows on the one Floor Plan the venue has shared (client_access != 'hidden'),
 * read live on every load — never a second canvas, never a second table
 * model. This component only ever creates/removes rows in
 * guest_seat_assignments (guest_id <-> table_object_id).
 *
 * Phase 2 (Wedding Workspace User Experience): the same data model, presented
 * so it feels like planning a wedding rather than operating software — a
 * dashboard for orientation before editing, guests organized into collapsible
 * groups instead of one long list, households and the wedding party seatable
 * in one action, and both drag-and-drop and multi-select as first-class ways
 * to assign. No new tables, no new RPCs — this phase is UI only.
 */

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
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
const ACCESSIBILITY_LABELS: Record<string, string> = {
  wheelchair: "Wheelchair access", limited_mobility: "Limited mobility",
  hearing_assistance: "Hearing assistance", vision_assistance: "Vision assistance",
  service_animal: "Service animal", special_seating: "Special seating request",
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

// A guest as it appears anywhere in the Guest Workspace — Phase 1's SeatingGuest
// plus where (if anywhere) they currently sit, so every group below can be
// derived from one list instead of re-deriving assignment state per section.
type AnyGuest = SeatingGuest & {
  tableId: string | null;
  tableLabel: string | null;
  needsReassignment: boolean;
};

function buildAllGuests(data: SeatingData): AnyGuest[] {
  return [
    ...data.tables.flatMap((t) => t.guests.map((g) => ({ ...g, tableId: t.id, tableLabel: t.label, needsReassignment: false }))),
    ...data.unassignedGuests.map((g) => ({ ...g, tableId: null, tableLabel: null, needsReassignment: false })),
    ...data.needsReassignment.map((g) => ({ ...g, tableId: null, tableLabel: null, needsReassignment: true })),
  ];
}

function summarizeMeals(guests: SeatingGuest[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const g of guests) {
    const label = g.mealChoice?.trim() || "Not yet chosen";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function summarizeAccessibility(guests: SeatingGuest[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const g of guests) {
    for (const tag of g.accessibilityTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].map(([tag, count]) => ({ label: ACCESSIBILITY_LABELS[tag] ?? tag, count }));
}

// ── Guest chip — draggable and (in the Guest Workspace) multi-selectable ───

function GuestChip({
  guest, onRemove, onDragStart, highlight, selected, onToggleSelect, tableLabel,
}: {
  guest: SeatingGuest & { needsReassignment?: boolean };
  onRemove?: (id: string) => void;
  onDragStart?: (id: string) => void;
  highlight?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  tableLabel?: string | null;
}) {
  const meal = mealEmoji(guest.mealChoice);
  const diet = dietaryEmojis(guest.dietaryTags);
  const selectable = !!onToggleSelect;

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart ? (e) => {
        e.dataTransfer.setData("guestId", guest.guestId);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(guest.guestId);
      } : undefined}
      onDragEnd={onDragStart ? () => onDragStart("") : undefined}
      onClick={selectable ? () => onToggleSelect(guest.guestId) : undefined}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-colors select-none ${
        onDragStart ? "cursor-grab active:cursor-grabbing" : ""
      } ${selected ? "bg-primary/10 border-primary/50 shadow-sm" : highlight ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-card border-border hover:border-primary/30"}`}
    >
      {selectable && (
        <input
          type="checkbox" checked={!!selected} onChange={() => onToggleSelect(guest.guestId)}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 rounded accent-[#5D6F5D] shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium text-foreground">
          {guest.isChild && <span className="mr-1">👶</span>}
          {guest.isWeddingParty && <span className="mr-1">💍</span>}
          {guest.isVendorMeal && <span className="mr-1">🧑‍🍳</span>}
          {guest.name}
          {guest.plusOneOfGuestId && <span className="text-[10px] text-muted-foreground ml-1">(+1)</span>}
        </div>
        {(guest.householdName || guest.needsReassignment || tableLabel) && (
          <div className="text-[10px] text-muted-foreground truncate">
            {guest.needsReassignment ? "⚠ needs a new table" : tableLabel ? `Seated at ${tableLabel}` : guest.householdName}
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

function occupancyFill(table: SeatingTable, defaultFill: string): string {
  if (table.guests.length === 0) return defaultFill;
  if (table.capacity == null) return "#EAF3EA";
  const ratio = table.guests.length / table.capacity;
  if (ratio > 1) return "#FBE0E0";
  if (ratio === 1) return "#CFE3CF";
  return "#EAF3EA";
}

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
  const fill = isDragOver ? "#eef4ee" : isSelected ? "#f0f5f0" : occupancyFill(table, style.fill);
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
        fill={fill} stroke={stroke} strokeWidth={isSelected || isDragOver ? 2.5 : 1.5}
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

// ── Filter tabs used only inside a Table's "Add Guests" quick-add list ─────

const GUEST_FILTERS = [
  { key: "unassigned", label: "Unassigned" },
  { key: "household", label: "Household" },
  { key: "wedding_party", label: "Wedding Party" },
  { key: "children", label: "Children" },
  { key: "vendor_meals", label: "Vendor Meals" },
] as const;
type GuestFilter = (typeof GUEST_FILTERS)[number]["key"];

function filterPool(pool: AnyGuest[], filter: GuestFilter, search: string): AnyGuest[] {
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

function groupByHousehold(pool: AnyGuest[]): { key: string; name: string; guests: AnyGuest[] }[] {
  const groups = new Map<string, { key: string; name: string; guests: AnyGuest[] }>();
  for (const g of pool) {
    const key = g.householdId ?? "__none__";
    const name = g.householdName ?? "No Household";
    if (!groups.has(key)) groups.set(key, { key, name, guests: [] });
    groups.get(key)!.guests.push(g);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
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

function QuickAddList({ pool, draggingGuestId, onDragStart, onAssign }: {
  pool: AnyGuest[];
  draggingGuestId: string;
  onDragStart: (id: string) => void;
  onAssign: (guestId: string) => void;
}) {
  const [filter, setFilter] = useState<GuestFilter>("unassigned");
  const [search, setSearch] = useState("");
  const filtered = filterPool(pool, filter, search);

  return (
    <div className="space-y-2">
      <Input placeholder="Search guests…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs" />
      <FilterTabs active={filter} onChange={setFilter} />
      {filtered.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground">No guests match.</div>
      ) : filter === "household" ? (
        <div className="space-y-3">
          {groupByHousehold(filtered).map((group) => (
            <div key={group.key}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{group.name}</p>
              <div className="space-y-1">
                {group.guests.map((g) => (
                  <div key={g.guestId} onClick={() => onAssign(g.guestId)}>
                    <GuestChip guest={g} onDragStart={onDragStart} highlight={draggingGuestId === g.guestId} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((g) => (
            <div key={g.guestId} onClick={() => onAssign(g.guestId)}>
              <GuestChip guest={g} onDragStart={onDragStart} highlight={draggingGuestId === g.guestId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Table Info panel (selected table) — rich summary + roster + quick add ──

function TableInfoPanel({
  table, pool, selectedGuestIds, onToggleSelect, draggingGuestId, onDragStart, onRemove, onAssign, onClose,
}: {
  table: SeatingTable;
  pool: AnyGuest[];
  selectedGuestIds: Set<string>;
  onToggleSelect: (id: string) => void;
  draggingGuestId: string;
  onDragStart: (id: string) => void;
  onRemove: (guestId: string) => void;
  onAssign: (guestId: string) => void;
  onClose: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const remaining = table.capacity != null ? Math.max(0, table.capacity - table.guests.length) : null;
  const meals = summarizeMeals(table.guests);
  const accessibility = summarizeAccessibility(table.guests);

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

        {(meals.length > 0 || accessibility.length > 0) && (
          <div className="mt-2.5 space-y-1.5">
            {meals.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Meals: </span>
                {meals.map((m) => `${m.label} × ${m.count}`).join(", ")}
              </p>
            )}
            {accessibility.length > 0 && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Accessibility: </span>
                  {accessibility.map((a) => `${a.label} × ${a.count}`).join(", ")}
                </p>
                <p className="text-[11px] text-primary/80">💡 Worth a quick check with your venue about easy, step-free access to this table.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {table.guests.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">No one seated here yet. Drag a guest onto this table, or add one below.</div>
        ) : (
          table.guests.map((g) => (
            <GuestChip
              key={g.guestId} guest={g} onRemove={onRemove} onDragStart={onDragStart}
              highlight={draggingGuestId === g.guestId}
              selected={selectedGuestIds.has(g.guestId)} onToggleSelect={onToggleSelect}
            />
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
          <div className="px-3 pb-3 max-h-64 overflow-y-auto">
            <QuickAddList pool={pool} draggingGuestId={draggingGuestId} onDragStart={onDragStart} onAssign={onAssign} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Collapsible group — the Guest Workspace's organizing unit ─────────────

function CollapsibleGroup({
  icon, title, count, summary, defaultOpen = false, action, children,
}: {
  icon: string;
  title: string;
  count: number;
  summary?: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/20"
      >
        <span className="text-xs font-semibold text-heading flex items-center gap-1.5">
          <span>{icon}</span>{title}
          <span className="font-normal text-muted-foreground">({count})</span>
        </span>
        <span className="flex items-center gap-2">
          {!open && summary && <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{summary}</span>}
          <span className="text-muted-foreground text-[10px]">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {action}
          {children}
        </div>
      )}
    </div>
  );
}

// Selects every member of a group at once, feeding the persistent
// SelectionBar (below) — the one path for "seat this whole group at a
// table," whether that's a household, the wedding party, or any other
// group. There is deliberately no per-group "seat here" shortcut: the
// Guest Workspace only ever renders when no table is selected (selecting
// one swaps the panel to that table's own roster), so a group action tied
// to "the selected table" could never actually fire.
function GroupBulkActions({ members, onSelectAll }: { members: AnyGuest[]; onSelectAll: () => void }) {
  return (
    <button onClick={onSelectAll} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground">
      Select all ({members.length})
    </button>
  );
}

// ── Guest Workspace — the planning side of the split view ─────────────────

function GuestWorkspacePanel({
  allGuests, selectedGuestIds, draggingGuestId,
  onToggleSelect, onSelectMany, onDragStart,
}: {
  allGuests: AnyGuest[];
  selectedGuestIds: Set<string>;
  draggingGuestId: string;
  onToggleSelect: (id: string) => void;
  onSelectMany: (ids: string[]) => void;
  onDragStart: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const matches = (g: AnyGuest) => !q || g.name.toLowerCase().includes(q);

  const unassigned = allGuests.filter((g) => g.tableId === null && matches(g));
  const assigned = allGuests.filter((g) => g.tableId !== null && matches(g));
  const households = groupByHousehold(allGuests.filter((g) => g.householdId && matches(g)));
  const weddingParty = allGuests.filter((g) => g.isWeddingParty && matches(g));
  const children = allGuests.filter((g) => g.isChild && matches(g));
  const vendorMeals = allGuests.filter((g) => g.isVendorMeal && matches(g));
  const needsReassignmentCount = unassigned.filter((g) => g.needsReassignment).length;

  const assignedByTable = new Map<string, { label: string; guests: AnyGuest[] }>();
  for (const g of assigned) {
    if (!g.tableId) continue;
    if (!assignedByTable.has(g.tableId)) assignedByTable.set(g.tableId, { label: g.tableLabel ?? "Table", guests: [] });
    assignedByTable.get(g.tableId)!.guests.push(g);
  }

  function renderChip(g: AnyGuest) {
    return (
      <GuestChip
        key={g.guestId} guest={g} onDragStart={onDragStart}
        highlight={draggingGuestId === g.guestId}
        selected={selectedGuestIds.has(g.guestId)} onToggleSelect={onToggleSelect}
        tableLabel={g.tableLabel}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <h3 className="text-sm font-semibold text-heading mb-2">Guest Workspace</h3>
        <Input placeholder="Search guests…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {needsReassignmentCount > 0 && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {needsReassignmentCount} guest{needsReassignmentCount === 1 ? "" : "s"} need{needsReassignmentCount === 1 ? "s" : ""} a new table — their table was removed from the Floor Plan.
          </div>
        )}

        <CollapsibleGroup icon="🪑" title="Unassigned" count={unassigned.length} defaultOpen>
          {unassigned.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <div className="text-2xl mb-1">🎉</div>
              <p className="text-xs">Everyone is seated!</p>
            </div>
          ) : (
            <div className="space-y-1">{unassigned.map(renderChip)}</div>
          )}
        </CollapsibleGroup>

        {households.length > 0 && (
          <CollapsibleGroup icon="🏠" title="Households" count={households.length}>
            <div className="space-y-4">
              {households.map((h) => (
                <div key={h.key}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{h.name} ({h.guests.length})</p>
                  <GroupBulkActions members={h.guests} onSelectAll={() => onSelectMany(h.guests.map((g) => g.guestId))} />
                  <div className="space-y-1 mt-1.5">{h.guests.map(renderChip)}</div>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">Tip: select or drag individual members to split them across tables.</p>
                </div>
              ))}
            </div>
          </CollapsibleGroup>
        )}

        {weddingParty.length > 0 && (
          <CollapsibleGroup icon="💍" title="Wedding Party" count={weddingParty.length}>
            <GroupBulkActions members={weddingParty} onSelectAll={() => onSelectMany(weddingParty.map((g) => g.guestId))} />
            <div className="space-y-1">{weddingParty.map(renderChip)}</div>
          </CollapsibleGroup>
        )}

        {children.length > 0 && (
          <CollapsibleGroup icon="👶" title="Children" count={children.length}>
            <GroupBulkActions members={children} onSelectAll={() => onSelectMany(children.map((g) => g.guestId))} />
            <div className="space-y-1">{children.map(renderChip)}</div>
          </CollapsibleGroup>
        )}

        {vendorMeals.length > 0 && (
          <CollapsibleGroup icon="🧑‍🍳" title="Vendor Meals" count={vendorMeals.length}>
            <GroupBulkActions members={vendorMeals} onSelectAll={() => onSelectMany(vendorMeals.map((g) => g.guestId))} />
            <div className="space-y-1">{vendorMeals.map(renderChip)}</div>
          </CollapsibleGroup>
        )}

        <CollapsibleGroup icon="✅" title="Assigned" count={assigned.length}>
          {assigned.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">No one seated yet.</div>
          ) : (
            <div className="space-y-3">
              {[...assignedByTable.entries()].map(([tableId, group]) => (
                <div key={tableId}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{group.label} ({group.guests.length})</p>
                  <div className="space-y-1">{group.guests.map(renderChip)}</div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleGroup>
      </div>

      <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
        Select a table, then drag or check off guests to seat them.
      </div>
    </div>
  );
}

// ── Selection bar — persistent whenever guests are multi-selected ─────────

function SelectionBar({
  count, tables, selectedTableId, onChangeTable, onAssign, onClear,
}: {
  count: number;
  tables: SeatingTable[];
  selectedTableId: string | null;
  onChangeTable: (id: string) => void;
  onAssign: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mx-4 mt-3 flex items-center gap-2 flex-wrap rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-xs font-medium text-foreground">{count} guest{count === 1 ? "" : "s"} selected</span>
      <select
        value={selectedTableId ?? ""} onChange={(e) => onChangeTable(e.target.value)}
        className="h-7 rounded-md border border-border bg-card px-2 text-xs"
      >
        <option value="">Choose a table…</option>
        {tables.map((t) => <option key={t.id} value={t.id}>{t.label ?? "Table"}</option>)}
      </select>
      <Button size="sm" className="h-7 text-xs" disabled={!selectedTableId} onClick={onAssign}>Assign</Button>
      <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground ml-auto">Clear</button>
    </div>
  );
}

// ── Seating Dashboard — orientation before editing ─────────────────────────

function SeatingDashboard({ data, onContinue }: { data: SeatingData; onContinue: () => void }) {
  const { stats } = data;
  const pct = stats.totalAttending > 0 ? Math.round((stats.totalAssigned / stats.totalAttending) * 100) : 0;
  const tablesWithSpace = data.tables.filter((t) => t.capacity == null || t.guests.length < t.capacity).length;
  const toSeat = data.unassignedGuests.length + data.needsReassignment.length;
  const complete = pct === 100 && stats.totalAttending > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{data.floorPlan?.name}</p>
      <h2 className="text-lg font-semibold text-heading mb-4">
        {complete ? "Everyone's seated! 🎉" : stats.totalAssigned > 0 ? "Continue seating your guests" : "Let's start seating your guests"}
      </h2>

      <div className="w-full max-w-xs mb-6">
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: complete ? "#3D5040" : "#5D6F5D" }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{stats.totalAssigned} of {stats.totalAttending} guests seated · {pct}%</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-6">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xl font-semibold text-heading">{tablesWithSpace}</p>
          <p className="text-[11px] text-muted-foreground">Tables with space</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xl font-semibold text-heading">{toSeat}</p>
          <p className="text-[11px] text-muted-foreground">Guests to seat</p>
        </div>
      </div>

      {data.needsReassignment.length > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 max-w-xs">
          {data.needsReassignment.length} guest{data.needsReassignment.length === 1 ? "" : "s"} need a new table since their table was removed.
        </p>
      )}

      <Button onClick={onContinue}>
        {complete ? "View Seating Chart" : stats.totalAssigned > 0 ? "Continue Seating" : "Start Seating"}
      </Button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SeatingSection({ token }: { token: string }) {
  const [data, setData] = useState<SeatingData | null>(null);
  const [loading, setLoading] = useState(true);
  // Remembered per browser tab, not just per component mount — switching to
  // another portal section and back to Seating should resume exactly where
  // the couple left off, not force them through the dashboard again.
  const [view, setView] = useState<"dashboard" | "workspace">(() => (
    typeof window !== "undefined" && sessionStorage.getItem(`seating-continued-${token}`) ? "workspace" : "dashboard"
  ));
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
  const [draggingGuestId, setDraggingGuestId] = useState<string>("");
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
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

  const assignMany = async (guestIds: string[], tableId: string) => {
    if (guestIds.length === 0) return;
    for (const guestId of guestIds) await assignGuest(guestId, tableId);
    const tableLabel = data?.tables.find((t) => t.id === tableId)?.label ?? "the table";
    toast.success(`Seated ${guestIds.length} guest${guestIds.length === 1 ? "" : "s"} at ${tableLabel}`);
    setSelectedGuestIds(new Set());
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

  const toggleSelect = (guestId: string) => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId); else next.add(guestId);
      return next;
    });
  };

  const selectMany = (ids: string[]) => {
    setSelectedGuestIds((prev) => new Set([...prev, ...ids]));
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

  const selectedTable: SeatingTable | null = data?.tables.find((t) => t.id === selectedTableId) ?? null;
  const allGuests = useMemo(() => (data ? buildAllGuests(data) : []), [data]);
  const unassignedPool = useMemo(() => allGuests.filter((g) => g.tableId === null), [allGuests]);

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

  if (view === "dashboard") {
    return (
      <SeatingDashboard
        data={data}
        onContinue={() => {
          sessionStorage.setItem(`seating-continued-${token}`, "1");
          setView("workspace");
        }}
      />
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
        <button onClick={() => setView("dashboard")} className="text-xs text-muted-foreground hover:text-foreground shrink-0" title="Back to seating overview">
          ← Dashboard
        </button>
        <p className="text-sm font-medium text-heading truncate">{data.floorPlan.name}</p>
        <div className="ml-auto flex items-center gap-2">
          {pctAssigned === 100 && stats && stats.totalAttending > 0 ? (
            <Badge>Everyone seated 🎉</Badge>
          ) : (
            <div className="flex items-center gap-2 w-40">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctAssigned}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{pctAssigned}%</span>
            </div>
          )}
          <Button
            size="sm" variant="outline" className="text-xs"
            disabled={autoAssigning || unassignedPool.length === 0 || !data.tables.length}
            onClick={handleAutoAssign}
          >
            {autoAssigning ? "Calculating…" : "✨ Auto-assign"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-1 flex-wrap text-xs text-muted-foreground">
        <span><strong className="text-foreground">{stats?.totalAssigned}</strong>/{stats?.totalAttending} seated</span>
        <span><strong className="text-foreground">{stats?.tableCount}</strong> tables</span>
        <span><strong className="text-foreground">{stats?.totalCapacity}</strong> seats</span>
        {stats && stats.totalCapacity > 0 && stats.totalCapacity < stats.totalAttending && (
          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
            Need {stats.totalAttending - stats.totalCapacity} more seats
          </Badge>
        )}
      </div>

      {selectedGuestIds.size > 0 && (
        <SelectionBar
          count={selectedGuestIds.size}
          tables={data.tables}
          selectedTableId={selectedTableId}
          onChangeTable={setSelectedTableId}
          onAssign={() => selectedTableId && assignMany([...selectedGuestIds], selectedTableId)}
          onClear={() => setSelectedGuestIds(new Set())}
        />
      )}

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

        <div className="w-80 border-l border-border flex flex-col bg-card overflow-hidden">
          {selectedTable ? (
            <TableInfoPanel
              table={selectedTable}
              pool={unassignedPool}
              selectedGuestIds={selectedGuestIds}
              onToggleSelect={toggleSelect}
              draggingGuestId={draggingGuestId}
              onDragStart={setDraggingGuestId}
              onRemove={removeGuest}
              onAssign={(guestId) => assignGuest(guestId, selectedTable.id)}
              onClose={() => setSelectedTableId(null)}
            />
          ) : (
            <GuestWorkspacePanel
              allGuests={allGuests}
              selectedGuestIds={selectedGuestIds}
              draggingGuestId={draggingGuestId}
              onToggleSelect={toggleSelect}
              onSelectMany={selectMany}
              onDragStart={setDraggingGuestId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
