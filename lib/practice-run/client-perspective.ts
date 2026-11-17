/**
 * PM-03 — narrowly scoped Practice Run client-view access.
 * Staff of the owning venue only. No general impersonation.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createPortalSession, getPortalSessions } from "@/lib/portal/service";
import * as practiceRepo from "@/lib/practice-run/repository";
import type { PracticeRun } from "@/lib/practice-run/types";
import { getCurrentVenue } from "@/lib/venue/service";

export const PRACTICE_PORTAL_SESSION_LABEL = "Practice Run client view";

export type PracticeClientAccess =
  | {
      ok: true;
      venueId: string;
      venueName: string;
      run: PracticeRun;
      portalToken: string;
      portalSessionId: string;
    }
  | { ok: false; message: string; status: 401 | 403 | 404 };

function practiceSessionLabel(runId: string): string {
  return `${PRACTICE_PORTAL_SESSION_LABEL} · ${runId.slice(0, 8)}`;
}

/**
 * Authorize the current staff member to open the Practice Run Client perspective.
 * Validates venue membership (via getCurrentVenue), run ownership, and sample links.
 */
export async function requirePracticeClientAccess(
  runId: string,
): Promise<PracticeClientAccess> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Hello to Cheers is not connected.", status: 401 };
  }
  const venue = await getCurrentVenue();
  if (!venue) {
    return { ok: false, message: "Choose a venue to continue.", status: 401 };
  }
  const client = await createClient();
  const run = await practiceRepo.getPracticeRunForVenue(client, venue.id, runId);
  if (!run || run.status !== "in_progress") {
    return { ok: false, message: "Practice Run not found for this venue.", status: 404 };
  }
  if (!run.sampleClientId || !run.sampleEventId || !run.sampleLeadId) {
    return { ok: false, message: "Practice Run sample celebration is not ready.", status: 404 };
  }

  // Confirm sample client is practice-linked to this run (server-side, not UI flag).
  const practiceRunId = await practiceRepo.getRecordPracticeRunId(
    client,
    "clients",
    venue.id,
    run.sampleClientId,
  );
  if (practiceRunId !== run.id) {
    return { ok: false, message: "Sample client is not linked to this Practice Run.", status: 403 };
  }

  const eventPracticeId = await practiceRepo.getRecordPracticeRunId(
    client,
    "events",
    venue.id,
    run.sampleEventId,
  );
  if (eventPracticeId !== run.id) {
    return { ok: false, message: "Sample event is not linked to this Practice Run.", status: 403 };
  }

  const session = await ensurePracticePortalSession(run);
  if (!session) {
    return { ok: false, message: "Could not open the Practice Run client view.", status: 403 };
  }

  return {
    ok: true,
    venueId: venue.id,
    venueName: venue.name,
    run,
    portalToken: session.accessToken,
    portalSessionId: session.id,
  };
}

/**
 * Create or reuse an isolated portal session for the Practice Run sample.
 * Does not send invitations or emails.
 */
export async function ensurePracticePortalSession(
  run: PracticeRun,
): Promise<{ id: string; accessToken: string } | null> {
  if (!run.sampleClientId) return null;
  const label = practiceSessionLabel(run.id);
  const existing = await getPortalSessions(run.sampleClientId);
  const match = existing.find(
    (s) =>
      s.accessLevel === "couple"
      && (s.label === label || s.label?.startsWith(PRACTICE_PORTAL_SESSION_LABEL)),
  );
  if (match) {
    // Keep event association when the column is present.
    const client = await createClient();
    if (run.sampleEventId && match.eventId !== run.sampleEventId) {
      await client
        .from("client_portal_sessions")
        .update({ event_id: run.sampleEventId, label })
        .eq("id", match.id)
        .eq("venue_id", run.venueId);
    }
    return { id: match.id, accessToken: match.accessToken };
  }

  const created = await createPortalSession(run.sampleClientId, label, "couple");
  if (!created) return null;
  if (run.sampleEventId) {
    const client = await createClient();
    await client
      .from("client_portal_sessions")
      .update({ event_id: run.sampleEventId })
      .eq("id", created.id)
      .eq("venue_id", run.venueId);
  }
  return { id: created.id, accessToken: created.accessToken };
}

/** True when a portal session token belongs to a practice-linked client. */
export async function isPracticePortalToken(token: string): Promise<boolean> {
  if (!token.trim() || !isSupabaseConfigured) return false;
  const client = await createClient();
  const { data: session } = await client
    .from("client_portal_sessions")
    .select("client_id, venue_id, label")
    .eq("access_token", token.trim())
    .maybeSingle();
  if (!session) return false;
  const row = session as { client_id: string; venue_id: string; label: string | null };
  if (row.label?.startsWith(PRACTICE_PORTAL_SESSION_LABEL)) return true;
  const practiceRunId = await practiceRepo.getRecordPracticeRunId(
    client,
    "clients",
    row.venue_id,
    row.client_id,
  );
  return Boolean(practiceRunId);
}
