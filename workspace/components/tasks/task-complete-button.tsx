"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { completeTaskAction } from "@/app/(app)/tasks/actions";
import { StatusPill } from "@/components/shared/ui";
import type { TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/utils";

export function TaskCompleteButton({
  taskId,
  title,
  initialStatus,
}: {
  taskId: string;
  title: string;
  initialStatus: TaskStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === "completed" || status === "cancelled") {
    return (
      <div>
        <StatusPill tone="muted">{TASK_STATUS_LABELS[status]}</StatusPill>
        {note ? <p className="mt-1 text-xs ws-muted">{note}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await completeTaskAction(taskId);
          if (result.ok) {
            setStatus("completed");
            setNote(`Completed “${title}” — timeline updated.`);
            router.refresh();
          } else {
            setNote(result.error);
          }
        });
      }}
      className="rounded-sm bg-[var(--forest-sage)] px-2.5 py-1 text-xs text-[var(--true-white)] hover:bg-[var(--heritage-sage)] disabled:opacity-60"
    >
      {pending ? "Saving…" : "Complete"}
    </button>
  );
}
