import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyContractVersionLineage, normalizeWorkspaceDocument } from "@/lib/document-workspace/normalize";
import {
  EXPERIENCE_STATUS_LABEL,
  describeExperience,
  experienceBadgeLabel,
} from "@/lib/document-workspace/experience";

function baseRow(over: Partial<Parameters<typeof normalizeWorkspaceDocument>[0]> = {}) {
  return {
    docType: "document" as const,
    id: "d1",
    name: "File",
    category: "other",
    status: null,
    currentVersion: 1,
    ownerType: "event" as const,
    leadId: null,
    clientId: "c1",
    eventId: "e1",
    vendorId: null,
    relationshipName: "Alex & Sam",
    eventName: "Saturday Wedding",
    fileUrl: "https://example.supabase.co/storage/v1/object/public/documents/v1/e1/f.pdf",
    fileSize: 10,
    mimeType: "application/pdf",
    isCoupleVisible: false,
    isVendorVisible: false,
    uploadedByType: "venue" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("experience labels", () => {
  it("maps questionnaire review loop to human-facing next actor", () => {
    assert.equal(describeExperience({ docType: "questionnaire", rawStatus: "submitted", eventId: "e1", id: "q1" }).experienceStatus, "review");
    assert.equal(describeExperience({ docType: "questionnaire", rawStatus: "submitted", eventId: "e1", id: "q1" }).nextActionLabel, "Venue to review");
    assert.equal(describeExperience({ docType: "questionnaire", rawStatus: "changes_requested", eventId: "e1", id: "q1", relationshipName: "A & B" }).experienceStatus, "changes_requested");
    assert.equal(describeExperience({ docType: "questionnaire", rawStatus: "resubmitted", eventId: "e1", id: "q1" }).experienceStatus, "review");
    assert.equal(describeExperience({ docType: "questionnaire", rawStatus: "complete", eventId: "e1", id: "q1" }).experienceStatus, "complete");
  });

  it("maps contract sent vs awaiting venue countersignature", () => {
    const awaitingClient = describeExperience({
      docType: "contract", rawStatus: "sent", eventId: "e1", id: "c1",
      requiredClientTotal: 1, requiredClientSigned: 0, venueSigned: false,
    });
    assert.equal(awaitingClient.nextActor, "couple");
    assert.match(awaitingClient.nextActionLabel ?? "", /to sign/);

    const awaitingVenue = describeExperience({
      docType: "contract", rawStatus: "sent", eventId: "e1", id: "c1",
      requiredClientTotal: 1, requiredClientSigned: 1, venueSigned: false,
    });
    assert.equal(awaitingVenue.nextActor, "venue");
    assert.match(awaitingVenue.nextActionLabel ?? "", /countersign/i);
  });

  it("maps with_someone producers to Waiting on Client — never With Someone", () => {
    const cases: Array<{
      docType: Parameters<typeof describeExperience>[0]["docType"];
      rawStatus: string;
      id: string;
    }> = [
      { docType: "questionnaire", rawStatus: "sent", id: "q1" },
      { docType: "contract", rawStatus: "sent", id: "c1" },
      // Event Order producer status that maps to with_someone is "shared" (not a DB "sent").
      { docType: "event_order", rawStatus: "shared", id: "eo1" },
      { docType: "client_choices", rawStatus: "sent", id: "cc1" },
      { docType: "invoice", rawStatus: "sent", id: "i1" },
    ];
    for (const c of cases) {
      const view = describeExperience({
        docType: c.docType,
        rawStatus: c.rawStatus,
        eventId: "e1",
        id: c.id,
        relationshipName: "Lucy & Charlie",
        requiredClientTotal: 1,
        requiredClientSigned: 0,
        venueSigned: false,
      });
      assert.equal(view.experienceStatus, "with_someone", `${c.docType} keeps internal with_someone`);
      assert.equal(
        experienceBadgeLabel(view.experienceStatus, c.docType),
        "Waiting on Client",
        `${c.docType} badge`,
      );
      assert.notEqual(
        experienceBadgeLabel(view.experienceStatus, c.docType),
        "With Someone",
        `${c.docType} must not say With Someone`,
      );
    }
    // Unrelated experience labels and producer→filter mapping stay intact.
    assert.equal(
      describeExperience({ docType: "questionnaire", rawStatus: "sent", eventId: "e1", id: "q1" }).filterStatus,
      "action_needed",
    );
    assert.equal(
      describeExperience({ docType: "questionnaire", rawStatus: "draft", eventId: "e1", id: "q1" }).experienceStatus,
      "draft",
    );
    assert.equal(
      describeExperience({ docType: "questionnaire", rawStatus: "submitted", eventId: "e1", id: "q1" }).experienceStatus,
      "review",
    );
    assert.equal(experienceBadgeLabel("draft"), "Draft");
    assert.equal(experienceBadgeLabel("review"), "Review");
    assert.equal(experienceBadgeLabel("complete"), "Complete");
  });

  it("customer-facing Documents label map never contains With Someone", () => {
    assert.equal(Object.values(EXPERIENCE_STATUS_LABEL).includes("With Someone"), false);
    assert.equal(EXPERIENCE_STATUS_LABEL.with_someone, "Waiting on Client");
  });

  it("maps signed+finalized contracts to Final and keeps companion uploads distinct", () => {
    const signed = describeExperience({ docType: "contract", rawStatus: "signed", eventId: "e1", id: "c1", hasFinalArtifact: true });
    assert.equal(signed.experienceStatus, "final");
    assert.equal(signed.artifactAuthority, "producer_final");
    const companion = normalizeWorkspaceDocument(baseRow({ category: "contract", name: "Scan" }));
    assert.equal(companion.isCompanionUpload, true);
    assert.match(companion.name, /uploaded file/i);
    assert.equal(companion.artifactAuthority, "uploaded_file");
  });

  it("maps event orders to Planning and Final when finalized", () => {
    const open = normalizeWorkspaceDocument(baseRow({
      docType: "event_order",
      name: "Saturday Wedding Event Order",
      category: "event_order",
      status: "open",
      fileUrl: null,
    }));
    assert.equal(open.category, "Planning");
    assert.equal(open.experienceStatus, "in_progress");
    assert.equal(open.nextActionLabel, "Venue to complete");
    const fin = normalizeWorkspaceDocument(baseRow({
      docType: "event_order",
      name: "Saturday Wedding Event Order",
      category: "event_order",
      status: "finalized",
      fileUrl: null,
      hasFinalArtifact: true,
    }));
    assert.equal(fin.experienceStatus, "final");
    assert.equal(fin.producerHref, "/events/e1");
  });
});

describe("workspace file URL rewriting", () => {
  it("rewrites generic document public URLs to the authorized file route", () => {
    const doc = normalizeWorkspaceDocument(baseRow());
    assert.equal(doc.fileUrl, "/api/documents/d1/file");
  });

  it("does not expose floor-plan background files as Documents downloads", () => {
    const plan = normalizeWorkspaceDocument(baseRow({
      docType: "floor_plan",
      name: "Ballroom",
      category: "floor_plan",
      fileUrl: "https://example/background.png",
    }));
    assert.equal(plan.fileUrl, null);
    assert.equal(plan.producerHref, "/events/e1/floor-plans/d1");
  });
});

describe("contract lineage does not treat companion uploads as versions", () => {
  it("leaves companion uploads out of contract version families", () => {
    const docs = [
      normalizeWorkspaceDocument(baseRow({ docType: "contract", id: "a", name: "Agreement", category: "contract", status: "signed", fileUrl: null })),
      normalizeWorkspaceDocument(baseRow({ category: "contract", id: "scan", name: "Scan" })),
    ];
    const enriched = applyContractVersionLineage(docs, [
      { id: "a", title: "Agreement", status: "signed", amendsContractId: null, createdAt: "2026-01-01T00:00:00.000Z", signedAt: "2026-01-02T00:00:00.000Z", finalized: true },
    ]);
    const companion = enriched.find((d) => d.id === "scan")!;
    const contract = enriched.find((d) => d.id === "a")!;
    assert.equal(companion.isCompanionUpload, true);
    assert.equal(companion.versionFamily, undefined);
    assert.equal(contract.hasFinalArtifact, true);
    assert.equal(contract.experienceStatus, "final");
  });
});
