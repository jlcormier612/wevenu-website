"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { updateReminderCadenceAction } from "@/app/(app)/settings/reminder-cadence-actions";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type {
  AfterDueCadenceLabel,
  BeforeDueCadenceLabel,
  ReminderCadence,
} from "@/lib/notifications/obligations";

const AFTER_DUE_OPTIONS: { value: AfterDueCadenceLabel; label: string }[] = [
  { value: "daily", label: "Every day until resolved" },
  { value: "every_3_days", label: "Every 3 days until resolved" },
  { value: "weekly", label: "Every week until resolved" },
  { value: "none", label: "Don't send" },
];

const BEFORE_DUE_OPTIONS: { value: BeforeDueCadenceLabel; label: string }[] = [
  { value: "weekly", label: "3 weeks, 2 weeks, and 1 week before" },
  { value: "once_two_weeks", label: "Once — 2 weeks before" },
  { value: "once_week", label: "Once — 1 week before" },
  { value: "on_due", label: "On the due date" },
  { value: "none", label: "Don't send" },
];

function Field({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
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
        onChange={(e) => onChange(e.target.value)}
        className="shrink-0 max-w-[14rem] rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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
        Payment due dates themselves (At booking, days before the event, etc.) are set on{" "}
        <Link href="/library/payment-schedules" className="underline underline-offset-2 text-heading">
          Payment schedules
        </Link>
        . Reminder cadence never invents a booking date.
      </p>
      <div className="divide-y divide-border rounded-sm border border-border overflow-hidden">
        <Field
          label="Payments — before due"
          description="Reminders leading up to a payment's due date."
          value={cadence.paymentBeforeDueCadence}
          options={BEFORE_DUE_OPTIONS}
          onChange={(v) =>
            void handleChange("paymentBeforeDueCadence", v as BeforeDueCadenceLabel)
          }
          disabled={saving === "paymentBeforeDueCadence"}
        />
        <Field
          label="Payments — overdue"
          description="Reminders after a payment's due date, until it's paid."
          value={cadence.paymentAfterDueCadence}
          options={AFTER_DUE_OPTIONS}
          onChange={(v) =>
            void handleChange("paymentAfterDueCadence", v as AfterDueCadenceLabel)
          }
          disabled={saving === "paymentAfterDueCadence"}
        />
        <Field
          label="Contracts — awaiting signature"
          description="Reminders to sign before the contract expires."
          value={cadence.contractBeforeDueCadence}
          options={BEFORE_DUE_OPTIONS}
          onChange={(v) =>
            void handleChange("contractBeforeDueCadence", v as BeforeDueCadenceLabel)
          }
          disabled={saving === "contractBeforeDueCadence"}
        />
        <Field
          label="Tasks — overdue"
          description="Reminders about a client's own overdue task, until complete."
          value={cadence.taskAfterDueCadence}
          options={AFTER_DUE_OPTIONS}
          onChange={(v) => void handleChange("taskAfterDueCadence", v as AfterDueCadenceLabel)}
          disabled={saving === "taskAfterDueCadence"}
        />
      </div>
    </div>
  );
}
