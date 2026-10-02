import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countUserFacingGroups,
  filterByUserFacingGroup,
  populatedUserFacingGroups,
  toUserFacingDocumentGroup,
  USER_FACING_DOCUMENT_GROUPS,
} from "@/lib/document-workspace/user-facing-categories";
import { WORKSPACE_CATEGORIES, type WorkspaceCategory, type WorkspaceDocument } from "@/lib/document-workspace/types";

function stub(category: WorkspaceCategory, id = category): WorkspaceDocument {
  return {
    docType: "document",
    id,
    name: id,
    category,
    rawStatus: null,
    status: "none",
    currentVersion: 1,
    ownerType: "lead",
    leadId: "l1",
    clientId: null,
    eventId: null,
    vendorId: null,
    relationshipName: null,
    eventName: null,
    fileUrl: null,
    fileSize: null,
    mimeType: null,
    isCoupleVisible: false,
    isVendorVisible: false,
    uploadedByType: "venue",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("user-facing document category roll-up", () => {
  it("maps every WorkspaceCategory to exactly one user-facing group", () => {
    const seen = new Set<string>();
    for (const cat of WORKSPACE_CATEGORIES) {
      const group = toUserFacingDocumentGroup(cat);
      assert.ok(USER_FACING_DOCUMENT_GROUPS.includes(group), `${cat} → ${group}`);
      seen.add(cat);
    }
    assert.equal(seen.size, WORKSPACE_CATEGORIES.length);
  });

  it("maps Contracts → Contracts", () => {
    assert.equal(toUserFacingDocumentGroup("Contracts"), "Contracts");
  });

  it("maps Invoices and Financial → Financial", () => {
    assert.equal(toUserFacingDocumentGroup("Invoices"), "Financial");
    assert.equal(toUserFacingDocumentGroup("Financial"), "Financial");
  });

  it("maps planning-related types → Planning", () => {
    assert.equal(toUserFacingDocumentGroup("Questionnaires"), "Planning");
    assert.equal(toUserFacingDocumentGroup("Planning"), "Planning");
    assert.equal(toUserFacingDocumentGroup("Floor Plans"), "Planning");
    assert.equal(toUserFacingDocumentGroup("Wedding Website"), "Planning");
    assert.equal(toUserFacingDocumentGroup("Photos"), "Planning");
  });

  it("maps Vendor Documents → Vendors", () => {
    assert.equal(toUserFacingDocumentGroup("Vendor Documents"), "Vendors");
  });

  it("maps Communication, Exports, Other → Other", () => {
    assert.equal(toUserFacingDocumentGroup("Communication"), "Other");
    assert.equal(toUserFacingDocumentGroup("Exports"), "Other");
    assert.equal(toUserFacingDocumentGroup("Other"), "Other");
  });

  it("All / filterByUserFacingGroup returns every document for all", () => {
    const docs = [
      stub("Contracts", "c1"),
      stub("Invoices", "i1"),
      stub("Questionnaires", "q1"),
      stub("Floor Plans", "f1"),
    ];
    assert.equal(filterByUserFacingGroup(docs, "all").length, 4);
  });

  it("filters by rolled-up group without losing documents from All", () => {
    const docs = [
      stub("Contracts", "c1"),
      stub("Invoices", "i1"),
      stub("Invoices", "i2"),
      stub("Questionnaires", "q1"),
      stub("Floor Plans", "f1"),
      stub("Vendor Documents", "v1"),
      stub("Exports", "e1"),
    ];
    assert.equal(filterByUserFacingGroup(docs, "all").length, 7);
    assert.equal(filterByUserFacingGroup(docs, "Contracts").length, 1);
    assert.equal(filterByUserFacingGroup(docs, "Financial").length, 2);
    assert.equal(filterByUserFacingGroup(docs, "Planning").length, 2);
    assert.equal(filterByUserFacingGroup(docs, "Vendors").length, 1);
    assert.equal(filterByUserFacingGroup(docs, "Other").length, 1);
  });

  it("hides empty categories from populatedUserFacingGroups", () => {
    const docs = [
      stub("Contracts", "c1"),
      stub("Invoices", "i1"),
      stub("Invoices", "i2"),
      stub("Questionnaires", "q1"),
      stub("Floor Plans", "f1"),
    ];
    assert.deepEqual(populatedUserFacingGroups(docs), [
      "Contracts",
      "Financial",
      "Planning",
    ]);
    const counts = countUserFacingGroups(docs);
    assert.equal(counts.get("Contracts"), 1);
    assert.equal(counts.get("Financial"), 2);
    assert.equal(counts.get("Planning"), 2);
    assert.equal(counts.get("Vendors"), 0);
    assert.equal(counts.get("Other"), 0);
  });

  it("no document is lost from All because of grouping", () => {
    const docs = WORKSPACE_CATEGORIES.map((c, i) => stub(c, `d${i}`));
    const all = filterByUserFacingGroup(docs, "all");
    assert.equal(all.length, WORKSPACE_CATEGORIES.length);
    const partitioned = USER_FACING_DOCUMENT_GROUPS.flatMap((g) =>
      filterByUserFacingGroup(docs, g),
    );
    assert.equal(partitioned.length, all.length);
    assert.deepEqual(
      new Set(partitioned.map((d) => d.id)),
      new Set(all.map((d) => d.id)),
    );
  });
});
