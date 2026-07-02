"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSeatingObservation } from "@/lib/luv/portal-observations";

// ── Types ─────────────────────────────────────────────────────────────────────

type TableType = "round" | "rectangular" | "head" | "sweetheart" | "cocktail";

type AssignedGuest = {
  guestId: string;
  name: string;
  mealChoice: string | null;
  dietaryRestrictions: string | null;
  isChild: boolean;
  householdId: string | null;
  plusOneOf: string | null;
};

type SeatingTable = {
  id: string;
  tableType: TableType;
  name: string;
  capacity: number;
  positionX: number;
  positionY: number;
  displayOrder: number;
  guests: AssignedGuest[];
};

type UnassignedGuest = {
  id: string;
  name: string;
  mealChoice: string | null;
  dietaryRestrictions: string | null;
  isChild: boolean;
  householdId: string | null;
  plusOneOf: string | null;
};

type SeatingData = {
  arrangement: { id: string; name: string; canvasWidth: number; canvasHeight: number };
  tables: SeatingTable[];
  unassignedGuests: UnassignedGuest[];
  stats: { totalAttending: number; totalAssigned: number; tableCount: number; totalCapacity: number };
};

type Household = {
  householdKey: string;
  guestIds: string[];
  names: string[];
  size: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE_DEFS: Record<TableType, { label: string; emoji: string; defaultCapacity: number; w: number; h: number; radius: string }> = {
  round:       { label: "Round",       emoji: "⭕", defaultCapacity: 8,  w: 150, h: 150, radius: "50%" },
  rectangular: { label: "Rectangular", emoji: "▭",  defaultCapacity: 10, w: 220, h: 100, radius: "8px" },
  head:        { label: "Head Table",  emoji: "👑", defaultCapacity: 12, w: 340, h: 80,  radius: "8px" },
  sweetheart:  { label: "Sweetheart",  emoji: "❤️", defaultCapacity: 2,  w: 120, h: 120, radius: "50%" },
  cocktail:    { label: "Cocktail",    emoji: "🥂", defaultCapacity: 4,  w: 90,  h: 90,  radius: "50%" },
};

const MEAL_EMOJI: Record<string, string> = {
  chicken: "🍗", beef: "🥩", fish: "🐟", vegetarian: "🥦", vegan: "🌱", kids: "🍕",
};

const CANVAS_W = 1200;
const CANVAS_H = 800;

// ── Utility ───────────────────────────────────────────────────────────────────

function mealEmoji(choice: string | null) {
  if (!choice) return null;
  return MEAL_EMOJI[choice.toLowerCase()] ?? "🍽";
}

function dietaryBadge(dietary: string | null) {
  if (!dietary) return null;
  const d = dietary.toLowerCase();
  if (d.includes("nut")) return "🥜";
  if (d.includes("gluten")) return "🌾";
  if (d.includes("dairy") || d.includes("lactose")) return "🥛";
  if (d.includes("kosher")) return "✡️";
  if (d.includes("halal")) return "☪️";
  return "⚠️";
}

// Auto-assign: pack households into tables in order, keeping groups together
function computeAutoAssign(
  households: Household[],
  tables: SeatingTable[],
): Array<{ guestId: string; tableId: string }> {
  if (!tables.length || !households.length) return [];

  const results: Array<{ guestId: string; tableId: string }> = [];
  const loads = new Map(tables.map(t => [t.id, t.guests.length]));
  const sortedTables = [...tables].sort((a, b) => a.displayOrder - b.displayOrder || a.positionX - b.positionX);

  for (const hh of households) {
    // Find first table where everyone fits
    let target = sortedTables.find(t => (loads.get(t.id) ?? 0) + hh.size <= t.capacity);
    if (!target) {
      // Partial fill: find any table with space
      target = sortedTables.find(t => (loads.get(t.id) ?? 0) < t.capacity);
    }
    if (!target) continue;

    for (const guestId of hh.guestIds) {
      const current = loads.get(target.id) ?? 0;
      if (current < target.capacity) {
        results.push({ guestId, tableId: target.id });
        loads.set(target.id, current + 1);
      }
    }
  }

  return results;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GuestChip({
  guest, onRemove,
}: {
  guest: AssignedGuest;
  onRemove: (id: string) => void;
}) {
  const meal = mealEmoji(guest.mealChoice);
  const diet = dietaryBadge(guest.dietaryRestrictions);
  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-card rounded text-xs shadow-sm border border-border select-none">
      <span className="flex-1 truncate max-w-[90px]">
        {guest.isChild && <span className="mr-0.5">👶</span>}
        {guest.name.split(" ")[0]}
      </span>
      {meal && <span className="opacity-70">{meal}</span>}
      {diet && <span className="opacity-70">{diet}</span>}
      <button
        onClick={e => { e.stopPropagation(); onRemove(guest.guestId); }}
        className="text-muted-foreground/40 hover:text-destructive ml-0.5 leading-none font-bold"
        title="Remove from table"
        aria-label={`Remove ${guest.name.split(" ")[0]} from table`}
      >
        ×
      </button>
    </div>
  );
}

function TableCard({
  table,
  isSelected,
  isDragOver,
  onSelect,
  onMouseDown,
  onDragOver,
  onDrop,
  onGuestRemove,
}: {
  table: SeatingTable;
  isSelected: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onGuestRemove: (guestId: string) => void;
}) {
  const def = TABLE_DEFS[table.tableType];
  const isOver = table.guests.length > table.capacity;
  const fillPct = Math.min(100, Math.round((table.guests.length / table.capacity) * 100));

  const borderColor = isOver
    ? "#ef4444"
    : isDragOver
    ? "#3D5040"
    : isSelected
    ? "#5D6F5D"
    : "#c8d4c8";

  return (
    <div
      style={{
        position: "absolute",
        left: table.positionX,
        top:  table.positionY,
        width: def.w + 20,
        userSelect: "none",
        zIndex: isSelected ? 20 : 10,
      }}
      onClick={e => { e.stopPropagation(); onSelect(); }}
    >
      {/* Drag handle area */}
      <div
        onMouseDown={onMouseDown}
        onDragOver={onDragOver}
        onDrop={onDrop}
        style={{ cursor: "grab" }}
      >
        {/* Table shape */}
        <div
          style={{
            width: def.w,
            height: def.h,
            borderRadius: def.radius,
            background: isDragOver ? "#f0f7f0" : isSelected ? "#eef4ee" : "#fafcfa",
            border: `2px solid ${borderColor}`,
            boxShadow: isSelected ? "0 0 0 3px rgba(93,111,93,0.15)" : "0 1px 3px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            transition: "border-color 0.15s, box-shadow 0.15s",
            position: "relative",
          }}
        >
          <div className="text-[11px] font-semibold text-[#3D5040] text-center leading-tight px-2">
            {table.tableType === "sweetheart" ? "❤️" : null}
            {table.name}
          </div>
          <div className={`text-[10px] font-medium ${isOver ? "text-red-500" : "text-gray-400"}`}>
            {table.guests.length}/{table.capacity}
            {isOver && " ⚠️"}
          </div>
          {/* Fill bar */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1 rounded-b overflow-hidden"
            style={{ borderRadius: def.radius === "50%" ? "0 0 50% 50%" : "0 0 6px 6px" }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${fillPct}%`,
                background: isOver ? "#ef4444" : "#5D6F5D",
              }}
            />
          </div>
        </div>
      </div>

      {/* Guest chips below table */}
      {table.guests.length > 0 && (
        <div
          className="mt-1.5 flex flex-wrap gap-1"
          style={{ maxWidth: def.w + 20 }}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {table.guests.map(g => (
            <GuestChip key={g.guestId} guest={g} onRemove={onGuestRemove} />
          ))}
        </div>
      )}

      {/* Drop zone hint */}
      {isDragOver && table.guests.length === 0 && (
        <div className="mt-1 text-center text-[10px] text-[#5D6F5D] animate-pulse">
          Drop to seat
        </div>
      )}
    </div>
  );
}

function GuestCard({
  guest,
  onDragStart,
  highlight,
}: {
  guest: UnassignedGuest;
  onDragStart: (id: string) => void;
  highlight: boolean;
}) {
  const meal = mealEmoji(guest.mealChoice);
  const diet = dietaryBadge(guest.dietaryRestrictions);

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData("guestId", guest.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(guest.id);
      }}
      onDragEnd={() => onDragStart("")}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing
        transition-colors select-none
        ${highlight
          ? "bg-[#eef4ee] border-[#5D6F5D] shadow-sm"
          : "bg-white border-gray-200 hover:border-[#5D6F5D]/40"}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[#2D3D2D] truncate">
          {guest.isChild && <span className="mr-1">👶</span>}
          {guest.name}
          {guest.plusOneOf && (
            <span className="text-[10px] text-gray-400 ml-1">(+1)</span>
          )}
        </div>
        {(guest.dietaryRestrictions || guest.mealChoice) && (
          <div className="text-[10px] text-gray-400 truncate">
            {guest.dietaryRestrictions}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {meal && <span className="text-sm">{meal}</span>}
        {diet && <span className="text-sm">{diet}</span>}
      </div>
      <svg className="w-3 h-3 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 16 16">
        <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
        <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
        <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
      </svg>
    </div>
  );
}

function TableConfigPanel({
  table,
  onUpdate,
  onDelete,
  onClose,
}: {
  table: SeatingTable;
  onUpdate: (patch: Partial<Pick<SeatingTable, "name" | "capacity" | "tableType">>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(table.name);
  const [capacity, setCapacity] = useState(String(table.capacity));

  useEffect(() => { setName(table.name); setCapacity(String(table.capacity)); }, [table.id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">Table Settings</h3>
        <button onClick={onClose} aria-label="Close table settings" className="text-muted-foreground hover:text-foreground text-lg leading-none p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">×</button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => name.trim() && onUpdate({ name: name.trim() })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Seats</Label>
          <Input
            type="number" min={1} max={100}
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            onBlur={() => {
              const n = parseInt(capacity);
              if (n >= 1 && n <= 100) onUpdate({ capacity: n });
            }}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Type</Label>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {(Object.entries(TABLE_DEFS) as [TableType, typeof TABLE_DEFS[TableType]][]).map(([type, def]) => (
              <button
                key={type}
                onClick={() => onUpdate({ tableType: type })}
                className={`
                  text-xs py-1.5 px-2 rounded border transition-colors
                  ${table.tableType === type
                    ? "bg-[#3D5040] text-white border-[#3D5040]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#5D6F5D]/40"}
                `}
              >
                {def.emoji} {def.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="text-xs text-gray-400 mb-1">
          {table.guests.length} seated · {Math.max(0, table.capacity - table.guests.length)} remaining
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          Remove table{table.guests.length > 0 ? ` (unseats ${table.guests.length})` : ""}
        </button>
      </div>
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
  const [guestFilter, setGuestFilter] = useState<"all" | "children" | "dietary">("all");
  const [guestSearch, setGuestSearch] = useState("");
  const [savingTableId, setSavingTableId] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [showAutoPreview, setShowAutoPreview] = useState<Array<{ guestId: string; tableId: string }>>([]);

  // Table drag-move state
  const movingRef = useRef<{
    tableId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/seating?token=${token}`);
      const json = await res.json();
      if (json.arrangement) setData(json as SeatingData);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // ── Table move (mouse) ─────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!movingRef.current || !data) return;
      const { tableId, startClientX, startClientY, origX, origY } = movingRef.current;
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      const def = TABLE_DEFS[data.tables.find(t => t.id === tableId)?.tableType ?? "round"];
      const newX = Math.max(0, Math.min(CANVAS_W - def.w - 20, origX + dx));
      const newY = Math.max(0, Math.min(CANVAS_H - def.h - 80, origY + dy));

      setData(d => d ? {
        ...d,
        tables: d.tables.map(t =>
          t.id === tableId ? { ...t, positionX: newX, positionY: newY } : t
        ),
      } : d);
    };

    const onUp = async () => {
      if (!movingRef.current || !data) { movingRef.current = null; return; }
      const { tableId } = movingRef.current;
      movingRef.current = null;
      const table = data.tables.find(t => t.id === tableId);
      if (!table) return;

      setSavingTableId(tableId);
      await fetch("/api/portal/seating/table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          tableId: table.id,
          tableType: table.tableType,
          name: table.name,
          capacity: table.capacity,
          positionX: Math.round(table.positionX),
          positionY: Math.round(table.positionY),
          displayOrder: table.displayOrder,
        }),
      });
      setSavingTableId(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [data, token]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const addTable = async (type: TableType) => {
    // Offset each new table slightly from center
    const offset = (data?.tables.length ?? 0) * 30;
    const def = TABLE_DEFS[type];
    const posX = Math.max(20, Math.min(CANVAS_W - def.w - 40, 100 + offset));
    const posY = Math.max(20, Math.min(CANVAS_H - def.h - 100, 80 + offset));

    const res = await fetch("/api/portal/seating/table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token, tableType: type,
        capacity: def.defaultCapacity,
        positionX: posX, positionY: posY,
        displayOrder: (data?.tables.length ?? 0),
      }),
    });
    const json = await res.json();
    if (json.tableId) await load();
  };

  const updateTable = async (tableId: string, patch: Partial<Pick<SeatingTable, "name" | "capacity" | "tableType">>) => {
    if (!data) return;
    const table = data.tables.find(t => t.id === tableId);
    if (!table) return;

    setData(d => d ? {
      ...d,
      tables: d.tables.map(t => t.id === tableId ? { ...t, ...patch } : t),
    } : d);

    await fetch("/api/portal/seating/table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token, tableId,
        tableType: patch.tableType ?? table.tableType,
        name: patch.name ?? table.name,
        capacity: patch.capacity ?? table.capacity,
        positionX: Math.round(table.positionX),
        positionY: Math.round(table.positionY),
        displayOrder: table.displayOrder,
      }),
    });
  };

  const deleteTable = async (tableId: string) => {
    if (!data) return;
    const table = data.tables.find(t => t.id === tableId);
    if (!table) return;

    // Move guests back to unassigned optimistically
    setData(d => {
      if (!d) return d;
      const movedGuests: UnassignedGuest[] = table.guests.map(g => ({
        id: g.guestId, name: g.name, mealChoice: g.mealChoice,
        dietaryRestrictions: g.dietaryRestrictions, isChild: g.isChild,
        householdId: g.householdId, plusOneOf: g.plusOneOf,
      }));
      return {
        ...d,
        tables: d.tables.filter(t => t.id !== tableId),
        unassignedGuests: [...d.unassignedGuests, ...movedGuests],
        stats: { ...d.stats, tableCount: d.stats.tableCount - 1 },
      };
    });
    setSelectedTableId(null);

    await fetch("/api/portal/seating/table", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, tableId }),
    });
  };

  const assignGuest = async (guestId: string, tableId: string) => {
    if (!data) return;
    const guest = data.unassignedGuests.find(g => g.id === guestId)
      ?? data.tables.flatMap(t => t.guests).find(g => g.guestId === guestId);
    if (!guest) return;

    // Optimistic update
    setData(d => {
      if (!d) return d;
      const guestObj: AssignedGuest = "id" in guest
        ? { guestId: guest.id, name: guest.name, mealChoice: guest.mealChoice,
            dietaryRestrictions: guest.dietaryRestrictions, isChild: guest.isChild,
            householdId: guest.householdId, plusOneOf: guest.plusOneOf }
        : guest as AssignedGuest;

      return {
        ...d,
        tables: d.tables.map(t => {
          // Remove from any existing table
          const filtered = t.guests.filter(g => g.guestId !== guestId);
          // Add to target table
          if (t.id === tableId) return { ...t, guests: [...filtered, guestObj] };
          return { ...t, guests: filtered };
        }),
        unassignedGuests: d.unassignedGuests.filter(g => g.id !== guestId),
        stats: { ...d.stats, totalAssigned: d.stats.totalAssigned + 1 },
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
    const assigned = data.tables.flatMap(t => t.guests).find(g => g.guestId === guestId);
    if (!assigned) return;

    setData(d => {
      if (!d) return d;
      const unassigned: UnassignedGuest = {
        id: assigned.guestId, name: assigned.name, mealChoice: assigned.mealChoice,
        dietaryRestrictions: assigned.dietaryRestrictions, isChild: assigned.isChild,
        householdId: assigned.householdId, plusOneOf: assigned.plusOneOf,
      };
      return {
        ...d,
        tables: d.tables.map(t => ({ ...t, guests: t.guests.filter(g => g.guestId !== guestId) })),
        unassignedGuests: [...d.unassignedGuests, unassigned].sort((a, b) => a.name.localeCompare(b.name)),
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
      const households: Household[] = json.households ?? [];

      // Only suggest for currently unassigned guests
      const unassignedIds = new Set(data.unassignedGuests.map(g => g.id));
      const filteredHouseholds = households
        .map(hh => ({ ...hh, guestIds: hh.guestIds.filter((id: string) => unassignedIds.has(id)) }))
        .filter(hh => hh.guestIds.length > 0);

      const suggestions = computeAutoAssign(filteredHouseholds, data.tables);
      setShowAutoPreview(suggestions);
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

  const selectedTable = data?.tables.find(t => t.id === selectedTableId) ?? null;

  // ── Filtered guest sidebar ─────────────────────────────────────────────────
  const filteredUnassigned = (data?.unassignedGuests ?? []).filter(g => {
    if (guestFilter === "children" && !g.isChild) return false;
    if (guestFilter === "dietary" && !g.dietaryRestrictions) return false;
    if (guestSearch) {
      const q = guestSearch.toLowerCase();
      if (!g.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Stats bar ──────────────────────────────────────────────────────────────
  const stats = data?.stats;
  const pctAssigned = stats && stats.totalAttending > 0
    ? Math.round((stats.totalAssigned / stats.totalAttending) * 100)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-pulse">Loading seating chart…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>No RSVP data yet.</p>
        <p className="text-sm mt-1">Seating becomes available once guests start confirming attendance.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ fontFamily: "inherit" }}>

      {/* ── Auto-assign preview modal ─────────────────────────────────────── */}
      {showAutoPreview.length > 0 && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-[#2D3D2D] mb-2">Auto-Assign Preview</h3>
            <p className="text-sm text-gray-500 mb-4">
              We'll seat <strong>{showAutoPreview.length}</strong> guests across your tables,
              keeping households together where possible.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#3D5040] hover:bg-[#2D3D30] text-white"
                onClick={confirmAutoAssign}
              >
                Confirm
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowAutoPreview([])}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-400 font-medium mr-1">Add table:</span>
          {(Object.entries(TABLE_DEFS) as [TableType, typeof TABLE_DEFS[TableType]][]).map(([type, def]) => (
            <button
              key={type}
              onClick={() => addTable(type)}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 hover:border-[#5D6F5D] hover:bg-[#f5f8f5] text-gray-600 transition-colors"
            >
              {def.emoji} {def.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {stats && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                <strong className={pctAssigned === 100 ? "text-[#3D5040]" : "text-[#2D3D2D]"}>
                  {stats.totalAssigned}
                </strong>/{stats.totalAttending} seated
              </span>
              <span>
                <strong className="text-[#2D3D2D]">{stats.tableCount}</strong> tables
              </span>
              <span>
                <strong className="text-[#2D3D2D]">{stats.totalCapacity}</strong> seats
              </span>
              {stats.totalCapacity > 0 && stats.totalCapacity < stats.totalAttending && (
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                  Need {stats.totalAttending - stats.totalCapacity} more seats
                </Badge>
              )}
              {pctAssigned === 100 && (
                <Badge className="bg-[#3D5040] text-white">Everyone seated 🎉</Badge>
              )}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            disabled={autoAssigning || !data.unassignedGuests.length || !data.tables.length}
            onClick={handleAutoAssign}
          >
            {autoAssigning ? "Calculating…" : "✨ Auto-assign"}
          </Button>
        </div>
      </div>

      {/* ── Luv observation ───────────────────────────────────────────────── */}
      {stats && (() => {
        const obs = getSeatingObservation(stats);
        if (!obs) return null;
        return (
          <div
            className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-start gap-2.5"
            style={{ background: "#FDF5F5", border: "1px solid #D8A7AA30" }}
          >
            <span style={{ color: "#D8A7AA", fontSize: 14, lineHeight: 1.5 }}>💗</span>
            <p className="text-sm leading-relaxed" style={{ color: "#5A3235" }}>{obs.text}</p>
          </div>
        );
      })()}

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-auto"
          style={{ background: "#f4f7f4" }}
        >
          <div
            ref={canvasRef}
            style={{
              position: "relative",
              width: CANVAS_W,
              height: CANVAS_H,
              backgroundImage: "radial-gradient(circle, #d0d9d0 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              minWidth: CANVAS_W,
              minHeight: CANVAS_H,
            }}
            onClick={() => setSelectedTableId(null)}
          >
            {data.tables.map(table => (
              <TableCard
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                isDragOver={dragOverTableId === table.id}
                onSelect={() => setSelectedTableId(table.id === selectedTableId ? null : table.id)}
                onMouseDown={e => {
                  e.stopPropagation();
                  movingRef.current = {
                    tableId: table.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    origX: table.positionX,
                    origY: table.positionY,
                  };
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverTableId(table.id);
                }}
                onDrop={e => {
                  e.preventDefault();
                  const guestId = e.dataTransfer.getData("guestId");
                  if (guestId) assignGuest(guestId, table.id);
                  setDragOverTableId(null);
                }}
                onGuestRemove={removeGuest}
              />
            ))}

            {data.tables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-3">🪑</div>
                  <p className="text-sm font-medium">Add tables using the bar above</p>
                  <p className="text-xs mt-1">Then drag guests from the sidebar to seat them</p>
                </div>
              </div>
            )}

            {/* Saving indicator */}
            {savingTableId && (
              <div className="absolute bottom-3 left-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                Saving…
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: config or guest sidebar ──────────────────────── */}
        <div className="w-72 border-l border-gray-100 flex flex-col bg-white overflow-hidden">
          {selectedTable ? (
            /* Table config panel */
            <div className="p-4 overflow-y-auto">
              <TableConfigPanel
                table={selectedTable}
                onUpdate={patch => updateTable(selectedTable.id, patch)}
                onDelete={() => deleteTable(selectedTable.id)}
                onClose={() => setSelectedTableId(null)}
              />
            </div>
          ) : (
            /* Unassigned guests sidebar */
            <>
              <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[#2D3D2D]">
                    Unassigned
                    <span className="ml-1.5 text-xs font-normal text-gray-400">
                      ({data.unassignedGuests.length})
                    </span>
                  </h3>
                </div>
                <Input
                  placeholder="Search guests…"
                  value={guestSearch}
                  onChange={e => setGuestSearch(e.target.value)}
                  className="h-7 text-xs mb-2"
                />
                <div className="flex gap-1">
                  {(["all","children","dietary"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setGuestFilter(f)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        guestFilter === f
                          ? "bg-[#3D5040] text-white border-[#3D5040]"
                          : "bg-white text-gray-500 border-gray-200 hover:border-[#5D6F5D]/40"
                      }`}
                    >
                      {f === "all" ? "All" : f === "children" ? "👶 Kids" : "⚠️ Dietary"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                {filteredUnassigned.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {data.unassignedGuests.length === 0 ? (
                      <>
                        <div className="text-2xl mb-2">🎉</div>
                        <p className="text-xs">Everyone is seated!</p>
                      </>
                    ) : (
                      <p className="text-xs">No guests match filter</p>
                    )}
                  </div>
                ) : (
                  filteredUnassigned.map(guest => (
                    <GuestCard
                      key={guest.id}
                      guest={guest}
                      onDragStart={setDraggingGuestId}
                      highlight={draggingGuestId === guest.id}
                    />
                  ))
                )}
              </div>

              {data.unassignedGuests.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                  Drag guests to a table to seat them
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
