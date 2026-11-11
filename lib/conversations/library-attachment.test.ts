/**
 * Attaching a Library Document to a conversation message.
 *
 * The rules worth pinning are the ones where the Library and the channel
 * disagree: a 12 MB PDF is a fine Library document and an impossible text, and
 * the venue has to be told which of those it is looking at.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";

import {
  describeLibraryDocument,
  evaluateLibraryAttachment,
  evaluateLibraryAttachmentWithSelection,
  type LibraryAttachmentCandidate,
} from "@/lib/conversations/library-attachment";
import { SMS_MMS_MAX_BYTES } from "@/lib/conversations/attachment-constraints";

const MB = 1024 * 1024;

function doc(over: Partial<LibraryAttachmentCandidate> = {}): LibraryAttachmentCandidate {
  return {
    id: "doc-1",
    name: "Rain plan",
    fileName: "rain-plan.pdf",
    fileSize: 2 * MB,
    mimeType: "application/pdf",
    ...over,
  };
}

describe("per-document channel compatibility", () => {
  it("accepts a small PDF on every channel the composer offers", () => {
    for (const channel of ["email", "sms", "portal", "internal_note"] as const) {
      assert.equal(evaluateLibraryAttachment(channel, doc()).attachable, true, channel);
    }
  });

  it("refuses a Library type that conversation storage does not accept", () => {
    // .zip is inside the Library's broader set and outside the conversation one.
    const result = evaluateLibraryAttachment("email", doc({ mimeType: "application/zip" }));
    assert.equal(result.attachable, false);
    assert.match(result.attachable === false ? result.reason : "", /can’t be sent as an email/);
  });

  it("refuses a Word document on text while allowing it on email", () => {
    const word = doc({
      fileName: "menu.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert.equal(evaluateLibraryAttachment("email", word).attachable, true);
    const sms = evaluateLibraryAttachment("sms", word);
    assert.equal(sms.attachable, false);
    assert.match(sms.attachable === false ? sms.reason : "", /text/i);
  });

  it("refuses a file that clears the Library's 25MB but not conversation storage's 20MB", () => {
    const big = doc({ fileSize: 23 * MB });
    const result = evaluateLibraryAttachment("email", big);
    assert.equal(result.attachable, false);
    assert.match(result.attachable === false ? result.reason : "", /23 MB.*20 MB/);
  });

  it("refuses an 8MB PDF on text and names the real number", () => {
    const result = evaluateLibraryAttachment("sms", doc({ fileSize: 8 * MB }));
    assert.equal(result.attachable, false);
    assert.match(result.attachable === false ? result.reason : "", /8\.0 MB.*5\.0 MB/);
  });

  it("refuses a document with no recorded type rather than guessing one", () => {
    const result = evaluateLibraryAttachment("email", doc({ mimeType: null }));
    assert.equal(result.attachable, false);
    assert.match(result.attachable === false ? result.reason : "", /no recorded file type/);
  });
});

describe("running total against what is already attached", () => {
  it("blocks a second 3MB file on text because the pair exceeds 5MB", () => {
    const result = evaluateLibraryAttachmentWithSelection("sms", doc({ fileSize: 3 * MB }), 3 * MB);
    assert.equal(result.attachable, false);
    assert.match(result.attachable === false ? result.reason : "", /over 5\.0 MB/);
  });

  it("allows the same pair on email, which has no combined cap under 20MB", () => {
    const result = evaluateLibraryAttachmentWithSelection("email", doc({ fileSize: 3 * MB }), 3 * MB);
    assert.equal(result.attachable, true);
  });

  it("allows a text attachment that exactly reaches the limit", () => {
    const result = evaluateLibraryAttachmentWithSelection(
      "sms",
      doc({ fileSize: SMS_MMS_MAX_BYTES - MB }),
      MB,
    );
    assert.equal(result.attachable, true);
  });

  it("still reports the per-file reason ahead of the total", () => {
    const result = evaluateLibraryAttachmentWithSelection(
      "sms",
      doc({ mimeType: "application/zip" }),
      4 * MB,
    );
    assert.equal(result.attachable, false);
    assert.match(result.attachable === false ? result.reason : "", /file type/);
  });
});

describe("what the picker shows to tell two documents apart", () => {
  it("reads as type and size", () => {
    assert.equal(describeLibraryDocument(doc()), "PDF · 2.0 MB");
  });

  it("says so rather than showing 0 when size is missing", () => {
    assert.match(describeLibraryDocument(doc({ fileSize: null })), /size unknown/);
  });
});

describe("the invariants D must not break", () => {
  const service = fs.readFileSync("lib/conversations/service.ts", "utf8");
  const route = fs.readFileSync("app/api/conversations/attach-document/route.ts", "utf8");
  const composer = fs.readFileSync("components/conversations/conversation-compose.tsx", "utf8");

  it("skips entity-scoped Documents registration for a Library-sourced attachment", () => {
    assert.match(service, /attached\.ok && !file\.libraryDocumentId/);
  });

  it("still registers a Documents row for a plain upload", () => {
    // The guard must be the library flag alone — not a blanket removal.
    assert.match(service, /registerMessageAttachmentAsDocument/);
  });

  it("copies into the public delivery bucket instead of linking the private one", () => {
    assert.match(route, /const DELIVERY_BUCKET = "couple-messages"/);
    assert.match(route, /const DOCUMENTS_BUCKET = "documents"/);
    assert.match(route, /getPublicUrl/);
  });

  it("attaches only venue-scoped Library documents, never an entity's file", () => {
    assert.match(route, /doc\.lead_id \|\| doc\.client_id \|\| doc\.event_id \|\| doc\.vendor_id/);
    assert.match(route, /doc\.venue_id !== venue\.id/);
    assert.match(route, /conversation\.venue_id !== venue\.id/);
  });

  it("lists Library documents without filtering out the incompatible ones", () => {
    // The picker has to show and explain them, so the endpoint must not filter.
    assert.match(route, /\.is\("lead_id", null\)/);
    assert.doesNotMatch(route, /mime_type.*in\.\(/);
  });

  it("weighs uploads and Library picks together for the text total", () => {
    assert.match(composer, /stagedAttachments/);
    assert.match(composer, /validateAttachmentsForChannel\(attachChannel, stagedAttachments\)/);
  });

  it("clears Library picks after a send and when switching to a note", () => {
    const clears = composer.match(/setPendingLibraryDocs\(\[\]\)/g) ?? [];
    assert.ok(clears.length >= 3, `expected send + mode switch + revalidate, saw ${clears.length}`);
  });
});
