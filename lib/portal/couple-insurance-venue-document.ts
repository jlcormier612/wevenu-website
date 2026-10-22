/**
 * Couple shared insurance proof → venue Document Workspace registration.
 *
 * Completion SoT remains couple_documents (source_type=insurance + share).
 * Venue All Documents reads public.documents via get_venue_documents — so a
 * shared insurance commit must also register an event-scoped documents row
 * pointing at the same stored file (no second upload, no private URL leak).
 */

export const COUPLE_INSURANCE_VENUE_TAG = "couple-shared-insurance";

export function storagePathFromCoupleFileUrl(fileUrl: string): string | null {
  try {
    const u = new URL(fileUrl);
    const marker = "/storage/v1/object/public/client-media/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export function coupleInsuranceVenueNotes(coupleDocumentId: string): string {
  return `Couple event insurance proof (couple_document:${coupleDocumentId})`;
}

export function shouldRegisterVenueInsuranceDocument(input: {
  sourceType: string | null | undefined;
  shareWithVenue: boolean;
}): boolean {
  return input.sourceType === "insurance" && input.shareWithVenue === true;
}

export type CoupleInsuranceVenueDocumentInsert = {
  venue_id: string;
  /** Exactly one entity column — prefer event when known (documents_one_entity). */
  client_id?: string | null;
  event_id?: string | null;
  name: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string;
  storage_url: string;
  category: "insurance";
  notes: string;
  tags: string[];
  /**
   * False: couple already sees the upload via couple_documents.
   * Re-exposing the venue mirror with is_couple_visible=true duplicated it
   * under "From your venue" while "Your uploads" still listed the original.
   */
  is_couple_visible: boolean;
  shared_with_vendors: boolean;
  /**
   * DB CHECK allows only venue|vendor. Couple origin is carried by
   * tags + client-media storage_url (see documentFileOriginLabel).
   */
  uploaded_by_type: "venue";
};

export function buildCoupleInsuranceVenueDocumentInsert(input: {
  venueId: string;
  clientId: string;
  eventId: string | null;
  coupleDocumentId: string;
  name: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
}): CoupleInsuranceVenueDocumentInsert | null {
  if (!shouldRegisterVenueInsuranceDocument({ sourceType: "insurance", shareWithVenue: true })) {
    return null;
  }
  const storagePath = storagePathFromCoupleFileUrl(input.fileUrl);
  if (!storagePath) return null;
  const fileName = storagePath.split("/").pop() || "insurance-proof";
  // documents_one_entity: set event_id when available, otherwise client_id only.
  const entity = input.eventId
    ? { event_id: input.eventId, client_id: null as string | null }
    : { event_id: null as string | null, client_id: input.clientId };
  return {
    venue_id: input.venueId,
    ...entity,
    name: input.name.trim() || "Event insurance",
    file_name: fileName,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    storage_path: storagePath,
    storage_url: input.fileUrl,
    category: "insurance",
    notes: coupleInsuranceVenueNotes(input.coupleDocumentId),
    tags: [COUPLE_INSURANCE_VENUE_TAG],
    is_couple_visible: false,
    shared_with_vendors: false,
    uploaded_by_type: "venue",
  };
}
