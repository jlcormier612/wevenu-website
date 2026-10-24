/**
 * Selection email must not reuse the invoice financial portal token.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  choicesReviewUrl,
  isChoicesPortalView,
  pickChoicesPortalSession,
} from "@/lib/client-choices/choices-portal-link";

describe("choices portal link", () => {
  it("never selects a financial session even when it is the only or newest session", () => {
    const sessions = [
      { accessToken: "fin-new", accessLevel: "financial" },
      { accessToken: "couple-old", accessLevel: "couple" },
    ];
    assert.equal(pickChoicesPortalSession(sessions)?.accessToken, "couple-old");
    assert.equal(
      pickChoicesPortalSession([{ accessToken: "fin-only", accessLevel: "financial" }]),
      null,
    );
  });

  it("prefers couple over planning and ignores view_only", () => {
    const sessions = [
      { accessToken: "view", accessLevel: "view_only" },
      { accessToken: "plan", accessLevel: "planning" },
      { accessToken: "couple", accessLevel: "couple" },
    ];
    assert.equal(pickChoicesPortalSession(sessions)?.accessToken, "couple");
  });

  it("builds a choices URL with query and hash, not an invoice path", () => {
    const url = choicesReviewUrl("https://app.sandbox.hellotocheers.com/", "tok_abc");
    assert.equal(
      url,
      "https://app.sandbox.hellotocheers.com/p/tok_abc?view=choices#choices",
    );
    assert.doesNotMatch(url, /item=/);
    assert.equal(isChoicesPortalView("choices"), true);
    assert.equal(isChoicesPortalView("payments"), false);
  });

  it("email sender uses the picker and creates a couple session instead of sessions[0]", () => {
    const src = readFileSync(resolve("lib/client-choices/couple-email.ts"), "utf8");
    assert.match(src, /pickChoicesPortalSession/);
    assert.match(src, /choicesReviewUrl/);
    assert.match(src, /createPortalSession\(input\.clientId, "Selections", "couple"\)/);
    assert.doesNotMatch(src, /sessions\[0\]/);
    assert.doesNotMatch(src, /accessLevel !== "financial"/);
  });

  it("financial portal page ignores view=choices; couple shell receives the initial section", () => {
    const page = readFileSync(resolve("app/(portal)/p/[token]/page.tsx"), "utf8");
    assert.match(page, /accessLevel === "financial"/);
    assert.match(page, /PaymentAccessShell/);
    assert.match(page, /isChoicesPortalView/);
    assert.match(page, /initialSection=\{choicesView \? "choices" : undefined\}/);
    const financialBranch = page.slice(
      page.indexOf('if (context.accessLevel === "financial")'),
      page.indexOf("const [tasks"),
    );
    assert.doesNotMatch(financialBranch, /initialSection/);
    assert.doesNotMatch(financialBranch, /ChoicesPortalSection/);
  });

  it("invoice outbound still uses a financial token and does not force choices", () => {
    const src = readFileSync(resolve("lib/invoices/outbound.ts"), "utf8");
    assert.match(src, /accessLevel === "financial"/);
    assert.match(src, /createPortalSession\(clientId, "Payment", "financial"\)/);
    assert.doesNotMatch(src, /view=choices/);
  });
});
