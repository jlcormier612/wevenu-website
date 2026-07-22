import type { FacebookConnection, FacebookLeadForm, FacebookLeadLogEntry } from "@/lib/facebook/types";

type ConnectionRow = {
  venue_id: string; page_id: string | null; page_name: string | null; status: FacebookConnection["status"];
  last_health_check_at: string | null; last_health_check_ok: boolean | null; last_error: string | null; connected_at: string;
};

function mapConnection(r: ConnectionRow): FacebookConnection {
  return {
    venueId: r.venue_id, pageId: r.page_id, pageName: r.page_name, status: r.status,
    lastHealthCheckAt: r.last_health_check_at, lastHealthCheckOk: r.last_health_check_ok,
    lastError: r.last_error, connectedAt: r.connected_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getConnection(client: any, venueId: string): Promise<FacebookConnection | null> {
  const { data } = await client.from("facebook_connections")
    .select("venue_id, page_id, page_name, status, last_health_check_at, last_health_check_ok, last_error, connected_at")
    .eq("venue_id", venueId).maybeSingle();
  return data ? mapConnection(data as ConnectionRow) : null;
}

type ConnectionWithTokens = FacebookConnection & {
  userAccessToken: string; userTokenExpiresAt: string; pageAccessToken: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getConnectionWithTokens(client: any, venueId: string): Promise<ConnectionWithTokens | null> {
  const { data } = await client.from("facebook_connections").select("*").eq("venue_id", venueId).maybeSingle();
  if (!data) return null;
  const row = data as ConnectionRow & { user_access_token: string; user_token_expires_at: string; page_access_token: string | null };
  return { ...mapConnection(row), userAccessToken: row.user_access_token, userTokenExpiresAt: row.user_token_expires_at, pageAccessToken: row.page_access_token };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertConnection(client: any, venueId: string, input: { userAccessToken: string; userTokenExpiresAt: string }): Promise<void> {
  const { error } = await client.from("facebook_connections").upsert({
    venue_id: venueId, user_access_token: input.userAccessToken, user_token_expires_at: input.userTokenExpiresAt,
    status: "needs_page_selection", page_id: null, page_name: null, page_access_token: null,
    connected_at: new Date().toISOString(), disconnected_at: null,
  }, { onConflict: "venue_id" });
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setSelectedPage(client: any, venueId: string, input: { pageId: string; pageName: string; pageAccessToken: string }): Promise<void> {
  const { error } = await client.from("facebook_connections").update({
    page_id: input.pageId, page_name: input.pageName, page_access_token: input.pageAccessToken, status: "connected",
  }).eq("venue_id", venueId);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function disconnectConnection(client: any, venueId: string): Promise<void> {
  const { error } = await client.from("facebook_connections").update({
    status: "disconnected", disconnected_at: new Date().toISOString(),
  }).eq("venue_id", venueId);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setConnectionError(client: any, venueId: string, message: string): Promise<void> {
  const { error } = await client.from("facebook_connections").update({
    status: "error", last_error: message, last_error_at: new Date().toISOString(),
  }).eq("venue_id", venueId);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordHealthCheck(client: any, venueId: string, ok: boolean, error?: string): Promise<void> {
  const patch: Record<string, unknown> = { last_health_check_at: new Date().toISOString(), last_health_check_ok: ok };
  if (!ok && error) { patch.last_error = error; patch.last_error_at = new Date().toISOString(); }
  const { error: dbError } = await client.from("facebook_connections").update(patch).eq("venue_id", venueId);
  if (dbError) throw dbError;
}

// ── Lead Forms ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLeadForms(client: any, venueId: string): Promise<FacebookLeadForm[]> {
  const { data } = await client.from("facebook_lead_forms").select("id, form_id, form_name, is_enabled").eq("venue_id", venueId).order("created_at");
  return ((data ?? []) as { id: string; form_id: string; form_name: string | null; is_enabled: boolean }[])
    .map((r) => ({ id: r.id, formId: r.form_id, formName: r.form_name, isEnabled: r.is_enabled }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function replaceLeadForms(client: any, venueId: string, pageId: string, forms: { formId: string; formName: string }[]): Promise<void> {
  await client.from("facebook_lead_forms").delete().eq("venue_id", venueId);
  if (forms.length === 0) return;
  const { error } = await client.from("facebook_lead_forms").insert(
    forms.map((f) => ({ venue_id: venueId, page_id: pageId, form_id: f.formId, form_name: f.formName, is_enabled: true })),
  );
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setFormEnabled(client: any, venueId: string, formId: string, enabled: boolean): Promise<void> {
  const { error } = await client.from("facebook_lead_forms").update({ is_enabled: enabled }).eq("venue_id", venueId).eq("form_id", formId);
  if (error) throw error;
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export type FacebookQueueRow = {
  id: string; venue_id: string; leadgen_id: string; form_id: string; page_id: string;
  status: string; attempt_count: number; max_attempts: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enqueueLead(client: any, input: { venueId: string; leadgenId: string; formId: string; pageId: string }): Promise<void> {
  const { error } = await client.from("facebook_lead_queue").upsert({
    venue_id: input.venueId, leadgen_id: input.leadgenId, form_id: input.formId, page_id: input.pageId,
    status: "pending", next_attempt_at: new Date().toISOString(),
  }, { onConflict: "venue_id,leadgen_id", ignoreDuplicates: true });
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDueBatch(client: any, limit: number): Promise<FacebookQueueRow[]> {
  const { data } = await client.from("facebook_lead_queue")
    .select("*").in("status", ["pending", "failed_retrying"]).lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at").limit(limit);
  return (data ?? []) as FacebookQueueRow[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function claimQueueItem(client: any, id: string): Promise<boolean> {
  const { data } = await client.from("facebook_lead_queue").update({ status: "processing", last_attempted_at: new Date().toISOString() })
    .eq("id", id).in("status", ["pending", "failed_retrying"]).select("id");
  return ((data ?? []) as unknown[]).length > 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function releaseQueueItem(client: any, id: string): Promise<void> {
  await client.from("facebook_lead_queue").update({ status: "pending" }).eq("id", id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markQueueSucceeded(client: any, id: string): Promise<void> {
  await client.from("facebook_lead_queue").update({ status: "succeeded" }).eq("id", id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markQueueFailedRetrying(client: any, id: string, attemptCount: number, nextAttemptAt: string, error: string): Promise<void> {
  await client.from("facebook_lead_queue").update({
    status: "failed_retrying", attempt_count: attemptCount, next_attempt_at: nextAttemptAt, last_error: error, last_error_at: new Date().toISOString(),
  }).eq("id", id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markQueueDeadLetter(client: any, id: string, attemptCount: number, error: string): Promise<void> {
  await client.from("facebook_lead_queue").update({
    status: "dead_letter", attempt_count: attemptCount, last_error: error, last_error_at: new Date().toISOString(),
  }).eq("id", id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertLog(client: any, input: {
  venueId: string; queueId: string; leadgenId: string;
  outcome: "succeeded" | "failed" | "dead_lettered"; attemptNumber: number; leadId?: string | null; message?: string | null;
}): Promise<void> {
  const { error } = await client.from("facebook_lead_log").insert({
    venue_id: input.venueId, queue_id: input.queueId, leadgen_id: input.leadgenId,
    outcome: input.outcome, attempt_number: input.attemptNumber, lead_id: input.leadId ?? null, message: input.message ?? null,
  });
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRecentLog(client: any, venueId: string, limit = 20): Promise<FacebookLeadLogEntry[]> {
  const { data } = await client.from("facebook_lead_log").select("id, leadgen_id, outcome, attempt_number, message, created_at")
    .eq("venue_id", venueId).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as { id: string; leadgen_id: string; outcome: "succeeded" | "failed" | "dead_lettered"; attempt_number: number; message: string | null; created_at: string }[])
    .map((r) => ({ id: r.id, leadgenId: r.leadgen_id, outcome: r.outcome, attemptNumber: r.attempt_number, message: r.message, createdAt: r.created_at }));
}
