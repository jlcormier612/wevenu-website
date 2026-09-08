"use client";

/**
 * Calendar 2A.2.1 / 2A.2.3 — Scheduled appointment types Settings section.
 * Catalog configuration only; does not rewrite calendar_blocks snapshots or titles.
 */
import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  archiveCustomScheduleItemTypeAction,
  createCustomScheduleItemTypeAction,
  restoreCustomScheduleItemTypeAction,
  updateBuiltinScheduleItemTypeAction,
  updateCustomScheduleItemTypeAction,
} from "@/app/(app)/settings/schedule-appointment-types-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS,
  CUSTOM_SCHEDULE_ITEM_KIND_OPTIONS,
  SCHEDULE_APPOINTMENT_SETTINGS_GROUPS,
  countActiveCustomTypes,
  groupKeyToCustomKind,
  type AppointmentCatalogBuiltinKey,
  type CustomScheduleItemKind,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";
import { cn } from "@/lib/utils";

type BuiltinRow = {
  id: string;
  builtinKey: AppointmentCatalogBuiltinKey;
  label: string;
  enabled: boolean;
  blocksAvailability: boolean;
};

type CustomRow = {
  id: string;
  label: string;
  blocksAvailability: boolean;
  groupKey: VenueScheduleItemType["groupKey"];
  archivedAt: string | null;
};

function toBuiltinRows(types: VenueScheduleItemType[]): Map<AppointmentCatalogBuiltinKey, BuiltinRow> {
  const map = new Map<AppointmentCatalogBuiltinKey, BuiltinRow>();
  for (const t of types) {
    if (t.source !== "builtin" || !t.builtinKey) continue;
    map.set(t.builtinKey, {
      id: t.id,
      builtinKey: t.builtinKey,
      label: t.label,
      enabled: t.enabled,
      blocksAvailability: t.blocksAvailability,
    });
  }
  return map;
}

