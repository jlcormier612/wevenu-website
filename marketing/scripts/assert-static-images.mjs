#!/usr/bin/env node
/**
 * Fail the build if required derived photography variants are missing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const marketingRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(
  marketingRoot,
  "public/marketing/derived/manifest.json",
);
const generatedTs = path.join(
  marketingRoot,
  "lib/marketing/static-photo-assets.generated.ts",
);

function fail(msg) {
  console.error(`assert-static-images: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) fail(`missing ${manifestPath}`);
if (!fs.existsSync(generatedTs)) fail(`missing ${generatedTs}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const images = manifest.images || {};
if (Object.keys(images).length < 1) fail("manifest has no images");

for (const [id, img] of Object.entries(images)) {
  const sourceRel = String(img.source || "").replace(/^\//, "");
  const sourceAbs = path.join(marketingRoot, "public", sourceRel);
  if (!fs.existsSync(sourceAbs)) fail(`original missing for ${id}: ${sourceAbs}`);
  const variants = img.variants || {};
  if (Object.keys(variants).length < 1) fail(`no variants for ${id}`);
  for (const [w, v] of Object.entries(variants)) {
    const rel = String(v.path || "").replace(/^\//, "");
    const abs = path.join(marketingRoot, "public", rel);
    if (!fs.existsSync(abs)) fail(`derived missing ${id}@${w}: ${abs}`);
    if (fs.statSync(abs).size < 100) fail(`derived too small ${id}@${w}`);
  }
}

console.log(
  `assert-static-images: OK (${Object.keys(images).length} photos, originals present)`,
);
