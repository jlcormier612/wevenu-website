"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusPill } from "@/components/shared/ui";
import type { Workflow, WorkflowRun } from "@/lib/program3/types";

export function EnrollWorkflowButton({
  relationshipId,
  workflows,
}: {
  relationshipId: string;
  workflows: Workflow[];
}) {
  const router = useRouter();
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const manual = workflows.filter((w) => w.active);

  async function enroll() {
    setMessage(null);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enroll",
        workflowId,
        relationshipId,
      }),
    });
    const data = (await res.json()) as { error?: string; run?: WorkflowRun };
    if (!res.ok) {
      setMessage(data.error || "Could not enroll");
      return;
    }
    setMessage(`Started “${data.run?.workflowName}”`);
    startTransition(() => router.refresh());
  }

  if (manual.length === 0) return null;

  return (
    <div className="ws-panel p-5">
      <p className="ws-eyebrow">Workflows</p>
      <h2 className="mt-1 font-heading text-xl">Start a workflow</h2>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="ws-muted">Workflow</span>
          <select
            className="mt-1 block min-w-[14rem] rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2"
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
          >
            {manual.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !workflowId}
          onClick={() => void enroll()}
          className="rounded-sm bg-[var(--forest-sage)] px-4 py-2 text-sm text-[var(--true-white)] hover:bg-[var(--heritage-sage)] disabled:opacity-60"
        >
          Enroll
        </button>
      </div>
      {message ? <p className="mt-3 text-sm ws-muted">{message}</p> : null}
    </div>
  );
}

export function WorkflowRunControls({ run }: { run: WorkflowRun }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  async function act(action: "pause" | "resume" | "exit") {
    setNote(null);
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, runId: run.id }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setNote(data.error || "Action failed");
      return;
    }
    setNote(`${action} ok`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill
        tone={
          run.status === "active"
            ? "good"
            : run.status === "paused"
              ? "warn"
              : "muted"
        }
      >
        {run.status}
      </StatusPill>
      {run.status === "active" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void act("pause")}
          className="rounded-sm px-2 py-1 text-xs ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_60%,transparent)] hover:bg-[var(--header-linen)]"
        >
          Pause
        </button>
      ) : null}
      {run.status === "paused" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void act("resume")}
          className="rounded-sm px-2 py-1 text-xs ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_60%,transparent)] hover:bg-[var(--header-linen)]"
        >
          Resume
        </button>
      ) : null}
      {run.status === "active" || run.status === "paused" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void act("exit")}
          className="rounded-sm px-2 py-1 text-xs text-[var(--heritage-sage)] hover:underline"
        >
          Exit
        </button>
      ) : null}
      {note ? <span className="text-xs ws-muted">{note}</span> : null}
    </div>
  );
}
