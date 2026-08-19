"use client";

import * as React from "react";
import { toast } from "sonner";

import { updateReminderCadenceAction } from "@/app/(app)/settings/reminder-cadence-actions";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { ReminderCadence } from "@/lib/notifications/obligations";

const AFTER_DUE_OPTIONS: { value: string; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "every_3_days", label: "Every 3 days" },
  { value: "weekly", label: "Weekly" },
  { value: "none", label: "Don't send" },
];

const BEFORE_DUE_OPTIONS: { value: string; label: string }[] = [
  { value: "weekly", label: "Weekly, starting 3 weeks before" },
  { value: "none", label: "Don't send" },
];

function Field({
  label, description, value, options, onChange, disabled,
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
        className="shrink-0 rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm disabled:opacity-50"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        Hello to Cheers automatically reminds clients about upcoming and overdue obligations, and stops the moment they{"'"}re resolved. Choose how often.
      </p>
      <div className="divide-y divide-border rounded-sm border border-border overflow-hidden">
        <Field
          label="Payments — before due"
          description="Reminders sent to the client leading up to a payment's due date."
          value={cadence.paymentBeforeDueCadence}
          options={BEFORE_DUE_OPTIONS}
          onChange={(v) => void handleChange("paymentBeforeDueCadence", v as ReminderCadence["paymentBeforeDueCadence"])}
          disabled={saving === "paymentBeforeDueCadence"}
        />
        <Field
          label="Payments — overdue"
          description="Reminders sent to the client after a payment's due date, until it's paid."
          value={cadence.paymentAfterDueCadence}
          options={AFTER_DUE_OPTIONS}
          onChange={(v) => void handleChange("paymentAfterDueCadence", v as ReminderCadence["paymentAfterDueCadence"])}
          disabled={saving === "paymentAfterDueCadence"}
        />
        <Field
          label="Contracts — awaiting signature"
          description="Reminders sent to the client to sign a contract before it expires."
          value={cadence.contractBeforeDueCadence}
          options={BEFORE_DUE_OPTIONS}
          onChange={(v) => void handleChange("contractBeforeDueCadence", v as ReminderCadence["contractBeforeDueCadence"])}
          disabled={saving === "contractBeforeDueCadence"}
        />
        <Field
          label="Tasks — overdue"
          description="Reminders sent to a client about their own overdue task, until it's complete."
          value={cadence.taskAfterDueCadence}
          options={AFTER_DUE_OPTIONS}
          onChange={(v) => void handleChange("taskAfterDueCadence", v as ReminderCadence["taskAfterDueCadence"])}
          disabled={saving === "taskAfterDueCadence"}
        />
      </div>
    </div>
  );
}
