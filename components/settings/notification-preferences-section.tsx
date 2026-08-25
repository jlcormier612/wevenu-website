"use client";

import * as React from "react";
import { toast } from "sonner";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { NotificationPreferences } from "@/lib/notifications/preferences";

type PrefKey = keyof Pick<NotificationPreferences,
  | "prefNewLead"
  | "prefMessageReceived"
  | "prefClientSubmittedInfo"
  | "prefPaymentFailed"
  | "prefPaymentOverdue"
  | "prefPaymentReceived"
  | "prefContractRequiresAttention"
  | "prefContractSigned"
  | "prefFinalGuestCountSubmitted"
  | "prefVendorCheckedIn"
  | "prefFeedbackReceived"
  | "prefReferralReceived"
>;

type PrefRow = { key: PrefKey; emoji: string; label: string; desc: string };

// Visual grouping only — each row below is still independently
// configurable; there is no bucket-level master toggle. RSVP received and
// Task completed are deliberately absent: individual guest RSVPs and
// routine task completions are routine, high-volume activity that belongs
// in-app (the event's guest list, Tasks/Activity) rather than as an inbox
// escalation — see the "Final guest count submitted" row below for the
// meaningful guest-related milestone instead.
const BUCKETS: { title: string; rows: PrefRow[] }[] = [
  {
    title: "Leads & clients",
    rows: [
      {
        key:   "prefNewLead",
        emoji: "✨",
        label: "New inquiry",
        desc:  "A client submits an inquiry form or is added manually.",
      },
      {
        key:   "prefMessageReceived",
        emoji: "💬",
        label: "New message",
        desc:  "An inbound message arrives from a client or lead.",
      },
      {
        key:   "prefClientSubmittedInfo",
        emoji: "📋",
        label: "Client submitted important information",
        desc:  "A client submits their final details or planning questionnaire.",
      },
    ],
  },
  {
    title: "Financials",
    rows: [
      {
        key:   "prefPaymentFailed",
        emoji: "⚠️",
        label: "Payment failed",
        desc:  "A client's payment doesn't go through.",
      },
      {
        key:   "prefPaymentOverdue",
        emoji: "⏰",
        label: "Payment overdue",
        desc:  "A scheduled payment passes its due date without being paid.",
      },
      {
        key:   "prefPaymentReceived",
        emoji: "💳",
        label: "Payment received",
        desc:  "A client's payment is successfully processed.",
      },
    ],
  },
  {
    title: "Bookings & planning",
    rows: [
      {
        key:   "prefContractRequiresAttention",
        emoji: "✍️",
        label: "Contract requires attention",
        desc:  "A contract is nearing its expiration or still needs a signature.",
      },
      {
        key:   "prefContractSigned",
        emoji: "✅",
        label: "Contract signed",
        desc:  "A client signs their contract.",
      },
      {
        key:   "prefFinalGuestCountSubmitted",
        emoji: "🔢",
        label: "Final guest count submitted",
        desc:  "A client submits their final guest count.",
      },
    ],
  },
  {
    title: "Vendors",
    rows: [
      {
        key:   "prefVendorCheckedIn",
        emoji: "🤝",
        label: "Vendor check-in",
        desc:  "A vendor marks themselves as arrived on the day of an event.",
      },
    ],
  },
  {
    title: "After the event",
    rows: [
      {
        key:   "prefFeedbackReceived",
        emoji: "💗",
        label: "Feedback received",
        desc:  "A client submits their post-wedding feedback.",
      },
      {
        key:   "prefReferralReceived",
        emoji: "💍",
        label: "Referral received",
        desc:  "A client refers someone from their network.",
      },
    ],
  },
];

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
        checked ? "translate-x-4" : "translate-x-0"
      }`} />
    </button>
  );
}

export function NotificationPreferencesSection({
  initialPrefs,
}: {
  initialPrefs: NotificationPreferences;
}) {
  // See lib/hooks/use-synced-state.ts — sibling sections on this same flat
  // Settings page call router.refresh() on save; every toggle here
  // auto-saves immediately (no draft to protect), so syncing is safe.
  const [prefs, setPrefs] = useSyncedState(initialPrefs);
  const [saving, setSaving] = React.useState<PrefKey | null>(null);

  async function handleToggle(key: PrefKey, value: boolean) {
    // Optimistic update
    setPrefs(prev => ({ ...prev, [key]: value }));
    setSaving(key);

    try {
      const res = await fetch("/api/notifications/preferences", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      // Revert on failure
      setPrefs(prev => ({ ...prev, [key]: !value }));
      toast.error("Could not save preference. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {BUCKETS.map(bucket => (
        <div key={bucket.title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {bucket.title}
          </p>
          <div className="divide-y divide-border rounded-sm border border-border overflow-hidden">
            {bucket.rows.map(row => (
              <div key={row.key} className="flex items-center gap-4 px-4 py-3.5 bg-card">
                <span className="text-xl shrink-0 w-7 text-center">{row.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading">{row.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{row.desc}</p>
                </div>
                <Toggle
                  checked={prefs[row.key]}
                  onChange={v => void handleToggle(row.key, v)}
                  disabled={saving === row.key}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
