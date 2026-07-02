import type { VenueAnalytics, HealthScores, ClientHealthScore } from "@/lib/analytics/types";
import type { LuvRollUpObservations } from "./roll-up-types";

// ── Signal labels (human-readable for the prompt) ────────────────────────────

const SIGNAL_LABELS: Record<string, string> = {
  no_portal_setup:     "no portal access",
  portal_inactive_14d: "inactive 14+ days",
  no_guests:           "no guests added yet",
  payment_overdue:     "overdue payment",
  tasks_behind:        "3 or more tasks behind",
  portal_active:       "active this week",
  website_published:   "website live",
  website_started:     "website in progress",
  guests_adding:       "5+ guests added",
  rsvp_active:         "RSVPs coming in",
  budget_set:          "budget configured",
  docs_shared:         "docs on file",
  positive_feedback:   "5-star review",
  recommends_venue:    "recommends the venue",
  referral_sent:       "sent a referral",
};

function humanSignals(keys: string[]): string {
  return keys.map(k => SIGNAL_LABELS[k] ?? k.replace(/_/g, " ")).join(", ");
}

function dollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number): string { return `${n}%`; }

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildClientSection(label: string, clients: ClientHealthScore[]): string {
  if (!clients.length) return "";
  const lines = clients.slice(0, 4).map(c => {
    const signals = [
      ...c.signals.atRisk,
      ...c.signals.healthy,
      ...c.signals.champion,
    ];
    const sigText = humanSignals(signals.slice(0, 3));
    return `  • ${c.clientName} — ${c.daysUntilEvent} days out, score ${c.score}/100${sigText ? `. Signals: ${sigText}` : ""}`;
  });
  return `${label}:\n${lines.join("\n")}`;
}

export function buildPromptData(
  analytics: VenueAnalytics,
  health:    HealthScores,
  period:    string,
): string {
  const { leadFunnel, events, payments, featureAdoption: fa, coupleEngagement: ce } = analytics;
  const clients = health.clients;

  const atRisk        = clients.filter(c => c.health === "at_risk");
  const needsAtt      = clients.filter(c => c.health === "needs_attention");
  const healthy       = clients.filter(c => c.health === "healthy");
  const champions     = clients.filter(c => c.health === "champion");

  const n = fa.totalActiveEvents || 1;

  const topSources = leadFunnel.bySource
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
    .map(s => `${s.source} (${s.total}, ${s.rate}% close rate)`)
    .join(", ");

  const sections: (string | null)[] = [
    `Period: ${period}`,

    [
      "LEAD FUNNEL",
      `• Total leads: ${leadFunnel.total} | Conversion rate: ${pct(leadFunnel.conversionRate)}`,
      `• Funnel: ${leadFunnel.contacted} contacted → ${leadFunnel.toured} toured → ${leadFunnel.proposal} proposal → ${leadFunnel.booked} booked | ${leadFunnel.lost} lost`,
      topSources ? `• Top sources: ${topSources}` : null,
    ].filter(Boolean).join("\n"),

    [
      "UPCOMING EVENTS",
      `• ${events.upcoming} events scheduled | Average guest count: ${events.avgGuestCount}`,
      `• Events this month: ${events.thisMonth} | Next month: ${events.nextMonth}`,
    ].join("\n"),

    [
      "PAYMENTS",
      `• Outstanding: ${dollars(payments.totalOutstanding)} | Collection rate: ${pct(payments.completionRate)}`,
      payments.overdueCount > 0
        ? `• OVERDUE: ${dollars(payments.totalOverdue)} across ${payments.overdueCount} event${payments.overdueCount !== 1 ? "s" : ""} — needs follow-up`
        : "• No overdue payments 🎉",
    ].join("\n"),

    [
      `FEATURE ADOPTION (${n} active event${n !== 1 ? "s" : ""})`,
      `• Wedding Website: ${fa.websitePublished} published (${Math.round(fa.websitePublished / n * 100)}%), ${fa.websiteStarted} started (${Math.round(fa.websiteStarted / n * 100)}%)`,
      `• Guest list: ${fa.guestsAdded} events (${Math.round(fa.guestsAdded / n * 100)}%)`,
      `• Budget: ${fa.budgetConfigured} configured (${Math.round(fa.budgetConfigured / n * 100)}%)`,
      `• Seating: ${fa.seatingStarted} started (${Math.round(fa.seatingStarted / n * 100)}%)`,
      `• Vendors linked: ${fa.vendorsLinked} events (${Math.round(fa.vendorsLinked / n * 100)}%)`,
      `• Task Playbooks: ${fa.playbooksActive} active (${Math.round(fa.playbooksActive / n * 100)}%)`,
    ].join("\n"),

    [
      "COUPLE ENGAGEMENT",
      `• Portal adoption: ${pct(ce.portalAdoption)} | Active this week: ${ce.activeThisWeek} of ${ce.totalActiveClients}`,
      `• Average RSVP completion: ${pct(ce.rsvpCompletionAvg)}`,
    ].join("\n"),

    atRisk.length > 0
      ? buildClientSection("AT RISK — immediate attention needed", atRisk)
      : "AT RISK: None 🎉",

    needsAtt.length > 0
      ? buildClientSection("NEEDS ATTENTION", needsAtt)
      : null,

    healthy.length > 0
      ? `HEALTHY: ${healthy.map(c => c.clientName).join(", ")} (${healthy.length} couple${healthy.length !== 1 ? "s" : ""})`
      : null,

    champions.length > 0
      ? buildClientSection("CHAMPIONS — celebrate these! 🌟", champions)
      : null,
  ];

  return sections.filter((s): s is string => s !== null).join("\n\n");
}

// ── Claude API call ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Luv, the built-in venue assistant at Wevenu. You are warm, thoughtful, and feel like a trusted team member — not an analytics dashboard.

Your job is to write a weekly Roll-Up for the venue coordinator. The Roll-Up synthesizes what's happening with their couples, identifies what needs attention, spots opportunities, and celebrates wins.

Rules:
- Be specific: use couple names when the data mentions them
- Synthesize and prioritize — don't just restate numbers
- Suggest concrete next actions where appropriate
- Keep each section to 2-3 sentences
- Sound like a smart colleague, not a report generator
- If something is quiet or has no data yet, say so warmly

You must respond with a valid JSON object and nothing else. The object must have exactly these four keys:
- "whatIsWorking": 2-3 sentences about positive trends, wins, and momentum
- "needsAttention": 2-3 sentences about at-risk couples, overdue payments, or low engagement — name names
- "opportunities": 2-3 sentences about feature adoption gaps or moments to educate couples
- "customerLove": 2-3 sentences celebrating testimonials, referrals, and champion couples`;

export async function generateRollUp(
  analytics: VenueAnalytics,
  health:    HealthScores,
  apiKey:    string,
): Promise<LuvRollUpObservations | null> {
  const period = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const dataText = buildPromptData(analytics, health, period);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: `Here is this week's venue data:\n\n${dataText}` }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic API error:", await res.text());
      return null;
    }

    const data = await res.json() as { content: { type: string; text: string }[] };
    const raw  = data.content.find(c => c.type === "text")?.text?.trim() ?? "";

    // Strip potential markdown code fences
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed  = JSON.parse(jsonStr) as LuvRollUpObservations;

    if (!parsed.whatIsWorking || !parsed.needsAttention || !parsed.opportunities || !parsed.customerLove) {
      console.error("Luv roll-up: unexpected shape", parsed);
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("Luv roll-up error:", err);
    return null;
  }
}
