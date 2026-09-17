import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  ATTACHMENT_ENTRY_LABEL,
  ATTACHMENT_NO_DOCUMENTS_HINT,
  ATTACHMENT_SOURCE_LABELS,
  ATTACHMENT_SOURCE_ORDER,
} from "@/lib/documents/attachment-source";

/**
 * Attachment source UX: the documents already in Hello to Cheers are the
 * primary source everywhere a venue can attach a file; the computer is the
 * secondary source for something new.
 *
 * The Inbox previously offered "Attach" (computer) beside "From Library"
 * (Hello to Cheers) and left staff to infer that the two words meant two
 * filing cabinets. The three inline attachment fields offered both sources but
 * led with the upload. These tests pin the corrected hierarchy per surface.
 */

const read = (p: string) => readFileSync(resolve(p), "utf8");

const SURFACES = {
  "Inbox composer": "components/conversations/conversation-compose.tsx",
  "Message Template attachments": "components/communication/template-attachments-field.tsx",
  "Planning Template task attachments": "components/playbooks/playbook-builder.tsx",
  "Event timeline attachments": "components/events/timeline/timeline-attachments-field.tsx",
} as const;

/** Inline-field surfaces put both sources in one row; Inbox uses a dialog. */
const INLINE_FIELD_SURFACES = [
  "Message Template attachments",
  "Planning Template task attachments",
  "Event timeline attachments",
] as const;

describe("attachment source vocabulary", () => {
  it("orders documents before the computer", () => {
    assert.deepEqual([...ATTACHMENT_SOURCE_ORDER], ["fromDocuments", "fromComputer"]);
  });

  it("names the primary source after the product area, not the storage", () => {
    assert.equal(ATTACHMENT_SOURCE_LABELS.fromDocuments, "Choose from Documents");
    assert.equal(ATTACHMENT_SOURCE_LABELS.fromComputer, "Upload from computer");
    assert.equal(ATTACHMENT_ENTRY_LABEL, "Add a document");
  });

  it("uses no implementation vocabulary in anything a venue reads", () => {
    const copy = [
      ATTACHMENT_ENTRY_LABEL,
      ATTACHMENT_NO_DOCUMENTS_HINT,
      ...Object.values(ATTACHMENT_SOURCE_LABELS),
    ].join(" ").toLowerCase();
    for (const term of ["bucket", "storage object", "signed url", "delivery bucket", "entity-scoped", "rls"]) {
      assert.ok(!copy.includes(term), `venue-facing copy leaks "${term}"`);
    }
  });
});

describe("Inbox composer — one way in", () => {
  const compose = read(SURFACES["Inbox composer"]);
  const picker = read("components/conversations/library-document-picker.tsx");

  it("no longer offers a separate computer-only Attach button", () => {
    // The old pair was `<Paperclip/> Attach` beside `<FolderOpen/> From Library`.
    assert.doesNotMatch(compose, /<Paperclip className="h-4 w-4" \/> Attach\b/);
    assert.doesNotMatch(compose, /From Library/);
  });

  it("offers a single entry point that opens the document picker", () => {
    const entry = compose.match(/<button[^>]*\n?[\s\S]{0,320}?ATTACHMENT_ENTRY_LABEL[\s\S]{0,40}?<\/button>/)?.[0];
    assert.ok(entry, "expected one attachment entry button using the shared label");
    assert.match(entry, /setLibraryPickerOpen\(true\)/);
    // Exactly one entry point, not two.
    assert.equal(compose.match(/setLibraryPickerOpen\(true\)/g)?.length, 1);
  });

  it("keeps the file input in the composer so the upload path is unchanged", () => {
    assert.match(compose, /ref=\{fileInputRef\}\s*\n\s*type="file"/);
    assert.match(compose, /accept=\{acceptAttributeForChannel\(attachChannel\)\}/);
    assert.match(compose, /onChange=\{handleFilePick\}/);
    // The dialog triggers that same input rather than uploading itself.
    assert.match(compose, /onUploadFromComputer=\{\(\) => fileInputRef\.current\?\.click\(\)\}/);
  });

  it("presents documents as the body and the computer as a footer action", () => {
    const bodyIndex = picker.indexOf("evaluateLibraryAttachmentWithSelection");
    const footerIndex = picker.indexOf("ATTACHMENT_SOURCE_LABELS.fromComputer");
    assert.ok(bodyIndex > 0 && footerIndex > 0);
    assert.ok(bodyIndex < footerIndex, "the computer action must come after the document list");
    // Secondary, not filled.
    const footer = picker.slice(picker.indexOf("<DialogFooter"));
    assert.match(footer, /variant="outline"[\s\S]{0,200}ATTACHMENT_SOURCE_LABELS\.fromComputer/);
  });

  it("still routes every document through D's compatibility rules", () => {
    assert.match(picker, /evaluateLibraryAttachmentWithSelection\(\s*channel,\s*doc,\s*alreadyAttachedBytes,?\s*\)/);
    assert.match(picker, /disabled=\{!check\.attachable\}/);
    assert.match(picker, /\{check\.reason\}/);
    // One picker implementation, and it is D's.
    assert.match(compose, /import \{ LibraryDocumentPicker \} from "@\/components\/conversations\/library-document-picker"/);
  });

  it("still suppresses a duplicate Documents row for a chosen document", () => {
    const service = read("lib/conversations/service.ts");
    assert.match(service, /if \(attached\.ok && !file\.libraryDocumentId\)/);
  });
});

