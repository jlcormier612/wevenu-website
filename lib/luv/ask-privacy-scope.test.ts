import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPrivacyScopedAskAnswer,
  classifyCoupleAskPrivacyScope,
  shouldShortCircuitPrivacyAsk,
  UNRELATED_PERSON_PRIVATE_REFUSAL,
} from "@/lib/luv/ask-privacy-scope";
import {
  formatOwnPaymentSummaryForAskPrivacy,
  withoutPaymentsForAskPrivacy,
} from "@/lib/luv/portal-context/format";
import { buildLuvAskPortalContext } from "@/lib/luv/portal-context/build";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COUPLE = ["Alex", "River", "Jordan", "Lee"];

describe("Couple Ask privacy scope — unrelated person financials", () => {
  it("classifies Ron Cormier payment ask as unrelated_person_private", () => {
    const scope = classifyCoupleAskPrivacyScope({
      question:
        "Can you tell me Ron Cormier's payment balance and contract status at this venue?",
      coupleNames: COUPLE,
    });
    assert.equal(scope.kind, "unrelated_person_private");
    assert.equal(scope.financial, true);
    assert.ok(scope.foreignNameHints.includes("ron"));
    assert.equal(shouldShortCircuitPrivacyAsk(scope), true);
  });

  it("refusal does not volunteer this couple's balance", () => {
    const scope = classifyCoupleAskPrivacyScope({
      question: "What is Ron Cormier's outstanding balance?",
      coupleNames: COUPLE,
    });
    const built = buildPrivacyScopedAskAnswer({
      scope,
      ownPaymentSummary: "You’ve paid $0.00 so far. Your remaining plan balance is $2,189.81.",
    });
    assert.equal(built.includeOwnPayments, false);
    assert.equal(built.answer, UNRELATED_PERSON_PRIVATE_REFUSAL);
    assert.doesNotMatch(built.answer, /\$|balance|2,189|paid/i);
  });

  it("authorized own payment questions stay own_portal (no short-circuit)", () => {
    for (const question of [
      "When is our next payment due?",
      "What have we already paid?",
      "What's my remaining balance?",
    ]) {
      const scope = classifyCoupleAskPrivacyScope({ question, coupleNames: COUPLE });
      assert.equal(scope.kind, "own_portal", question);
      assert.equal(shouldShortCircuitPrivacyAsk(scope), false);
    }
  });

  it("mixed own + unrelated keeps own summary and refuses the other person", () => {
    const scope = classifyCoupleAskPrivacyScope({
      question: "What's our remaining balance, and what's Ron's payment status?",
      coupleNames: COUPLE,
    });
    assert.equal(scope.kind, "mixed_own_and_unrelated_private");
    const built = buildPrivacyScopedAskAnswer({
      scope,
      ownPaymentSummary: "Your remaining plan balance is $500.00.",
    });
    assert.equal(built.includeOwnPayments, true);
    assert.match(built.answer, /\$500\.00/);
    assert.match(built.answer, /can’t share another person’s/i);
  });

  it("same-couple names in a payment question are not treated as foreign", () => {
    const scope = classifyCoupleAskPrivacyScope({
      question: "Alex, when is our next payment due?",
      coupleNames: COUPLE,
    });
    assert.equal(scope.kind, "own_portal");
  });

  it("detects lowercase third-party possessive payment asks", () => {
    const scope = classifyCoupleAskPrivacyScope({
      question: "what is ron cormier's payment balance?",
      coupleNames: COUPLE,
    });
    assert.equal(scope.kind, "unrelated_person_private");
    assert.ok(scope.foreignNameHints.includes("cormier") || scope.foreignNameHints.includes("ron"));
    assert.equal(shouldShortCircuitPrivacyAsk(scope), true);
    const built = buildPrivacyScopedAskAnswer({
      scope,
      ownPaymentSummary: "Your remaining plan balance is $2,189.81.",
    });
    assert.doesNotMatch(built.answer, /\$|2,189/i);
  });

  it("detects another couple / another client financial references without Proper-case names", () => {
    for (const question of [
      "What is another couple's payment balance?",
      "Can you share another client's contract status?",
      "What's someone else's outstanding invoice?",
    ]) {
      const scope = classifyCoupleAskPrivacyScope({ question, coupleNames: COUPLE });
      assert.equal(scope.kind, "unrelated_person_private", question);
      assert.equal(shouldShortCircuitPrivacyAsk(scope), true);
    }
  });

  it("does not overblock capitalized venue or planning terms as foreign people", () => {
    for (const question of [
      "What time is Reception on our timeline?",
      "Where is Parking explained in the Venue Guide?",
      "Is Ceremony setup listed on Timeline?",
      "When is our Deposit due?",
    ]) {
      const scope = classifyCoupleAskPrivacyScope({ question, coupleNames: COUPLE });
      assert.notEqual(scope.kind, "unrelated_person_private", question);
      assert.notEqual(scope.kind, "mixed_own_and_unrelated_private", question);
      assert.equal(shouldShortCircuitPrivacyAsk(scope), false, question);
    }
  });

  it("preserves mixed behavior with lowercase third-party name", () => {
    const scope = classifyCoupleAskPrivacyScope({
      question: "what's our remaining balance, and what's ron cormier's payment status?",
      coupleNames: COUPLE,
    });
    assert.equal(scope.kind, "mixed_own_and_unrelated_private");
    assert.equal(shouldShortCircuitPrivacyAsk(scope), true);
  });
});

