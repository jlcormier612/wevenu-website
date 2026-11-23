"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  STANDARD_DISCOUNT_LABELS,
  type StandardDiscountEligibility,
} from "@shared/relationships/standard-discount-eligibility";

const OPTIONS: StandardDiscountEligibility[] = [
  "not_established",
  "former_weven",
  "founding",
  "additional_venue",
  "none",
];

type Props = {
  relationshipId: string;
  eligibility: StandardDiscountEligibility;
  evidence?: string;
  canEdit: boolean;
  /** When true, additional venue may be selected */
  additionalVenueQualified?: boolean;
};

export function StandardDiscountEligibilityPanel({
  relationshipId,
  eligibility,
  evidence,
  canEdit,
  additionalVenueQualified = false,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState<StandardDiscountEligibility>(eligibility);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/relationships/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_standard_discount_eligibility",
          relationshipId,
          standardDiscountEligibility: value,
          additionalVenueQualified,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not update eligibility");
        return;
      }
      setMessage(
        data.message ||
          "Eligibility saved. Founding slots are not consumed by this change.",
      );
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="ws-panel mt-6 p-5"
      data-testid="standard-discount-eligibility-panel"
    >
      <p className="ws-eyebrow">Commercial terms</p>
      <h2 className="mt-1 font-heading text-xl text-[var(--htc-forest)]">
        Standard Discount Eligibility
      </h2>
      <p className="mt-1 max-w-2xl text-sm ws-muted">
        Record ordinary eligibility without creating a custom offer. Only one
        standard discount applies. Custom offers keep their own agreed terms and
        are not rewritten by later edits here.
      </p>

      <label className="mt-4 block max-w-lg text-sm">
        <span className="mb-1.5 block font-medium">Eligibility</span>
        <select
          className="ws-input w-full"
          value={value}
          disabled={!canEdit || busy || pending}
          onChange={(e) =>
            setValue(e.target.value as StandardDiscountEligibility)
          }
        >
          {OPTIONS.map((opt) => (
            <option
              key={opt}
              value={opt}
              disabled={opt === "additional_venue" && !additionalVenueQualified}
            >
              {STANDARD_DISCOUNT_LABELS[opt]}
              {opt === "additional_venue" && !additionalVenueQualified
                ? " (qualification required)"
                : ""}
            </option>
          ))}
        </select>
      </label>

      <ul className="mt-3 max-w-2xl space-y-1 text-xs ws-muted">
        <li>Former Weven: 20% recurring · $399 White Glove when selected · honor system.</li>
        <li>
          Founding Member: 10% recurring · soft availability at checkout · saving
          here does not consume a slot.
        </li>
        <li>
          Additional venue: 10% only when a qualifying organization relationship
          exists.
        </li>
      </ul>

      {evidence ? (
        <p className="mt-2 text-xs ws-muted">Evidence on file: {evidence}</p>
      ) : null}

      {canEdit ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="ws-btn-primary"
            disabled={busy || pending || value === eligibility}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Update eligibility"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-[var(--htc-dusty)]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-[var(--htc-forest)]" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
