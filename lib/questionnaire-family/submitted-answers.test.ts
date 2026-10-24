/**
 * Run: npx tsx --test lib/questionnaire-family/submitted-answers.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  buildSubmittedAnswerRows,
  isSubmittedQuestionnaireDocumentStatus,
  submittedQuestionnaireTitle,
} from "@/lib/questionnaire-family/submitted-answers";

describe("submitted questionnaire answers for Documents", () => {
  it("titles use questionnaire family name", () => {
    assert.match(submittedQuestionnaireTitle("client_planning"), /Client Planning/i);
    assert.match(submittedQuestionnaireTitle("final_details"), /Final Details/i);
  });

  it("returned statuses include submitted and complete", () => {
    assert.equal(isSubmittedQuestionnaireDocumentStatus("submitted"), true);
    assert.equal(isSubmittedQuestionnaireDocumentStatus("complete"), true);
    assert.equal(isSubmittedQuestionnaireDocumentStatus("sent"), false);
    assert.equal(isSubmittedQuestionnaireDocumentStatus("draft"), false);
  });

  it("builds question/answer rows from persisted columns and family answers", () => {
    const rows = buildSubmittedAnswerRows({
      kind: "client_planning",
      status: "complete",
      included_fields: ["excited_about", "priorities", "meal_notes_cp"],
      required_fields: [],
      additional: {
        family: {
          excited_about: "Sunset ceremony",
          priorities: "Good food",
        },
      },
    });
    assert.ok(rows.length >= 2, JSON.stringify(rows.map((r) => r.id)));
    const excited = rows.find((r) => r.id === "excited_about");
    assert.ok(excited);
    assert.equal(excited!.value, "Sunset ceremony");
    const priorities = rows.find((r) => r.id === "priorities");
    assert.ok(priorities);
    assert.equal(priorities!.value, "Good food");
  });

  it("couple form shows read-only submitted review with answers", () => {
    const form = readFileSync(resolve("components/form/couple-family-questionnaire-form.tsx"), "utf8");
    assert.match(form, /questionnaire-submitted-review/);
    assert.match(form, /buildSubmittedAnswerRows/);
    assert.match(form, /Read-only/);
  });

  it("Documents lists questionnaires by real title and review CTA", () => {
    const docs = readFileSync(resolve("components/portal/couple-documents-section.tsx"), "utf8");
    assert.match(docs, /portal-documents-questionnaires/);
    assert.match(docs, /portal-documents-questionnaire/);
    assert.match(docs, /submittedQuestionnaireTitle/);
    assert.doesNotMatch(docs, />Final Details Questionnaire</);
    assert.match(docs, /Your submitted answers/);
  });
});
