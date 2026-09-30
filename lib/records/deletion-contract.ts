/**
 * Global deleted-record visibility — deletion contract helpers.
 *
 * Product lock (hard delete, no soft-delete, no exclude_from_business_reporting):
 *   Successful delete → entity must not surface in active business surfaces.
 *   Failed delete → record remains; UI must report failure clearly.
 *
 * Lead contract (authoritative parent: leads row):
 *   CASCADE: lead_tasks, lead_notes, lead_activities, lead-scoped documents, …
 *   SET NULL: clients.lead_id, tour_appointments.lead_id, commercial_* lead refs, …
 *   RESTRICT: tour_protection_requests.lead_id (blocks delete until resolved)
 *   After success: archive venue tours for that lead; clear lead-scoped Luv drafts;
 *   surviving client/financials stay historical; never present as that lead.
 *
 * Client contract: preview refuses signed/paid financials; events best-effort delete;
 * linked lead deleted; no soft-delete.
 */

export type LeadDeleteBlocker = {
  kind: "tour_protection";
  count: number;
};

export function formatLeadDeleteBlockedMessage(blocker: LeadDeleteBlocker): string {
  if (blocker.kind === "tour_protection") {
    const n = blocker.count;
    return n === 1
      ? "This lead cannot be deleted because a tour protection request is still linked to it. Resolve or remove that tour protection record first. The lead was not removed."
      : `This lead cannot be deleted because ${n} tour protection requests are still linked to it. Resolve or remove those tour protection records first. The lead was not removed.`;
  }
  return "This lead cannot be deleted because related records still depend on it.";
}

/** Map PostgREST / Postgres FK failures into venue-facing copy. */
export function formatLeadDeleteFailureMessage(error: {
  message?: string;
  code?: string;
  details?: string;
}): string {
  const raw = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  const code = error.code ?? "";

  if (
    code === "23503" ||
    raw.includes("foreign key") ||
    raw.includes("violates foreign key") ||
    raw.includes("tour_protection_requests")
  ) {
    if (raw.includes("tour_protection")) {
      return formatLeadDeleteBlockedMessage({ kind: "tour_protection", count: 1 });
    }
    return "This lead cannot be deleted because related records still depend on it. The lead was not removed.";
  }

  if (error.message?.trim()) return error.message.trim();
  return "Could not delete this lead. The lead was not removed.";
}

export function formatClientDeleteFailureMessage(error: {
  message?: string;
  code?: string;
}): string {
  if (error.code === "23503" || (error.message ?? "").toLowerCase().includes("foreign key")) {
    return "This record has related history that could not be removed automatically. The client was not deleted.";
  }
  if (error.message?.trim()) return error.message.trim();
  return "Could not delete this client. The client was not removed.";
}
