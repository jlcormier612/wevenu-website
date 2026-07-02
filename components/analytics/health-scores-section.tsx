"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { ClientHealthScore, HealthScores, HealthTier } from "@/lib/analytics/types";

// ── Visual config ─────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<HealthTier, { label: string; bg: string; text: string; border: string; dot: string }> = {
  at_risk:         { label: "At Risk",         bg: "#DC6A6A12", text: "#DC6A6A",  border: "#DC6A6A30", dot: "#DC6A6A" },
  needs_attention: { label: "Needs Attention", bg: "#D9770615", text: "#D97706",  border: "#D9770630", dot: "#D97706" },
  healthy:         { label: "Healthy",         bg: "#5D6F5D12", text: "#3D5040",  border: "#5D6F5D30", dot: "#5D6F5D" },
  champion:        { label: "Champion",        bg: "#7C3AED12", text: "#7C3AED",  border: "#7C3AED30", dot: "#7C3AED" },
};

const SIGNAL_LABELS: Record<string, string> = {
  // At Risk
  no_portal_setup:     "No portal access",
  portal_inactive_14d: "Inactive 14+ days",
  no_guests:           "No guests added",
  payment_overdue:     "Payment overdue",
  tasks_behind:        "3+ tasks behind",
  // Healthy
  portal_active:       "Active this week",
  website_published:   "Website live",
  website_started:     "Website in progress",
  guests_adding:       "5+ guests",
  rsvp_active:         "RSVPs coming in",
  budget_set:          "Budget configured",
  docs_shared:         "Docs on file",
  // Champion
  positive_feedback:   "5-star review",
  recommends_venue:    "Recommends venue",
  referral_sent:       "Sent referral",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthBadge({ tier }: { tier: HealthTier }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function SignalChip({ sig, type }: { sig: string; type: "atRisk" | "healthy" | "champion" }) {
  const colors = {
    atRisk:    { bg: "#DC6A6A10", text: "#DC6A6A", border: "#DC6A6A25" },
    healthy:   { bg: "#5D6F5D10", text: "#4A6050", border: "#5D6F5D25" },
    champion:  { bg: "#7C3AED10", text: "#7C3AED", border: "#7C3AED25" },
  }[type];
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
      style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
      {SIGNAL_LABELS[sig] ?? sig.replace(/_/g, " ")}
    </span>
  );
}

function ClientRow({ client }: { client: ClientHealthScore }) {
  const daysLabel = client.daysUntilEvent === 0
    ? "Today"
    : client.daysUntilEvent === 1
    ? "Tomorrow"
    : `${client.daysUntilEvent}d`;

  const topSignals = [
    ...client.signals.atRisk.slice(0, 2).map(s => ({ sig: s, type: "atRisk" as const })),
    ...client.signals.champion.slice(0, 1).map(s => ({ sig: s, type: "champion" as const })),
    ...client.signals.healthy.slice(0, 2).map(s => ({ sig: s, type: "healthy" as const })),
  ].slice(0, 3);

  return (
    <Link href={`/events/${client.eventId}`}
      className="group flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">

      {/* Name + event info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-heading group-hover:text-foreground truncate">
          {client.clientName}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(client.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          {client.eventType && <span className="ml-1.5 opacity-60">· {client.eventType}</span>}
        </p>
      </div>

      {/* Days until */}
      <div className="hidden sm:block text-right">
        <p className="text-xs font-semibold tabular-nums text-muted-foreground">{daysLabel}</p>
        <p className="text-[10px] text-muted-foreground/50">until event</p>
      </div>

      {/* Health badge */}
      <HealthBadge tier={client.health} />

      {/* Signals */}
      <div className="flex flex-wrap gap-1 sm:w-56">
        {topSignals.map(({ sig, type }) => (
          <SignalChip key={sig} sig={sig} type={type} />
        ))}
        {topSignals.length === 0 && (
          <span className="text-[10px] text-muted-foreground/40">No signals</span>
        )}
      </div>

      {/* Mini metrics */}
      <div className="hidden lg:flex items-center gap-4 text-[11px] text-muted-foreground shrink-0">
        <span title="Guests">{client.metrics.guestCount} guests</span>
        <span title="RSVP rate">{client.metrics.rsvpRate}% RSVP</span>
        <span title="Days since last login">
          {client.metrics.hasPortal
            ? client.metrics.daysSinceLogin != null
              ? `${client.metrics.daysSinceLogin}d ago`
              : "never"
            : "no portal"}
        </span>
      </div>
    </Link>
  );
}

// ── Tier summary strip ────────────────────────────────────────────────────────

function TierStrip({ clients }: { clients: ClientHealthScore[] }) {
  const counts = { at_risk: 0, needs_attention: 0, healthy: 0, champion: 0 } as Record<HealthTier, number>;
  for (const c of clients) counts[c.health]++;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {(["at_risk", "needs_attention", "healthy", "champion"] as HealthTier[]).map(tier => {
        const cfg = TIER_CONFIG[tier];
        return (
          <div key={tier} className="rounded-xl border px-4 py-3 text-center"
            style={{ background: cfg.bg, borderColor: cfg.border }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color: cfg.text }}>{counts[tier]}</p>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: cfg.text }}>{cfg.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type FilterTier = HealthTier | "all";

export function HealthScoresSection({ data }: { data: HealthScores | null }) {
  const [filter, setFilter] = React.useState<FilterTier>("all");

  if (!data || data.clients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Health</CardTitle>
          <CardDescription>Health scores will appear as you add upcoming events.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6 text-center">No upcoming events in the next 24 months.</p>
        </CardContent>
      </Card>
    );
  }

  const filtered = filter === "all" ? data.clients : data.clients.filter(c => c.health === filter);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Client Health</CardTitle>
            <CardDescription className="mt-0.5">
              Health scores for upcoming events — the raw signals Sprint 88 will let Luv summarize.
            </CardDescription>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{data.clients.length} events</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-2">
        {/* Tier summary */}
        <TierStrip clients={data.clients} />

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {(["all", "at_risk", "needs_attention", "healthy", "champion"] as FilterTier[]).map(f => {
            const label = f === "all" ? `All (${data.clients.length})` : TIER_CONFIG[f].label;
            const active = filter === f;
            const cfg    = f === "all" ? null : TIER_CONFIG[f];
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors"
                style={active && cfg
                  ? { background: cfg.text, color: "white", borderColor: cfg.text }
                  : active
                  ? { background: "#1a1a1a", color: "white", borderColor: "#1a1a1a" }
                  : { background: "transparent", color: "#6A6460", borderColor: "#E0DAD4" }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Table header (desktop) */}
        <div className="hidden lg:flex items-center gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50 border-b border-border/50">
          <span className="flex-1">Client</span>
          <span className="w-10 text-right">Days</span>
          <span className="w-28">Health</span>
          <span className="w-56">Signals</span>
          <span className="w-48">Metrics</span>
        </div>

        {/* Rows */}
        <div className="rounded-xl border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No {filter === "all" ? "" : TIER_CONFIG[filter as HealthTier].label.toLowerCase() + " "}clients.
            </p>
          ) : (
            filtered.map(c => <ClientRow key={c.eventId} client={c} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}
