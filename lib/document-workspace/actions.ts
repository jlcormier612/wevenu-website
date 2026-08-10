"use server";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { getDocumentActivity } from "@/lib/document-workspace/service";
import type { WorkspaceActivityAction, WorkspaceActivityEntry, WorkspaceDocType, WorkspaceDocument } from "@/lib/document-workspace/types";

type ActionResult = { ok: true } | { ok: false; message?: string };

async function withVenue<T>(fn: (venueId: string) => Promise<T>): Promise<T | ActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  return fn(venue.id);
}

// Pinned Documents are venue-controlled and manual (Step 2, Section 2) —
// no revalidatePath here on purpose: the caller updates its own local pin
// state optimistically (same pattern DocumentCard already uses for share
// toggles), since a pin can be set from any of the four entry points and
// there's no single page to invalidate.

export async function pinDocumentAction(docType: WorkspaceDocType, docId: string): Promise<ActionResult> {
  const result = await withVenue(async (venueId) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("document_workspace_pins")
      .upsert({ venue_id: venueId, doc_type: docType, doc_id: docId, pinned_by: user?.id ?? null }, { onConflict: "venue_id,doc_type,doc_id" });
    if (error) return { ok: false, message: error.message } as ActionResult;
    return { ok: true } as ActionResult;
  });
  return result as ActionResult;
}

export async function unpinDocumentAction(docType: WorkspaceDocType, docId: string): Promise<ActionResult> {
  const result = await withVenue(async (venueId) => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("document_workspace_pins")
      .delete()
      .eq("venue_id", venueId)
      .eq("doc_type", docType)
      .eq("doc_id", docId);
    if (error) return { ok: false, message: error.message } as ActionResult;
    return { ok: true } as ActionResult;
  });
  return result as ActionResult;
}

export async function recordDocumentInteractionAction(
  docType: WorkspaceDocType,
  docId: string,
  action: WorkspaceActivityAction,
): Promise<ActionResult> {
  if (action !== "viewed" && action !== "downloaded" && action !== "shared") {
    // Only these three are ever written here — the rest are derived from
    // real producer timestamps (see getDocumentActivity), never logged.
    return { ok: true };
  }
  const result = await withVenue(async (venueId) => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("document_workspace_interactions")
      .insert({ venue_id: venueId, doc_type: docType, doc_id: docId, action, actor_user_id: user?.id ?? null });
    if (error) return { ok: false, message: error.message } as ActionResult;
    return { ok: true } as ActionResult;
  });
  return result as ActionResult;
}

export async function getDocumentActivityAction(doc: WorkspaceDocument): Promise<WorkspaceActivityEntry[]> {
  return getDocumentActivity(doc);
}
