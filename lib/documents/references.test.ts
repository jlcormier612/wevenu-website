import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  DOCUMENT_REFERENCE_SAFETY,
  describeBlockingReferences,
  planDocumentDeletion,
  type DocumentReferenceCount,
  type DocumentReferenceKind,
} from "@/lib/documents/references";

const ALL_KINDS: DocumentReferenceKind[] = [
  "conversation_attachment",
  "message_template",
  "playbook_task",
  "event_task_context",
  "timeline_entry",
  "floor_plan",
  "floor_plan_template",
  "migration_session",
];

function refs(partial: Partial<Record<DocumentReferenceKind, number>>): DocumentReferenceCount[] {
  return ALL_KINDS.map((kind) => ({ kind, count: partial[kind] ?? 0 }));
}

describe("Library document deletion safety", () => {
  it("covers every relationship that points at public.documents", () => {
    // The nine relationships in the schema: seven FKs, the conversation
    // attachment URL, and document_file_versions (handled as the document's
    // own storage, not an external reference).
    assert.equal(Object.keys(DOCUMENT_REFERENCE_SAFETY).length, ALL_KINDS.length);
    for (const kind of ALL_KINDS) {
      assert.ok(DOCUMENT_REFERENCE_SAFETY[kind], `${kind} needs a safety classification`);
    }
  });

  it("deletes freely when nothing references the document", () => {
    const plan = planDocumentDeletion(refs({}));
    assert.equal(plan.blocked, false);
    assert.equal(plan.retainStorage, false);
    assert.deepEqual(plan.references, []);
  });

  it("keeps the storage object when an already-sent message still points at it", () => {
    const plan = planDocumentDeletion(refs({ conversation_attachment: 1 }));
    // The Library row may go — the venue asked for that, and the message
    // carries its own file_url.
    assert.equal(plan.blocked, false);
    // The file may not.
    assert.equal(plan.retainStorage, true);
  });

  it("refuses deletion while a live venue feature depends on the row", () => {
    for (const kind of ALL_KINDS.filter(
      (k) => DOCUMENT_REFERENCE_SAFETY[k] === "blocks_delete",
    )) {
      const plan = planDocumentDeletion(refs({ [kind]: 1 }));
      assert.equal(plan.blocked, true, `${kind} should block deletion`);
      assert.deepEqual(plan.blocking, [{ kind, count: 1 }]);
    }
  });

  it("does not block on history alone", () => {
    const plan = planDocumentDeletion(refs({ migration_session: 3 }));
    assert.equal(plan.blocked, false);
    assert.equal(plan.retainStorage, false);
  });

  it("does not block merely because some foreign key exists", () => {
    // migration_session is an FK cascade and conversation_attachment has no FK
    // at all; neither is grounds for refusal.
    const plan = planDocumentDeletion(refs({ migration_session: 2, conversation_attachment: 5 }));
    assert.equal(plan.blocked, false);
    assert.equal(plan.retainStorage, true);
  });

  it("blocks and retains together when both kinds are present", () => {
    const plan = planDocumentDeletion(refs({ floor_plan: 1, conversation_attachment: 2 }));
    assert.equal(plan.blocked, true);
    assert.equal(plan.retainStorage, true);
  });

  it("names every blocking reference so the venue knows what to detach", () => {
    assert.equal(
      describeBlockingReferences([{ kind: "message_template", count: 1 }]),
      "1 message template",
    );
    assert.equal(
      describeBlockingReferences([{ kind: "message_template", count: 2 }]),
      "2 message templates",
    );
    assert.equal(
      describeBlockingReferences([
        { kind: "message_template", count: 2 },
        { kind: "floor_plan", count: 1 },
      ]),
      "2 message templates and 1 floor plan",
    );
    assert.equal(
      describeBlockingReferences([
        { kind: "message_template", count: 1 },
        { kind: "timeline_entry", count: 1 },
        { kind: "floor_plan", count: 1 },
      ]),
      "1 message template, 1 timeline entry and 1 floor plan",
    );
  });

  it("reports an unreadable table as referenced rather than as safe", () => {
    const source = readFileSync(resolve("lib/documents/references.ts"), "utf8");
    // An error must not be allowed to read as count 0 — that would authorize
    // destroying a file on the strength of a failed query.
    assert.match(source, /if \(error\) return \{ kind, count: 1 \}/);
    assert.match(source, /if \(error\) return \{ kind: "conversation_attachment", count: 1 \}/);
    assert.doesNotMatch(source, /if \(error\) return \{ kind, count: 0 \}/);
  });
});

describe("document deletion honors reference safety in the service layer", () => {
  const service = readFileSync(resolve("lib/documents/service.ts"), "utf8");

  it("consults the reference plan before removing storage objects", () => {
    assert.match(service, /getVenueDocumentReferences/);
    assert.match(service, /planDocumentDeletion/);
    assert.match(service, /retainStorage/);
  });

  it("leaves the existing documents-bucket guard in place", () => {
    // isDocumentsBucketPath already protects couple-messages uploads; the
    // reference check is added on top of it, not in place of it.
    assert.match(service, /isDocumentsBucketPath/);
  });
});
