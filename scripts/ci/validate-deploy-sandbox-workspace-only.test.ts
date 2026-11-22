/**
 * Static validation for Deploy Sandbox Workspace Only workflow.
 * Ensures fail-closed gates without executing AWS.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const wfPath = join(
  process.cwd(),
  ".github/workflows/deploy-sandbox-workspace-only.yml",
);
const src = readFileSync(wfPath, "utf8");

describe("deploy-sandbox-workspace-only workflow", () => {
  it("is manual workflow_dispatch only (no push/PR triggers)", () => {
    assert.match(src, /workflow_dispatch:/);
    assert.equal(/\non:\s*\n\s*push:/.test(src), false);
    assert.equal(/\non:\s*\n\s*pull_request:/.test(src), false);
    assert.equal(src.includes("schedule:"), false);
  });

  it("requires full sha input and main ancestry gate", () => {
    assert.match(src, /inputs:\s*\n\s*sha:/);
    assert.match(src, /\[0-9a-f\]\{40\}/);
    assert.match(src, /merge-base --is-ancestor/);
    assert.match(src, /origin\/main/);
    assert.match(src, /Unmerged feature tips are rejected/);
  });

  it("uses sandbox environment and sandbox-only stack/account guards", () => {
    assert.match(src, /environment:\s*sandbox/);
    assert.match(src, /htc-sandbox/);
    assert.match(src, /405254329873/);
    assert.match(src, /Refusing non-sandbox stack/);
    assert.match(src, /Refusing production-looking stack/);
    assert.match(src, /us-east-1/);
  });

  it("updates only WorkspaceImage and preserves other images", () => {
    assert.match(src, /ParameterKey=WorkspaceImage,ParameterValue=/);
    assert.match(src, /ParameterKey=VenueAppImage,UsePreviousValue=true/);
    assert.match(src, /ParameterKey=MarketingImage,UsePreviousValue=true/);
    assert.match(src, /ParameterKey=SchedulerImage,UsePreviousValue=true/);
    assert.match(src, /get-template --stack-name/);
    assert.match(src, /template-stage Processed/);
  });

  it("fail-closes change sets that touch non-Workspace resources", () => {
    assert.match(src, /non-workspace resources/);
    assert.match(src, /if "Workspace" in lid/);
  });

  it("does not build or deploy venue/marketing/scheduler images", () => {
    assert.equal(src.includes("htc-sandbox-venue-app:"), false);
    assert.equal(src.includes("Dockerfile.scheduler"), false);
    assert.match(src, /htc-sandbox-workspace/);
    assert.match(src, /workspace\/Dockerfile/);
  });

  it("verifies sibling services unchanged and does not print secrets", () => {
    assert.match(src, /pre-non-workspace-tds\.json/);
    assert.match(src, /untouched_check/);
    assert.equal(/put-secret|SecretString|AWS_SECRET_ACCESS_KEY\s*:/.test(src), false);
    assert.equal(src.includes("echo \"$ROLE\""), false);
  });

  it("has no Production deploy path", () => {
    assert.equal(/environment:\s*production/.test(src), false);
    assert.equal(src.includes("htc-production"), false);
  });
});
