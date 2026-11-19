/**
 * Every production sendEmail / sendRawEmail call site must set an explicit
 * category so uncategorized traffic cannot consume critical reserved slots.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { describe, it } from "node:test";

const IGNORE = [
  "node_modules",
  ".worktrees",
  "scripts/",
  "docs/",
  ".test.",
  "_smoke",
  "resend-path-coverage",
  "send-classification-coverage",
  "invite-send-intercept",
  "send-trust.test",
  "communication-preview.test",
  "payment-request-send-once.test",
];

describe("sendEmail / sendRawEmail classification coverage", () => {
  it("no production call site omits category", () => {
    const out = execSync(
      `rg -n "sendEmail\\(\\{|sendRawEmail\\(\\{" -g '*.ts' -g '*.tsx' --glob '!**/*.test.*' --glob '!scripts/**' --glob '!docs/**' -A 14 || true`,
      { encoding: "utf8", cwd: process.cwd() },
    );

    const missing: string[] = [];
    const blocks = out.split(/(?=^[^\s-]+:\d+:)/m).filter(Boolean);
    for (const block of blocks) {
      const header = block.split("\n")[0] ?? "";
      if (IGNORE.some((x) => header.includes(x) || block.includes(x))) continue;
      if (!header.includes("sendEmail({") && !header.includes("sendRawEmail({")) continue;
      // Transport wrappers assign category before postResendEmail — OK if they
      // derive it from payload.category ?? DEFAULT
      if (header.includes("lib/email/send.ts") || header.includes("shared/email/client.ts")) continue;
      if (!/category:\s*["']/.test(block) && !/category:\s*input\.category/.test(block)) {
        missing.push(header.slice(0, 160));
      }
    }

    assert.deepEqual(missing, [], `Unclassified send sites:\n${missing.join("\n")}`);
  });

  it("default category is bulk (uncategorized)", async () => {
    const { DEFAULT_SEND_CATEGORY, priorityForCategory } = await import(
      "@shared/email/pacing/priority"
    );
    assert.equal(DEFAULT_SEND_CATEGORY, "uncategorized");
    assert.equal(priorityForCategory(DEFAULT_SEND_CATEGORY), "bulk");
  });
});
