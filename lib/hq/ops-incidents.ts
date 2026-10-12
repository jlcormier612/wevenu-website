/**
 * Platform operations incidents — HQ-only persistent alerts.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type OpsSeverity = "critical" | "high" | "warning" | "info";
export type OpsIncidentStatus = "active" | "acknowledged" | "recovered" | "resolved";

export type OpsIncident = {
  id: string;
  dedupeKey: string;
  sourceService: string;
  sourceAlarm: string | null;
  sourceEventId: string | null;
  severity: OpsSeverity;
  status: OpsIncidentStatus;
  title: string;
  summary: string;
  recommendedAction: string;
  diagnostic: Record<string, unknown>;
  firstDetectedAt: string;
  lastObservedAt: string;
  acknowledgedAt: string | null;
  recoveredAt: string | null;
  resolvedAt: string | null;
  lastEmailNotifiedAt: string | null;
  lastEmailOutcome: string | null;
  observationCount: number;
};

export type OpsIncidentEvent = {
  id: string;
  incidentId: string;
  eventType: string;
  severity: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type DbIncident = {
  id: string;
  dedupe_key: string;
  source_service: string;
  source_alarm: string | null;
  source_event_id: string | null;
  severity: OpsSeverity;
  status: OpsIncidentStatus;
  title: string;
  summary: string;
  recommended_action: string;
  diagnostic: Record<string, unknown> | null;
  first_detected_at: string;
  last_observed_at: string;
  acknowledged_at: string | null;
  recovered_at: string | null;
  resolved_at: string | null;
  last_email_notified_at: string | null;
  last_email_outcome: string | null;
  observation_count: number;
};

function mapIncident(row: DbIncident): OpsIncident {
  return {
    id: row.id,
    dedupeKey: row.dedupe_key,
    sourceService: row.source_service,
    sourceAlarm: row.source_alarm,
    sourceEventId: row.source_event_id,
    severity: row.severity,
    status: row.status,
    title: row.title,
    summary: row.summary,
    recommendedAction: row.recommended_action,
    diagnostic: row.diagnostic ?? {},
    firstDetectedAt: row.first_detected_at,
    lastObservedAt: row.last_observed_at,
    acknowledgedAt: row.acknowledged_at,
    recoveredAt: row.recovered_at,
    resolvedAt: row.resolved_at,
    lastEmailNotifiedAt: row.last_email_notified_at,
    lastEmailOutcome: row.last_email_outcome,
    observationCount: row.observation_count,
  };
}

/** Alarm → service / severity / recommended action (shared with Lambda via tests). */
export function classifyOpsAlarm(alarmName: string | null | undefined): {
  sourceService: string;
  severity: OpsSeverity;
  recommendedAction: string;
} {
  const name = (alarmName || "").toLowerCase();
  if (name.includes("health-supabase") || name.includes("unhealthy") || name.includes("alb-target-5xx")) {
    return {
      sourceService: "infrastructure",
      severity: "critical",
      recommendedAction: "Check /api/health, ECS tasks, and recent Sandbox deploys. Confirm ALB target health.",
    };
  }
  if (name.includes("supabase-restriction")) {
    return {
      sourceService: "supabase",
      severity: "critical",
      recommendedAction: "Stop heavy QA traffic. Review Supabase Dashboard Usage. Do not rotate secrets.",
    };
  }
  if (name.includes("auth-retryable") || name.includes("crm-contention")) {
    return {
      sourceService: name.includes("crm") ? "database" : "auth",
      severity: "high",
      recommendedAction: "Inspect venue-app logs for Auth/CRM storms; avoid store rewrite storms.",
    };
  }
  if (name.includes("resend-provider-limit") || name.includes("ops-alert-email-failures")) {
    return {
      sourceService: "resend",
      severity: "high",
      recommendedAction: "Check Resend /usage and ops-alert-email Lambda logs. In-product alerts remain authoritative.",
    };
  }
  if (name.includes("usage-canary-down") || name.includes("sns-notifications-failed")) {
    return {
      sourceService: "monitoring",
      severity: "high",
      recommendedAction: "Monitoring path degraded — verify canaries and SNS subscriptions. Do not assume silence means healthy.",
    };
  }
  if (name.includes("resend") && name.includes("usage")) {
    return {
      sourceService: "resend",
      severity: "warning",
      recommendedAction: "Pause bulk/QA sends. Review daily/monthly Resend allowance before exhaustion.",
    };
  }
  return {
    sourceService: "platform",
    severity: "high",
    recommendedAction: "Review CloudWatch alarm detail and recent Sandbox logs.",
  };
}

export async function listOpsIncidents(filters?: {
  status?: OpsIncidentStatus | "unresolved" | "all";
  severity?: OpsSeverity | "all";
  service?: string | "all";
}): Promise<OpsIncident[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  let q = supabase
    .from("ops_incidents")
    .select("*")
    .order("last_observed_at", { ascending: false })
    .limit(200);

  const status = filters?.status ?? "unresolved";
  if (status === "unresolved") {
    q = q.in("status", ["active", "acknowledged"]);
  } else if (status !== "all") {
    q = q.eq("status", status);
  }
  if (filters?.severity && filters.severity !== "all") {
    q = q.eq("severity", filters.severity);
  }
  if (filters?.service && filters.service !== "all") {
    q = q.eq("source_service", filters.service);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as DbIncident[]).map(mapIncident);
}

export async function countActiveOpsIncidents(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("ops_incidents")
    .select("id", { count: "exact", head: true })
    .in("status", ["active", "acknowledged"]);
  if (error) return 0;
  return count ?? 0;
}

export async function getOpsIncident(id: string): Promise<{
  incident: OpsIncident | null;
  events: OpsIncidentEvent[];
}> {
  if (!isSupabaseConfigured) return { incident: null, events: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ops_incidents").select("*").eq("id", id).maybeSingle();
  if (error || !data) return { incident: null, events: [] };

  const { data: events } = await supabase
    .from("ops_incident_events")
    .select("id, incident_id, event_type, severity, message, metadata, created_at")
    .eq("incident_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    incident: mapIncident(data as DbIncident),
    events: (events ?? []).map((e) => ({
      id: e.id as string,
      incidentId: e.incident_id as string,
      eventType: e.event_type as string,
      severity: (e.severity as string | null) ?? null,
      message: (e.message as string) ?? "",
      metadata: (e.metadata as Record<string, unknown>) ?? {},
      createdAt: e.created_at as string,
    })),
  };
}

export async function acknowledgeOpsIncident(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Supabase not configured" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_ops_incident", { p_incident_id: id });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
