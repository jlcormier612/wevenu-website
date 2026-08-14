/**
 * Code-path visual fixtures for combination audit (read-only).
 * Renders GalleryGrid for all 10 Photo Styles at desktop (720) and mobile (359) widths.
 *
 *   node --import tsx docs/qa/wedding-website-studio-combination-audit/render-photo-surfaces.mts
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
const outHtml = join(__dir, "photo-surfaces-matrix.html");

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
const widths = [
  { label: "studio-mobile-inner", width: 359, note: "~375px phone − 8px×2 border" },
  { label: "studio-desktop-pane", width: 720, note: "typical Live Preview desk pane" },
  { label: "published-mobile", width: 390, note: "iPhone-ish published viewport" },
];

const sections: string[] = [];

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
  const grid = renderToStaticMarkup(React.createElement(GalleryGrid, { photos, tc }));
  const cols = widths
    .map(
      (w) => `
      <div class="surface">
        <div class="label">${w.label} · ${w.width}px<br/><span>${w.note}</span></div>
        <div class="frame" style="width:${w.width}px;background:${dark ? "#0a0a0c" : "#f7f5f1"}">
          <div class="@container/wedding" style="width:100%">${grid}</div>
        </div>
      </div>`,
    )
    .join("");
  sections.push(`
    <section class="style">
      <h2>${key}</h2>
      <p class="meta">arrangement=${tokens.arrangement} · scale=${tokens.scalePattern} · frame=${tokens.frameStyle} · spacing=${tokens.spacing}</p>
      <div class="row">${cols}</div>
    </section>
  `);
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Combination audit — Photo Style × surface widths</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 1.5rem; background: #e8e4df; color: #1a1612; }
    h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 0.25rem; }
    .lede { opacity: 0.7; margin: 0 0 1.5rem; max-width: 44rem; font-size: 0.92rem; }
    .style { margin-bottom: 2rem; background: #fff; border-radius: 1rem; padding: 1rem 1rem 1.25rem; box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
    .style h2 { margin: 0; text-transform: capitalize; font-size: 1.1rem; }
    .meta { margin: 0.25rem 0 0.85rem; font-size: 0.75rem; opacity: 0.55; font-family: ui-monospace, monospace; }
    .row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start; }
    .surface { display: flex; flex-direction: column; gap: 0.4rem; }
    .label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.55; }
    .label span { text-transform: none; letter-spacing: 0; opacity: 0.8; }
    .frame { border: 1px solid #ddd6cb; border-radius: 0.5rem; overflow: hidden; }
    .frame img { display: block; max-width: 100%; }
  </style>
</head>
<body>
  <h1>Photo Style × preview surface widths</h1>
  <p class="lede">Static SSR of the same GalleryGrid used by Studio + published. Container widths match Studio mobile phone inner (~359), Studio desktop pane (~720), and a published phone (~390). Same 6 canonical photos.</p>
  ${sections.join("\n")}
</body>
</html>`;

mkdirSync(__dir, { recursive: true });
writeFileSync(outHtml, html);
console.log(`wrote ${outHtml} (${photos.length} photos × ${Object.keys(PHASE_B_PHOTO_STYLE_TOKENS).length} styles × ${widths.length} widths)`);
