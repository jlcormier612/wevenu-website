/**
 * Partial import outcomes must not claim full success while records need attention.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Migration Center partial import clarity", () => {
  const src = readFileSync(resolve("components/settings/migration-center.tsx"), "utf8");

  it("post-commit toast uses session guidance instead of always toast.success", () => {
    assert.match(src, /formatPartialImportGuidance/);
    assert.match(src, /getMigrationSessionResumeStateAction\(sessionId\)/);
    const commitFn = src.slice(src.indexOf("function handleCommit"), src.indexOf("async function handlePreviewCleanup"));
    assert.match(commitFn, /guidance\.tone === "attention"/);
    assert.match(commitFn, /toast\.message/);
    assert.doesNotMatch(
      commitFn,
      /toast\.success\(`Imported \$\{result\.outcome\.committed\}/,
    );
  });

  it("surfaces a durable needs-attention callout for partial / review states", () => {
    assert.match(src, /data-migration-outcome="needs-attention"/);
    assert.match(src, /partialGuidance/);
    assert.match(src, /Partly imported — some records need attention/);
    assert.match(src, /Needs your decision/);
  });
});
