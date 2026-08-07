/**
 * Welcome Experience unit tests (WP3).
 *
 * Uses node:test + renderToStaticMarkup (no RTL in repo). Interactive
 * enablement / acceptance failure covered via pure helpers + error alert.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { OutstandingDocument } from "@/lib/legal/acceptance-engine";
import type { LegalAcceptance, LegalDocument } from "@/lib/legal/types";

import {
  WelcomeExperience,
  WelcomeExperienceDocumentList,
  WelcomeExperienceErrorAlert,
  WELCOME_ACCEPTANCE_ERROR_DETAIL,
  WELCOME_ACCEPTANCE_ERROR_TITLE,
  WELCOME_AGREE_LABEL,
  WELCOME_CONTINUE_LABEL,
  WELCOME_SUPPORT_BODY,
  WELCOME_SUPPORT_HEADING,
  attemptWelcomeContinue,
  canContinue,
  formatWelcomeEffectiveDate,
  isAlreadyCompliant,
  normalizeIntroduction,
  shouldShowAgreementCheckbox,
  welcomeDocumentsFromOutstanding,
  type WelcomeExperienceDocument,
} from "./index";

function doc(
  partial: Partial<WelcomeExperienceDocument> &
    Pick<WelcomeExperienceDocument, "title" | "version">,
): WelcomeExperienceDocument {
  return {
    effectiveDate: partial.effectiveDate ?? "2026-03-01",
    viewHref: partial.viewHref ?? "/privacy",
    id: partial.id,
    documentType: partial.documentType,
    title: partial.title,
    version: partial.version,
  };
}

function makeLegalDoc(
  partial: Partial<LegalDocument> &
    Pick<LegalDocument, "id" | "documentType" | "version" | "title">,
): LegalDocument {
  return {
    effectiveDate: partial.effectiveDate ?? "2026-03-01",
    content: partial.content ?? "body",
    isPublished: partial.isPublished ?? true,
    isActive: partial.isActive ?? true,
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("Welcome Experience helpers", () => {
  it("treats empty documents as already compliant", () => {
    assert.equal(isAlreadyCompliant([]), true);
    assert.equal(shouldShowAgreementCheckbox([]), false);
    assert.equal(
      canContinue({ documents: [], agreed: false, pending: false }),
      true,
    );
  });

  it("requires checkbox agreement when documents are present", () => {
    const documents = [doc({ title: "Privacy Policy", version: "1.0" })];
    assert.equal(isAlreadyCompliant(documents), false);
    assert.equal(shouldShowAgreementCheckbox(documents), true);
    assert.equal(
      canContinue({ documents, agreed: false, pending: false }),
      false,
    );
    assert.equal(
      canContinue({ documents, agreed: true, pending: false }),
      true,
    );
    assert.equal(
      canContinue({ documents, agreed: true, pending: true }),
      false,
    );
  });

  it("normalizes introduction paragraphs", () => {
    assert.deepEqual(normalizeIntroduction("Hello"), ["Hello"]);
    assert.deepEqual(normalizeIntroduction(["One", "", "Two"]), [
      "One",
      "Two",
    ]);
  });

  it("formats effective dates editorially", () => {
    assert.equal(formatWelcomeEffectiveDate("2026-03-01"), "March 1, 2026");
  });

  it("maps outstanding engine docs to viewHref via public routes", () => {
    const outstanding: OutstandingDocument[] = [
      {
        documentType: "privacy_policy",
        active: makeLegalDoc({
          id: "d1",
          documentType: "privacy_policy",
          title: "Privacy Policy",
          version: "2.0",
          effectiveDate: "2026-04-15",
        }),
        acceptance: null as LegalAcceptance | null,
      },
      {
        documentType: "vendor_end_user_terms",
        active: null,
        acceptance: null,
      },
    ];
    const mapped = welcomeDocumentsFromOutstanding(outstanding);
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0]?.viewHref, "/privacy");
    assert.equal(mapped[0]?.title, "Privacy Policy");
    assert.equal(mapped[0]?.version, "2.0");
  });
});

describe("attemptWelcomeContinue", () => {
  it("calls onSuccess when onContinue resolves", async () => {
    let continued = false;
    let succeeded = false;
    const result = await attemptWelcomeContinue({
      onContinue: async () => {
        continued = true;
      },
      onSuccess: () => {
        succeeded = true;
      },
    });
    assert.equal(result, "success");
    assert.equal(continued, true);
    assert.equal(succeeded, true);
  });

  it("returns error when onContinue rejects — acceptance failure", async () => {
    let succeeded = false;
    const result = await attemptWelcomeContinue({
      onContinue: async () => {
        throw new Error("db down");
      },
      onSuccess: () => {
        succeeded = true;
      },
    });
    assert.equal(result, "error");
    assert.equal(succeeded, false);
  });
});

describe("WelcomeExperienceErrorAlert", () => {
  it("renders exact two-line acceptance failure copy (no tech details)", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeExperienceErrorAlert),
    );
    assert.equal(
      WELCOME_ACCEPTANCE_ERROR_TITLE,
      "We couldn't save your acceptance.",
    );
    assert.equal(WELCOME_ACCEPTANCE_ERROR_DETAIL, "Please try again.");
    // React SSR escapes apostrophes as &#x27;
    assert.match(html, /We couldn&#x27;t save your acceptance\./);
    assert.match(html, /Please try again\./);
    assert.doesNotMatch(html, /db down|stack|SQL|Error:/i);
  });
});

describe("WelcomeExperienceDocumentList", () => {
  it("renders a single document with title, version, date, and View link", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeExperienceDocumentList, {
        documents: [
          doc({
            title: "Privacy Policy",
            version: "1.2",
            effectiveDate: "2026-03-01",
            viewHref: "/privacy",
          }),
        ],
      }),
    );
    assert.match(html, /Privacy Policy/);
    assert.match(html, /Version 1\.2/);
    assert.match(html, /March 1, 2026/);
    assert.match(html, /View →/);
    assert.match(html, /href="\/privacy"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noreferrer"/);
  });

  it("renders multiple documents", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeExperienceDocumentList, {
        documents: [
          doc({
            id: "a",
            title: "End User Terms",
            version: "1.0",
            viewHref: "/end-user-terms",
          }),
          doc({
            id: "b",
            title: "Privacy Policy",
            version: "2.0",
            viewHref: "/privacy",
          }),
        ],
      }),
    );
    assert.match(html, /End User Terms/);
    assert.match(html, /Privacy Policy/);
    assert.match(html, /href="\/end-user-terms"/);
    assert.match(html, /href="\/privacy"/);
  });

  it("renders nothing when there are no required documents", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeExperienceDocumentList, { documents: [] }),
    );
    assert.equal(html, "");
  });
});

describe("WelcomeExperience", () => {
  it("renders logo, heading, introduction, checkbox, continue, and support", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeExperience, {
        heading: "Welcome aboard",
        introduction: [
          "First paragraph for context.",
          "Second paragraph for context.",
        ],
        documents: [
          doc({
            title: "Vendor Terms",
            version: "3.0",
            viewHref: "/vendor-terms",
          }),
        ],
        onContinue: () => undefined,
      }),
    );

    assert.match(html, /data-welcome-experience/);
    assert.match(html, /alt="Hello to Cheers"/);
    assert.match(html, /Welcome aboard/);
    assert.match(html, /First paragraph for context\./);
    assert.match(html, /Second paragraph for context\./);
    assert.match(html, /Vendor Terms/);
    assert.match(html, new RegExp(WELCOME_AGREE_LABEL));
    assert.match(html, /type="checkbox"/);
    assert.match(html, /htmlFor="welcome-experience-agree"|for="welcome-experience-agree"/);
    assert.match(html, new RegExp(WELCOME_CONTINUE_LABEL));
    assert.match(html, /disabled/);
    assert.match(html, new RegExp(WELCOME_SUPPORT_HEADING));
    assert.match(html, new RegExp(WELCOME_SUPPORT_BODY));
    assert.doesNotMatch(html, /Legal Acceptance Experience/i);
  });

  it("already compliant: empty docs enable Continue without checkbox", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeExperience, {
        heading: "You're all set",
        introduction: "No further documents are required.",
        documents: [],
        onContinue: () => undefined,
      }),
    );
    assert.match(html, /data-already-compliant="true"/);
    assert.doesNotMatch(html, /type="checkbox"/);
    assert.doesNotMatch(html, /I have reviewed and agree/);
    assert.match(html, />Continue</);
    // Enabled: no disabled attribute (class may still include disabled:opacity-50).
    assert.doesNotMatch(html, /<button[^>]*\sdisabled(?:="| |>)/);
  });

  it("documents responsive stacked layout classes (mobile → desktop)", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeExperience, {
        heading: "Review",
        introduction: "Intro",
        documents: [
          doc({ title: "Privacy Policy", version: "1.0" }),
          doc({
            id: "2",
            title: "Cookie Policy",
            version: "1.0",
            viewHref: "/cookies",
          }),
        ],
        onContinue: () => undefined,
      }),
    );
    // Outer shell: stacked centered layout across breakpoints.
    assert.match(html, /min-h-svh/);
    assert.match(html, /flex-col/);
    assert.match(html, /items-center/);
    assert.match(html, /px-4/);
    assert.match(html, /sm:px-6/);
    assert.match(html, /md:px-8/);
    // Document rows: column on mobile, row on sm+.
    assert.match(html, /flex-col/);
    assert.match(html, /sm:flex-row/);
  });

  it("string introduction renders as a single paragraph", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeExperience, {
        heading: "Hello",
        introduction: "One intro block.",
        documents: [doc({ title: "Privacy Policy", version: "1.0" })],
        onContinue: () => undefined,
      }),
    );
    assert.match(html, /One intro block\./);
  });
});
