/**
 * Assemble a marketing-only source from an explicit commit and deploy one
 * Vercel Preview of the existing hello-to-cheers project.
 *
 * The installed Vercel CLI (deploy/parseTarget) treats a deploy with neither
 * `--prod` nor `--target` as Preview. This script never passes either flag.
 * `vercel api` GET `/v9/projects/:id` is the read-only settings check: project
 * inspect prints those fields, but not as JSON.
 *
 * It does not promote, assign domains, or change project settings.
 */
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_PROJECT_NAME = "hello-to-cheers";
const EXPECTED_PROJECT_ID = "prj_JqFrVHLf8bvaF55wK9AzqISvtAAg";
const EXPECTED_ROOT_DIRECTORY = "marketing";
const EXPECTED_BUILD_COMMAND =
  "node scripts/assert-marketing-build-root.mjs && npm run build";
const EXPECTED_MARKETING_PACKAGE = "wevenu-marketing";
const EXPECTED_PARENT_PACKAGE = "wevenu-website";
const TEMP_PREFIX = "htc-mkt-preview-";
const GUARD_RELATIVE = "marketing/scripts/assert-marketing-build-root.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(here, "../..");

function fail(message) {
  const error = new Error(message);
  error.previewDeployRefusal = true;
  throw error;
}

export function assertCommitArgument(commit) {
  if (typeof commit !== "string" || commit.trim() === "") {
    fail("A commit SHA is required. This script does not default to HEAD.");
  }
  const value = commit.trim();
  if (!/^[0-9a-f]{7,40}$/i.test(value)) {
    fail(`Commit must be a Git SHA, not ${JSON.stringify(value)}.`);
  }
  return value;
}

export function assertProjectLink(link) {
  if (!link || typeof link !== "object") {
    fail("`.vercel/project.json` is missing or unreadable.");
  }
  if (link.projectName !== EXPECTED_PROJECT_NAME || link.projectId !== EXPECTED_PROJECT_ID) {
    fail(
      `Refusing to deploy: project link is ${JSON.stringify(link.projectName ?? null)} / ${JSON.stringify(link.projectId ?? null)}, expected ${EXPECTED_PROJECT_NAME} / ${EXPECTED_PROJECT_ID}.`,
    );
  }
  if (typeof link.orgId !== "string" || !link.orgId.startsWith("team_")) {
    fail("Refusing to deploy: project link has no team orgId.");
  }
  return {
    orgId: link.orgId,
    projectId: link.projectId,
    projectName: link.projectName,
  };
}

export function assertRemoteProject(project) {
  if (!project || typeof project !== "object") {
    fail("Vercel project settings could not be read.");
  }
  if (project.name !== EXPECTED_PROJECT_NAME || project.id !== EXPECTED_PROJECT_ID) {
    fail(
      `Refusing to deploy: Vercel project is ${JSON.stringify(project.name ?? null)} / ${JSON.stringify(project.id ?? null)}.`,
    );
  }
  if (project.rootDirectory !== EXPECTED_ROOT_DIRECTORY) {
    fail(
      `Refusing to deploy: Root Directory is ${JSON.stringify(project.rootDirectory ?? null)}, expected ${JSON.stringify(EXPECTED_ROOT_DIRECTORY)}.`,
    );
  }
  if (project.buildCommand !== EXPECTED_BUILD_COMMAND) {
    fail(
      `Refusing to deploy: Build Command is ${JSON.stringify(project.buildCommand ?? null)}.`,
    );
  }
  return {
    name: project.name,
    id: project.id,
    rootDirectory: project.rootDirectory,
    buildCommand: project.buildCommand,
  };
}

export function buildDeployArgv() {
  return ["deploy", "--yes"];
}

export function assertPreviewArgv(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv[0] !== "deploy") {
    fail("Refusing to deploy: command is not `vercel deploy`.");
  }
  for (const arg of argv) {
    if (arg === "--prod" || arg === "--production" || arg.startsWith("--target")) {
      fail(`Refusing to deploy: ${arg} would override the Preview target.`);
    }
  }
  return argv;
}

