import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertCommitArgument,
  assertDeploymentSource,
  assertPreviewArgv,
  assertProjectLink,
  assertRemoteProject,
  buildDeployArgv,
  deployMarketingPreview,
} from "./deploy-marketing-preview.mjs";

const GOOD_SETTINGS = {
  name: "hello-to-cheers",
  id: "prj_JqFrVHLf8bvaF55wK9AzqISvtAAg",
  rootDirectory: "marketing",
  buildCommand: "node scripts/assert-marketing-build-root.mjs && npm run build",
};

const GOOD_LINK = {
  orgId: "team_test_fixture",
  projectId: "prj_JqFrVHLf8bvaF55wK9AzqISvtAAg",
  projectName: "hello-to-cheers",
};

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "HTC Test",
  GIT_AUTHOR_EMAIL: "htc-test@example.com",
  GIT_COMMITTER_NAME: "HTC Test",
  GIT_COMMITTER_EMAIL: "htc-test@example.com",
};

function git(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", env: gitEnv });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return (result.stdout || "").trim();
}

async function writeFixtureFile(repo, relativePath, contents) {
  const absolute = path.join(repo, relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, contents);
}

async function createFixtureRepo({
  marketingName = "wevenu-marketing",
  includeGuard = true,
  extraCommitted = {},
} = {}) {
  const repo = await mkdirTemp("htc-mkt-fixture-");
  git(repo, ["init", "-b", "main"]);
  const files = {
    "marketing/package.json": JSON.stringify({ name: marketingName, private: true }),
    "marketing/package-lock.json": "{}\n",
    "marketing/next.config.ts": "export default {};\n",
    "marketing/app/layout.tsx": "export default function Layout() { return null; }\n",
    "marketing/lib/marketing/nav.ts": "export const MARKETING_NAV = [];\n",
    "shared/marker.txt": "shared\n",
    "package.json": JSON.stringify({
      name: "wevenu-website",
      private: true,
      scripts: { build: "next build" },
    }),
    "vercel.json": "{\"crons\":[]}\n",
    ...extraCommitted,
  };
  if (includeGuard) {
    files["marketing/scripts/assert-marketing-build-root.mjs"] =
      "console.log('Marketing build root confirmed (wevenu-marketing).');\n";
  }
  for (const [relativePath, contents] of Object.entries(files)) {
    await writeFixtureFile(repo, relativePath, contents);
  }
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "fixture"]);
  await writeFile(
    path.join(repo, ".vercel", "project.json"),
    `${JSON.stringify(GOOD_LINK)}\n`,
  );
  await mkdir(path.join(repo, ".vercel"), { recursive: true }).catch(() => {});
  await writeFile(path.join(repo, "KEEP"), "main-checkout-marker\n");
  return repo;
}

async function mkdirTemp(prefix) {
  const { mkdtemp } = await import("node:fs/promises");
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  if (prefix === "htc-mkt-fixture-") {
    await mkdir(path.join(directory, ".vercel"), { recursive: true });
  }
  return directory;
}

function mockRun({ settings = GOOD_SETTINGS, apiStatus = 0 } = {}) {
  const calls = [];
  return {
    calls,
    run(command, args, options = {}) {
      if (command === "git" || command === "tar") {
        return spawnSync(command, args, { encoding: "utf8", env: gitEnv, ...options });
      }
      calls.push({ command, args, cwd: options.cwd ?? null, stdio: options.stdio ?? null });
      if (command === "vercel" && args[0] === "api") {
        return { status: apiStatus, stdout: JSON.stringify(settings), stderr: "" };
      }
      if (command === "vercel" && args[0] === "deploy") {
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 1, stderr: `unexpected ${command}` };
    },
  };
}

async function newTempNames() {
  const before = new Set(await readdir(tmpdir()));
  return {
    async created() {
      const after = await readdir(tmpdir());
      return after.filter((name) => name.startsWith("htc-mkt-preview-") && !before.has(name));
    },
  };
}