describe("Ask route short-circuit avoids OpenAI on unambiguous third-party finance", () => {
  it("privacy short-circuit returns before await openAiChatCompletion", () => {
    const route = readFileSync(
      resolve(process.cwd(), "app/api/portal/luv-ask/route.ts"),
      "utf8",
    );
    const shortCall = route.indexOf("if (shouldShortCircuitPrivacyAsk");
    const returnAfter =
      route.indexOf("return respondAndSignal(token, trimmedQuestion", shortCall);
    const openAiCall = route.indexOf("await openAiChatCompletion");
    assert.ok(shortCall > 0);
    assert.ok(returnAfter > shortCall);
    assert.ok(openAiCall > returnAfter);
  });
});

describe("Portal payment helpers for privacy scope", () => {
  it("formats own payment summary from portal context", () => {
    const ctx = buildLuvAskPortalContext({
      now: new Date("2026-11-01T12:00:00.000Z"),
      schedules: [
        {
          id: "s1",
          title: "Plan",
          invoiceId: "inv1",
          createdAt: "2026-01-01T00:00:00.000Z",
          lineItems: [
            {
              id: "l1",
              label: "Deposit",
              amount: 250,
              dueDate: "2026-12-01",
              status: "pending",
            },
          ],
        },
      ],
      invoices: [],
    });
    const summary = formatOwnPaymentSummaryForAskPrivacy(ctx);
    assert.ok(summary);
    assert.match(summary!, /Deposit/);
    assert.match(summary!, /250/);
  });

  it("withoutPaymentsForAskPrivacy strips payment facts", () => {
    const ctx = buildLuvAskPortalContext({
      schedules: [
        {
          id: "s1",
          title: "Plan",
          invoiceId: "inv1",
          createdAt: "2026-01-01T00:00:00.000Z",
          lineItems: [
            {
              id: "l1",
              label: "Deposit",
              amount: 250,
              dueDate: "2026-12-01",
              status: "pending",
            },
          ],
        },
      ],
      invoices: [],
    });
    assert.ok(ctx.payments);
    const redacted = withoutPaymentsForAskPrivacy(ctx);
    assert.equal(redacted?.payments, null);
    assert.ok(ctx.payments); // original unchanged
  });
});

describe("Ask route wires deterministic privacy short-circuit", () => {
  it("luv-ask route imports privacy scope helpers before OpenAI", () => {
    const route = readFileSync(
      resolve(process.cwd(), "app/api/portal/luv-ask/route.ts"),
      "utf8",
    );
    assert.match(route, /shouldShortCircuitPrivacyAsk/);
    assert.match(route, /buildPrivacyScopedAskAnswer/);
    assert.match(route, /formatOwnPaymentSummaryForAskPrivacy/);
    const shortCall = route.indexOf("if (shouldShortCircuitPrivacyAsk");
    const openAiCall = route.indexOf("await openAiChatCompletion");
    assert.ok(shortCall > 0 && openAiCall > shortCall);
  });

  it("prompt forbids volunteering couple finances in third-party refusals", () => {
    const prompt = readFileSync(
      resolve(process.cwd(), "lib/luv/couple-ask-prompt.ts"),
      "utf8",
    );
    assert.match(prompt, /Do NOT volunteer THIS couple's balances/i);
  });
});