function forbiddenFileReason(relativePath) {
  const base = relativePath.split("/").at(-1) ?? relativePath;
  if (base === "vercel.json") return "vercel.json";
  // Allow committed .env.example templates; block real env files.
  if (base === ".env" || (base.startsWith(".env.") && !base.endsWith(".example"))) {
    return base;
  }
  if (base === "credentials.json" || base === "credentials") return base;
  if (/\.(pem|p12|pfx)$/i.test(base)) return base;
  return null;
}

async function listFiles(root) {
  const files = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        files.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
    }
  }
  await walk(root);
  return files.sort();
}

export async function assertDeploymentSource(root, commitFiles) {
  const actual = await listFiles(root);
  for (const relativePath of actual) {
    const reason = forbiddenFileReason(relativePath);
    if (reason) {
      fail(`Refusing to deploy: assembled source contains ${reason} (${relativePath}).`);
    }
  }

  const parentRaw = await readFile(path.join(root, "package.json"), "utf8");
  let parent;
  try {
    parent = JSON.parse(parentRaw);
  } catch {
    fail("Parent package.json is not valid JSON.");
  }
  const parentKeys = Object.keys(parent).sort();
  if (
    parentKeys.join(",") !== "name,private" ||
    parent.name !== EXPECTED_PARENT_PACKAGE ||
    parent.private !== true
  ) {
    fail(
      `Parent package identity is invalid. Expected only name ${EXPECTED_PARENT_PACKAGE} and private true.`,
    );
  }

  const marketingRaw = await readFile(path.join(root, "marketing", "package.json"), "utf8");
  let marketing;
  try {
    marketing = JSON.parse(marketingRaw);
  } catch {
    fail("marketing/package.json is not valid JSON.");
  }
  if (marketing.name !== EXPECTED_MARKETING_PACKAGE) {
    fail(
      `Marketing package name is ${JSON.stringify(marketing.name ?? null)}, expected ${JSON.stringify(EXPECTED_MARKETING_PACKAGE)}.`,
    );
  }

  try {
    await access(path.join(root, GUARD_RELATIVE));
  } catch {
    fail(`Committed build-root guard is missing: ${GUARD_RELATIVE}.`);
  }

  if (commitFiles) {
    const allowed = new Set(commitFiles);
    allowed.add("package.json");
    allowed.add(".vercel/project.json");
    for (const relativePath of actual) {
      if (!allowed.has(relativePath)) {
        fail(`Assembled source contains a file that is not from the commit: ${relativePath}.`);
      }
    }
    for (const relativePath of commitFiles) {
      if (!actual.includes(relativePath)) {
        fail(`Committed file missing from assembled source: ${relativePath}.`);
      }
    }
  }

  try {
    await access(path.join(root, "vercel.json"));
    fail("Refusing to deploy: vercel.json exists at the upload root.");
  } catch (error) {
    if (error?.previewDeployRefusal) throw error;
  }
}

