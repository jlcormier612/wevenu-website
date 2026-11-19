/**
 * Guard: required hospitality check contexts must always report on PRs to main.
 * Path-filtered silence previously blocked Luv/backend-only PRs (e.g. #91).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const WF = resolve(process.cwd(), ".github/workflows/hospitality-visual-smoke.yml");

describe("Hospitality required checks always report", () => {
  const yaml = readFileSync(WF, "utf8");

  it("pull_request targets main without a top-level paths filter", () => {
    assert.match(yaml, /pull_request:\s*\n\s*branches:\s*\[main\]/);
    // No `paths:` sibling under pull_request (that silently skipped required contexts).
    const prBlock = yaml.slice(yaml.indexOf("pull_request:"), yaml.indexOf("concurrency:"));
    assert.doesNotMatch(prBlock, /^\s*paths:\s*$/m);
    assert.doesNotMatch(prBlock, /^\s*paths:\s*\n\s*-/m);
  });

  it("keeps exact required job names", () => {
    assert.match(yaml, /name:\s*Hospitality presentation source guards/);
    assert.match(yaml, /name:\s*Screenshot vs approved baseline compare/);
  });

  it("skips heavy visual steps only when presentation scope is false", () => {
    assert.match(yaml, /Detect hospitality presentation scope/);
    assert.match(yaml, /steps\.scope\.outputs\.visual == 'true'/);
    assert.match(yaml, /Skip visual source guards \(non-presentation PR\)/);
    assert.match(yaml, /Skip screenshot baseline compare \(non-presentation PR\)/);
  });

  it("still forces full visual work on workflow_dispatch", () => {
    assert.match(yaml, /workflow_dispatch/);
    assert.match(yaml, /forced on \(workflow_dispatch\)/);
  });

  it("never soft-succeeds after a failed visual gate", () => {
    // Heavy visual steps are gated by visual==true; skip steps only run when visual!=true.
    // There is no continue-on-error / always() success override after visual failures.
    assert.doesNotMatch(yaml, /continue-on-error:\s*true/);
  });
});
