/**
 * Portal-facing Luv observations — pure functions, zero I/O.
 *
 * Used inside couple-portal sections (guests, seating, budget, overview)
 * to surface warm, contextual guidance without AI calls.
 *
 * Design rule: Luv states facts and asks questions — she never judges.
 * "43 guests listed" is a fact. "Few signals yet" is a judgment.
 */

export type PortalObs = {
  id: string;
  text: string;
  kind: "info" | "nudge" | "flag";
};

// ── Guest observations ─────────────────────────────────────────────────────────

export function getGuestObservations(
  stats: { total: number; attending: number; declined: number; pending: number },
  daysUntil?: number | null,
): PortalObs[] {
  const obs: PortalObs[] = [];
  if (stats.total === 0) {
    obs.push({ id: "no-guests", text: "Your guest list is empty. Adding guests now makes RSVPs, meal counts, and seating much easier.", kind: "nudge" });
    return obs;
  }

  const responded = stats.attending + stats.declined;
  const responsePct = stats.total > 0 ? Math.round((responded / stats.total) * 100) : 0;

  if (daysUntil != null && daysUntil > 0 && daysUntil < 90 && stats.pending > 20) {
    obs.push({ id: "pending-urgent", text: `${stats.pending} guests haven't responded with ${daysUntil} days to go. A quick reminder usually does the trick.`, kind: "flag" });
  } else if (responsePct >= 85 && stats.total >= 20) {
    obs.push({ id: "great-response", text: `${responsePct}% response rate — almost everyone has weighed in. Nice work.`, kind: "info" });
  } else if (daysUntil != null && daysUntil > 0 && daysUntil < 180 && responsePct < 50 && stats.total >= 20) {
    obs.push({ id: "low-response", text: `${responsePct}% of guests have responded so far. Sending a reminder while people are still planning gives you the best numbers.`, kind: "nudge" });
  }

  if (stats.total >= 10 && stats.total < 50) {
    obs.push({ id: "count-growing", text: `You have ${stats.total} guests so far. Most couples end up inviting 125–175 — plenty of room to grow or keep it intimate.`, kind: "info" });
  } else if (stats.total >= 200) {
    obs.push({ id: "large-celebration", text: `${stats.total} guests is a beautiful celebration. Make sure your seating plan and meal selections are current with your venue.`, kind: "nudge" });
  }

  return obs;
}

// ── Seating observations ───────────────────────────────────────────────────────

export function getSeatingObservation(stats: {
  totalAttending: number;
  totalAssigned: number;
  tableCount: number;
  totalCapacity: number;
}): PortalObs | null {
  if (stats.totalAttending === 0) return null;

  const gap = stats.totalCapacity - stats.totalAttending;
  const unseated = stats.totalAttending - stats.totalAssigned;

  if (gap < 0) {
    return { id: "over-capacity", text: `You have ${stats.totalAttending} guests attending but only ${stats.totalCapacity} seats. You'll need ${Math.abs(gap)} more seats — let your venue coordinator know.`, kind: "flag" };
  }
  if (unseated > 15) {
    return { id: "many-unseated", text: `${unseated} guests still need a table. The auto-assign button above can seat them by household group.`, kind: "nudge" };
  }
  if (unseated > 0 && unseated <= 15) {
    return { id: "almost-seated", text: `Just ${unseated} guest${unseated === 1 ? "" : "s"} left without a table. Almost there!`, kind: "info" };
  }
  if (stats.totalAssigned > 0 && unseated === 0) {
    return { id: "fully-seated", text: `All ${stats.totalAttending} guests are seated. Your seating chart is complete.`, kind: "info" };
  }
  return null;
}

// ── Budget observations ────────────────────────────────────────────────────────

