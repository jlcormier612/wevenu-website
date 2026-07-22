"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type RelOption = { id: string; label: string; email: string };
type TeamOption = { id: string; name: string };

export function LogWalkthroughForm({
  relationships,
  teamMembers,
  defaultRelationshipId,
  compact,
}: {
  relationships: RelOption[];
  teamMembers: TeamOption[];
  defaultRelationshipId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(
    defaultRelationshipId ? "existing" : "existing",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(null);
    const form = new FormData(e.currentTarget);
    const rawAt = String(form.get("scheduledAt") ?? "");
    const payload: Record<string, string> = {
      scheduledAt: rawAt ? new Date(rawAt).toISOString() : "",
      notes: String(form.get("notes") ?? ""),
      assignedTeamMemberId: String(form.get("assignedTeamMemberId") ?? ""),
    };

    if (mode === "existing") {
      payload.relationshipId = String(
        form.get("relationshipId") || defaultRelationshipId || "",
      );
    } else {
      payload.email = String(form.get("email") ?? "");
      payload.venueName = String(form.get("venueName") ?? "");
      payload.ownerName = String(form.get("ownerName") ?? "");
    }

    try {
      const res = await fetch("/api/walkthroughs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        relationshipId?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not log walkthrough");
        return;
      }
      setDone("Walkthrough scheduled — timeline updated.");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] bg-[var(--true-white)] px-3 py-1.5 text-sm text-[var(--forest-sage)] hover:bg-[var(--header-linen)]"
            : "rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)] hover:bg-[var(--heritage-sage)]"
        }
      >
        Log Walkthrough
      </button>
    );
  }

  return (
    <div className="ws-panel w-full max-w-lg border-[var(--soft-sage)]/50 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg">Log Walkthrough</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs ws-muted hover:text-[var(--forest-sage)]"
        >
          Cancel
        </button>
      </div>

      {!defaultRelationshipId ? (
        <div className="mb-4 flex gap-2">
          <ModeButton active={mode === "existing"} onClick={() => setMode("existing")}>
            Existing relationship
          </ModeButton>
          <ModeButton active={mode === "new"} onClick={() => setMode("new")}>
            Email / venue
          </ModeButton>
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        {mode === "existing" && !defaultRelationshipId ? (
          <div>
            <label className="ws-eyebrow" htmlFor="relationshipId">
              Relationship
            </label>
            <select
              id="relationshipId"
              name="relationshipId"
              required
              className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select…
              </option>
              {relationships.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {defaultRelationshipId ? (
          <input type="hidden" name="relationshipId" value={defaultRelationshipId} />
        ) : null}

        {mode === "new" ? (
          <>
            <Field label="Venue name" name="venueName" required />
            <Field label="Owner name" name="ownerName" />
            <Field label="Email" name="email" type="email" required />
          </>
        ) : null}

        <div>
          <label className="ws-eyebrow" htmlFor="scheduledAt">
            Date &amp; time
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="ws-eyebrow" htmlFor="assignedTeamMemberId">
            Assigned team member (optional)
          </label>
          <select
            id="assignedTeamMemberId"
            name="assignedTeamMemberId"
            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="">—</option>
            {teamMembers.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="ws-eyebrow" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="text-sm text-[var(--dusty-rose)]">{error}</p> : null}
        {done ? <p className="text-sm text-[var(--heritage-sage)]">{done}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-[var(--forest-sage)] px-4 py-2 text-sm text-[var(--true-white)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Schedule Walkthrough"}
        </button>
      </form>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-sm bg-[var(--soft-sage)]/50 px-3 py-1.5 text-xs"
          : "rounded-sm px-3 py-1.5 text-xs ws-muted hover:text-[var(--forest-sage)]"
      }
    >
      {children}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="ws-eyebrow" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
      />
    </div>
  );
}
