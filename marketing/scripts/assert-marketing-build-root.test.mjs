import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(here, "assert-marketing-build-root.mjs");
const marketingRoot = path.resolve(here, "..");
const repoRoot = path.resolve(marketingRoot, "..");

function run(cwd, args) {
  return spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value));
}

async function fixtureMarketingRoot({
  packageName = "wevenu-marketing",
  parentName = "wevenu-website",
  omit = [],
  omitParent = false,
} = {}) {
  const parent = await mkdtemp(path.join(tmpdir(), "htc-assert-"));
  const cwd = path.join(parent, "marketing");
  await mkdir(cwd, { recursive: true });
  if (!omitParent) {
    await writeJson(path.join(parent, "package.json"), { name: parentName });
  }
  const files = {
    "package.json": { name: packageName },
    "package-lock.json": { name: packageName, lockfileVersion: 3 },
    "next.config.ts": "export default {};\n",
    "app/layout.tsx": "export default function Layout() { return null; }\n",
    "lib/marketing/nav.ts": "export const MARKETING_NAV = [];\n",
  };
  for (const [relativePath, contents] of Object.entries(files)) {
    if (omit.includes(relativePath)) continue;
    const filePath = path.join(cwd, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      typeof contents === "string" ? contents : JSON.stringify(contents),
    );
  }
  return {
    cwd,
    parent,
    async cleanup() {
      await rm(parent, { recursive: true, force: true });
    },
  };
}

test("confirms the real marketing directory", () => {
  const result = run(marketingRoot, ["scripts/assert-marketing-build-root.mjs"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Marketing build root confirmed/);
});

test("fails closed for the product-app directory when invoked by absolute path", () => {
  const result = run(repoRoot, [scriptPath]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /wevenu-website/);
  assert.match(result.stderr, /expected "wevenu-marketing"/);
});

test("fails closed when the Vercel relative build command is run at the product root", () => {
  const result = run(repoRoot, ["scripts/assert-marketing-build-root.mjs"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot find module|MODULE_NOT_FOUND|ENOENT/);
});

test("marketing npm run build stays next build", async () => {
  const pkg = JSON.parse(await readFile(path.join(marketingRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "wevenu-marketing");
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts["assert:build-root"], "node scripts/assert-marketing-build-root.mjs");
});

test("fails when package.json is missing", async () => {
  const fixture = await fixtureMarketingRoot({ omit: ["package.json"] });
  try {
    const result = run(fixture.cwd, [scriptPath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /package\.json is missing or unreadable/);
  } finally {
    await fixture.cleanup();
  }
});

test("fails when the package name is not the marketing app", async () => {
  const fixture = await fixtureMarketingRoot({ packageName: "wevenu-website" });
  try {
    const result = run(fixture.cwd, [scriptPath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected "wevenu-marketing"/);
  } finally {
    await fixture.cleanup();
  }
});

test("fails when a required marketing build file is missing", async () => {
  const fixture = await fixtureMarketingRoot({ omit: ["lib/marketing/nav.ts"] });
  try {
    const result = run(fixture.cwd, [scriptPath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /lib\/marketing\/nav\.ts/);
  } finally {
    await fixture.cleanup();
  }
});

test("fails when the monorepo parent package is missing", async () => {
  const fixture = await fixtureMarketingRoot({ omitParent: true });
  try {
    const result = run(fixture.cwd, [scriptPath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /parent package\.json is missing or unreadable/);
  } finally {
    await fixture.cleanup();
  }
});

test("fails when the parent package is not the product app", async () => {
  const fixture = await fixtureMarketingRoot({ parentName: "something-else" });
  try {
    const result = run(fixture.cwd, [scriptPath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected "wevenu-website"/);
  } finally {
    await fixture.cleanup();
  }
});

test("passes a complete marketing-shaped fixture", async () => {
  const fixture = await fixtureMarketingRoot();
  try {
    const result = run(fixture.cwd, [scriptPath]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    await fixture.cleanup();
  }
});
