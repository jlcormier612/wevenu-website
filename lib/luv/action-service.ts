import { createClient } from "@/integrations/supabase/server";
import type { LuvObservation } from "@/lib/luv/types";
import type { RawActionOutcomeRow, RawPendingActionRow, RawPerformanceSummaryRow } from "./action-types";

export async function getLuvActionObservations(): Promise<LuvObservation[]> {
  const supabase = await createClient();

  const { error: computeError } = await supabase.rpc("compute_action_outcomes");
  if (computeError) {
    console.error("[action-service] compute_action_outcomes failed:", computeError.message);
  }

  const { data, error } = await supabase.rpc("get_luv_action_outcomes");
  if (error || !data) {
    if (error) console.error("[action-service] get_luv_action_outcomes failed:", error.message);
    return [];
  }
  return formatActionObservations(data as RawActionOutcomeRow[]);
}

export async function getPendingLuvActions(): Promise<LuvObservation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_pending_luv_actions");
  if (error || !data) {
    if (error) console.error("[action-service] get_pending_luv_actions failed:", error.message);
    return [];
  }
  return formatPendingObservations(data as RawPendingActionRow[]);
}

export function formatActionObservations(rows: RawActionOutcomeRow[]): LuvObservation[] {
  return rows
    .map(row => toObservation(row))
    .filter((obs): obs is LuvObservation => obs !== null);
}

export function formatPendingObservations(rows: RawPendingActionRow[]): LuvObservation[] {
  return rows
    .map(row => toPendingObservation(row))
    .filter((obs): obs is LuvObservation => obs !== null);
}

function toObservation(row: RawActionOutcomeRow): LuvObservation | null {
  const { action_type, metric_name, before_value, after_value, started_at } = row;

  if (after_value === null || after_value === 0) return null;

  const weeksAgo  = Math.round((Date.now() - new Date(started_at).getTime()) / (7 * 86_400_000));
  const timeLabel = weeksAgo <= 1 ? "last week" : `${weeksAgo} weeks ago`;

  if (action_type === "follow_up_messages" && metric_name === "leads_contacted") {
    const n = after_value;
    return {
      id:          "action_outcome_follow_up_messages",
      priority:    "medium",
      message:     `${n} couple${n !== 1 ? "s" : ""} responded after your follow-up campaign`,
      detail:      `${timeLabel} · ${before_value ?? 0} leads were overdue for contact`,
      link:        "/leads",
      actionLabel: "View leads →",
    };
  }

  if (action_type === "seasonal_promo" && metric_name === "new_inquiries_14d") {
    const n      = after_value;
    const before = before_value ?? 0;
    const vs     = before > 0
      ? ` — ${n >= before ? "up" : "down"} from ${before} in the prior 14 days`
      : "";
    return {
      id:          "action_outcome_seasonal_promo",
      priority:    "medium",
      message:     `Your seasonal promotion brought in ${n} new inquiries over 14 days${vs}`,
      detail:      timeLabel,
      link:        "/leads",
      actionLabel: "View inquiries →",
    };
  }

  if (action_type === "availability_plan" && metric_name === "new_inquiries_14d") {
    const n      = after_value;
    const before = before_value ?? 0;
    const vs     = before > 0
      ? ` — ${n >= before ? "up" : "down"} from ${before} in the prior 14 days`
      : "";
    return {
      id:          "action_outcome_availability_plan",
      priority:    "medium",
      message:     `After updating your availability plan, ${n} new inquiries came in over 14 days${vs}`,
      detail:      timeLabel,
      link:        "/calendar",
      actionLabel: "View calendar →",
    };
  }

  return null;
}

