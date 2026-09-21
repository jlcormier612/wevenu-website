"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { updateReminderCadenceAction } from "@/app/(app)/settings/reminder-cadence-actions";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import {
  BEFORE_DUE_OFFSET_OPTIONS,
  type AfterDueCadenceLabel,
  type BeforeDueOffsetDays,
  type ReminderCadence,
} from "@/lib/notifications/obligations";

const AFTER_DUE_OPTIONS: { value: AfterDueCadenceLabel; label: string }[] = [
  { value: "daily", label: "Every day until resolved" },
  { value: "every_3_days", label: "Every 3 days until resolved" },
  { value: "weekly", label: "Every week until resolved" },
  { value: "none", label: "Don't send" },
];

const OFFSET_LABELS: Record<BeforeDueOffsetDays, string> = {
  [-21]: "3 weeks before",
  [-14]: "2 weeks before",
  [-7]: "1 week before",
  0: "On the due date",
};

function AfterDueField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: AfterDueCadenceLabel;
  onChange: (v: AfterDueCadenceLabel) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 px-4 py-3.5 bg-card">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-heading">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as AfterDueCadenceLabel)}
        className="shrink-0 max-w-[14rem] rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm disabled:opacity-50"
      >
        {AFTER_DUE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BeforeDueMultiSelect({
  label,
  description,
  name,
  offsets,
  offsetLabels,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  name: string;
  offsets: number[];
  offsetLabels: Record<BeforeDueOffsetDays, string>;
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  // Local "Send" intent so timing checkboxes can appear before the first box
  // is checked. Don't-send remains mutually exclusive with any selection.
  const [sendIntent, setSendIntent] = React.useState(false);
  const sendEnabled = offsets.length > 0 || sendIntent;

  React.useEffect(() => {
    if (offsets.length > 0) setSendIntent(false);
  }, [offsets]);

  function setDontSend() {
    setSendIntent(false);
    if (offsets.length === 0) return;
    onChange([]);
  }

  function setSendReminders() {
    setSendIntent(true);
  }

  function toggleOffset(days: BeforeDueOffsetDays, checked: boolean) {
    const set = new Set(offsets);
    if (checked) set.add(days);
    else set.delete(days);
    const next = [...set].sort((a, b) => a - b);
    // Unchecking the last point is Don't send — never leave zero boxes selected
    // while Send reminders is on.
    if (next.length === 0) {
      setSendIntent(false);
      onChange([]);
      return;
    }
    setSendIntent(false);
    onChange(next);
  }

  return (
    <div className="px-4 py-3.5 bg-card space-y-3">
      <div>
        <p className="text-sm font-medium text-heading">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <fieldset disabled={disabled} className="space-y-2">
        <legend className="sr-only">{label} reminder mode</legend>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="radio"
            name={name}
            className="mt-0.5"
            checked={!sendEnabled}
            onChange={setDontSend}
          />
          <span className="text-sm text-heading">Don&apos;t send reminders</span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="radio"
            name={name}
            className="mt-0.5"
            checked={sendEnabled}
            onChange={setSendReminders}
          />
          <span className="text-sm text-heading">Send reminders</span>
        </label>

        {sendEnabled ? (
          <div className="ml-6 space-y-2 pt-1" role="group" aria-label={`${label} reminder points`}>
            {BEFORE_DUE_OFFSET_OPTIONS.map((days) => (
              <label key={days} className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={offsets.includes(days)}
                  onChange={(e) => toggleOffset(days, e.target.checked)}
                />
                <span className="text-sm text-heading">{offsetLabels[days]}</span>
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}

export function ReminderCadenceSection({
  initialCadence,
}: {
  initialCadence: ReminderCadence;
}) {
  const [cadence, setCadence] = useSyncedState(initialCadence);
  const [saving, setSaving] = React.useState<keyof ReminderCadence | null>(null);

  async function handleChange<K extends keyof ReminderCadence>(key: K, value: ReminderCadence[K]) {
    const prev = cadence[key];
    setCadence((c) => ({ ...c, [key]: value }));
    setSaving(key);
    try {
      const result = await updateReminderCadenceAction({ [key]: value } as Partial<ReminderCadence>);
      if (!result.ok) throw new Error("save failed");
      toast.success("Saved");
    } catch {
      setCadence((c) => ({ ...c, [key]: prev }));
      toast.error("Could not save. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Hello to Cheers reminds clients about upcoming and overdue obligations, and stops once they
        are resolved. These options control how often reminders fire relative to each obligation
        due date — not relative to booking.
      </p>
      <p className="text-xs text-muted-foreground rounded-sm border border-border bg-muted/30 px-3 py-2">
        Payment due dates themselves (At booking, days before the event, etc.) are set in the{" "}
        <Link href="/payments/new" className="underline underline-offset-2 text-heading">
          Payment Plan Builder
        </Link>
        . Reminder cadence never invents a booking date.
      </p>
      <div className="divide-y divide-border rounded-sm border border-border overflow-hidden">
        <BeforeDueMultiSelect
          label="Payments — before due"
          description="Reminders leading up to a payment's due date."
          name="payment-before-due-mode"
          offsets={cadence.paymentBeforeDueOffsets}
          offsetLabels={OFFSET_LABELS}
          onChange={(next) => void handleChange("paymentBeforeDueOffsets", next)}
          disabled={saving === "paymentBeforeDueOffsets"}
        />
        <AfterDueField
          label="Payments — overdue"
          description="Reminders after a payment's due date, until it's paid."
          value={cadence.paymentAfterDueCadence}
          onChange={(v) => void handleChange("paymentAfterDueCadence", v)}
          disabled={saving === "paymentAfterDueCadence"}
        />
        <BeforeDueMultiSelect
          label="Contracts — awaiting signature"
          description="Reminders to sign before the contract expires."
          name="contract-before-due-mode"
          offsets={cadence.contractBeforeDueOffsets}
          offsetLabels={OFFSET_LABELS}
          onChange={(next) => void handleChange("contractBeforeDueOffsets", next)}
          disabled={saving === "contractBeforeDueOffsets"}
        />
        <AfterDueField
          label="Tasks — overdue"
          description="Reminders about a client's own overdue task, until complete."
          value={cadence.taskAfterDueCadence}
          onChange={(v) => void handleChange("taskAfterDueCadence", v)}
          disabled={saving === "taskAfterDueCadence"}
        />
      </div>
    </div>
  );
}
