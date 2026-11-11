import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { EXPERIENCE_STATUS_LABEL, experienceBadgeLabel } from "@/lib/document-workspace/experience";
import { normalizeWorkspaceDocument } from "@/lib/document-workspace/normalize";
import {
  applyQuestionnaireWorkspaceNames,
  questionnaireWorkspaceDocumentName,
} from "@/lib/document-workspace/questionnaire-names";
import { kindLabel } from "@/lib/questionnaire-family/definitions";

const root = process.cwd();
const latestDocsMigration = readFileSync(
  join(root, "supabase/migrations/20261411700000_venue_documents_questionnaire_kind_names.sql"),
  "utf8",
);
const service = readFileSync(join(root, "lib/document-workspace/service.ts"), "utf8");

describe("questionnaire Documents titles by kind", () => {
  it("reuses questionnaire-family kindLabel — no second dictionary", () => {
    assert.equal(
      questionnaireWorkspaceDocumentName("client_planning"),
      kindLabel("client_planning"),
    );
    assert.equal(
      questionnaireWorkspaceDocumentName("final_details"),
      kindLabel("final_details"),
    );
    assert.equal(
      questionnaireWorkspaceDocumentName("post_event_feedback"),
      kindLabel("post_event_feedback"),
    );
    assert.equal(
      questionnaireWorkspaceDocumentName("client_planning"),
      "Client Planning Questionnaire",
    );
    assert.equal(questionnaireWorkspaceDocumentName("final_details"), "Final Details");
    assert.equal(
      questionnaireWorkspaceDocumentName("post_event_feedback"),
      "Post-Event Feedback",
    );
  });

  it("three kinds no longer all render Final Details Questionnaire", () => {
    const names = [
      questionnaireWorkspaceDocumentName("client_planning"),
      questionnaireWorkspaceDocumentName("final_details"),
      questionnaireWorkspaceDocumentName("post_event_feedback"),
    ];
    assert.equal(new Set(names).size, 3);
    assert.ok(!names.every((n) => n === "Final Details Questionnaire"));
    assert.ok(names.includes("Client Planning Questionnaire"));
    assert.ok(names.includes("Final Details"));
    assert.ok(names.includes("Post-Event Feedback"));
  });

  it("applyQuestionnaireWorkspaceNames overlays kind titles and leaves other docs alone", () => {
    const rows = applyQuestionnaireWorkspaceNames(
      [
        {
          docType: "questionnaire",
          id: "q-cp",
          name: "Final Details Questionnaire",
          status: "sent",
        },
        {
          docType: "questionnaire",
          id: "q-fd",
          name: "Final Details Questionnaire",
          status: "sent",
        },
        {
          docType: "questionnaire",
          id: "q-pe",
          name: "Final Details Questionnaire",
          status: "sent",
        },
        {
          docType: "invoice",
          id: "i1",
          name: "Deposit Invoice",
          status: "sent",
        },
      ],
      new Map([
        ["q-cp", "client_planning"],
        ["q-fd", "final_details"],
        ["q-pe", "post_event_feedback"],
      ]),
    );
    assert.equal(rows[0].name, "Client Planning Questionnaire");
    assert.equal(rows[1].name, "Final Details");
    assert.equal(rows[2].name, "Post-Event Feedback");
    assert.equal(rows[3].name, "Deposit Invoice");
    assert.equal(rows[0].status, "sent");
    assert.equal(rows[1].status, "sent");
  });

  it("normalize keeps producer status and Waiting on Client badge for sent questionnaires", () => {
    const named = applyQuestionnaireWorkspaceNames(
      [{
        docType: "questionnaire" as const,
        id: "q1",
        name: "Final Details Questionnaire",
        category: "questionnaire",
        status: "sent",
        currentVersion: 1,
        ownerType: "event" as const,
        leadId: null,
        clientId: "c1",
        eventId: "e1",
        vendorId: null,
        relationshipName: "A & B",
        eventName: "Wedding",
        fileUrl: null,
        fileSize: null,
        mimeType: null,
        isCoupleVisible: true,
        isVendorVisible: false,
        uploadedByType: "venue" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }],
      new Map([["q1", "client_planning"]]),
    );
    const doc = normalizeWorkspaceDocument(named[0]);
    assert.equal(doc.name, "Client Planning Questionnaire");
    assert.equal(doc.rawStatus, "sent");
    assert.equal(doc.experienceStatus, "with_someone");
    assert.equal(experienceBadgeLabel(doc.experienceStatus!, "questionnaire"), "Waiting on Client");
    assert.equal(EXPERIENCE_STATUS_LABEL.with_someone, "Waiting on Client");
    assert.notEqual(experienceBadgeLabel("with_someone", "questionnaire"), "With Someone");
  });

  it("latest get_venue_documents migration projects by kind — no universal Final Details hardcode", () => {
    assert.match(latestDocsMigration, /when 'client_planning' then 'Client Planning Questionnaire'/);
    assert.match(latestDocsMigration, /when 'final_details' then 'Final Details'/);
    assert.match(latestDocsMigration, /when 'post_event_feedback' then 'Post-Event Feedback'/);
    assert.doesNotMatch(
      latestDocsMigration,
      /'name',\s+'Final Details Questionnaire'/,
    );
    assert.match(service, /applyQuestionnaireWorkspaceNames/);
    assert.match(service, /kindLabel|questionnaire-names/);
  });
});
