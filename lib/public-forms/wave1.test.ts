import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_PUBLIC_FORM_FIELD_CONFIG, PUBLIC_FORM_COLLECTS_SMS_CONSENT } from "@/lib/public-forms/constants";
import { publicFormAbsoluteUrl, publicFormPath } from "@/lib/public-forms/public-url";
import { validatePublicFormSubmission } from "@/lib/public-forms/validation";
import type { InquiryFormQuestion } from "@/lib/inquiry-form/types";

const root = process.cwd();

describe("Public Form Wave 1 — URL + policy", () => {
  it("uses /forms/{token} distinct from venue inquiry /form/{embed_key}", () => {
    assert.equal(publicFormPath("abc123def"), "/forms/abc123def");
    assert.equal(publicFormAbsoluteUrl("abc123def", "https://app.example.com"), "https://app.example.com/forms/abc123def");
    assert.equal(publicFormPath(""), "");
  });

  it("does not collect SMS consent on custom Public Forms (phone ≠ consent)", () => {
    assert.equal(PUBLIC_FORM_COLLECTS_SMS_CONSENT, false);
    const submitSrc = readFileSync(join(root, "app/api/public/forms/submit/route.ts"), "utf8");
    // Must not import or invoke the inquiry SMS consent applier.
    assert.doesNotMatch(submitSrc, /from ["']@\/lib\/communication\/apply-inquiry-consent["']/);
    assert.doesNotMatch(submitSrc, /await applyInquiryCommunicationCapture/);
  });

  it("defaults event_type to hidden so expo forms need not collect it", () => {
    assert.equal(DEFAULT_PUBLIC_FORM_FIELD_CONFIG.event_type, "hidden");
    assert.equal(DEFAULT_PUBLIC_FORM_FIELD_CONFIG.phone, "optional");
  });
});

describe("Public Form Wave 1 — validation", () => {
  const questions: InquiryFormQuestion[] = [
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
      questionText: "Anything else?",
      questionType: "long_answer",
      required: false,
      options: [],
      sortOrder: 1,
    },
  ];

  it("requires identity + required custom questions", () => {
    const errors = validatePublicFormSubmission(DEFAULT_PUBLIC_FORM_FIELD_CONFIG, questions, {
      firstName: "",
      lastName: "Test",
      email: "a@b.com",
      phone: "",
      eventType: "",
      eventDate: "",
      guestCount: "",
      customAnswers: {},
    });
    assert.ok(errors.firstName);
    assert.ok(errors.q1);
    assert.equal(errors.q2, undefined);
  });

  it("accepts a valid submission payload shape", () => {
    const errors = validatePublicFormSubmission(DEFAULT_PUBLIC_FORM_FIELD_CONFIG, questions, {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "",
      eventType: "",
      eventDate: "",
      guestCount: "",
      customAnswers: { q1: "A wedding venue" },
    });
    assert.deepEqual(errors, {});
  });

  it("enforces required standard fields when configured", () => {
    const errors = validatePublicFormSubmission(
      { ...DEFAULT_PUBLIC_FORM_FIELD_CONFIG, phone: "required", event_type: "required" },
      [],
      {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "",
        eventType: "",
        eventDate: "",
        guestCount: "",
        customAnswers: {},
      },
    );
    assert.ok(errors.phone);
    assert.ok(errors.eventType);
  });
});

describe("Public Form Wave 1 — migration + intake wiring", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/20261407600000_public_forms_wave1.sql"),
    "utf8",
  );

  it("creates public_forms and form-scoped questions with RLS", () => {
    assert.match(migration, /create table public\.public_forms/);
    assert.match(migration, /create table public\.public_form_questions/);
    assert.match(migration, /public_form_id uuid not null references public\.public_forms/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /venue_id = public\.current_user_venue_id\(\)/);
  });

  it("adds QR public_form destination with many-QR → one-form FK", () => {
    assert.match(migration, /add column if not exists public_form_id/);
    assert.match(migration, /'public_form'/);
    assert.match(migration, /destination_type = 'public_form' and public_form_id is not null/);
  });

  it("submits through ingest_lead via create_public_form_lead", () => {
    assert.match(migration, /create or replace function public\.create_public_form_lead/);
    assert.match(migration, /public\.ingest_lead\(/);
    assert.match(migration, /'public_form_id', v_form\.id::text/);
    assert.match(migration, /status = 'published'/);
  });

  it("API route uses TypeScript ingestLead + create_public_form_lead", () => {
    const route = readFileSync(join(root, "app/api/public/forms/submit/route.ts"), "utf8");
    assert.match(route, /ingestLead\(/);
    assert.match(route, /create_public_form_lead/);
  });

  it("QR redirect resolves public_form to /forms/{key}?qr=", () => {
    const qr = readFileSync(join(root, "app/qr/[code]/route.ts"), "utf8");
    assert.match(qr, /destinationType === "public_form"/);
    assert.match(qr, /publicFormPath/);
    assert.match(qr, /\?qr=\$/);
  });

  it("proxy allowlists /forms without weakening /form", () => {
    const proxy = readFileSync(join(root, "integrations/supabase/proxy.ts"), "utf8");
    assert.match(proxy, /"\/forms"/);
    assert.match(proxy, /"\/form"/);
  });
});

describe("Public Form Wave 1 — QR destination picker + ownership", () => {
  it("QR types and create path require publicFormId for public_form", () => {
    const types = readFileSync(join(root, "lib/qr-campaigns/types.ts"), "utf8");
    const service = readFileSync(join(root, "lib/qr-campaigns/service.ts"), "utf8");
    const list = readFileSync(join(root, "components/qr-campaigns/qr-campaign-list.tsx"), "utf8");
    assert.match(types, /"public_form"/);
    assert.match(service, /destinationType === "public_form"/);
    assert.match(service, /Select a public form/);
    assert.match(list, /Custom public form/);
    assert.match(list, /Create new form/);
    assert.match(list, /Choose a form/);
    assert.match(list, /Customize form/);
    assert.match(list, /buildQrCreateReturnPath/);
    assert.match(list, /listPublicFormsForQrPicker|publicForms/);
  });

  it("QR create round-trip preserves publicFormId via returnTo", () => {
    const qrPage = readFileSync(join(root, "app/(app)/library/qr-campaigns/page.tsx"), "utf8");
    const formsPage = readFileSync(join(root, "app/(app)/library/public-forms/page.tsx"), "utf8");
    const detailPage = readFileSync(join(root, "app/(app)/library/public-forms/[id]/page.tsx"), "utf8");
    const builder = readFileSync(join(root, "components/public-forms/public-form-builder.tsx"), "utf8");
    assert.match(qrPage, /parseQrCreateSearchParams/);
    assert.match(qrPage, /listPublicFormsForQrPicker/);
    assert.match(formsPage, /returnTo/);
    assert.match(formsPage, /sp\.create === "1"/);
    assert.match(detailPage, /returnTo/);
    assert.match(detailPage, /stampQrCreateReturnWithPublicFormId/);
    assert.match(builder, /Return to QR creation/);
    const listUi = readFileSync(join(root, "components/public-forms/public-form-list.tsx"), "utf8");
    assert.match(listUi, /create=1|initialShowCreate/);
    assert.match(listUi, /stampQrCreateReturnWithPublicFormId/);
    const returnLib = readFileSync(join(root, "lib/qr-campaigns/qr-form-return.ts"), "utf8");
    assert.match(returnLib, /stampQrCreateReturnWithPublicFormId/);
    assert.match(returnLib, /name: state\.name/);
  });

  it("management service gates create/update to owner/manager", () => {
    const service = readFileSync(join(root, "lib/public-forms/service.ts"), "utf8");
    assert.match(service, /role === "owner" \|\| role === "manager"/);
    assert.match(service, /forbidden/);
    assert.match(service, /\.eq\("venue_id", venue\.id\)/);
  });

  it("inactive/draft forms are not returned by get_public_form", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20261407600000_public_forms_wave1.sql"),
      "utf8",
    );
    assert.match(migration, /create or replace function public\.get_public_form/);
    assert.match(migration, /and status = 'published'/);
  });
});