function toPendingObservation(row: RawPendingActionRow): LuvObservation | null {
  const daysElapsed = Math.floor(
    (Date.now() - new Date(row.started_at).getTime()) / 86_400_000
  );
  const daysLeft    = Math.max(0, row.measure_after_days - daysElapsed);
  const countdown   = daysLeft > 0
    ? `Checking back in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
    : "Results ready soon";

  switch (row.action_type) {
    case "follow_up_messages":
      return {
        id:          "pending_follow_up_messages",
        priority:    "medium",
        message:     "I'm tracking the follow-up messages you sent this week.",
        detail:      countdown,
        link:        "/leads",
        actionLabel: "View leads →",
      };

    case "seasonal_promo":
      return {
        id:          "pending_seasonal_promo",
        priority:    "medium",
        message:     "I'm watching whether your seasonal promotion brings in more inquiries.",
        detail:      countdown,
        link:        "/leads",
        actionLabel: "View leads →",
      };

    case "availability_plan":
      return {
        id:          "pending_availability_plan",
        priority:    "medium",
        message:     "I'll let you know if your availability update changes booking momentum.",
        detail:      countdown,
        link:        "/calendar",
        actionLabel: "View calendar →",
      };

    default:
      return null;
  }
}

export async function getLuvPerformanceObservations(): Promise<LuvObservation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_luv_performance_summary");
  if (error || !data) {
    if (error) console.error("[action-service] get_luv_performance_summary failed:", error.message);
    return [];
  }
  return (data as RawPerformanceSummaryRow[])
    .map(toPerformanceObservation)
    .filter((obs): obs is LuvObservation => obs !== null);
}

function toPerformanceObservation(row: RawPerformanceSummaryRow): LuvObservation | null {
  const { action_type, total_actions, total_outcome, best_month_name, best_month_avg, worst_month_name, worst_month_avg } = row;

  if (!total_outcome) return null;

  const total          = Math.round(total_outcome);
  const avgPerCampaign = +(total_outcome / total_actions).toFixed(1);
  const hasSeasonal    = best_month_name && worst_month_name &&
                         best_month_name !== worst_month_name &&
                         best_month_avg != null && worst_month_avg != null && worst_month_avg > 0;
  const ratio          = hasSeasonal
    ? Math.round((best_month_avg! / worst_month_avg!) * 10) / 10
    : null;

  if (action_type === "follow_up_messages") {
    return {
      id:          "perf_follow_up_messages",
      priority:    "medium",
      message:     `Follow-up campaigns have contacted ${total} lead${total !== 1 ? "s" : ""} across ${total_actions} campaign${total_actions !== 1 ? "s" : ""}.`,
      detail:      hasSeasonal && ratio && ratio >= 1.3
        ? `${best_month_name} is your strongest month — ${ratio}× more effective than ${worst_month_name}`
        : `${avgPerCampaign} leads per campaign on average`,
      link:        "/leads",
      actionLabel: "View leads →",
    };
  }

  if (action_type === "seasonal_promo") {
    return {
      id:          "perf_seasonal_promo",
      priority:    "medium",
      message:     `${total_actions} seasonal promotion${total_actions !== 1 ? "s" : ""} brought in ${total} new ${total !== 1 ? "inquiries" : "inquiry"}.`,
      detail:      hasSeasonal && ratio && ratio >= 1.3
        ? `${best_month_name} promotions outperform ${worst_month_name} by ${ratio}× for your venue`
        : `${avgPerCampaign} new inquiries per promotion on average`,
      link:        "/leads",
      actionLabel: "View inquiries →",
    };
  }

  if (action_type === "availability_plan") {
    return {
      id:          "perf_availability_plan",
      priority:    "medium",
      message:     `Availability updates have generated ${total} ${total !== 1 ? "inquiries" : "inquiry"} across ${total_actions} update${total_actions !== 1 ? "s" : ""}.`,
      detail:      hasSeasonal && ratio && ratio >= 1.3
        ? `${best_month_name} is your most effective time to update availability`
        : `${avgPerCampaign} new inquiries per update on average`,
      link:        "/calendar",
      actionLabel: "View calendar →",
    };
  }

  return null;
}
