/**
 * Canonical object paths for the `documents` storage bucket.
 *
 * The venue id is the load-bearing part, not a tidy-looking prefix. The bucket
 * policies added in 20261370000000_documents_workspace_completion.sql compare
 * the FIRST path segment to current_user_venue_id() on insert, select, update
 * and delete alike:
 *
 *   (storage.foldername(name))[1] = public.current_user_venue_id()::text
 *
 * so any literal prefix — the `venue/` that two uploaders were still using —
 * is rejected outright. It is not a naming preference; the upload fails.
 *
 * Convention: {venue_id}/{entity_type}/{entity_id}/{file}, with "library" in
 * the entity slot when the file belongs to the venue itself rather than to one
 * lead, client, event or vendor. Both callers here save through
 * saveVenueDocument, which is exactly that venue-level case.
 */

/**
 * Extension for the stored object name, matching what every existing uploader
 * in this bucket does. A name with no dot yields the name itself, which is
 * harmless — the object name is a random UUID and the real type travels in the
 * Documents row's mime_type.
 */
export function documentFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "bin";
}

/**
 * Path for a venue-level document — one that outlives any single lead, client,
 * event or vendor. `objectId` is injectable so tests can assert a whole path
 * rather than a prefix; callers should let it default.
 */
export function venueLibraryDocumentPath(
  venueId: string,
  fileName: string,
  objectId: string = crypto.randomUUID(),
): string {
  return `${venueId}/library/${objectId}.${documentFileExtension(fileName)}`;
}

/**
 * Path for a retained migration source file — the CSV or batch ZIP a venue
 * imported from, kept so they can see later what the import was built from.
 *
 * The import session is the entity slot, which is the same shape the rest of
 * the bucket uses: {venue_id}/{entity_type}/{entity_id}/{file}. Two uploads
 * that already work prove this is the house style rather than a new one —
 * `{venue}/migration/active-commitment/…` in proposeActiveCommitmentFromFileAction
 * and `{venue}/floor_plan/{planId}/…` in prepareFloorPlanSourceUpload.
 *
 * Two browser uploaders instead wrote `migration/{sessionId}/…`, on the
 * reasoning that a random session uuid makes the path unguessable. Unguessable
 * is not the property the bucket checks. The policies compare segment one to
 * current_user_venue_id(), so a path beginning `migration` is refused on
 * INSERT and, had anything ever landed there, on SELECT too. The session id is
 * an import grouping, not a security boundary; ownership lives in
 * documents.venue_id and in this first segment.
 */
export function venueMigrationArtifactPath(
  venueId: string,
  sessionId: string,
  fileName: string,
  objectId: string = crypto.randomUUID(),
): string {
  return `${venueId}/migration/${sessionId}/${objectId}.${documentFileExtension(fileName)}`;
}
