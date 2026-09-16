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
    assert.match(actions, /Detach it there first/);
    assert.match(manager, /state: "blocked"/);
    assert.match(manager, /Can&rsquo;t delete/);
  });

  it("says so when a sent message will keep its copy", () => {
    assert.match(manager, /Messages you already sent keep their copy/);
  });

  it("removes the uploaded object when the row fails to save", () => {
    const upload = manager.match(/async function handleUpload[\s\S]*?\n {2}\}/)?.[0] ?? "";
    assert.match(upload, /if \(!saved\.ok\)/);
    assert.match(upload, /storage\.from\("documents"\)\.remove\(\[storagePath\]\)/);
  });
});
