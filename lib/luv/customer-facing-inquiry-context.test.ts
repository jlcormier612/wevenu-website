/**
 * Gate 2 classifier — narrow high-confidence withhold rules.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  customerFacingInquiryContext,
  shouldWithholdInquiryFragment,
  splitInquiryFragments,
} from "@/lib/luv/customer-facing-inquiry-context";

describe("shouldWithholdInquiryFragment", () => {
  it("withholds Charlie-style on-his-toes relationship commentary", () => {
    assert.equal(
      shouldWithholdInquiryFragment(
        "Keeping Charlie on his toes sounds like it will make the day even more fun.",
      ),
      true,
    );
  });

  it("withholds Lucy keeping Charlie on his toes phrasing", () => {
    assert.equal(
      shouldWithholdInquiryFragment(
        "Lucy keeping Charlie on his toes sounds like it will make the day even more fun.",
      ),
      true,
    );
  });

  it("allows garden preference", () => {
    assert.equal(shouldWithholdInquiryFragment("We love the garden."), false);
  });

  it("allows Saturday in August planning preference", () => {
    assert.equal(
      shouldWithholdInquiryFragment("We're hoping for a Saturday in August."),
      false,
    );
  });

  it("allows venue questions", () => {
    assert.equal(
      shouldWithholdInquiryFragment("Do you have availability for a ceremony outdoors?"),
      false,
    );
  });

  it("withholds teasing about the couple", () => {
    assert.equal(shouldWithholdInquiryFragment("Just teasing them about the dance."), true);
  });
});

describe("customerFacingInquiryContext", () => {
  it("excludes venue origin", () => {
    assert.deepEqual(
      customerFacingInquiryContext("We love the garden.", "venue"),
      { status: "excluded" },
    );
  });

  it("excludes unknown origin", () => {
    assert.deepEqual(
      customerFacingInquiryContext("We love the garden.", "unknown"),
      { status: "excluded" },
    );
  });

  it("excludes invalid/missing origin", () => {
    assert.deepEqual(
      customerFacingInquiryContext("We love the garden.", null),
      { status: "excluded" },
    );
    assert.deepEqual(
      customerFacingInquiryContext("We love the garden.", "bogus"),
      { status: "excluded" },
    );
  });

  it("returns usable details for useful preference", () => {
    const result = customerFacingInquiryContext("We love the garden.", "customer");
    assert.equal(result.status, "usable");
    if (result.status === "usable") {
      assert.deepEqual(result.details, ["We love the garden."]);
    }
  });

  it("returns none_usable for Charlie-only commentary", () => {
    assert.deepEqual(
      customerFacingInquiryContext(
        "Keeping Charlie on his toes sounds like it will make the day even more fun.",
        "customer",
      ),
      { status: "none_usable" },
    );
  });

  it("mixed: keeps useful, drops withheld; never returns full raw", () => {
    const raw =
      "We love the garden. Keeping Charlie on his toes sounds like it will make the day even more fun.";
    const result = customerFacingInquiryContext(raw, "customer");
    assert.equal(result.status, "usable");
    if (result.status === "usable") {
      assert.deepEqual(result.details, ["We love the garden."]);
      assert.ok(!result.details.some((d) => d.includes("Charlie")));
      assert.ok(!result.details.includes(raw));
    }
  });

  it("splitInquiryFragments separates sentence boundaries", () => {
    assert.deepEqual(
      splitInquiryFragments("We love the garden. Hoping for August."),
      ["We love the garden.", "Hoping for August."],
    );
  });
});
