/**
 * Couple portal document viewer — Open opens inline Print/Download chrome,
 * including contracts (PDF) and invoices (print page). Venue DocumentViewer
 * is untouched.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  coupleContractPdfPath,
  coupleDocumentDownloadName,
  coupleDocumentIsPreviewable,
  coupleDocumentViewTarget,
  coupleInvoicePrintPath,
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

describe("coupleDocumentViewTarget", () => {
  it("opens content-only contracts via the portal PDF API", () => {
    const target = coupleDocumentViewTarget({
      id: "c1",
      name: "Venue Rental Agreement",
      docType: "contract",
      fileUrl: null,
      mimeType: null,
    }, "tok");
    assert.deepEqual(target, {
      kind: "pdf",
      id: "c1",
      name: "Venue Rental Agreement",
      src: coupleContractPdfPath("c1", "tok"),
      downloadSrc: `${coupleContractPdfPath("c1", "tok")}&download=1`,
    });
  });

  it("prefers an attached contract file when present", () => {
    const target = coupleDocumentViewTarget({
      id: "c1",
      name: "Signed PDF",
      docType: "contract",
      fileUrl: "/api/portal/documents/c1/file?token=tok",
      mimeType: "application/pdf",
    }, "tok");
    assert.equal(target?.kind, "file");
  });

  it("opens invoices via the portal print page", () => {
    const target = coupleDocumentViewTarget({
      id: "i1",
      name: "Invoice",
      docType: "invoice",
      fileUrl: null,
      mimeType: null,
    }, "tok");
    assert.deepEqual(target, {
      kind: "page",
      id: "i1",
      name: "Invoice",
      src: coupleInvoicePrintPath("i1", "tok"),
    });
  });

  it("requires a file URL for ordinary uploads", () => {
    assert.equal(
      coupleDocumentViewTarget({
        id: "u1",
        name: "COI",
        docType: "insurance",
        fileUrl: null,
        mimeType: null,
      }, "tok"),
      null,
    );
  });
});

describe("portal documents Open uses viewer chrome", () => {
  it("wires Open through CoupleDocumentViewerDialog with Print and Download", () => {
    const section = read("components/portal/couple-documents-section.tsx");
    const viewer = read("components/portal/couple-document-viewer.tsx");
    assert.match(section, /CoupleDocumentViewerDialog/);
    assert.match(section, /onOpenFile=\{setViewerDoc\}/);
    assert.match(section, /coupleDocumentViewTarget/);
    assert.match(section, /data-testid="portal-document-open"/);
    assert.doesNotMatch(
      section,
      /fileUrl && \(\s*<a href=\{doc\.fileUrl\} target="_blank"/,
    );
    assert.match(viewer, /data-testid="portal-document-viewer"/);
    assert.match(viewer, /data-testid="portal-document-viewer-print"/);
    assert.match(viewer, /data-testid="portal-document-viewer-download"/);
    assert.match(viewer, /portal-document-viewer-frame/);
    assert.match(viewer, /kind === "pdf"/);
    assert.match(viewer, /kind === "page"/);
  });

  it("surfaces Open on contracts and invoices without requiring fileUrl", () => {
    const section = read("components/portal/couple-documents-section.tsx");
    assert.match(section, /function ContractCard/);
    assert.match(section, /function InvoiceCard/);
    assert.match(section, /viewTarget && \(/);
    assert.doesNotMatch(
      section.slice(section.indexOf("function ContractCard"), section.indexOf("function InvoiceCard")),
      /doc\.fileUrl && \(/,
    );
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

  it("token-auth portal contract PDF and invoice print paths exist", () => {
    const pdfRoute = read("app/api/portal/contracts/[id]/pdf/route.ts");
    assert.match(pdfRoute, /renderCoupleContractPdf/);
    assert.match(pdfRoute, /missing_token/);
    const printPage = read("app/(portal-print)/portal/invoices/[id]/print/page.tsx");
    assert.match(printPage, /loadCoupleInvoicePrint/);
    assert.match(printPage, /InvoicePrintDocument/);
    const render = read("lib/portal/render-couple-contract-pdf.ts");
    assert.match(render, /is_couple_visible/);
    assert.match(render, /_resolve_portal_ids/);
    const load = read("lib/portal/load-couple-invoice-print.ts");
    assert.match(load, /is_couple_visible/);
    assert.match(load, /_resolve_portal_ids/);
    const proxy = read("integrations/supabase/proxy.ts");
    assert.match(proxy, /"\/portal\/invoices"/);
  });

  it("token-auth portal file route remains the couple file fetch path", () => {
    const route = read("app/api/portal/documents/[id]/file/route.ts");
    assert.match(route, /_resolve_portal_ids/);
    assert.match(route, /canAccessDocumentFile/);
    const list = read("app/api/portal/documents/route.ts");
    assert.match(list, /\/api\/portal\/documents\/\$\{doc\.id\}\/file\?token=/);
  });
});
