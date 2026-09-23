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
import type { VenueSpace } from "@/lib/availability/types";
import {
  configuredUsesFromSpaces,
  spacesEligibleForUse,
  type EventSpaceAssignmentInput,
} from "@/lib/venue-spaces/assignments";

const NONE = "__none__";

export function EventSpaceAssignmentsEditor({
  spaces,
  value,
  onChange,
}: {
  spaces: VenueSpace[];
  value: EventSpaceAssignmentInput[];
  onChange: (next: EventSpaceAssignmentInput[]) => void;
}) {
  const uses = configuredUsesFromSpaces(spaces);

  if (uses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure permitted uses on your spaces in Availability settings to assign Ceremony,
        Reception, and other uses for this event.
      </p>
    );
  }

  function setUseSpace(useKey: string, useLabel: string, spaceId: string) {
    const without = value.filter((a) => a.useKey !== useKey);
    if (!spaceId) {
      onChange(without);
      return;
    }
    onChange([...without, { useKey, useLabel, spaceId }]);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-heading">Event spaces</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Assign a physical space for each use. The same space may serve more than one use.
        </p>
      </div>
      <div className="space-y-3">
        {uses.map((u) => {
          const current = value.find((a) => a.useKey === u.key)?.spaceId ?? "";
          const eligible = spacesEligibleForUse(spaces, u.key);
          const items = [
            { value: NONE, label: "Not assigned" },
            ...eligible.map((s) => ({
              value: s.id,
              label: `${s.name}${s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}`,
            })),
          ];
          return (
            <Field key={u.key} label={u.label} htmlFor={`esa-${u.key}`}>
              <Select
                value={current || NONE}
                onValueChange={(v) => setUseSpace(u.key, u.label, v === NONE ? "" : v)}
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
        .map((a) => `${a.useLabel || a.useKey}: ${a.spaceName ?? "—"}`)
        .join("\n")}
    </span>
  );
}
