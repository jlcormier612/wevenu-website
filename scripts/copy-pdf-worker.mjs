/**
 * Keep /public/pdf.worker.min.mjs in sync with the installed pdfjs-dist
 * (Floor Plan Phase 2 — PDF page-1 raster in the browser).
 *
 * Also vendor pdf-parse's own worker for server-side Import Data PDF extract
 * (Node Alpine / Next standalone cannot resolve the worker via relative
 * chunk paths — see "Setting up fake worker failed … pdf.worker.mjs").
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
fs.mkdirSync(path.join(root, "public"), { recursive: true });

const browserSrc = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const browserDest = path.join(root, "public", "pdf.worker.min.mjs");
if (fs.existsSync(browserSrc)) {
  fs.copyFileSync(browserSrc, browserDest);
  console.log("[copy-pdf-worker] wrote public/pdf.worker.min.mjs");
} else {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found; skipped browser copy.");
}

const parseWorkerCandidates = [
  path.join(root, "node_modules", "pdf-parse", "dist", "pdf-parse", "esm", "pdf.worker.mjs"),
  path.join(root, "node_modules", "pdf-parse", "dist", "worker", "pdf.worker.mjs"),
  path.join(root, "node_modules", "pdf-parse", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
];
const parseDest = path.join(root, "public", "pdf-parse.worker.mjs");
const parseSrc = parseWorkerCandidates.find((p) => fs.existsSync(p));
if (parseSrc) {
  fs.copyFileSync(parseSrc, parseDest);
  console.log("[copy-pdf-worker] wrote public/pdf-parse.worker.mjs from", path.relative(root, parseSrc));
} else {
  console.warn("[copy-pdf-worker] pdf-parse worker not found; skipped server copy.");
}
