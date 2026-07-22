"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export function AddRelationshipForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      venueName: String(form.get("venueName") ?? ""),
      ownerName: String(form.get("ownerName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };

    try {
      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        relationshipId?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not add relationship");
        return;
      }
      setOpen(false);
      startTransition(() => {
        if (data.relationshipId) {
          router.push(`/relationships/${data.relationshipId}`);
        } else {
          router.refresh();
        }
      });
    } catch {
      setError("Network error");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)] hover:bg-[var(--heritage-sage)]"
      >
        Add Relationship
      </button>
    );
  }

  return (
    <div className="ws-panel w-full max-w-md border-[var(--soft-sage)]/50 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg">Add Relationship</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs ws-muted hover:text-[var(--forest-sage)]"
        >
          Cancel
        </button>
      </div>
      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Venue name" name="venueName" required />
        <Field label="Owner name" name="ownerName" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone" name="phone" type="tel" />
        <div>
          <label className="ws-eyebrow" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="mt-1 w-full rounded-sm border border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] bg-[var(--true-white)] px-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs ws-muted">Status defaults to Inquiry. Same email merges into one record.</p>
        {error ? <p className="text-sm text-[var(--dusty-rose)]">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-[var(--forest-sage)] px-4 py-2 text-sm text-[var(--true-white)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Relationship"}
        </button>
      </form>
    </div>
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
        {required ? "" : " (optional)"}
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
