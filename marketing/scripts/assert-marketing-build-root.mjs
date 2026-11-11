/**
 * Fail closed unless the current working directory is the Hello to Cheers
 * marketing app inside this monorepo.
 *
 * Vercel runs the project Build Command with cwd set to the configured Root
 * Directory. This script therefore trusts process.cwd() and never the script's
 * own path: invoking it by absolute path from the product-app root must fail.
 *
 * It is not part of `npm run build`. The ECS/Sandbox image build keeps calling
 * `npm run build` (`next build`) and does not run this check.
 *
 * The hello-to-cheers Vercel Build Command is:
 *   node scripts/assert-marketing-build-root.mjs && npm run build
 * That command runs only when Vercel builds this project. It is not invoked
 * by the Docker image build.
 */
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const EXPECTED_PACKAGE = "wevenu-marketing";
const EXPECTED_PARENT_PACKAGE = "wevenu-website";
const REQUIRED_FILES = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "app/layout.tsx",
  "lib/marketing/nav.ts",
];

function fail(message) {
  console.error(`Refusing to build: ${message}`);
  process.exit(1);
}

async function readPackageJson(filePath, label) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    fail(`${label} is missing or unreadable (${filePath}).`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail(`${label} is not valid JSON (${filePath}).`);
  }
}

async function main() {
  const cwd = process.cwd();
  const pkg = await readPackageJson(path.join(cwd, "package.json"), "package.json");
  if (pkg.name !== EXPECTED_PACKAGE) {
    fail(
      `package name is ${JSON.stringify(pkg.name ?? null)}, expected ${JSON.stringify(EXPECTED_PACKAGE)}.`,
    );
  }

  for (const relativePath of REQUIRED_FILES) {
    try {
      await access(path.join(cwd, relativePath));
    } catch {
      fail(`required marketing build file is missing: ${relativePath}.`);
    }
  }

  const parent = await readPackageJson(
    path.join(cwd, "..", "package.json"),
    "parent package.json",
  );
  if (parent.name !== EXPECTED_PARENT_PACKAGE) {
    fail(
      `parent package name is ${JSON.stringify(parent.name ?? null)}, expected ${JSON.stringify(EXPECTED_PARENT_PACKAGE)}.`,
    );
  }

  console.log(`Marketing build root confirmed (${EXPECTED_PACKAGE}).`);
}

await main();