const TYPICAL_PCT: Record<string, [lo: number, hi: number, label: string]> = {
  photography: [10, 15, "Photography"],
  videography: [5, 10, "Videography"],
  florals:     [8, 12, "Florals"],
  catering:    [30, 40, "Catering"],
  music:       [5, 10, "Music & Entertainment"],
  attire:      [5, 10, "Attire"],
  hair_makeup: [2, 5,  "Hair & Makeup"],
};

function matchCategoryKey(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("photo")) return "photography";
  if (n.includes("video")) return "videography";
  if (n.includes("floral")) return "florals";
  if (n.includes("cateri") || n.includes("food") || n.includes("beverage")) return "catering";
  if (n.includes("music") || n.includes("dj") || n.includes("band") || n.includes("entertain")) return "music";
  if (n.includes("attire") || n.includes("dress") || n.includes("suit") || n.includes("tux")) return "attire";
  if (n.includes("hair") || n.includes("makeup") || n.includes("beauty")) return "hair_makeup";
  return null;
}

export function getBudgetObservations(
  categories: { name: string; budgetedAmount: number }[],
  totalBudget: number,
): PortalObs[] {
  if (totalBudget <= 0) return [];
  const obs: PortalObs[] = [];

  for (const cat of categories) {
    if (cat.budgetedAmount <= 0) continue;
    const key = matchCategoryKey(cat.name);
    const typical = key ? TYPICAL_PCT[key] : null;
    if (!typical) continue;
    const pct = Math.round((cat.budgetedAmount / totalBudget) * 100);
    const [lo, hi, label] = typical;
    if (pct > hi + 5) {
      obs.push({ id: `high-${key}`, text: `${label} is ${pct}% of your budget — a bit above the typical ${lo}–${hi}% range. That's totally fine if it's a priority for you.`, kind: "info" });
    }
  }

  return obs.slice(0, 2);
}

// ── Overview / planning-stage observation ─────────────────────────────────────

export function getOverviewObservation(
  guestStats: { total: number; attending: number } | null,
  readinessScore: number,
  daysUntil: number | null,
): PortalObs | null {
  if (daysUntil === null) return null;

  if (daysUntil > 0 && daysUntil <= 30 && readinessScore < 80) {
    return { id: "final-stretch", text: `${daysUntil} days to go! Venue tasks are ${readinessScore}% complete — your coordinator will be in touch soon to confirm the last few details.`, kind: "flag" };
  }
  if (daysUntil > 0 && daysUntil <= 90 && (guestStats?.attending ?? 0) === 0 && (guestStats?.total ?? 0) > 10) {
    return { id: "no-rsvps", text: `No RSVPs confirmed yet with ${daysUntil} days out. Sending a reminder helps your venue finalize catering counts.`, kind: "nudge" };
  }
  if (daysUntil > 180 && (guestStats?.total ?? 0) === 0) {
    return { id: "early-and-empty", text: `You have plenty of time — ${daysUntil} days. Starting with your guest list is usually the first big step.`, kind: "info" };
  }
  return null;
}

// ── Payment observations ───────────────────────────────────────────────────────

function _daysUntilDate(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function _fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "long", day: "numeric",
  });
}

function _fmtMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

