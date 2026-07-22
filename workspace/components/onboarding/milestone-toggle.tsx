"use client";

import { useState } from "react";

import { StatusPill } from "@/components/shared/ui";

export function MilestoneToggle({
  title,
  initialStatus,
}: {
  title: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="rounded-sm bg-[var(--warm-gray)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs capitalize ws-muted">{status.replace("_", " ")}</p>
        </div>
        {status !== "completed" ? (
          <button
            type="button"
            onClick={() => {
              setStatus("completed");
              setNote("Milestone completed — timeline updated (stub).");
            }}
            className="shrink-0 rounded-sm bg-[var(--forest-sage)] px-2 py-1 text-xs text-white"
          >
            Complete
          </button>
        ) : (
          <StatusPill tone="good">Done</StatusPill>
        )}
      </div>
      {note ? <p className="mt-2 text-xs ws-muted">{note}</p> : null}
    </div>
  );
}
