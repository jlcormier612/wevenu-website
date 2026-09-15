import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  applyContractVersionLineage,
  normalizeWorkspaceDocument,
  workspaceDocKey,
} from "@/lib/document-workspace/normalize";
import type {
  WorkspaceActivityEntry,
  WorkspaceDocument,
  WorkspaceScope,
  WorkspaceVersion,
} from "@/lib/document-workspace/types";
import * as contractRepo from "@/lib/contracts/repository";

/** Global Documents (no scope) or a Relationship/Vendor/Event-filtered view — same one RPC, same one shape, per the brief's own "filtered view, not another document system." */
export async function getVenueWorkspaceDocuments(scope: WorkspaceScope = {}): Promise<WorkspaceDocument[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_documents", {
    p_lead_id: scope.leadId ?? null,
    p_client_id: scope.clientId ?? null,
    p_event_id: scope.eventId ?? null,
    p_vendor_id: scope.vendorId ?? null,
  });
  if (error) {
    console.error("[getVenueWorkspaceDocuments]", error.message);
    return [];
  }
  const rows = (data?.documents ?? []) as Parameters<typeof normalizeWorkspaceDocument>[0][];
  const docs = rows.map(normalizeWorkspaceDocument);

  const contractIds = docs.filter((d) => d.docType === "contract").map((d) => d.id);
  if (contractIds.length === 0) return docs;

  try {
    const nodes = await contractRepo.listContractLineageNodes(supabase, venue.id, contractIds);
    const { isContractFinalized } = await import("@/lib/contracts/document-integration");
    const withFinal = await Promise.all(
      nodes.map(async (n) => ({
        ...n,
        finalized: n.status === "signed" ? await isContractFinalized(supabase, n.id) : false,
      })),
    );
    return applyContractVersionLineage(docs, withFinal);
  } catch (err) {
    console.error("[getVenueWorkspaceDocuments] lineage enrich failed", err);
    return docs;
  }
}

export async function getWorkspaceFileVersions(doc: WorkspaceDocument): Promise<WorkspaceVersion[]> {
  if (doc.docType !== "document") return doc.versionFamily ?? [];
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { listDocumentFileVersions } = await import("@/lib/documents/repository");
  const rows = await listDocumentFileVersions(supabase, venue.id, doc.id);
  const archived: WorkspaceVersion[] = rows.map((r) => ({
    versionNumber: r.versionNumber,
    createdBy: doc.uploadedByType === "vendor" ? "Vendor" : "Venue",
    createdAt: r.createdAt,
    reason: `Replaced — ${r.fileName}`,
    current: false,
    locked: false,
    representation: "Prior file",
  }));
  return [
    {
      versionNumber: doc.currentVersion || archived.length + 1,
      createdBy: doc.uploadedByType === "vendor" ? "Vendor" : "Venue",
      createdAt: doc.updatedAt,
      reason: "Current file",
      current: true,
      locked: false,
      representation: "File",
    },
    ...archived,
  ];
}

// ── Pinned Documents (Step 2, Section 2) ────────────────────────────────────

export async function getPinnedDocumentKeys(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const venue = await getCurrentVenue();
  if (!venue) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_workspace_pins")
    .select("doc_type, doc_id")
    .eq("venue_id", venue.id);
  if (error) {
    console.error("[getPinnedDocumentKeys]", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => workspaceDocKey(r.doc_type, r.doc_id)));
}

// ── Recent Documents (Step 2, Section 1 — "interacted with", not uploaded) ──

export async function getRecentInteractionMap(limit = 100): Promise<Map<string, string>> {
  if (!isSupabaseConfigured) return new Map();
  const venue = await getCurrentVenue();
  if (!venue) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_workspace_interactions")
    .select("doc_type, doc_id, occurred_at")
    .eq("venue_id", venue.id)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getRecentInteractionMap]", error.message);
    return new Map();
  }
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const key = workspaceDocKey(row.doc_type, row.doc_id);
    if (!map.has(key)) map.set(key, row.occurred_at); // first hit is the most recent — already ordered desc
  }
  return map;
}

// ── Document Activity (Step 2, Section 5) — per-document, for the Preview panel ──
// "Generated"/"Uploaded"/"Edited"/"Shared"/"Signed" come from the producer's
// own real timestamps/status (nothing fabricated); "Viewed"/"Downloaded"
// come from document_workspace_interactions, the only place those are
// tracked (confirmed in Step 1 — no producer logs them).

export async function getDocumentActivity(doc: WorkspaceDocument): Promise<WorkspaceActivityEntry[]> {
  const entries: WorkspaceActivityEntry[] = [];

  entries.push({
    id: `${doc.docType}-created`,
    action: doc.docType === "document" ? "uploaded" : "generated",
    occurredAt: doc.createdAt,
  });
  if (doc.updatedAt && doc.updatedAt !== doc.createdAt) {
    entries.push({ id: `${doc.docType}-updated`, action: "edited", occurredAt: doc.updatedAt });
  }
  if (doc.isCoupleVisible || doc.isVendorVisible) {
    entries.push({ id: `${doc.docType}-shared`, action: "shared", occurredAt: doc.updatedAt });
  }
  if (doc.signedAt) {
    entries.push({ id: `${doc.docType}-signed`, action: "signed", occurredAt: doc.signedAt });
  }

  if (isSupabaseConfigured) {
    const venue = await getCurrentVenue();
    if (venue) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("document_workspace_interactions")
        .select("id, action, occurred_at")
        .eq("venue_id", venue.id)
        .eq("doc_type", doc.docType)
        .eq("doc_id", doc.id)
        .order("occurred_at", { ascending: false })
        .limit(20);
      for (const row of data ?? []) {
        entries.push({ id: row.id, action: row.action as WorkspaceActivityEntry["action"], occurredAt: row.occurred_at });
      }
    }
  }

  return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