export function getPaymentObservations(
  lineItems: { label: string; amount: number; dueDate: string | null; status: string }[],
): PortalObs[] {
  const obs: PortalObs[] = [];
  const active = lineItems.filter(i => i.status !== "cancelled");
  if (active.length === 0) return obs;

  const paid    = active.filter(i => i.status === "paid");
  const overdue = active.filter(i => i.status === "overdue");
  const pending = active.filter(i => i.status === "pending").sort((a, b) =>
    (a.dueDate ?? "") < (b.dueDate ?? "") ? -1 : 1,
  );

  if (paid.length === active.length) {
    obs.push({ id: "all-paid", text: "All payments are complete. Your financial commitment to your venue is fulfilled — enjoy the planning!", kind: "info" });
    return obs;
  }

  if (overdue.length > 0) {
    const o = overdue[0];
    const dateStr = o.dueDate ? ` (due ${_fmtDate(o.dueDate)})` : "";
    obs.push({ id: "overdue", text: `${o.label}${dateStr} hasn't been received yet. Reach out to your venue coordinator to arrange payment.`, kind: "flag" });
  }

  if (pending.length > 0) {
    const next = pending[0];
    if (next.dueDate) {
      const days = _daysUntilDate(next.dueDate);
      if (days >= 0 && days <= 7) {
        obs.push({ id: "due-soon", text: `${next.label} of ${_fmtMoney(next.amount)} is due ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}. Contact your coordinator to arrange payment.`, kind: "flag" });
      } else if (days > 7 && days <= 30) {
        obs.push({ id: "due-soon-nudge", text: `${next.label} of ${_fmtMoney(next.amount)} is coming up on ${_fmtDate(next.dueDate)}.`, kind: "nudge" });
      } else if (days > 30) {
        obs.push({ id: "next-payment", text: `Your next payment, ${next.label}, is scheduled for ${_fmtDate(next.dueDate)}.`, kind: "info" });
      }
    }
  }

  return obs;
}

// ── Countdown & Wedding Day observations ──────────────────────────────────────

export function getCountdownObservation(daysUntil: number): PortalObs | null {
  if (daysUntil === 0) return { id: "wedding-day", text: "Today is your wedding day. Every detail you've planned leads to this moment. Take a breath, be present, and enjoy every second.", kind: "info" };
  if (daysUntil === 1) return { id: "tomorrow", text: "Tomorrow is the day. Everything is in place. Tonight, rest — your biggest job now is to be completely present.", kind: "info" };
  if (daysUntil === 2) return { id: "two-days", text: "Two days away. The planning is done. This is the time to let go of the logistics and step into the joy.", kind: "info" };
  if (daysUntil <= 7) return { id: "one-week", text: `${daysUntil} days to go. Your coordinator has everything they need. Trust the team — you've done the work.`, kind: "info" };
  if (daysUntil <= 14) return { id: "two-weeks", text: `Two weeks out — the final details phase. Your coordinator will be reaching out soon to confirm everything. A beautiful day is coming.`, kind: "nudge" };
  return null;
}

export function getWeddingDayObservations(hasRunOfShow: boolean, taskCount: number): PortalObs[] {
  const obs: PortalObs[] = [];
  if (!hasRunOfShow) {
    obs.push({ id: "no-ros", text: "Your day-of timeline hasn't been shared yet. Your coordinator will add it as the event gets closer.", kind: "info" });
  }
  if (taskCount > 0) {
    obs.push({ id: "tasks-today", text: `${taskCount} task${taskCount === 1 ? "" : "s"} to complete today. You've got this.`, kind: "nudge" });
  }
  return obs;
}

// ── Anniversary & Keepsake observations ───────────────────────────────────────

