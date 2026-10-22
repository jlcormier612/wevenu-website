import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCoupleInsuranceVenueDocumentInsert,
  coupleInsuranceVenueNotes,
  shouldRegisterVenueInsuranceDocument,
  storagePathFromCoupleFileUrl,
} from "./couple-insurance-venue-document";

describe("couple insurance → venue documents registration", () => {
  it("extracts client-media storage path from public URL", () => {
    const url =
      "https://wvpsldwwjqdannqasrdf.supabase.co/storage/v1/object/public/client-media/venue/client/document-1.png";
    assert.equal(
      storagePathFromCoupleFileUrl(url),
      "venue/client/document-1.png",
    );
  });

  it("rejects non client-media URLs", () => {
    assert.equal(
      storagePathFromCoupleFileUrl(
        "https://example.com/storage/v1/object/public/documents/x.pdf",
      ),
      null,
    );
  });

  it("only registers when insurance is shared with venue", () => {
    assert.equal(
      shouldRegisterVenueInsuranceDocument({ sourceType: "insurance", shareWithVenue: true }),
      true,
    );
    assert.equal(
      shouldRegisterVenueInsuranceDocument({ sourceType: "insurance", shareWithVenue: false }),
      false,
    );
    assert.equal(
      shouldRegisterVenueInsuranceDocument({ sourceType: "upload", shareWithVenue: true }),
      false,
    );
  });

  it("builds event-scoped insurance document insert with couple provenance notes", () => {
    const row = buildCoupleInsuranceVenueDocumentInsert({
      venueId: "v1",
      clientId: "c1",
      eventId: "e1",
      coupleDocumentId: "cd1",
      name: "COI",
      fileUrl:
        "https://x.supabase.co/storage/v1/object/public/client-media/v1/c1/coi.pdf",
      fileSize: 12,
      mimeType: "application/pdf",
    });
    assert.ok(row);
    assert.equal(row!.category, "insurance");
    assert.equal(row!.event_id, "e1");
    assert.equal(row!.client_id, null);
    assert.equal(row!.is_couple_visible, false);
    assert.equal(row!.uploaded_by_type, "venue");
    assert.equal(row!.notes, coupleInsuranceVenueNotes("cd1"));
    assert.ok(row!.tags.includes("couple-shared-insurance"));
  });

  it("returns null when storage path cannot be derived", () => {
    assert.equal(
      buildCoupleInsuranceVenueDocumentInsert({
        venueId: "v1",
        clientId: "c1",
        eventId: "e1",
        coupleDocumentId: "cd1",
        name: "COI",
        fileUrl: "https://evil.example/file.pdf",
        fileSize: null,
        mimeType: null,
      }),
      null,
    );
  });
});
