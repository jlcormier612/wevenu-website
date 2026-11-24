import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRIVACY_POLICY } from "@/lib/marketing/legal";

describe("Privacy Policy public Vercel parity", () => {
  it("keeps How We Use Information bullets aligned to the live public site", () => {
    const howWeUse = PRIVACY_POLICY.sections.find(
      (s) => s.heading === "4. How We Use Information",
    );
    assert.ok(howWeUse?.bullets);
    const blob = howWeUse!.bullets!.join("\n");
    assert.match(blob, /Provide customer support and respond to requests/);
    assert.equal(
      blob.includes(
        "Authorized Hello to Cheers team members may access account information",
      ),
      false,
      "unapproved support-portal wording must not appear on public Privacy Policy",
    );
  });
});
