/**
 * Writes a static HTML comparison of all 10 Photo Styles with the same
 * 6-photo canonical specimen. Open in a browser for visual QA.
 *
 *   node --import tsx docs/qa/wedding-website-studio-photo-style-content-contract/render-comparison.mts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GalleryGrid, resolveTheme } from "../../../components/wedding-website/wedding-website";
import { buildPreviewSite } from "../../../lib/wedding-website/preview-site";
import { resolveStudioPreviewPhotos } from "../../../lib/wedding-website/studio-preview-content";
import { PHASE_B_PHOTO_STYLE_TOKENS } from "../../../lib/wedding-website/photo-style-phase-b-tokens";
import type { CatalogCollection, CatalogPhotoStyle } from "../../../lib/wedding-website/types";

const __dir = dirname(fileURLToPath(import.meta.url));
const outHtml = join(__dir, "all-10-same-6-photos.html");

const collection: CatalogCollection = {
  id: "id-classic",
  key: "classic",
  name: "classic",
  description: null,
  isPremium: false,
  sortOrder: 0,
  swatchAccent: null,
  layoutConfig: { galleryLayout: "grid", animationStyle: "none" },
  colorStories: [],
};

const photos = resolveStudioPreviewPhotos();
const cards: string[] = [];

for (const key of Object.keys(PHASE_B_PHOTO_STYLE_TOKENS)) {
  const tokens = PHASE_B_PHOTO_STYLE_TOKENS[key]!;
  const photoStyle: CatalogPhotoStyle = {
    id: `ps-${key}`,
    key,
    name: key,
    description: null,
    sortOrder: 0,
    tokens,
  };
  const tc = resolveTheme(buildPreviewSite({ collection, photoStyle }));
  const dark = /brightness\(\s*0\.[0-7]/.test(tokens.photoFilter || "");
  const grid = renderToStaticMarkup(
    React.createElement(GalleryGrid, { photos, tc }),
  );
  cards.push(`
    <figure class="card">
      <div class="specimen" style="background:${dark ? "#0a0a0c" : "#f7f5f1"}">${grid}</div>
      <figcaption><strong>${key}</strong> · ${photos.length} photos</figcaption>
    </figure>
  `);
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Photo Style content contract — same 6 photos × 10 styles</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; margin: 0; padding: 2rem; background: #efeae3; color: #1c1824; }
    h1 { font-weight: 400; font-size: 1.6rem; margin: 0 0 0.35rem; }
    p { margin: 0 0 1.5rem; opacity: 0.7; max-width: 40rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
    .card { margin: 0; background: #fff; border-radius: 1rem; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
    .specimen { min-height: 220px; padding: 0.5rem; overflow: hidden; }
    .specimen img { max-width: 100%; }
    figcaption { padding: 0.75rem 1rem 1rem; font-size: 0.85rem; border-top: 1px solid #ece6dc; text-transform: capitalize; }
  </style>
</head>
<body>
  <h1>Same six photographs · ten art directions</h1>
  <p>Canonical Photo Style specimen (${photos.length} distinct URLs). Content count is constant; composition differs.</p>
  <div class="grid">${cards.join("\n")}</div>
</body>
</html>`;

mkdirSync(__dir, { recursive: true });
writeFileSync(outHtml, html);
console.log(`Wrote ${outHtml}`);
