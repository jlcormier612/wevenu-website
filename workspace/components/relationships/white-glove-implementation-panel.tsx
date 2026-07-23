"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Task } from "@/lib/types";

type Assets = {
  brandingNotes?: string;
  contractsNotes?: string;
  packagesNotes?: string;
  questionnairesNotes?: string;
  websiteProgressNotes?: string;
};

type Props = {
  relationshipId: string;
  venueName: string;
  status: string;
  tasks: Task[];
  implementationNotes: string;
  assets: Assets;
  launchReady: boolean;
  completedCount: number;
  totalCount: number;
  missing: string[];
  canLaunch: boolean;
  canOverride: boolean;
  canEdit: boolean;
  timelineLabel: string;
};

export function WhiteGloveImplementationPanel({
  relationshipId,
  venueName,
  status,
  tasks,
  implementationNotes: initialNotes,
  assets: initialAssets,
  launchReady,
  completedCount,
  totalCount,
  missing,
  canLaunch,
  canOverride,
  canEdit,
  timelineLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [assets, setAssets] = useState<Assets>(initialAssets);
  const [message, setMessage] = useState<string | null>(null);

  async function saveNotes() {
    setMessage(null);
    const res = await fetch("/api/relationships/lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_implementation_notes",
        relationshipId,
        implementationNotes: notes,
        implementationAssets: assets,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    setMessage("Implementation notes saved.");
    startTransition(() => router.refresh());
  }

  async function launch(ownerOverride = false) {
    setMessage(null);
    const res = await fetch("/api/relationships/lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "launch_workspace",
        relationshipId,
        ownerOverride,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      message?: string;
      activateUrl?: string;
    };
    if (!res.ok) {
      setMessage(data.error || "Launch failed");
      return;
    }
    setMessage(
      data.activateUrl
        ? `${data.message || "Launched."} Activate: ${data.activateUrl}`
        : data.message || "Workspace launched.",
    );
    startTransition(() => router.refresh());
  }

  const checklist = [...tasks].sort((a, b) => {
    const ao = Number(a.meta?.sort_order ?? 99);
    const bo = Number(b.meta?.sort_order ?? 99);
    return ao - bo;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ws-eyebrow">White Glove Implementation</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">{venueName}</h1>
          <p className="mt-2 text-sm ws-muted">
            Team-only implementation project · Target ~{timelineLabel} · Status{" "}
            {status.replace(/_/g, " ")}
          </p>
        </div>
        <Link
          href={`/relationships/${relationshipId}`}
          className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
        >
          ← Relationship
        </Link>
      </div>

      <section className="ws-panel p-6">
        <h2 className="font-heading text-xl">Checklist progress</h2>
        <p className="mt-1 text-sm ws-muted">
          {completedCount}/{totalCount} complete
          {missing.length > 0 ? ` · Remaining: ${missing.join(", ")}` : " · Ready to launch"}
        </p>
        <ul className="mt-4 space-y-2">
          {checklist.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--taupe-medium)_25%,transparent)] py-2 text-sm last:border-0"
            >
              <span>
                {task.status === "completed" ? "✓ " : "○ "}
                {task.title}
              </span>
              <span className="ws-muted capitalize">{task.status.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
        {canLaunch ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || (!launchReady && !canOverride)}
              onClick={() => void launch(false)}
              className="rounded-sm bg-[var(--heritage-sage)] px-4 py-2.5 text-sm font-medium text-[var(--true-white)] disabled:opacity-50"
            >
              Launch Workspace
            </button>
            {canOverride && !launchReady ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Launch with incomplete checklist (Owner override)?",
                    )
                  ) {
                    return;
                  }
                  void launch(true);
                }}
                className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-4 py-2.5 text-sm"
              >
                Launch (Owner Override)
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="ws-panel p-6">
        <h2 className="font-heading text-xl">Branding & content placeholders</h2>
        <p className="mt-1 text-sm ws-muted">
          Capture assets and notes here — not customer-facing.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(
            [
              ["brandingNotes", "Branding assets"],
              ["packagesNotes", "Packages"],
              ["contractsNotes", "Contracts"],
              ["questionnairesNotes", "Questionnaires"],
              ["websiteProgressNotes", "Website progress"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="ws-eyebrow">{label}</span>
              <textarea
                className="mt-1.5 min-h-[88px] w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] bg-[var(--true-white)] p-3 text-sm"
                value={assets[key] ?? ""}
                disabled={!canEdit || pending}
                onChange={(e) =>
                  setAssets((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={`${label} notes…`}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="ws-panel p-6">
        <h2 className="font-heading text-xl">Internal notes</h2>
        <textarea
          className="mt-3 min-h-[120px] w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] bg-[var(--true-white)] p-3 text-sm"
          value={notes}
          disabled={!canEdit || pending}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal implementation notes…"
        />
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void saveNotes()}
            className="mt-3 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-4 py-2 text-sm"
          >
            Save notes
          </button>
        ) : null}
      </section>

      {message ? (
        <p className="text-sm text-[var(--forest-sage)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
