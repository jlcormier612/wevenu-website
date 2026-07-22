"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { StatusPill } from "@/components/shared/ui";
import type { Sequence, SequenceEnrollment } from "@/lib/program3/types";

export function EnrollSequenceButton({
  relationshipId,
  sequences,
  pipelineBucket,
}: {
  relationshipId: string;
  sequences: Sequence[];
  /** prospects | customers — filters eligible sequences */
  pipelineBucket: "prospects" | "customers";
}) {
  const router = useRouter();
  const eligible = useMemo(
    () =>
      sequences.filter(
        (s) =>
          s.active !== false &&
          (s.targeting === "any" || s.targeting === pipelineBucket),
      ),
    [sequences, pipelineBucket],
  );
  const [sequenceId, setSequenceId] = useState(eligible[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function enroll() {
    setMessage(null);
    const res = await fetch("/api/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enroll",
        sequenceId,
        relationshipId,
      }),
    });
    const data = (await res.json()) as { error?: string; enrollment?: SequenceEnrollment };
    if (!res.ok) {
      setMessage(data.error || "Could not enroll");
      return;
    }
    setMessage(`Enrolled in “${data.enrollment?.sequenceName}”`);
    startTransition(() => router.refresh());
  }

  if (eligible.length === 0) return null;

  return (
    <div className="ws-panel p-5">
      <p className="ws-eyebrow">Sequences</p>
      <h2 className="mt-1 font-heading text-xl">Enroll in sequence</h2>
      <p className="mt-1 text-sm ws-muted">
        Ordered template sends — relative delays or absolute calendar times.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="ws-muted">Sequence</span>
          <select
            className="mt-1 block min-w-[14rem] rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2"
            value={sequenceId}
            onChange={(e) => setSequenceId(e.target.value)}
          >
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.targeting !== "any" ? ` (${s.targeting})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !sequenceId}
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

export function SequenceEnrollmentControls({
  enrollment,
}: {
  enrollment: SequenceEnrollment;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  async function act(action: "pause" | "resume" | "exit") {
    setNote(null);
    const res = await fetch("/api/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, enrollmentId: enrollment.id }),
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
          enrollment.status === "active"
            ? "good"
            : enrollment.status === "paused"
              ? "warn"
              : "muted"
        }
      >
        {enrollment.status}
      </StatusPill>
      {enrollment.status === "active" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void act("pause")}
          className="rounded-sm px-2 py-1 text-xs ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_60%,transparent)] hover:bg-[var(--header-linen)]"
        >
          Pause
        </button>
      ) : null}
      {enrollment.status === "paused" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void act("resume")}
          className="rounded-sm px-2 py-1 text-xs ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_60%,transparent)] hover:bg-[var(--header-linen)]"
        >
          Resume
        </button>
      ) : null}
      {enrollment.status === "active" || enrollment.status === "paused" ? (
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