function toCustomRows(types: VenueScheduleItemType[]): CustomRow[] {
  return types
    .filter((t) => t.source === "custom")
    .map((t) => ({
      id: t.id,
      label: t.label,
      blocksAvailability: t.blocksAvailability,
      groupKey: t.groupKey,
      archivedAt: t.archivedAt,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function ScheduledAppointmentTypesSection({
  initialTypes,
  canEdit = true,
}: {
  initialTypes: VenueScheduleItemType[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [builtins, setBuiltins] = React.useState(() => toBuiltinRows(initialTypes));
  const [customs, setCustoms] = React.useState(() => toCustomRows(initialTypes));
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const [newKind, setNewKind] = React.useState<CustomScheduleItemKind>("appointment");
  const [newReserves, setNewReserves] = React.useState(true);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  React.useEffect(() => {
    setBuiltins(toBuiltinRows(initialTypes));
    setCustoms(toCustomRows(initialTypes));
  }, [initialTypes]);

  function refreshCatalog() {
    router.refresh();
  }

  const activeCustomCount = countActiveCustomTypes(
    customs.map((c) => ({
      id: c.id,
      venueId: "",
      source: "custom" as const,
      builtinKey: null,
      customKey: null,
      label: c.label,
      enabled: true,
      blocksAvailability: c.blocksAvailability,
      groupKey: c.groupKey,
      sortOrder: 0,
      archivedAt: c.archivedAt,
      createdAt: "",
      updatedAt: "",
    })),
  );
  const atCustomCap = activeCustomCount >= APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS;
  const archivedCustoms = customs.filter((c) => c.archivedAt);
  const activeCustoms = customs.filter((c) => !c.archivedAt);

  async function persistBuiltin(
    builtinKey: AppointmentCatalogBuiltinKey,
    patch: { enabled?: boolean; blocksAvailability?: boolean },
    rollback: BuiltinRow,
  ) {
    setSavingKey(builtinKey);
    try {
      const result = await updateBuiltinScheduleItemTypeAction({ builtinKey, ...patch });
      if (!result.ok) {
        setBuiltins((prev) => {
          const next = new Map(prev);
          next.set(builtinKey, rollback);
          return next;
        });
        toast.error(result.message);
      }
    } catch {
      setBuiltins((prev) => {
        const next = new Map(prev);
        next.set(builtinKey, rollback);
        return next;
      });
      toast.error("Could not save.");
    } finally {
      setSavingKey(null);
    }
  }

  function onBuiltinEnabled(builtinKey: AppointmentCatalogBuiltinKey, enabled: boolean) {
    if (!canEdit || builtinKey === "blocked_time") return;
    const current = builtins.get(builtinKey);
    if (!current || current.enabled === enabled) return;
    const rollback = { ...current };
    setBuiltins((prev) => {
      const next = new Map(prev);
      next.set(builtinKey, { ...current, enabled });
      return next;
    });
    void persistBuiltin(builtinKey, { enabled }, rollback);
  }

  function onBuiltinReserves(builtinKey: AppointmentCatalogBuiltinKey, blocksAvailability: boolean) {
    if (!canEdit || builtinKey === "blocked_time") return;
    const current = builtins.get(builtinKey);
    if (!current || current.blocksAvailability === blocksAvailability) return;
    const rollback = { ...current };
    setBuiltins((prev) => {
      const next = new Map(prev);
      next.set(builtinKey, { ...current, blocksAvailability });
      return next;
    });
    void persistBuiltin(builtinKey, { blocksAvailability }, rollback);
  }

  async function onCreateCustom() {
    if (!canEdit || atCustomCap) return;
    setSavingKey("create");
    try {
      const result = await createCustomScheduleItemTypeAction({
        label: newLabel,
        kind: newKind,
        blocksAvailability: newReserves,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Custom type added.");
      setAdding(false);
      setNewLabel("");
      setNewKind("appointment");
      setNewReserves(true);
      refreshCatalog();
    } catch {
      toast.error("Could not save.");
    } finally {
      setSavingKey(null);
    }
  }

  async function onCustomReserves(row: CustomRow, blocksAvailability: boolean) {
    if (!canEdit || row.archivedAt) return;
    if (row.blocksAvailability === blocksAvailability) return;
    const rollback = customs;
    setCustoms((prev) =>
      prev.map((c) => (c.id === row.id ? { ...c, blocksAvailability } : c)),
    );
    setSavingKey(row.id);
    try {
      const result = await updateCustomScheduleItemTypeAction({ id: row.id, blocksAvailability });
      if (!result.ok) {
        setCustoms(rollback);
        toast.error(result.message);
      }
    } catch {
      setCustoms(rollback);
      toast.error("Could not save.");
    } finally {
      setSavingKey(null);
    }
  }

  async function onRenameCustom(row: CustomRow) {
    if (!canEdit || row.archivedAt) return;
    const nextLabel = renameValue;
    setSavingKey(row.id);
    try {
      const result = await updateCustomScheduleItemTypeAction({ id: row.id, label: nextLabel });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setCustoms((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, label: nextLabel.trim().replace(/\s+/g, " ") } : c)),
      );
      setRenamingId(null);
      setRenameValue("");
      toast.success("Name updated.");
      refreshCatalog();
    } catch {
      toast.error("Could not save.");
    } finally {
      setSavingKey(null);
    }
  }

  async function onArchive(row: CustomRow) {
    if (!canEdit || row.archivedAt) return;
    setSavingKey(row.id);
    try {
      const result = await archiveCustomScheduleItemTypeAction({ id: row.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setCustoms((prev) =>
        prev.map((c) =>
          c.id === row.id ? { ...c, archivedAt: new Date().toISOString() } : c,
        ),
      );
      toast.success("Type archived. Existing Calendar items keep it.");
      refreshCatalog();
    } catch {
      toast.error("Could not archive.");
    } finally {
      setSavingKey(null);
    }
  }

  async function onRestore(row: CustomRow) {
    if (!canEdit || !row.archivedAt) return;
    setSavingKey(row.id);
    try {
      const result = await restoreCustomScheduleItemTypeAction({ id: row.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setCustoms((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, archivedAt: null } : c)),
      );
      toast.success("Type restored.");
      refreshCatalog();
    } catch {
      toast.error("Could not restore.");
    } finally {
      setSavingKey(null);
    }
  }

  function customsForGroup(groupLabel: string): CustomRow[] {
    return activeCustoms.filter((c) => {
      const kind = groupKeyToCustomKind(c.groupKey);
      if (groupLabel === "Appointments") return kind === "appointment";
      return kind === "reserved_blocked";
    });
  }

  return (
    <div className="space-y-6">
      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Only an Owner or Manager can change scheduled appointment types. You can view the current configuration here.
        </p>
      )}

      {SCHEDULE_APPOINTMENT_SETTINGS_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {group.keys.map((key) => {
              const row = builtins.get(key);
              if (!row) return null;
              const locked = key === "blocked_time";
              const busy = savingKey === key;
              return (
                <li
                  key={key}
                  className={cn(
                    "flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                    busy && "opacity-70",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-heading">{row.label}</p>
                    {locked && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Always available — your safe way to close time on the Calendar.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <label className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-xs text-muted-foreground">On</span>
                      <Switch
                        checked={row.enabled}
                        disabled={!canEdit || locked || busy}
                        onCheckedChange={(v) => onBuiltinEnabled(key, v)}
                        aria-label={`${row.label} enabled`}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-xs text-muted-foreground max-w-[14rem] text-right leading-snug">
                        Reserves venue time for events
                      </span>
                      <Switch
                        checked={row.blocksAvailability}
                        disabled={!canEdit || locked || busy}
                        onCheckedChange={(v) => onBuiltinReserves(key, v)}
                        aria-label={`${row.label} reserves venue time for events`}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
            {customsForGroup(group.label).map((row) => {
              const busy = savingKey === row.id;
              const renaming = renamingId === row.id;
              return (
                <li
                  key={row.id}
                  className={cn(
                    "flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between",
                    busy && "opacity-70",
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    {renaming ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-8 max-w-xs"
                          aria-label="New name"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || !renameValue.trim()}
                          onClick={() => void onRenameCustom(row)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => { setRenamingId(null); setRenameValue(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-heading">{row.label}</p>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Your type
                        </span>
                      </div>
                    )}
                    {canEdit && !renaming && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => { setRenamingId(row.id); setRenameValue(row.label); }}
                        >
                          Rename
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void onArchive(row)}
                        >
                          Archive
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <label className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-xs text-muted-foreground max-w-[14rem] text-right leading-snug">
                        Reserves venue time for events
                      </span>
                      <Switch
                        checked={row.blocksAvailability}
                        disabled={!canEdit || busy}
                        onCheckedChange={(v) => void onCustomReserves(row, v)}
                        aria-label={`${row.label} reserves venue time for events`}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        When on, this time counts as reserved on your Calendar so another event can’t book over it. It does not change when couples can book tours — that’s under Tour Availability above.
      </p>

      {canEdit && (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          {!adding ? (
            <div className="space-y-1">
              {atCustomCap ? (
                <p className="text-xs text-muted-foreground">
                  You’ve reached the limit of {APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS} custom types.
                  Archive one before adding another.
                </p>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
                  Add your own type
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-heading">Add your own type</p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground" htmlFor="custom-type-name">Name</label>
                <Input
                  id="custom-type-name"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Wedding Planning Meeting"
                  disabled={savingKey === "create"}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Kind</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_SCHEDULE_ITEM_KIND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={savingKey === "create"}
                      onClick={() => setNewKind(opt.value)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        newKind === opt.value
                          ? "border-primary bg-primary/10 text-heading"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Reserves venue time for events</span>
                <Switch
                  checked={newReserves}
                  disabled={savingKey === "create"}
                  onCheckedChange={setNewReserves}
                  aria-label="Reserves venue time for events"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={savingKey === "create" || !newLabel.trim()}
                  onClick={() => void onCreateCustom()}
                >
                  {savingKey === "create" ? "Saving…" : "Save type"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={savingKey === "create"}
                  onClick={() => {
                    setAdding(false);
                    setNewLabel("");
                    setNewKind("appointment");
                    setNewReserves(true);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {archivedCustoms.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Archived types
          </p>
          <p className="text-xs text-muted-foreground">
            Archived types aren’t offered for new Calendar items. Existing items that use them stay valid.
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {archivedCustoms.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <p className="text-sm text-muted-foreground">{row.label}</p>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingKey === row.id || atCustomCap}
                    onClick={() => void onRestore(row)}
                  >
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && atCustomCap && (
            <p className="text-xs text-muted-foreground">
              Restore is unavailable until you archive an active custom type ({APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS} active limit).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
