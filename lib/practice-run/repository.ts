import { emptyPracticeJourney, parsePracticeJourney, type PracticeJourney } from "@/lib/practice-run/journey";
import type { PracticeRun, PracticeRunStatus } from "@/lib/practice-run/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = { from: (table: string) => any; auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> } };

type PracticeRunRow = {
  id: string;
  venue_id: string;
  status: PracticeRunStatus;
  celebration_name: string;
  sample_lead_id: string | null;
  sample_client_id: string | null;
  sample_event_id: string | null;
  sample_relationship_id: string | null;
  journey?: unknown;
  practice_booked_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
};

export function mapPracticeRun(row: PracticeRunRow): PracticeRun {
  return {
    id: row.id,
    venueId: row.venue_id,
    status: row.status,
    celebrationName: row.celebration_name,
    sampleLeadId: row.sample_lead_id,
    sampleClientId: row.sample_client_id,
    sampleEventId: row.sample_event_id,
    sampleRelationshipId: row.sample_relationship_id,
    journey: row.journey === undefined ? emptyPracticeJourney() : parsePracticeJourney(row.journey),
    practiceBookedAt: row.practice_booked_at ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
  };
}

function isMissingPracticeSchema(error: { message?: string; code?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("practice_runs")
    && (message.includes("schema cache") || message.includes("does not exist") || message.includes("could not find"))
  );
}

function isMissingJourneyColumn(error: { message?: string; code?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("journey")
    || message.includes("practice_booked_at")
  ) && (
    message.includes("schema cache")
    || message.includes("does not exist")
    || message.includes("could not find")
    || message.includes("column")
  );
}

