/**
 * Couple portal document viewer — Open opens inline Print/Download chrome,
 * not a bare target=_blank tab. Venue DocumentViewer is untouched.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  coupleDocumentDownloadName,
  coupleDocumentIsPreviewable,
} from "@/lib/portal/couple-document-viewer";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("coupleDocumentIsPreviewable", () => {
  it("treats PDF / image / plain text mime as previewable", () => {
    assert.equal(coupleDocumentIsPreviewable("application/pdf", "/x"), true);
    assert.equal(coupleDocumentIsPreviewable("image/png", "/x"), true);
    assert.equal(coupleDocumentIsPreviewable("text/plain", "/x"), true);
    assert.equal(coupleDocumentIsPreviewable("application/zip", "/x.zip"), false);
  });

  it("infers from file extension when mime is missing", () => {
    assert.equal(
      coupleDocumentIsPreviewable(null, "/api/portal/documents/1/file?token=t"),
      false,
    );
    assert.equal(
      coupleDocumentIsPreviewable(null, "/api/portal/documents/1/file.pdf?token=t"),
      true,
    );
    assert.equal(
      coupleDocumentIsPreviewable(null, "https://cdn.example/coi.PDF"),
      true,
    );
    assert.equal(
      coupleDocumentIsPreviewable(null, "https://cdn.example/notes.docx"),
      false,
    );
  });
});

describe("coupleDocumentDownloadName", () => {
  it("keeps an existing extension and adds .pdf for PDF mime", () => {
    assert.equal(
      coupleDocumentDownloadName({
        name: "COI.pdf",
        mimeType: "application/pdf",
        fileUrl: "/x",
      }),
      "COI.pdf",
    );
    assert.equal(
      coupleDocumentDownloadName({
        name: "Insurance certificate",
        mimeType: "application/pdf",
        fileUrl: "/x",
      }),
      "Insurance certificate.pdf",
    );
  });
});

describe("portal documents Open uses viewer chrome", () => {
  it("wires Open through CoupleDocumentViewerDialog with Print and Download", () => {
    const section = read("components/portal/couple-documents-section.tsx");
    const viewer = read("components/portal/couple-document-viewer.tsx");
    assert.match(section, /CoupleDocumentViewerDialog/);
    assert.match(section, /onOpenFile=\{setViewerDoc\}/);
    assert.match(section, /data-testid="portal-document-open"/);
    assert.doesNotMatch(
      section,
      /fileUrl && \(\s*<a href=\{doc\.fileUrl\} target="_blank"/,
    );
    assert.match(viewer, /data-testid="portal-document-viewer"/);
    assert.match(viewer, /data-testid="portal-document-viewer-print"/);
    assert.match(viewer, /data-testid="portal-document-viewer-download"/);
    assert.match(viewer, /portal-document-viewer-frame/);
  });

  it("keeps Review & sign as an external sign link", () => {
    const section = read("components/portal/couple-documents-section.tsx");
    assert.match(section, /href=\{`\/sign\/\$\{doc\.signToken\}`\}/);
    assert.match(section, /Review &amp; sign/);
  });

  it("does not change venue DocumentViewerDialog", () => {
    const venue = read("components/document-workspace/document-viewer.tsx");
    assert.match(venue, /export function DocumentViewerDialog/);
    assert.match(venue, /data-testid="document-viewer"/);
    assert.doesNotMatch(venue, /portal-document-viewer/);
  });

  it("token-auth portal file route remains the couple file fetch path", () => {
    const route = read("app/api/portal/documents/[id]/file/route.ts");
    assert.match(route, /_resolve_portal_ids/);
    assert.match(route, /canAccessDocumentFile/);
    const list = read("app/api/portal/documents/route.ts");
    assert.match(list, /\/api\/portal\/documents\/\$\{doc\.id\}\/file\?token=/);
  });
});
