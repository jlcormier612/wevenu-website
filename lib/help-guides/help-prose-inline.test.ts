import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseHelpInlineSegments } from "./help-prose-inline";

describe("parseHelpInlineSegments", () => {
  it("renders relative Communication Health links (not raw markdown)", () => {
    const parts = parseHelpInlineSegments(
      "confirm readiness in [Communication Health](/messaging/health) before sending.",
    );
    const link = parts.find((p) => p.type === "link");
    assert.ok(link && link.type === "link");
    assert.equal(link.label, "Communication Health");
    assert.equal(link.href, "/messaging/health");
    assert.equal(link.external, false);
    assert.equal(
      parts.some((p) => p.type === "text" && p.value.includes("[Communication Health]")),
      false,
    );
  });

  it("still supports absolute https links as external", () => {
    const parts = parseHelpInlineSegments(
      "See [Stripe's documentation](https://stripe.com/docs).",
    );
    const link = parts.find((p) => p.type === "link");
    assert.ok(link && link.type === "link");
    assert.equal(link.href, "https://stripe.com/docs");
    assert.equal(link.external, true);
  });

  it("parses bold alongside links", () => {
    const parts = parseHelpInlineSegments("Shows **Ready** and [Open setup](/settings/communications#texting).");
    assert.ok(parts.some((p) => p.type === "bold" && p.value === "Ready"));
    assert.ok(
      parts.some(
        (p) => p.type === "link" && p.href === "/settings/communications#texting",
      ),
    );
  });
});