export function getAnniversaryObservations(
  daysSince: number,
  daysUntilAnniversary: number,
): PortalObs[] {
  const obs: PortalObs[] = [];

  // Approaching anniversary
  if (daysUntilAnniversary <= 7 && daysUntilAnniversary > 0) {
    const yearsNum = Math.floor(daysSince / 365) + 1;
    const ordinal = yearsNum === 1 ? "first" : yearsNum === 2 ? "second" : yearsNum === 3 ? "third" : `${yearsNum}th`;
    obs.push({ id: "anniversary-soon", text: `Your ${ordinal} anniversary is in ${daysUntilAnniversary} day${daysUntilAnniversary === 1 ? "" : "s"}. Time moves fast when you're happy.`, kind: "info" });
  } else if (daysUntilAnniversary === 0) {
    const yearsNum = Math.round(daysSince / 365);
    const ordinal = yearsNum === 1 ? "first" : yearsNum === 2 ? "second" : yearsNum === 3 ? "third" : `${yearsNum}th`;
    obs.push({ id: "anniversary-today", text: `Happy ${ordinal} anniversary. 💗`, kind: "info" });
  } else if (daysUntilAnniversary <= 30) {
    obs.push({ id: "anniversary-month", text: `Your anniversary is coming up in ${daysUntilAnniversary} days. This space will always hold the memory of how you planned this.`, kind: "info" });
  }

  // Milestone moments
  if (daysSince === 7) {
    obs.push({ id: "one-week", text: "One week married. The beginning of everything.", kind: "info" });
  } else if (daysSince === 30) {
    obs.push({ id: "one-month", text: "One month married today.", kind: "info" });
  } else if (daysSince === 100) {
    obs.push({ id: "hundred-days", text: "100 days married. That's 100 mornings you've woken up married.", kind: "info" });
  } else if (daysSince === 365) {
    obs.push({ id: "one-year", text: "One year ago today, you said 'I do.' Happy first anniversary. 💗", kind: "info" });
  }

  // General warm presence
  if (obs.length === 0) {
    if (daysSince < 30) {
      obs.push({ id: "newlywed", text: "This space will hold everything you planned here — always. Come back whenever you want to remember the journey.", kind: "info" });
    } else if (daysSince < 180) {
      obs.push({ id: "settling-in", text: "The planning is done. The memories are yours to keep.", kind: "info" });
    } else {
      obs.push({ id: "long-married", text: "Wevenu is yours for as long as you want it. Your wedding journey is preserved here.", kind: "info" });
    }
  }

  return obs;
}

// ── Coordinator observations (venue side — from readiness data) ───────────────

export type CoordObs = { id: string; text: string; kind: "flag" | "info" };

export function getCoordinatorObservations(data: {
  coupleName: string;
  guestTotal: number;
  guestAttending: number;
  guestPending: number;
  seatingCapacity: number;
  readinessScore: number;
  daysUntil: number | null;
  paymentStatus?: "overdue" | "on_track" | "complete" | "no_payments" | null;
  balanceDue?: number | null;
}): CoordObs[] {
  const obs: CoordObs[] = [];
  const { coupleName, daysUntil } = data;

  if (data.seatingCapacity > 0 && data.seatingCapacity < data.guestAttending) {
    obs.push({ id: "seating-gap", text: `${coupleName} has ${data.guestAttending} guests confirmed but seating for only ${data.seatingCapacity}. They may need more tables.`, kind: "flag" });
  }
  if (daysUntil != null && daysUntil > 0 && daysUntil < 90 && data.guestPending > 15) {
    obs.push({ id: "pending-rsvps", text: `${data.guestPending} guests haven't responded with ${daysUntil} days out — meal and catering counts may be affected.`, kind: "flag" });
  }
  if (daysUntil != null && daysUntil > 0 && daysUntil < 60 && data.readinessScore < 70) {
    obs.push({ id: "tasks-behind", text: `Venue tasks are ${data.readinessScore}% complete with ${daysUntil} days to go.`, kind: "flag" });
  }
  if (data.guestTotal === 0 && daysUntil != null && daysUntil < 365) {
    obs.push({ id: "no-guest-list", text: `${coupleName} hasn't started their guest list yet — this affects catering, seating, and planning timelines.`, kind: "info" });
  }

  if (data.paymentStatus === "overdue") {
    const bal = data.balanceDue != null ? ` (${_fmtMoney(data.balanceDue)} outstanding)` : "";
    obs.push({ id: "payment-overdue", text: `${coupleName} has an overdue payment${bal}. Follow up before the event date.`, kind: "flag" });
  } else if (data.paymentStatus === "on_track" && daysUntil != null && daysUntil > 0 && daysUntil < 30 && (data.balanceDue ?? 0) > 0) {
    obs.push({ id: "balance-close", text: `${coupleName} has a balance of ${_fmtMoney(data.balanceDue ?? 0)} with ${daysUntil} days to go.`, kind: "flag" });
  }

  return obs;
}