function defaultRun(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function gitText(run, repoRoot, args) {
  const result = run("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  if (result.error) {
    fail(`git ${args[0]} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    fail(detail ? `git ${args.join(" ")} failed: ${detail}` : `git ${args.join(" ")} failed.`);
  }
  return (result.stdout || "").replace(/\n$/, "");
}

export function resolveCommit(run, repoRoot, commit) {
  const sha = assertCommitArgument(commit);
  const resolved = gitText(run, repoRoot, ["rev-parse", "--verify", `${sha}^{commit}`]);
  if (!/^[0-9a-f]{40}$/.test(resolved)) {
    fail(`git did not resolve ${sha} to a commit.`);
  }
  return resolved;
}

function commitFileList(run, repoRoot, sha) {
  const text = gitText(run, repoRoot, [
    "ls-tree",
    "-r",
    "--name-only",
    sha,
    "marketing",
    "shared",
  ]);
  return text.split("\n").map((line) => line.trim()).filter(Boolean).sort();
}

async function extractCommit(run, repoRoot, sha, destination) {
  const archivePath = path.join(destination, "source.tar");
  const archived = run(
    "git",
    ["-C", repoRoot, "archive", "--format=tar", "-o", archivePath, sha, "marketing", "shared"],
    { encoding: "utf8" },
  );
  if (archived.error || archived.status !== 0) {
    const detail = (archived.stderr || archived.error?.message || "").trim();
    fail(detail || "git archive failed.");
  }
  const extracted = run("tar", ["-xf", archivePath, "-C", destination], { encoding: "utf8" });
  if (extracted.error || extracted.status !== 0) {
    const detail = (extracted.stderr || extracted.error?.message || "").trim();
    fail(detail || "tar extract failed.");
  }
  await rm(archivePath, { force: true });
}

function safeTempPath(directory) {
  const tempRoot = path.resolve(tmpdir());
  const resolved = path.resolve(directory);
  if (resolved !== tempRoot && !resolved.startsWith(tempRoot + path.sep)) {
    fail(`Refusing to delete a directory outside the temp dir: ${directory}`);
  }
  if (!path.basename(resolved).startsWith(TEMP_PREFIX)) {
    fail(`Refusing to delete a directory this script did not create: ${directory}`);
  }
  return resolved;
}

async function readProjectLink(repoRoot) {
  let raw;
  try {
    raw = await readFile(path.join(repoRoot, ".vercel", "project.json"), "utf8");
  } catch {
    fail("`.vercel/project.json` is missing.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail("`.vercel/project.json` is not valid JSON.");
  }
}

function readRemoteProject(run, link) {
  const endpoint = `/v9/projects/${encodeURIComponent(link.projectId)}?teamId=${encodeURIComponent(link.orgId)}`;
  const result = run("vercel", ["api", endpoint, "--method", "GET"], { encoding: "utf8" });
  if (result.error) {
    fail(`Could not read Vercel project settings: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail("Could not read Vercel project settings (vercel api GET failed). Settings were not changed.");
  }
  let project;
  try {
    project = JSON.parse(result.stdout);
  } catch {
    fail("Vercel project settings were not valid JSON. Refusing to deploy.");
  }
  return project;
}

function printPlan({ sha, link, settings, argv, uploadRoot }) {
  console.log(`Commit: ${sha}`);
  console.log(`Project: ${link.projectName} (${link.projectId})`);
  console.log(`Root Directory: ${settings.rootDirectory}`);
  console.log(`Build Command: ${settings.buildCommand}`);
  console.log(`Upload root: ${uploadRoot}`);
  console.log(`Command: vercel ${argv.join(" ")}`);
}

export async function deployMarketingPreview({
  commit,
  repoRoot = defaultRepoRoot,
  run = defaultRun,
} = {}) {
  const sha = resolveCommit(run, repoRoot, commit);
  const link = assertProjectLink(await readProjectLink(repoRoot));
  const committedFiles = commitFileList(run, repoRoot, sha);
  if (!committedFiles.includes(GUARD_RELATIVE)) {
    fail(`Commit ${sha} does not contain the build-root guard (${GUARD_RELATIVE}).`);
  }

  const uploadRoot = safeTempPath(await mkdtemp(path.join(tmpdir(), TEMP_PREFIX)));
  try {
    await extractCommit(run, repoRoot, sha, uploadRoot);
    await writeFile(
      path.join(uploadRoot, "package.json"),
      `${JSON.stringify({ name: EXPECTED_PARENT_PACKAGE, private: true })}\n`,
    );
    await mkdir(path.join(uploadRoot, ".vercel"), { recursive: true });
    await writeFile(
      path.join(uploadRoot, ".vercel", "project.json"),
      `${JSON.stringify(link)}\n`,
    );
    await assertDeploymentSource(uploadRoot, committedFiles);

    const settings = assertRemoteProject(readRemoteProject(run, link));
    const argv = assertPreviewArgv(buildDeployArgv());
    printPlan({ sha, link, settings, argv, uploadRoot });
    const deployed = run("vercel", argv, { cwd: uploadRoot, stdio: "inherit" });
    if (deployed.error) {
      fail(`vercel deploy failed to start: ${deployed.error.message}`);
    }
    if (deployed.status !== 0) {
      fail(`vercel deploy exited ${deployed.status}. No retry will be attempted.`);
    }
    return { sha, uploadRoot, argv };
  } finally {
    await rm(safeTempPath(uploadRoot), { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  deployMarketingPreview({ commit: process.argv[2], repoRoot: defaultRepoRoot })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}
