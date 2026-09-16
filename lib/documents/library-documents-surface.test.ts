import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Library Documents surface", () => {
  const manager = readFileSync(
    resolve("components/library/library-documents-manager.tsx"),
    "utf8",
  );
  const actions = readFileSync(resolve("app/(app)/library/documents/actions.ts"), "utf8");
  const page = readFileSync(resolve("app/(app)/library/documents/page.tsx"), "utf8");

  it("serves files through the venue-authorized route, not the stored public URL", () => {
    // The documents bucket is private: getPublicUrl produces a dead link, and
    // linking straight to storage would also skip the venue access check.
    assert.match(manager, /venueFileHref\(doc\.id\)/);
    assert.doesNotMatch(manager, /href=\{doc\.storageUrl\}/);
  });

  it("offers the V1 actions", () => {
    assert.match(manager, /Add document/);
    assert.match(manager, /Preview/);
    assert.match(manager, /Download/);
    assert.match(manager, /Rename/);
    assert.match(manager, /Delete/);
    assert.match(manager, /Search documents by name/);
  });

  it("has an empty state and a distinct no-search-matches state", () => {
    assert.match(manager, /No documents yet/);
    assert.match(manager, /No matches/);
  });

  it("lists venue-level documents only", () => {
    assert.match(page, /getVenueDocuments/);
  });

  it("keeps a Library document venue-unscoped when saving", () => {
    // No entityType/entityId may reach saveVenueDocument, or the asset stops
    // being reusable and starts belonging to one booking.
    assert.match(actions, /saveVenueDocument\(\{/);
    const saveCall = actions.match(/saveVenueDocument\(\{[\s\S]*?\}\)/)?.[0] ?? "";
    assert.ok(saveCall.length > 0);
    assert.doesNotMatch(saveCall, /entityType/);
    assert.doesNotMatch(saveCall, /entityId/);
  });

  it("refuses to act on entity-scoped documents", () => {
    // findVenueDocument pins all four entity keys to null, so a Library action
    // cannot rename or delete a lead/client/event/vendor file.
    assert.match(actions, /findVenueDocument/);
    const repo = readFileSync(resolve("lib/documents/repository.ts"), "utf8");
    const fn = repo.match(/export async function findVenueDocument[\s\S]*?\n\}/)?.[0] ?? "";
    assert.match(fn, /\.is\("lead_id", null\)/);
    assert.match(fn, /\.is\("client_id", null\)/);
    assert.match(fn, /\.is\("event_id", null\)/);
    assert.match(fn, /\.is\("vendor_id", null\)/);
  });

  it("re-checks deletion safety on the server rather than trusting the dialog", () => {
    const del = actions.match(/export async function deleteLibraryDocumentAction[\s\S]*?\n\}/)?.[0] ?? "";
    assert.match(del, /getLibraryDocumentDeletionInfoAction/);
    assert.match(del, /if \(info\.blocked\)/);
  });

  it("tells the venue what to detach instead of failing silently", () => {
    assert.match(actions, /describeBlockingReferences/);
    assert.match(manager, /Detach it there first/);
    assert.match(manager, /Can&rsquo;t delete this yet/);
    // Shown against the document itself, and persistent — not a toast that
    // disappears before it has been read.
    assert.match(manager, /blocked\?\.documentId === doc\.id/);
    assert.match(manager, /role="alert"/);
  });

  it("phrases the refusal so it reads correctly for one or many references", () => {
    // "1 floor plan template still use this" was the bug; subject-first fixes
    // singular and plural at once.
    assert.match(actions, /Still needed by \$\{describeBlockingReferences/);
    assert.doesNotMatch(actions, /\} still use this document/);
  });

  it("says so when a sent message will keep its copy", () => {
    assert.match(manager, /Messages you already sent keep their copy/);
  });

  it("removes the uploaded object when the row fails to save", () => {
    const upload = manager.match(/async function handleUpload[\s\S]*?\n {2}\}/)?.[0] ?? "";
    assert.match(upload, /if \(!saved\.ok\)/);
    assert.match(upload, /storage\.from\("documents"\)\.remove\(\[storagePath\]\)/);
  });

  it("uploads under {venue_id}/ so the bucket policies permit it", () => {
    // Found in Sandbox: a literal `venue/` prefix is rejected outright. The
    // documents policies compare (storage.foldername(name))[1] against
    // current_user_venue_id(), so uploads AND deletes both 403 on any path that
    // does not start with the venue's own id.
    assert.match(manager, /\$\{venueId\}\/library\//);
    assert.doesNotMatch(manager, /storagePath = `venue\//);
    // The id has to reach the component for that path to be constructible.
    assert.match(page, /venueId=\{venue\.id\}/);
  });

  it("deletes the storage object with a client that storage actually accepts", () => {
    // Found in Sandbox: deleteDocument ran the removal through the *browser*
    // client, which has no session server-side, so storage returned 403
    // AccessDenied for every delete. The error was never read, so the row
    // vanished and the file stayed in the bucket — still fetchable by path.
    const service = readFileSync(resolve("lib/documents/service.ts"), "utf8");
    const del = service.match(/export async function deleteDocument[\s\S]*?\n\}/)?.[0] ?? "";
    assert.ok(del.length > 0);
    assert.match(del, /await c\.storage\.from\("documents"\)\.remove\(paths\)/);
    // The failure must surface instead of leaving a phantom deletion behind.
    assert.match(del, /if \(error\) throw error/);
    assert.doesNotMatch(del, /browser\.storage/);
    assert.doesNotMatch(service, /supabase\/client/);
  });
});
