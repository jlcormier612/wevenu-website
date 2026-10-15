/**
 * Contract setup CardDescription — customer-facing Smart Fields copy (no "tokens").
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/contracts/new/page.tsx"), "utf8");

describe("Contract setup copy", () => {
  it("uses Smart Fields customer language instead of tokens", () => {
    assert.match(
      page,
      /Select a template and client, then personalize your contract with Smart Fields\. Preview your contract before sending\. Smart Fields fill in automatically when you send\./,
    );
    assert.doesNotMatch(page, /Tokens resolve when you send/);
    assert.doesNotMatch(page, /Preview is display-only\. Tokens/);
  });
});
