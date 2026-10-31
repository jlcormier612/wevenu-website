/**
 * Documents open the readable document (print page or PDF) with Print and
 * Download on every type — not only the metadata panel.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { generateEventOrderPdf } from "@/lib/event-orders/pdf";
import { extractPdfText } from "@/lib/import/file-parsing";
import type { EventOrderWithDetails } from "@/lib/event-orders/types";
import type { Venue } from "@/lib/venue/types";
import {
  contractWorkingCopyNote,
  documentViewSource,
  eventOrderPdfNote,
} from "@/lib/document-workspace/viewer";

const base = { id: "doc-1", eventId: "ev-1", fileUrl: null, mimeType: null };

describe("documentViewSource", () => {
  it("opens every booking document type as a readable document", () => {
    assert.deepEqual(documentViewSource({ ...base, docType: "invoice" }), { kind: "page", src: "/invoices/doc-1/print" });
    assert.deepEqual(documentViewSource({ ...base, docType: "floor_plan" }), { kind: "page", src: "/events/ev-1/floor-plan-print/doc-1" });
    assert.deepEqual(documentViewSource({ ...base, docType: "questionnaire" }), { kind: "page", src: "/events/ev-1/questionnaire-print/doc-1" });
    assert.deepEqual(documentViewSource({ ...base, docType: "contract" }), {
      kind: "pdf", src: "/api/document-workspace/contract/doc-1/pdf", downloadSrc: "/api/document-workspace/contract/doc-1/pdf?download=1",
    });
    assert.deepEqual(documentViewSource({ ...base, docType: "event_order" }), {
      kind: "pdf", src: "/api/document-workspace/event_order/doc-1/pdf", downloadSrc: "/api/document-workspace/event_order/doc-1/pdf?download=1",
    });
  });

  it("previews uploaded PDFs and images inline; other files download", () => {
    assert.deepEqual(documentViewSource({ ...base, docType: "document", fileUrl: "/api/documents/doc-1/file", mimeType: "application/pdf" }), {
      kind: "file", src: "/api/documents/doc-1/file", previewable: true,
    });
    assert.deepEqual(documentViewSource({ ...base, docType: "document", fileUrl: "/api/documents/doc-1/file", mimeType: "image/jpeg" })?.kind, "file");
    assert.equal(
      (documentViewSource({ ...base, docType: "document", fileUrl: "/f", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) as { previewable: boolean }).previewable,
      false,
    );
    assert.equal(documentViewSource({ ...base, docType: "document" }), null);
  });

  it("vendor sessions only view uploaded files (print pages and PDFs are venue-only)", () => {
    assert.equal(documentViewSource({ ...base, docType: "floor_plan" }, "files"), null);
    assert.equal(documentViewSource({ ...base, docType: "contract" }, "files"), null);
    assert.equal(documentViewSource({ ...base, docType: "document", fileUrl: "/f", mimeType: "application/pdf" }, "files")?.kind, "file");
  });

  it("falls back to the details panel when there is nothing to show", () => {
    assert.equal(documentViewSource({ ...base, docType: "client_choices" }), null);
    assert.equal(documentViewSource({ ...base, eventId: null, docType: "floor_plan" }), null);
  });
});

describe("status notes on viewer PDFs", () => {
  it("marks unsigned contracts as a working copy", () => {
    assert.equal(contractWorkingCopyNote("draft"), "Working copy — not signed yet");
    assert.equal(contractWorkingCopyNote("sent"), "Working copy — not signed yet");
    assert.equal(contractWorkingCopyNote("signed"), null);
  });

  it("says whether the Event Order is a draft and whether the couple has this version", () => {
    assert.equal(eventOrderPdfNote({ status: "open", finalizedAt: null, sharedAt: null }), "Draft — still being edited");
    assert.equal(eventOrderPdfNote({ status: "open", finalizedAt: null, sharedAt: "2026-10-01T00:00:00Z" }), "Draft — still being edited");
    assert.equal(eventOrderPdfNote({ status: "finalized", finalizedAt: "2026-10-01T00:00:00Z", sharedAt: null }), "Final — not yet shared with the couple");
    assert.equal(
      eventOrderPdfNote({ status: "finalized", finalizedAt: "2026-10-05T00:00:00Z", sharedAt: "2026-10-01T00:00:00Z" }),
      "Final — changes not yet shared with the couple",
    );
    assert.equal(
      eventOrderPdfNote({ status: "finalized", finalizedAt: "2026-10-01T00:00:00Z", sharedAt: "2026-10-01T00:05:00Z" }),
      "Final — shared with the couple",
    );
  });
});

describe("Event Order PDF carries the note only when asked", () => {
  const venue = { id: "v", name: "Test Venue", businessName: null, email: null, phone: null, website: null, addressLine1: null, addressLine2: null, logoUrl: null, primaryColor: "#5D6F5D", secondaryColor: "#B8A07E" } as unknown as Venue;
  const eo = {
    id: "eo", venueId: "v", eventId: "e", status: "open", revision: 1, finalizedAt: null, sharedAt: null,
    clientAgreedAt: null, clientAgreedName: null, clientAgreedRevision: null, templateId: null, createdAt: "", updatedAt: "",
    sections: [], lines: [{ id: "l1", sectionId: null, description: "Chicken", quantity: 2, amount: 0, isIncluded: true }], total: 0,
  } as unknown as EventOrderWithDetails;
  const ctx = { eventName: "Test Wedding", eventDate: "2060-05-01", guestCount: 100, spaceName: null, clientName: null };

  it("prints the draft note on the viewer copy", async () => {
    const text = await extractPdfText(await generateEventOrderPdf(eo, venue, { ...ctx, statusNote: "Draft — still being edited" }));
    assert.match(text, /Draft — still being edited/);
    assert.match(text, /Chicken/);
  });

  it("leaves the shared copy unchanged (no note)", async () => {
    const text = await extractPdfText(await generateEventOrderPdf(eo, venue, ctx));
    assert.doesNotMatch(text, /Draft|still being edited/);
  });
});

describe("wiring", () => {
  const card = readFileSync(resolve("components/document-workspace/document-card.tsx"), "utf8");
  const workspace = readFileSync(resolve("components/document-workspace/document-workspace.tsx"), "utf8");
  const layout = readFileSync(resolve("app/(app)/layout.tsx"), "utf8");
  const vendor = readFileSync(resolve("components/vendor-app/vendor-event-workspace.tsx"), "utf8");
  const route = readFileSync(resolve("app/api/document-workspace/[docType]/[id]/pdf/route.ts"), "utf8");

  it("clicking a document title opens the viewer; Details stays available", () => {
    assert.match(card, /onClick=\{handleView\}[^>]*data-testid="workspace-doc-title"/);
    assert.match(card, /aria-label="Details"/);
    assert.match(workspace, /onOpenView=\{openView\}/);
    assert.match(workspace, /if \(!documentViewSource\(doc, viewerScope\)\) \{ openPreview\(doc\); return; \}/);
  });

  it("framed pages drop the shell only after every auth and venue gate", () => {
    const frame = layout.indexOf('"sec-fetch-dest") === "iframe"');
    assert.ok(frame > 0);
    for (const gate of ['redirect("/login")', 'redirect("/select-venue")', 'redirect("/onboarding/intake")', 'redirect("/billing/suspended")']) {
      assert.ok(layout.lastIndexOf(gate) < frame, `${gate} must run before the framed branch`);
    }
  });

  it("PDFs are never stuck behind a load spinner; framed pages hide their own toolbar", () => {
    const viewer = readFileSync(resolve("components/document-workspace/document-viewer.tsx"), "utf8");
    assert.match(viewer, /const waitsForLoad = source\?\.kind === "page";/);
    assert.match(viewer, /\{waitsForLoad && !loaded && \(/);
    assert.match(viewer, /disabled=\{waitsForLoad && !loaded\} data-testid="document-viewer-print"/);
    assert.match(viewer, /\.no-print, \.print\\\\:hidden \{ display: none !important; \}/);
  });

  it("vendor sessions get the files-only viewer", () => {
    assert.match(vendor, /pinningEnabled=\{false\}\s*viewerScope="files"/);
  });

  it("the PDF route only renders contracts and Event Orders, inline unless ?download=1", () => {
    assert.match(route, /docType === "contract" \? await renderContractPdfForViewer\(id\)/);
    assert.match(route, /docType === "event_order" \? await renderEventOrderPdfForViewer\(id\)/);
    assert.match(route, /download \? "attachment" : "inline"/);
  });
});
