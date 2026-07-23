"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function WhiteGloveTimelineSettingsForm({
  minBusinessDays,
  maxBusinessDays,
  canEdit,
}: {
  minBusinessDays: number;
  maxBusinessDays: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [min, setMin] = useState(minBusinessDays);
  const [max, setMax] = useState(maxBusinessDays);
  const [message, setMessage] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMessage(null);
    const res = await fetch("/api/settings/lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whiteGlove: { minBusinessDays: min, maxBusinessDays: max },
      }),
    });
    const data = (await res.json()) as { error?: string; ok?: boolean };
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    setMessage("White Glove timeline saved.");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={(e) => void onSave(e)} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="ws-eyebrow block mb-1">Min business days</span>
        <input
          type="number"
          min={1}
          max={30}
          className="w-24 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-3 py-2"
          value={min}
          disabled={!canEdit || pending}
          onChange={(e) => setMin(Number(e.target.value))}
        />
      </label>
      <label className="text-sm">
        <span className="ws-eyebrow block mb-1">Max business days</span>
        <input
          type="number"
          min={1}
          max={60}
          className="w-24 rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-3 py-2"
          value={max}
          disabled={!canEdit || pending}
          onChange={(e) => setMax(Number(e.target.value))}
        />
      </label>
      {canEdit ? (
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_55%,transparent)] px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Save
        </button>
      ) : null}
      {message ? <p className="w-full text-sm text-[var(--forest-sage)]">{message}</p> : null}
    </form>
  );
}
