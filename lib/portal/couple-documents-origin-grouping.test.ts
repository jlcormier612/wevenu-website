import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCoupleInsuranceVenueDocumentInsert,
  COUPLE_INSURANCE_VENUE_TAG,
} from "./couple-insurance-venue-document";
import { documentFileOriginLabel } from "@/lib/documents/access";
import { normalizeWorkspaceDocument } from "@/lib/document-workspace/normalize";

type PortalDoc = {
  id: string;
  docType: string;
  uploadedBy: "couple" | "venue" | "vendor";
  name: string;
};

/** Mirrors couple-documents-section group filters (origin-based bands). */
function groupPortalDocuments(documents: PortalDoc[]) {
  return {
    venueShared: documents.filter((d) => d.uploadedBy === "venue" && d.docType !== "contract" && d.docType !== "invoice"),
    vendorShared: documents.filter((d) => d.uploadedBy === "vendor" && d.docType !== "contract" && d.docType !== "invoice"),
    coupleUploaded: documents.filter((d) => d.uploadedBy === "couple"),
  };
}

describe("couple document origin grouping", () => {
  it("keeps couple insurance upload only under Your uploads when venue mirror is not couple-visible", () => {
    const coupleUpload: PortalDoc = {
      id: "cd-1",
      docType: "insurance",
      uploadedBy: "couple",
      name: "COI",
    };
    // Venue mirror must NOT appear in get_couple_documents when is_couple_visible=false
    const groups = groupPortalDocuments([coupleUpload]);
    assert.equal(groups.coupleUploaded.length, 1);
    assert.equal(groups.venueShared.length, 0);
    assert.deepEqual(groups.coupleUploaded.map((d) => d.id), ["cd-1"]);
  });

  it("does not duplicate the same logical insurance across origin groups", () => {
    const badDuplicate: PortalDoc[] = [
      { id: "cd-1", docType: "insurance", uploadedBy: "couple", name: "COI" },
      { id: "doc-venue-mirror", docType: "insurance", uploadedBy: "venue", name: "COI" },
    ];
    const groups = groupPortalDocuments(badDuplicate);
    // Regression guard: if both appear, UI would show two bands — registration must prevent that.
    assert.equal(groups.coupleUploaded.length + groups.venueShared.length, 2);
    const insert = buildCoupleInsuranceVenueDocumentInsert({
      venueId: "v1",
      clientId: "c1",
      eventId: "e1",
      coupleDocumentId: "cd-1",
      name: "COI",
      fileUrl: "https://x.supabase.co/storage/v1/object/public/client-media/v1/c1/coi.pdf",
      fileSize: 1,
      mimeType: "application/pdf",
    });
    assert.equal(insert!.is_couple_visible, false);
    assert.ok(insert!.tags.includes(COUPLE_INSURANCE_VENUE_TAG));
  });

  it("preserves genuine venue-originated shared docs in From your venue", () => {
    const docs: PortalDoc[] = [
      { id: "v-1", docType: "brochure", uploadedBy: "venue", name: "Welcome packet" },
      { id: "cd-1", docType: "upload", uploadedBy: "couple", name: "Mood board" },
    ];
    const groups = groupPortalDocuments(docs);
    assert.deepEqual(groups.venueShared.map((d) => d.id), ["v-1"]);
    assert.deepEqual(groups.coupleUploaded.map((d) => d.id), ["cd-1"]);
  });

  it("workspace Owner label is Client for client-media insurance mirrors", () => {
    const doc = normalizeWorkspaceDocument({
      docType: "document",
      id: "404fd5eb",
      name: "Event insurance",
      category: "insurance",
      status: null,
      currentVersion: 1,
      ownerType: "event",
      leadId: null,
      clientId: null,
      eventId: "e1",
      vendorId: null,
      relationshipName: "Bindi & Jake",
      eventName: "Wedding",
      fileUrl: "https://x.supabase.co/storage/v1/object/public/client-media/v/c/coi.png",
      fileSize: 10,
      mimeType: "image/png",
      isCoupleVisible: false,
      isVendorVisible: false,
      uploadedByType: "venue",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    assert.equal(doc.originLabel, "Client");
    assert.equal(
      documentFileOriginLabel({ uploadedByType: doc.uploadedByType, storageUrl: "https://x/object/public/client-media/x" }),
      "Client",
    );
  });

  it("document preview no longer shows Comments Coming soon", () => {
    const src = readFileSync(resolve("components/document-workspace/document-preview.tsx"), "utf8");
    assert.doesNotMatch(src, /Coming soon/);
    assert.doesNotMatch(src, />Comments</);
  });

  it("client-origin sharing label uses documentSharingDirectionLabel", () => {
    const src = readFileSync(resolve("components/document-workspace/document-preview.tsx"), "utf8");
    assert.match(src, /documentSharingDirectionLabel/);
  });

  it("ensure heal clears is_couple_visible on existing mirrors", () => {
    const src = readFileSync(resolve("lib/portal/ensure-couple-insurance-venue-document.ts"), "utf8");
    assert.match(src, /is_couple_visible: false/);
    assert.match(src, /update\(\{ is_couple_visible: false \}\)/);
  });
});
