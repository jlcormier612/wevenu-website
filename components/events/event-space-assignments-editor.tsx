"use client";

/**
 * Multi-space use → physical space assignment editor.
 * Only render when venue spaceOperatingMode === "multi" and uses are configured.
 */

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/setup/field";
import { Input } from "@/components/ui/input";
import type { VenueSpace } from "@/lib/availability/types";
import {
  configuredUsesFromSpaces,
  spacesEligibleForUse,
  type EventSpaceAssignmentInput,
} from "@/lib/venue-spaces/assignments";
import { labelForUseKey } from "@/lib/venue-spaces/uses";

const NONE = "__none__";

export function EventSpaceAssignmentsEditor({
  spaces,
  value,
  onChange,
  uses: usesProp,
  withTimes = false,
}: {
  spaces: VenueSpace[];
  value: EventSpaceAssignmentInput[];
  onChange: (next: EventSpaceAssignmentInput[]) => void;
  /** Relevant uses for this event. Defaults to all configured venue uses. */
  uses?: Array<{ key: string; label: string }>;
  /** Start and end belong to this use's space, not one event-wide window. */
  withTimes?: boolean;
}) {
  const uses = usesProp ?? configuredUsesFromSpaces(spaces);

  if (uses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure permitted uses on your spaces in Availability settings to assign
        spaces for this event.
      </p>
    );
  }

  function rowFor(useKey: string): EventSpaceAssignmentInput | undefined {
    return value.find((row) => row.useKey === useKey);
  }

  function writeRow(useKey: string, useLabel: string, patch: Partial<EventSpaceAssignmentInput>) {
    const current = rowFor(useKey);
    const next = { useKey, useLabel, spaceId: current?.spaceId ?? "", startTime: current?.startTime ?? null, endTime: current?.endTime ?? null, ...patch };
    const without = value.filter((row) => row.useKey !== useKey);
    if (!next.spaceId) {
      onChange(without);
      return;
    }
    onChange([...without, next]);
  }

  return (
    <div className="space-y-3">
      {withTimes ? null : (
        <div>
          <p className="text-sm font-medium text-heading">Event spaces</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assign a physical space for each use. The same space may serve more than one use.
          </p>
        </div>
      )}
      <div className="space-y-3">
        {uses.map((u) => {
          const current = rowFor(u.key);
          const currentSpace = current?.spaceId ?? "";
          const eligible = spacesEligibleForUse(spaces, u.key);
          const items = [
            { value: NONE, label: "Not assigned" },
            ...eligible.map((s) => ({
              value: s.id,
              label: `${s.name}${s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}`,
            })),
          ];
          return (
            <div key={u.key} className={withTimes ? "grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_7.5rem_7.5rem] sm:items-end" : ""}>
              <Field label={u.label} htmlFor={`esa-${u.key}`}>
                <Select
                  value={currentSpace || NONE}
                  onValueChange={(v) => writeRow(u.key, u.label, { spaceId: v === NONE ? "" : v })}
                  items={items}
                >
                  <SelectTrigger id={`esa-${u.key}`}>
                    <SelectValue placeholder="Not assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not assigned</SelectItem>
                    {eligible.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {withTimes ? (
                <>
                  <Field label="Start time" htmlFor={`esa-${u.key}-start`}>
                    <Input
                      id={`esa-${u.key}-start`}
                      type="time"
                      value={(current?.startTime ?? "").slice(0, 5)}
                      disabled={!currentSpace}
                      onChange={(e) => writeRow(u.key, u.label, { spaceId: currentSpace, startTime: e.target.value })}
                    />
                  </Field>
                  <Field label="End time" htmlFor={`esa-${u.key}-end`}>
                    <Input
                      id={`esa-${u.key}-end`}
                      type="time"
                      value={(current?.endTime ?? "").slice(0, 5)}
                      disabled={!currentSpace}
                      onChange={(e) => writeRow(u.key, u.label, { spaceId: currentSpace, endTime: e.target.value })}
                    />
                  </Field>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only display of use → space lines for overview / contracts preview. */
export function EventSpaceAssignmentsDisplay({
  assignments,
  fallbackSpaceName,
}: {
  assignments: Array<{ useKey: string; useLabel: string; spaceName: string | null }>;
  fallbackSpaceName?: string | null;
}) {
  if (assignments.length === 0) {
    return (
      <span className="text-muted-foreground">{fallbackSpaceName ?? "No space assigned"}</span>
    );
  }
  if (assignments.length === 1 && assignments[0]!.useKey === "event_space") {
    return <span className="text-muted-foreground">{assignments[0]!.spaceName ?? "No space assigned"}</span>;
  }
  return (
    <span className="text-muted-foreground whitespace-pre-line">
      {assignments
        .map((a) => `${labelForUseKey(a.useKey, a.useLabel)}: ${a.spaceName ?? "—"}`)
        .join("\n")}
    </span>
  );
}
