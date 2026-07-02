"use client";

import * as React from "react";
import { Bell, Mail, Smartphone, Zap } from "lucide-react";
import { toast } from "sonner";
import type { NotificationPreferences } from "@/lib/notifications/preferences";

type PrefKey = keyof Pick<NotificationPreferences,
  | "prefNewLead"
  | "prefRsvpReceived"
  | "prefTaskCompleted"
  | "prefVendorCheckedIn"
  | "prefFeedbackReceived"
  | "prefReferralReceived"
  | "prefMessageReceived"
>;

const PREF_ROWS: { key: PrefKey; emoji: string; label: string; desc: string }[] = [
  {
    key:   "prefNewLead",
    emoji: "✨",
    label: "New inquiry",
    desc:  "A couple submits an inquiry form or is added manually.",
  },
  {
    key:   "prefRsvpReceived",
    emoji: "📬",
    label: "RSVP received",
    desc:  "A guest responds to an invitation.",
  },
  {
    key:   "prefTaskCompleted",
    emoji: "✅",
    label: "Task completed",
    desc:  "A couple or vendor marks a task as done.",
  },
  {
    key:   "prefVendorCheckedIn",
    emoji: "🤝",
    label: "Vendor check-in",
    desc:  "A vendor marks themselves as arrived on the day of an event.",
  },
  {
    key:   "prefFeedbackReceived",
    emoji: "💗",
    label: "Feedback received",
    desc:  "A couple submits their post-wedding feedback.",
  },
  {
    key:   "prefReferralReceived",
    emoji: "💍",
    label: "Referral received",
    desc:  "A couple refers someone from their network.",
  },
  {
    key:   "prefMessageReceived",
    emoji: "💬",
    label: "Message received",
    desc:  "An inbound message arrives from a couple or lead.",
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
  const [prefs, setPrefs] = React.useState(initialPrefs);
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
      {/* In-app notification type toggles */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-heading">In-app notifications</p>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Active</span>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {PREF_ROWS.map(row => (
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

      {/* Future channels — visible but inactive */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Additional channels
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { icon: Mail,       label: "Email",       desc: "Coming soon" },
            { icon: Smartphone, label: "SMS",         desc: "Coming soon" },
            { icon: Zap,        label: "Push",        desc: "Coming soon" },
          ].map(ch => (
            <div
              key={ch.label}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 opacity-50"
            >
              <ch.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-heading">{ch.label}</p>
                <p className="text-xs text-muted-foreground">{ch.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Email, SMS, and push channels will respect these same per-type preferences when activated.
        </p>
      </div>
    </div>
  );
}