export async function getActivePracticeRun(
  client: DbClient,
  venueId: string,
): Promise<PracticeRun | null> {
  const { data, error } = await client
    .from("practice_runs")
    .select("*")
    .eq("venue_id", venueId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (error) {
    if (isMissingPracticeSchema(error)) return null;
    throw error;
  }
  return data ? mapPracticeRun(data as PracticeRunRow) : null;
}

export async function getPracticeRunForVenue(
  client: DbClient,
  venueId: string,
  runId: string,
): Promise<PracticeRun | null> {
  const { data, error } = await client
    .from("practice_runs")
    .select("*")
    .eq("venue_id", venueId)
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPracticeRun(data as PracticeRunRow) : null;
}

export async function findPracticeRunBySample(
  client: DbClient,
  venueId: string,
  sample: { leadId?: string | null; clientId?: string | null; eventId?: string | null },
): Promise<PracticeRun | null> {
  if (sample.leadId) {
    const { data, error } = await client
      .from("practice_runs")
      .select("*")
      .eq("venue_id", venueId)
      .eq("sample_lead_id", sample.leadId)
      .eq("status", "in_progress")
      .maybeSingle();
    if (error) {
      if (isMissingPracticeSchema(error)) return null;
      throw error;
    }
    if (data) return mapPracticeRun(data as PracticeRunRow);
  }
  if (sample.clientId) {
    const { data, error } = await client
      .from("practice_runs")
      .select("*")
      .eq("venue_id", venueId)
      .eq("sample_client_id", sample.clientId)
      .eq("status", "in_progress")
      .maybeSingle();
    if (error) {
      if (isMissingPracticeSchema(error)) return null;
      throw error;
    }
    if (data) return mapPracticeRun(data as PracticeRunRow);
  }
  if (sample.eventId) {
    const { data, error } = await client
      .from("practice_runs")
      .select("*")
      .eq("venue_id", venueId)
      .eq("sample_event_id", sample.eventId)
      .eq("status", "in_progress")
      .maybeSingle();
    if (error) {
      if (isMissingPracticeSchema(error)) return null;
      throw error;
    }
    if (data) return mapPracticeRun(data as PracticeRunRow);
  }
  return null;
}

export async function insertPracticeRun(
  client: DbClient,
  venueId: string,
  celebrationName: string,
  createdBy: string | null,
): Promise<PracticeRun> {
  const { data, error } = await client
    .from("practice_runs")
    .insert({
      venue_id: venueId,
      status: "in_progress",
      celebration_name: celebrationName,
      created_by: createdBy,
      journey: emptyPracticeJourney(),
    })
    .select("*")
    .single();
  if (error) {
    // Soft-fail when PM-02 journey column is not applied yet.
    if (isMissingJourneyColumn(error)) {
      const fallback = await client
        .from("practice_runs")
        .insert({
          venue_id: venueId,
          status: "in_progress",
          celebration_name: celebrationName,
          created_by: createdBy,
        })
        .select("*")
        .single();
      if (fallback.error) throw fallback.error;
      return mapPracticeRun(fallback.data as PracticeRunRow);
    }
    throw error;
  }
  return mapPracticeRun(data as PracticeRunRow);
}

export async function touchPracticeRunOpened(
  client: DbClient,
  venueId: string,
  runId: string,
): Promise<PracticeRun> {
  const { data, error } = await client
    .from("practice_runs")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("venue_id", venueId)
    .eq("id", runId)
    .eq("status", "in_progress")
    .select("*")
    .single();
  if (error) throw error;
  return mapPracticeRun(data as PracticeRunRow);
}

export async function attachPracticeSample(
  client: DbClient,
  venueId: string,
  runId: string,
  sample: {
    leadId: string;
    clientId: string;
    eventId: string;
    relationshipId: string | null;
  },
): Promise<PracticeRun> {
  const { data, error } = await client
    .from("practice_runs")
    .update({
      sample_lead_id: sample.leadId,
      sample_client_id: sample.clientId,
      sample_event_id: sample.eventId,
      sample_relationship_id: sample.relationshipId,
      last_opened_at: new Date().toISOString(),
    })
    .eq("venue_id", venueId)
    .eq("id", runId)
    .select("*")
    .single();
  if (error) throw error;
  return mapPracticeRun(data as PracticeRunRow);
}

export async function setPracticeRunStatus(
  client: DbClient,
  venueId: string,
  runId: string,
  status: PracticeRunStatus,
): Promise<PracticeRun> {
  const { data, error } = await client
    .from("practice_runs")
    .update({ status, last_opened_at: new Date().toISOString() })
    .eq("venue_id", venueId)
    .eq("id", runId)
    .select("*")
    .single();
  if (error) throw error;
  return mapPracticeRun(data as PracticeRunRow);
}

export async function updatePracticeJourney(
  client: DbClient,
  venueId: string,
  runId: string,
  journey: PracticeJourney,
  extras?: { practiceBookedAt?: string | null },
): Promise<PracticeRun> {
  const patch: Record<string, unknown> = {
    journey,
    last_opened_at: new Date().toISOString(),
  };
  if (extras && "practiceBookedAt" in extras) {
    patch.practice_booked_at = extras.practiceBookedAt;
  }
  const { data, error } = await client
    .from("practice_runs")
    .update(patch)
    .eq("venue_id", venueId)
    .eq("id", runId)
    .eq("status", "in_progress")
    .select("*")
    .single();
  if (error) {
    if (isMissingJourneyColumn(error)) {
      throw new Error(
        "Practice Run journey progress needs the Sandbox database update. Ask your Hello to Cheers guide to apply the Practice Run journey migration, then try again.",
      );
    }
    throw error;
  }
  return mapPracticeRun(data as PracticeRunRow);
}

export async function markRecordPracticeLinked(
  client: DbClient,
  table: "leads" | "clients" | "events",
  venueId: string,
  recordId: string,
  practiceRunId: string,
): Promise<void> {
  const { error } = await client
    .from(table)
    .update({
      practice_run_id: practiceRunId,
      exclude_from_business_reporting: true,
    })
    .eq("venue_id", venueId)
    .eq("id", recordId);
  if (error) throw error;
}

/** Server-side lookup: is this CRM row practice-linked for the venue? */
export async function getRecordPracticeRunId(
  client: DbClient,
  table: "leads" | "clients" | "events",
  venueId: string,
  recordId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from(table)
    .select("practice_run_id")
    .eq("venue_id", venueId)
    .eq("id", recordId)
    .maybeSingle();
  if (error) {
    if (isMissingPracticeSchema(error) || isMissingJourneyColumn(error)) return null;
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("practice_run_id") && message.includes("column")) return null;
    throw error;
  }
  const id = (data as { practice_run_id?: string | null } | null)?.practice_run_id;
  return typeof id === "string" && id.trim() ? id : null;
}
