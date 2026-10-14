/**
 * Sandbox CI: Dockerfile FROM rewrite must cover every Public ECR library base
 * used by deploy-sandbox matrix builds, without changing committed Dockerfiles.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const ROOT = resolve(".");
const SCRIPT = resolve("scripts/ci/rewrite-sandbox-dockerfile-bases.sh");
const WORKFLOW = resolve(".github/workflows/deploy-sandbox.yml");
const REGISTRY = "405254329873.dkr.ecr.us-east-1.amazonaws.com";

const DOCKERFILES = [
  "Dockerfile",
  "Dockerfile.scheduler",
  "marketing/Dockerfile",
  "workspace/Dockerfile",
] as const;

describe("Sandbox Dockerfile base rewrite", () => {
  it("workflow invokes the rewrite script before docker build", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    const script = readFileSync(SCRIPT, "utf8");
    assert.match(yml, /rewrite-sandbox-dockerfile-bases\.sh/);
    assert.match(script, /htc-ci-bases:node-22-alpine/);
    assert.match(script, /htc-ci-bases:alpine-3\.20/);
    // Build must use the rewritten temp file, not the committed path alone.
    assert.match(yml, /docker build --pull=false -f "\$REWRITTEN"/);
    assert.doesNotMatch(
      yml.slice(yml.indexOf("- name: Build"), yml.indexOf("- name: Push")),
      /docker build --pull=false -f "\$\{\{ matrix\.dockerfile \}\}"/,
    );
  });

  it("rewrites every Public ECR library FROM across all matrix Dockerfiles", () => {
    const dir = mkdtempSync(join(tmpdir(), "htc-base-rewrite-"));
    try {
      for (const rel of DOCKERFILES) {
        const src = resolve(ROOT, rel);
        const dest = join(dir, rel.replaceAll("/", "__"));
        execFileSync(SCRIPT, [src, dest, REGISTRY], { stdio: "pipe" });
        const out = readFileSync(dest, "utf8");
        assert.doesNotMatch(out, /^FROM\s+public\.ecr\.aws\/docker\/library\//m);
        assert.match(
          out,
          new RegExp(
            `^FROM\\s+${REGISTRY.replace(/\./g, "\\.")}/htc-ci-bases:(node-22-alpine|alpine-3\\.20)`,
            "m",
          ),
        );
        // Committed source still uses Public ECR (unchanged).
        const committed = readFileSync(src, "utf8");
        assert.match(committed, /^FROM\s+public\.ecr\.aws\/docker\/library\//m);
      }
      // No stray public library FROM left in any rewritten file.
      for (const name of readdirSync(dir)) {
        const body = readFileSync(join(dir, name), "utf8");
        assert.doesNotMatch(body, /^FROM\s+public\.ecr\.aws\/docker\/library\//m);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed if a Public ECR library FROM would remain", () => {
    const dir = mkdtempSync(join(tmpdir(), "htc-base-rewrite-fail-"));
    try {
      const src = join(dir, "Dockerfile");
      const dest = join(dir, "out");
      writeFileSync(
        src,
        "FROM public.ecr.aws/docker/library/python:3.12-alpine\n",
        "utf8",
      );
      assert.throws(() => execFileSync(SCRIPT, [src, dest, REGISTRY], { stdio: "pipe" }));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
