"use client";

/**
 * ConflictWarning — inline availability advisory shown on event/tour forms.
 *
 * Calls checkAvailabilityAction whenever the watched date or spaceId changes
 * (with a short debounce so we don't fire on every keystroke).
 * All conflicts are warnings only — venues manage their own exceptions.
 */

import * as React from "react";

import { AlertTriangle, CalendarX, Info } from "lucide-react";

import { checkAvailabilityAction } from "@/app/(app)/availability/actions";
import type { AvailabilityStatus, ConflictItem } from "@/lib/availability/types";

function ConflictRow({ conflict }: { conflict: ConflictItem }) {
  const Icon = conflict.severity === "error" ? CalendarX : AlertTriangle;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
      <p className="text-xs text-warning-foreground dark:text-warning">{conflict.message}</p>
    </div>
  );
}

export function ConflictWarning({
  date,
  spaceId,
  type,
  excludeId,
}: {
  date: string;
  spaceId?: string;
  type: "event" | "tour";
  excludeId?: string;
}) {
  const [status, setStatus] = React.useState<AvailabilityStatus | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    // Don't check without a date
    if (!date) { setStatus(null); return; }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const result = await checkAvailabilityAction({ date, spaceId: spaceId || undefined, type, excludeId });
      setStatus(result);
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [date, spaceId, type, excludeId]);

  if (!status || status.conflicts.length === 0) return null;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 text-warning" />
        <p className="text-xs font-semibold text-warning-foreground dark:text-warning uppercase tracking-wide">
          Availability notice
        </p>
      </div>
      <div className="space-y-1">
        {status.conflicts.map((c, i) => <ConflictRow key={i} conflict={c} />)}
      </div>
      <p className="text-xs text-muted-foreground">
        You can still proceed — this is advisory only.
      </p>
    </div>
  );
}
