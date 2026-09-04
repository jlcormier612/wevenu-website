/**
 * Keep /public/pdf.worker.min.mjs in sync with the installed pdfjs-dist
 * (Floor Plan Phase 2 — PDF page-1 raster in the browser).
 */
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const dest = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

if (!fs.existsSync(src)) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found; skipped.");
  process.exit(0);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("[copy-pdf-worker] wrote public/pdf.worker.min.mjs");
