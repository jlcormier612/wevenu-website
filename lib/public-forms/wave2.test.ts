/**
 * Public Forms Wave 2 — operational management / lifecycle.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { DEFAULT_PUBLIC_FORM_FIELD_CONFIG } from "@/lib/public-forms/constants";
import {
  isPublicFormLive,
  nextDuplicateInternalName,
  projectDuplicatedPublicForm,
  publicFormUnavailableCopy,
} from "@/lib/public-forms/lifecycle";
import type { PublicForm } from "@/lib/public-forms/types";

const root = process.cwd();

function sampleForm(over: Partial<PublicForm> = {}): PublicForm {
  return {
    id: "form-a",
    venueId: "venue-1",
    internalName: "Wedding Expo",
    publicTitle: "Wedding Expo Registration",
    description: "Tell us what you're planning.",
    status: "published",
    publicKey: "key-aaa",
    fieldConfig: { ...DEFAULT_PUBLIC_FORM_FIELD_CONFIG, phone: "required" },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    questions: [
      {
        id: "q1",
        questionText: "What are you looking for?",
        questionType: "short_answer",
        required: true,
        options: [],
        sortOrder: 0,
      },
      {
        id: "q2",
        questionText: "Preferred season",
        questionType: "single_select",
        required: false,
        options: ["Spring", "Fall"],
        sortOrder: 1,
      },
    ],
    ...over,
  };
}

describe("Wave 2 — create / draft / publish", () => {
  it("new forms are created as draft and are not live", () => {
    const service = readFileSync(join(root, "lib/public-forms/service.ts"), "utf8");
    assert.match(service, /status: "draft"/);
    assert.equal(isPublicFormLive("draft"), false);
    assert.equal(isPublicFormLive("published"), true);
    assert.equal(isPublicFormLive("archived"), false);
  });

  it("published forms are the only live public intake", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20261407600000_public_forms_wave1.sql"),
      "utf8",
    );
    assert.match(migration, /and status = 'published'/);
    const submit = readFileSync(join(root, "app/api/public/forms/submit/route.ts"), "utf8");
    assert.match(submit, /get_public_form/);
    assert.match(submit, /form_unavailable/);
  });
});

describe("Wave 2 — duplicate", () => {
  it("copies configuration and questions, not history or identity", () => {
    const source = sampleForm();
    const copy = projectDuplicatedPublicForm(source);
    assert.equal(copy.internalName, "Wedding Expo (copy)");
    assert.equal(copy.publicTitle, "Wedding Expo Registration");
    assert.equal(copy.description, source.description);
    assert.equal(copy.fieldConfig.phone, "required");
    assert.equal(copy.status, "draft");
    assert.equal(copy.questions.length, 2);
    assert.equal(copy.questions[0]!.questionText, "What are you looking for?");
    assert.equal(copy.questions[0]!.required, true);
    assert.deepEqual(copy.questions[1]!.options, ["Spring", "Fall"]);
    assert.equal((copy as { id?: string }).id, undefined);
    assert.equal((copy as { publicKey?: string }).publicKey, undefined);
    assert.doesNotMatch(JSON.stringify(copy), /form-a|key-aaa|q1/);
  });

  it("duplicate action does not copy QR or leads", () => {
    const service = readFileSync(join(root, "lib/public-forms/service.ts"), "utf8");
    assert.match(service, /export async function duplicatePublicForm/);
    assert.match(service, /projectDuplicatedPublicForm/);
    assert.match(service, /createPublicForm/);
    assert.doesNotMatch(service.slice(service.indexOf("duplicatePublicForm")), /qr_campaigns\.insert/);
    assert.doesNotMatch(service.slice(service.indexOf("duplicatePublicForm")), /from\("leads"\)\.insert/);
  });

  it("renames the staff name with (copy)", () => {
    assert.equal(nextDuplicateInternalName("Open House"), "Open House (copy)");
    assert.equal(nextDuplicateInternalName("  "), "Untitled form (copy)");
  });
});

describe("Wave 2 — archive / unpublished public experience", () => {
  it("archived and draft URLs use honest copy, not Inquiry Form", () => {
    const archived = publicFormUnavailableCopy("archived");
    assert.match(archived.title, /no longer available/i);
    assert.doesNotMatch(archived.title, /Inquiry Form/);
    assert.doesNotMatch(archived.body, /Inquiry Form/);
    const draft = publicFormUnavailableCopy("draft");
    assert.match(draft.title, /not available/i);
    assert.doesNotMatch(draft.body, /Inquiry Form/);
  });

  it("public route renders unavailable state instead of the live form", () => {
    const page = readFileSync(join(root, "app/forms/[token]/page.tsx"), "utf8");
    assert.match(page, /PublicFormUnavailable/);
    assert.match(page, /getPublicFormUnavailableState/);
    assert.match(page, /PublicFormView/);
  });

  it("QR to a non-published public form stays on the inactive QR path", () => {
    const qr = readFileSync(join(root, "app/qr/[code]/route.ts"), "utf8");
    const publicFormBlock = qr.slice(qr.indexOf('destinationType === "public_form"'));
    assert.match(publicFormBlock, /form\.status !== "published"/);
    assert.match(publicFormBlock, /inactive\(\)/);
    assert.doesNotMatch(publicFormBlock, /embed_key/);
  });
});

describe("Wave 2 — edit does not rewrite historical answers", () => {
  it("question replace only writes public_form_questions, not leads.source_data", () => {
    const service = readFileSync(join(root, "lib/public-forms/service.ts"), "utf8");
    const fn = service.slice(
      service.indexOf("export async function replacePublicFormQuestions"),
      service.indexOf("export async function publishPublicForm"),
    );
    assert.match(fn, /from\("public_form_questions"\)/);
    assert.doesNotMatch(fn, /from\("leads"\)/);
    assert.doesNotMatch(fn, /source_data/);
  });
});

describe("Wave 2 — QR + lead visibility", () => {
  it("form management lists associated QR campaigns without a second QR system", () => {
    const service = readFileSync(join(root, "lib/public-forms/service.ts"), "utf8");
    assert.match(service, /export async function listQrCampaignsForPublicForm/);
    assert.match(service, /from\("qr_campaigns"\)/);
    const builder = readFileSync(join(root, "components/public-forms/public-form-builder.tsx"), "utf8");
    assert.match(builder, /Create QR code/);
    assert.match(builder, /createQrForPublicFormAction/);
    const actions = readFileSync(join(root, "app/(app)/library/public-forms/actions.ts"), "utf8");
    assert.match(actions, /createQrCampaign/);
    assert.match(actions, /destinationType: "public_form"/);
  });

  it("lead visibility reads canonical leads.source_data.public_form_id", () => {
    const service = readFileSync(join(root, "lib/public-forms/service.ts"), "utf8");
    assert.match(service, /export async function listLeadsForPublicForm/);
    assert.match(service, /contains\("source_data", \{ public_form_id: formId \}\)/);
    assert.doesNotMatch(service, /public_form_submissions/);
  });
});

describe("Wave 2 — staff UI mental model", () => {
  it("uses human-facing actions", () => {
    const list = readFileSync(join(root, "components/public-forms/public-form-list.tsx"), "utf8");
    assert.match(list, /Create form/);
    assert.match(list, /Duplicate/);
    assert.match(list, /Copy link/);
    assert.match(list, /Archive/);
    assert.doesNotMatch(list, /public_form_id/);
    assert.doesNotMatch(list, /destination enum/);
    const builder = readFileSync(join(root, "components/public-forms/public-form-builder.tsx"), "utf8");
    assert.match(builder, /Publish/);
    assert.match(builder, /Leads from this form/);
  });

  it("public chrome still uses the form title, not Inquiry Form", () => {
    const view = readFileSync(join(root, "components/form/public-form.tsx"), "utf8");
    assert.match(view, /form\.publicTitle/);
    assert.doesNotMatch(view, /Inquiry Form/);
  });
});

describe("Wave 2 — legacy isolation", () => {
  it("does not migrate embed_key or inquiry_form_questions", () => {
    const files = [
      readFileSync(join(root, "lib/public-forms/service.ts"), "utf8"),
      readFileSync(join(root, "lib/public-forms/lifecycle.ts"), "utf8"),
      readFileSync(join(root, "app/(app)/library/public-forms/actions.ts"), "utf8"),
    ].join("\n");
    assert.doesNotMatch(files, /inquiry_form_questions/);
    assert.doesNotMatch(files, /embed_key/);
    assert.doesNotMatch(files, /questionnaire.?template/i);
  });
});
