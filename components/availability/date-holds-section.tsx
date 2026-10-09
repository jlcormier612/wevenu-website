"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Calendar, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createHoldAction,
  releaseHoldAction,
  updateHoldAction,
} from "@/app/(app)/availability/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/availability/constants";
import { defaultHoldDateFromDesiredEventDate } from "@/lib/availability/hold-defaults";
import { venueCalendarDateFromValue } from "@/lib/venue/timezone";
import { defaultHoldSpaceIdsFromPreferences } from "@/lib/availability/hold-occupancy";
import {
  activeHolds as selectActiveHolds,
  historicalHoldLabel,
  historicalHolds as selectHistoricalHolds,
  holdWindowLabel,
  placeHoldCtaLabel,
  shouldShowPlaceHoldCta,
} from "@/lib/availability/hold-presentation";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { DateHold, DateHoldInput, DateHoldUpdateInput, VenueSpace } from "@/lib/availability/types";

function holdExpiresDateInput(expiresAt: string | null, timezone: string | null): string {
  if (!expiresAt) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return expiresAt;
  return venueCalendarDateFromValue(expiresAt, timezone);
}

export type HoldSpacePreferenceSeed = {
  useKey: string;
  preferenceKind: string;
  spaceId: string | null;
};

export function DateHoldsSection({
  leadId,
  leadName,
  desiredEventDate = null,
  initialHolds,
  spaces,
  spacePreferences = [],
  venueTimezone = null,
  density = "regular",
}: {
  leadId: string;
  leadName: string;
  /** Authoritative preferred/desired event date (YYYY-MM-DD). Hold date defaults from this. */
  desiredEventDate?: string | null;
  initialHolds: DateHold[];
  spaces: VenueSpace[];
  /** Lead ceremony/reception prefs — default selected spaces when venue_space. */
  spacePreferences?: HoldSpacePreferenceSeed[];
  /** Venue IANA zone. Expiration dates are that zone's end of day, not the browser's. */
  venueTimezone?: string | null;
  /** Compact row for the lead header. The place/edit form is unchanged. */
  density?: "regular" | "compact";
}) {
  const router = useRouter();
  // See lib/hooks/use-synced-state.ts — TasksSection may refresh siblings
  // on the same page and would otherwise leave this list stale.
  const [holds, setHolds] = useSyncedState(initialHolds);
  const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
  const [editingHoldId, setEditingHoldId] = React.useState<string | null>(null);
  const [holdDate, setHoldDate] = React.useState("");
  const [holdTitle, setHoldTitle] = React.useState(`Hold — ${leadName}`);
  const [wholeVenue, setWholeVenue] = React.useState(false);
  const [selectedSpaceIds, setSelectedSpaceIds] = React.useState<string[]>([]);
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const [releasingId, setReleasingId] = React.useState<string | null>(null);
  const showForm = formMode !== null;

  const desiredDefault = defaultHoldDateFromDesiredEventDate(desiredEventDate);
  const activeHolds = selectActiveHolds(holds);
  const pastHolds = selectHistoricalHolds(holds);
  const showPlaceHold = shouldShowPlaceHoldCta(holds);
  const placeCtaLabel = placeHoldCtaLabel(desiredDefault, activeHolds.length > 0);
  const prefDefaults = defaultHoldSpaceIdsFromPreferences(spacePreferences);
  const activeSpaces = spaces.filter((s) => s.isActive);
  const formSpaces = React.useMemo(() => {
    const heldInactive = spaces.filter((s) =>
      !s.isActive && selectedSpaceIds.includes(s.id),
    );
    return [...activeSpaces, ...heldInactive];
  }, [spaces, activeSpaces, selectedSpaceIds]);

  function closeForm() {
    setFormMode(null);
    setEditingHoldId(null);
  }

  function openForm() {
    setHoldDate(desiredDefault);
    setHoldTitle(`Hold — ${leadName}`);
    const defaults = prefDefaults.filter((id) => activeSpaces.some((s) => s.id === id));
    setWholeVenue(defaults.length === 0);
    setSelectedSpaceIds(defaults);
    setStartTime("");
    setEndTime("");
    setExpiresAt("");
    setEditingHoldId(null);
    setFormMode("create");
  }

  function openEdit(hold: DateHold) {
    setHoldDate(hold.holdDate);
    setHoldTitle(hold.title);
    setWholeVenue(hold.spaceIds.length === 0);
    setSelectedSpaceIds(hold.spaceIds);
    setStartTime(hold.startTime ?? "");
    setEndTime(hold.endTime ?? "");
    setExpiresAt(holdExpiresDateInput(hold.expiresAt, venueTimezone));
    setEditingHoldId(hold.id);
    setFormMode("edit");
  }

  function toggleSpace(spaceId: string) {
    setWholeVenue(false);
    setSelectedSpaceIds((prev) =>
      prev.includes(spaceId) ? prev.filter((id) => id !== spaceId) : [...prev, spaceId],
    );
  }

  function handleAdd() {
    if (!holdDate || !holdTitle.trim()) return;
    const spaceIds = wholeVenue ? [] : selectedSpaceIds;
    startAdd(async () => {
      const input: DateHoldInput = {
        leadId,
        spaceIds,
        spaceId: spaceIds.length === 1 ? spaceIds[0]! : "",
        title: holdTitle.trim(),
        holdDate,
        startTime,
        endTime,
        notes: "",
        expiresAt,
      };
      const result = await createHoldAction(input);
      if (result.ok) {
        toast.success("Hold placed.");
        const names = spaceIds
          .map((id) => activeSpaces.find((s) => s.id === id)?.name)
          .filter((n): n is string => !!n);
        setHolds((p) => [...p, {
          id: result.holdId,
          venueId: "",
          leadId,
          spaceId: spaceIds.length === 1 ? spaceIds[0]! : null,
          spaceIds,
          title: holdTitle.trim(),
          holdDate,
          startTime: startTime || null,
          endTime: endTime || null,
          status: "active",
          expiresAt: expiresAt || null,
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          leadName,
          spaceName: names.length === 1 ? names[0]! : names.length > 1 ? names.join(", ") : null,
          spaceNames: names,
        }]);
        closeForm();
        router.refresh();
      } else toast.error(result.message ?? "Could not place hold.");
    });
  }

  function handleSave() {
    if (!editingHoldId || !holdDate || !holdTitle.trim()) return;
    const spaceIds = wholeVenue ? [] : selectedSpaceIds;
    startAdd(async () => {
      const input: DateHoldUpdateInput = {
        leadId,
        spaceIds,
        spaceId: spaceIds.length === 1 ? spaceIds[0]! : "",
        title: holdTitle.trim(),
        holdDate,
        startTime,
        endTime,
        expiresAt,
      };
      const result = await updateHoldAction(editingHoldId, input);
      if (result.ok) {
        toast.success("Hold updated.");
        const names = spaceIds
          .map((id) => formSpaces.find((s) => s.id === id)?.name ?? spaces.find((s) => s.id === id)?.name)
          .filter((n): n is string => !!n);
        setHolds((p) => p.map((h) => h.id !== editingHoldId ? h : {
          ...h,
          spaceId: spaceIds.length === 1 ? spaceIds[0]! : null,
          spaceIds,
          title: holdTitle.trim(),
          holdDate,
          startTime: startTime || null,
          endTime: endTime || null,
          expiresAt: expiresAt || h.expiresAt,
          spaceName: names.length === 1 ? names[0]! : names.length > 1 ? names.join(", ") : null,
          spaceNames: names,
        }));
        closeForm();
        router.refresh();
      } else toast.error(result.message ?? "Could not update hold.");
    });
  }

  async function handleRelease(holdId: string) {
    setReleasingId(holdId);
    const result = await releaseHoldAction(holdId);
    setReleasingId(null);
    if (result.ok) {
      setHolds((p) => p.map((h) => h.id === holdId ? { ...h, status: "released" as const } : h));
      toast.success("Hold released.");
      router.refresh();
    } else toast.error(result.message ?? "Could not release hold.");
  }

  function holdResourcesLabel(hold: DateHold): string {
    if (hold.spaceNames?.length) return hold.spaceNames.join(", ");
    if (hold.spaceName) return hold.spaceName;
    if (hold.spaceIds?.length) {
      return hold.spaceIds
        .map((id) => spaces.find((s) => s.id === id)?.name ?? id)
        .join(", ");
    }
    return "Whole venue";
  }

  const compact = density === "compact";

  return (
    <div className={compact ? "flex min-w-0 max-w-full flex-wrap items-center gap-2" : "space-y-3"} data-testid={compact ? "date-hold-compact" : undefined}>
      {compact ? <span className="shrink-0 text-xs font-medium text-muted-foreground">Date hold</span> : null}
      {/* Active holds — authoritative date_holds.status === "active". Multiple per lead/date are valid. */}
      {activeHolds.length > 0 && (
        <div className={compact ? "flex min-w-0 flex-wrap items-center gap-2" : "space-y-2"} data-testid="date-hold-active-list">
          {compact ? null : (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active holds
            </p>
          )}
          {activeHolds.map((hold) => (
            <div
              key={hold.id}
              className={compact
                ? "flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-2 py-1"
                : "flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5"}
              data-testid="date-hold-active"
            >
              <Calendar className={compact ? "h-3.5 w-3.5 shrink-0 text-warning-foreground" : "mt-0.5 h-4 w-4 shrink-0 text-warning-foreground"} />
              {compact ? (
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-warning-foreground">
                    Held
                  </p>
                  <p className="text-sm font-medium text-foreground">{formatDate(hold.holdDate)}</p>
                  <span className="text-xs text-muted-foreground">
                    {holdResourcesLabel(hold)}
                    {" · "}
                    {holdWindowLabel(hold) ?? "All day"}
                    {hold.expiresAt
                      ? ` · Expires ${new Date(hold.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : ""}
                  </span>
                </div>
              ) : (
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-warning-foreground">
                  Held
                </p>
                <p className="text-sm font-medium text-foreground">{formatDate(hold.holdDate)}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{holdResourcesLabel(hold)}</span>
                  {holdWindowLabel(hold) ? <span>{holdWindowLabel(hold)}</span> : <span>All day</span>}
                  {hold.expiresAt ? (
                    <span>
                      Expires{" "}
                      {new Date(hold.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
              )}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={addPending || releasingId === hold.id}
                  onClick={() => openEdit(hold)}
                  data-testid="date-hold-edit"
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={releasingId === hold.id}
                  onClick={() => handleRelease(hold.id)}
                  data-testid="date-hold-release"
                >
                  {releasingId === hold.id ? (
                    <>
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      Releasing…
                    </>
                  ) : (
                    "Release hold"
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historical holds — released / expired / converted; not active */}
      {pastHolds.length > 0 && (
        <div className={compact ? "basis-full space-y-1" : "space-y-1"} data-testid="date-hold-history">
          {pastHolds.map((hold) => (
            <div
              key={hold.id}
              className="px-1 py-0.5 text-xs text-muted-foreground"
            >
              {historicalHoldLabel(hold)}
            </div>
          ))}
        </div>
      )}

      {/* Place hold / Place another hold — never gated by an existing active hold. */}
      {showForm ? (
        <div className={compact ? "basis-full w-full space-y-3 rounded-lg border border-border bg-muted/30 p-4" : "space-y-3 rounded-lg border border-border bg-muted/30 p-4"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Hold title</Label>
              <Input value={holdTitle} onChange={(e) => setHoldTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hold date *</Label>
              <Input
                type="date"
                value={holdDate}
                onChange={(e) => setHoldDate(e.target.value)}
                data-testid="date-hold-hold-date"
              />
              {formMode !== "edit" && desiredDefault ? (
                <p className="text-[11px] text-muted-foreground">
                  Defaults to their preferred event date ({formatDate(desiredDefault)}). Change only if you intend to hold a different day.
                </p>
              ) : formMode !== "edit" ? (
                <p className="text-[11px] text-muted-foreground">
                  No preferred event date on this lead — enter the date to hold.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start time <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="date-hold-start-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End time <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="date-hold-end-time"
              />
              <p className="text-[11px] text-muted-foreground">
                Venue occupancy window for this hold. Leave blank for all day.
              </p>
            </div>
            {formSpaces.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2" data-testid="date-hold-spaces">
                <Label className="text-xs">Spaces to hold</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={wholeVenue}
                    onChange={(e) => {
                      setWholeVenue(e.target.checked);
                      if (e.target.checked) setSelectedSpaceIds([]);
                    }}
                    data-testid="date-hold-whole-venue"
                  />
                  <span>Whole venue</span>
                </label>
                <div className="mt-1 space-y-1">
                  {formSpaces.map((s) => {
                    const pref = spacePreferences.find(
                      (p) => p.preferenceKind === "venue_space" && p.spaceId === s.id,
                    );
                    const useLabel = pref?.useKey === "ceremony"
                      ? "Ceremony"
                      : pref?.useKey === "reception"
                        ? "Reception"
                        : null;
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!wholeVenue && selectedSpaceIds.includes(s.id)}
                          disabled={wholeVenue}
                          onChange={() => toggleSpace(s.id)}
                          data-testid={`date-hold-space-${s.id}`}
                        />
                        <span>
                          {s.name}
                          {useLabel ? (
                            <span className="text-muted-foreground"> — {useLabel}</span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {!wholeVenue && selectedSpaceIds.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Select one or more spaces, or choose Whole venue.
                  </p>
                ) : null}
                {formMode === "edit" && formSpaces.some((s) => !s.isActive) ? (
                  <p className="text-[11px] text-muted-foreground">
                    A space on this hold is no longer active. It stays available here so saving without changing spaces does not drop it.
                  </p>
                ) : null}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Auto-release date <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                When this temporary hold should stop protecting the hold date — not the event date itself.
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-heading">
              {formMode === "edit"
                ? "You're editing this Hold."
                : activeHolds.length > 0
                  ? "You're placing another Hold."
                  : "You're placing a Hold on this date."}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formMode === "edit"
                ? "Saving updates this hold. It does not create a new one."
                : activeHolds.length > 0
                  ? "This creates a new hold. Existing holds stay as they are."
                  : "Whether this Hold prevents booking is controlled by your availability settings."}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={closeForm} disabled={addPending}>Cancel</Button>
            <Button
              type="button"
              size="sm"
              disabled={
                !holdDate
                || !holdTitle.trim()
                || addPending
                || (formSpaces.length > 0 && !wholeVenue && selectedSpaceIds.length === 0)
              }
              onClick={formMode === "edit" ? handleSave : handleAdd}
              data-testid={formMode === "edit" ? "date-hold-save" : "date-hold-place-submit"}
            >
              {addPending
                ? (formMode === "edit" ? "Saving…" : "Placing…")
                : (formMode === "edit" ? "Save hold" : "Place Hold")}
            </Button>
          </div>
        </div>
      ) : showPlaceHold ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={compact ? "h-8" : undefined}
          onClick={openForm}
          data-testid="date-hold-place"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {placeCtaLabel}
        </Button>
      ) : null}
    </div>
  );
}
