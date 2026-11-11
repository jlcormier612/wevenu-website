/**
 * Persist / heal venue documents row for a shared couple insurance proof.
 * Idempotent on (venue_id, storage_path). Does not re-fire task triggers.
 */

import type { createClient } from "@/integrations/supabase/server";
import {
  buildCoupleInsuranceVenueDocumentInsert,
  coupleInsuranceVenueNotes,
} from "@/lib/portal/couple-insurance-venue-document";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type EnsureCoupleInsuranceVenueDocumentResult =
  | { ok: true; documentId: string; created: boolean }
  | { ok: false; message: string };

export async function ensureCoupleInsuranceVenueDocument(
  client: DbClient,
  input: {
    venueId: string;
    clientId: string;
    eventId: string | null;
    coupleDocumentId: string;
    name: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
  },
): Promise<EnsureCoupleInsuranceVenueDocumentResult> {
  const row = buildCoupleInsuranceVenueDocumentInsert(input);
  if (!row) {
    return { ok: false, message: "Could not derive venue document from couple insurance file." };
  }

  const { data: byPath } = await client
    .from("documents")
    .select("id, is_couple_visible, tags")
    .eq("venue_id", input.venueId)
    .eq("storage_path", row.storage_path)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; is_couple_visible: boolean; tags: string[] | null }>();
  if (byPath?.id) {
    // Heal presentation: venue mirror must not reappear in portal "From your venue".
    if (byPath.is_couple_visible) {
      await client
        .from("documents")
        .update({ is_couple_visible: false })
        .eq("id", byPath.id)
        .eq("venue_id", input.venueId);
    }
    return { ok: true, documentId: byPath.id, created: false };
  }

  const notes = coupleInsuranceVenueNotes(input.coupleDocumentId);
  const { data: byNotes } = await client
    .from("documents")
    .select("id, is_couple_visible")
    .eq("venue_id", input.venueId)
    .eq("notes", notes)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; is_couple_visible: boolean }>();
  if (byNotes?.id) {
    if (byNotes.is_couple_visible) {
      await client
        .from("documents")
        .update({ is_couple_visible: false })
        .eq("id", byNotes.id)
        .eq("venue_id", input.venueId);
    }
    return { ok: true, documentId: byNotes.id, created: false };
  }

  const { data, error } = await client
    .from("documents")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Insert failed." };
  }
  return { ok: true, documentId: data.id, created: true };
}

/** Heal shared couple insurance proofs missing from venue documents (read-path safe, idempotent). */
export async function healSharedCoupleInsuranceVenueDocuments(
  client: DbClient,
  venueId: string,
  clientId: string,
  eventId: string | null,
): Promise<{ healed: number; errors: string[] }> {
  const { data: rows, error } = await client
    .from("couple_documents")
    .select("id, name, file_url, file_size, mime_type, source_type, share_with_venue")
    .eq("client_id", clientId)
    .eq("source_type", "insurance")
    .eq("share_with_venue", true);
  if (error) return { healed: 0, errors: [error.message] };

  let healed = 0;
  const errors: string[] = [];
  for (const cd of rows ?? []) {
    const result = await ensureCoupleInsuranceVenueDocument(client, {
      venueId,
      clientId,
      eventId,
      coupleDocumentId: cd.id,
      name: cd.name,
      fileUrl: cd.file_url,
      fileSize: cd.file_size,
      mimeType: cd.mime_type,
    });
    if (!result.ok) errors.push(result.message);
    else if (result.created) healed += 1;
  }
  return { healed, errors };
}