describe("inline attachment fields — documents lead", () => {
  for (const name of INLINE_FIELD_SURFACES) {
    describe(name, () => {
      const src = read(SURFACES[name]);

      it("uses the shared labels rather than its own wording", () => {
        assert.match(src, /ATTACHMENT_SOURCE_LABELS\.fromDocuments/);
        assert.match(src, /ATTACHMENT_SOURCE_LABELS\.fromComputer/);
        assert.doesNotMatch(src, /Use an existing document/);
        assert.doesNotMatch(src, /Upload a file/);
      });

      it("renders the documents action before the upload action", () => {
        const docs = src.indexOf("ATTACHMENT_SOURCE_LABELS.fromDocuments");
        const computer = src.indexOf("ATTACHMENT_SOURCE_LABELS.fromComputer");
        assert.ok(docs > 0 && computer > 0);
        assert.ok(docs < computer, "documents must be offered first");
      });

      it("does not let the upload be the visually dominant action", () => {
        // Upload keeps the bordered treatment; documents gets the filled default.
        const uploadButton = src.match(/<Button[\s\S]{0,400}?ATTACHMENT_SOURCE_LABELS\.fromComputer/);
        assert.ok(uploadButton, "expected an upload button");
        assert.match(uploadButton[0], /variant="outline"/);
        const docsButton = src.match(/<Button[\s\S]{0,300}?ATTACHMENT_SOURCE_LABELS\.fromDocuments/);
        assert.ok(docsButton);
        assert.doesNotMatch(docsButton[0], /variant="outline"/);
      });

      it("keeps its existing upload and registration behavior", () => {
        assert.match(src, /fileRef\.current\?\.click\(\)/);
        assert.match(src, /type="file" accept=\{ACCEPT\}/);
        assert.match(src, /storage\.from\("documents"\)/);
        assert.match(src, /remove\(\[storagePath\]\)/);
      });

      it("still selects an existing document without re-uploading it", () => {
        const fn = src.match(/async function handleAttachExisting\(\)[\s\S]*?\n {2}\}/)?.[0];
        assert.ok(fn, "expected handleAttachExisting");
        // The existing document id goes straight to the link action; no upload.
        assert.match(fn, /existingDocId/);
        assert.doesNotMatch(fn, /storage\.from|\.upload\(/);
      });
    });
  }

  it("does not regress the venue-scoped path fixes committed separately", () => {
    for (const p of [
      "components/communication/template-attachments-field.tsx",
      "components/setup/setup-migration-steps.tsx",
    ]) {
      const src = read(p);
      assert.doesNotMatch(src, /`venue\/\$\{/);
      assert.match(src, /venueDocumentUploadPathAction\(file\.name\)/);
    }
  });
});

describe("surfaces deliberately left alone", () => {
  it("Task Center has no attachment surface to convert", () => {
    const taskCenter = read("components/tasks/task-center.tsx");
    assert.doesNotMatch(taskCenter, /type="file"/);
    assert.doesNotMatch(taskCenter, /attachment/i);
  });

  it("keeps the entity-scoped Documents uploader as an upload-only surface", () => {
    // components/document-workspace/upload-button.tsx puts files INTO Documents;
    // offering "choose from Documents" there would be circular.
    const uploadButton = read("components/document-workspace/upload-button.tsx");
    assert.doesNotMatch(uploadButton, /ATTACHMENT_SOURCE_LABELS/);
    assert.match(uploadButton, /type="file"/);
  });
});