test("missing commit argument fails", () => {
  assert.throws(() => assertCommitArgument(undefined), /commit SHA is required/);
  assert.throws(() => assertCommitArgument("   "), /commit SHA is required/);
  assert.throws(() => assertCommitArgument("HEAD"), /Git SHA/);
});

test("invalid commit fails and does not deploy", async () => {
  const repo = await createFixtureRepo();
  const watcher = await newTempNames();
  const vercel = mockRun();
  try {
    await assert.rejects(
      () =>
        deployMarketingPreview({
          commit: "0123456789abcdef",
          repoRoot: repo,
          run: vercel.run,
        }),
      /0123456789abcdef/,
    );
    assert.equal(vercel.calls.some((call) => call.args[0] === "deploy"), false);
    assert.deepEqual(await watcher.created(), []);
    assert.equal(await readText(path.join(repo, "KEEP")), "main-checkout-marker\n");
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("correct project identity passes", () => {
  assert.deepEqual(assertProjectLink({ ...GOOD_LINK, extra: true }), GOOD_LINK);
  assert.deepEqual(assertRemoteProject({ ...GOOD_SETTINGS, env: [{ key: "SECRET" }] }), GOOD_SETTINGS);
});

test("wrong project name or project ID fails", () => {
  assert.throws(
    () => assertProjectLink({ ...GOOD_LINK, projectName: "quickcloud-nextjs" }),
    /quickcloud-nextjs/,
  );
  assert.throws(
    () => assertProjectLink({ ...GOOD_LINK, projectId: "prj_wrong" }),
    /prj_wrong/,
  );
  assert.throws(
    () => assertRemoteProject({ ...GOOD_SETTINGS, name: "other" }),
    /other/,
  );
  assert.throws(
    () => assertRemoteProject({ ...GOOD_SETTINGS, id: "prj_wrong" }),
    /prj_wrong/,
  );
});

test("wrong Root Directory fails before deploy", async () => {
  const repo = await createFixtureRepo();
  const sha = git(repo, ["rev-parse", "HEAD"]);
  const watcher = await newTempNames();
  const vercel = mockRun({ settings: { ...GOOD_SETTINGS, rootDirectory: null } });
  try {
    await assert.rejects(
      () => deployMarketingPreview({ commit: sha, repoRoot: repo, run: vercel.run }),
      /Root Directory/,
    );
    assert.equal(vercel.calls.some((call) => call.args[0] === "deploy"), false);
    assert.equal(vercel.calls.some((call) => call.args[0] === "api"), true);
    assert.deepEqual(await watcher.created(), []);
    assert.equal(await readText(path.join(repo, "KEEP")), "main-checkout-marker\n");
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("wrong Build Command fails before deploy", async () => {
  const repo = await createFixtureRepo();
  const sha = git(repo, ["rev-parse", "HEAD"]);
  const vercel = mockRun({ settings: { ...GOOD_SETTINGS, buildCommand: "npm run build" } });
  try {
    await assert.rejects(
      () => deployMarketingPreview({ commit: sha, repoRoot: repo, run: vercel.run }),
      /Build Command/,
    );
    assert.equal(vercel.calls.some((call) => call.args[0] === "deploy"), false);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("assembled source containing vercel.json fails", async () => {
  const root = await mkdirTemp("htc-mkt-source-");
  try {
    await writeSource(root, {});
    await writeFile(path.join(root, "vercel.json"), "{}\n");
    await assert.rejects(() => assertDeploymentSource(root), /vercel\.json/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("wrong marketing or parent package identity fails", async () => {
  const root = await mkdirTemp("htc-mkt-source-");
  try {
    await writeSource(root, { marketingName: "wevenu-website" });
    await assert.rejects(() => assertDeploymentSource(root), /Marketing package name/);
    await writeSource(root, {
      parent: { name: "wevenu-website", private: true, scripts: { build: "next build" } },
    });
    await assert.rejects(() => assertDeploymentSource(root), /Parent package identity/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing guard fails", async () => {
  const repo = await createFixtureRepo({ includeGuard: false });
  const sha = git(repo, ["rev-parse", "HEAD"]);
  const vercel = mockRun();
  try {
    await assert.rejects(
      () => deployMarketingPreview({ commit: sha, repoRoot: repo, run: vercel.run }),
      /build-root guard/,
    );
    assert.equal(vercel.calls.length, 0);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("worktree .env and product root files are not deployed", async () => {
  const repo = await createFixtureRepo();
  const sha = git(repo, ["rev-parse", "HEAD"]);
  await writeFixtureFile(repo, "marketing/.env", "STRIPE_SECRET_KEY=sk_live_example\n");
  await writeFixtureFile(repo, "marketing/.env.production", "SECRET=1\n");
  await writeFixtureFile(repo, "credentials.json", "{}\n");
  const watcher = await newTempNames();
  const vercel = mockRun();
  try {
    await deployMarketingPreview({ commit: sha, repoRoot: repo, run: vercel.run });
    const deploy = vercel.calls.find((call) => call.args[0] === "deploy");
    assert.ok(deploy);
    assert.deepEqual(deploy.args, ["deploy", "--yes"]);
    assert.equal(deploy.cwd.startsWith(repo), false);
    assert.equal(await readText(path.join(repo, "KEEP")), "main-checkout-marker\n");
    assert.equal(await readText(path.join(repo, "vercel.json")), "{\"crons\":[]}\n");
    assert.deepEqual(await watcher.created(), []);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("a committed .env fails before deploy", async () => {
  const repo = await createFixtureRepo({
    extraCommitted: { "marketing/.env": "STRIPE_SECRET_KEY=sk_live_example\n" },
  });
  const sha = git(repo, ["rev-parse", "HEAD"]);
  const vercel = mockRun();
  try {
    await assert.rejects(
      () => deployMarketingPreview({ commit: sha, repoRoot: repo, run: vercel.run }),
      /\.env/,
    );
    assert.equal(vercel.calls.some((call) => call.args[0] === "deploy"), false);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("generated command has no Production target flags", () => {
  const argv = buildDeployArgv();
  assert.deepEqual(argv, ["deploy", "--yes"]);
  assert.equal(argv.includes("--prod"), false);
  assert.equal(argv.some((arg) => arg.startsWith("--target")), false);
  assert.deepEqual(assertPreviewArgv(argv), argv);
  assert.throws(() => assertPreviewArgv(["deploy", "--prod"]), /--prod/);
  assert.throws(() => assertPreviewArgv(["deploy", "--target", "production"]), /--target/);
  assert.throws(() => assertPreviewArgv(["deploy", "--target=preview"]), /--target/);
});

test("settings read is a GET and a failed preflight does not deploy", async () => {
  const repo = await createFixtureRepo();
  const sha = git(repo, ["rev-parse", "HEAD"]);
  const vercel = mockRun({ apiStatus: 1, settings: {} });
  try {
    await assert.rejects(
      () => deployMarketingPreview({ commit: sha, repoRoot: repo, run: vercel.run }),
      /not changed/,
    );
    assert.equal(vercel.calls.length, 1);
    assert.equal(vercel.calls[0].args[0], "api");
    assert.match(vercel.calls[0].args[1], /^\/v9\/projects\/prj_JqFrVHLf8bvaF55wK9AzqISvtAAg\?teamId=team_test_fixture$/);
    assert.deepEqual(vercel.calls[0].args.slice(2), ["--method", "GET"]);
    assert.equal(await readText(path.join(repo, "KEEP")), "main-checkout-marker\n");
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

async function writeSource(root, { marketingName = "wevenu-marketing", parent } = {}) {
  const parentPackage = parent ?? { name: "wevenu-website", private: true };
  await writeFixtureFile(root, "package.json", `${JSON.stringify(parentPackage)}\n`);
  await writeFixtureFile(
    root,
    "marketing/package.json",
    JSON.stringify({ name: marketingName }),
  );
  await writeFixtureFile(
    root,
    "marketing/scripts/assert-marketing-build-root.mjs",
    "console.log('guard');\n",
  );
  await writeFixtureFile(root, ".vercel/project.json", `${JSON.stringify(GOOD_LINK)}\n`);
}

async function readText(file) {
  const { readFile } = await import("node:fs/promises");
  return readFile(file, "utf8");
}
