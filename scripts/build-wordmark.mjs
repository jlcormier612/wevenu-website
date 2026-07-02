// Wevenu wordmark builder — "Wevenu" set in Cardo Bold, outlined to vector
// paths (font-independent), with a simple white + beige daisy over the "u".
// No stem, no box. Run: node scripts/build-wordmark.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "brand");
const CACHE = join(__dirname, ".fontcache");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const r2 = (n) => Math.round(n * 100) / 100;

async function getCardoBold() {
  const cached = join(CACHE, "Cardo-Bold.ttf");
  if (existsSync(cached)) return opentype.parse(toAB(readFileSync(cached)));
  const url = "https://raw.githubusercontent.com/google/fonts/main/ofl/cardo/Cardo-Bold.ttf";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch Cardo-Bold.ttf");
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(cached, buf);
  return opentype.parse(toAB(buf));
}

// ---- palette (Brand Foundation v1.1) ---------------------------------------
const SAGE = "#4F5F4F"; // dark sage — wordmark
const WHITE = "#FFFFFF"; // true white — petals
const BEIGE = "#C7BAA3"; // beige — petal outline (visible on white)
const BEIGE_DEEP = "#B7AEA1"; // warm beige — flower center

// ---- daisy (white petals + beige center, no stem) --------------------------
function daisy(cx, cy, R, { petals = 11 } = {}) {
  const petalRy = R * 0.52;
  const petalRx = R * 0.2;
  const petalDist = R * 0.5; // distance from flower centre to petal centre
  const parts = [];
  for (let i = 0; i < petals; i++) {
    const deg = (360 / petals) * i;
    parts.push(
      `<g transform="rotate(${r2(deg)} ${r2(cx)} ${r2(cy)})"><ellipse cx="${r2(
        cx,
      )}" cy="${r2(cy - petalDist)}" rx="${r2(petalRx)}" ry="${r2(
        petalRy,
      )}" fill="${WHITE}" stroke="${BEIGE}" stroke-width="${r2(R * 0.05)}" /></g>`,
    );
  }
  parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(R * 0.28)}" fill="${BEIGE_DEEP}" />`);
  return parts.join("\n  ");
}

const font = await getCardoBold();
const WORD = "Wevenu";
const SIZE = 300;
const baseX = 60;
const baseY = 320;
const scale = SIZE / font.unitsPerEm;

// full wordmark outline
const wordPath = font.getPath(WORD, baseX, baseY, SIZE);
const wordD = wordPath.toPathData(2);
const wb = wordPath.getBoundingBox();

// locate the final "u" glyph (with kerning, matching getPath layout)
const glyphs = font.stringToGlyphs(WORD);
let penX = baseX;
let uPen = baseX;
for (let i = 0; i < glyphs.length; i++) {
  if (i === glyphs.length - 1) uPen = penX;
  penX += glyphs[i].advanceWidth * scale;
  if (i < glyphs.length - 1) {
    penX += (font.getKerningValue(glyphs[i], glyphs[i + 1]) || 0) * scale;
  }
}
const ub = glyphs[glyphs.length - 1].getPath(uPen, baseY, SIZE).getBoundingBox();
const uCenterX = (ub.x1 + ub.x2) / 2;
const uTop = ub.y1; // top of the u ink (x-height line)
const xHeight = baseY - uTop;

// daisy sits just above the top of the "u", overlapping slightly
const daisyR = xHeight * 0.62;
const daisyCx = uCenterX;
const daisyCy = uTop - daisyR * 0.28;

// ---- compose SVG -----------------------------------------------------------
const pad = daisyR * 0.6;
const minX = Math.min(wb.x1, daisyCx - daisyR) - pad;
const minY = Math.min(wb.y1, daisyCy - daisyR) - pad;
const maxX = Math.max(wb.x2, daisyCx + daisyR) + pad;
const maxY = wb.y2 + pad;
const vbW = maxX - minX;
const vbH = maxY - minY;

function svg({ withBg = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r2(minX)} ${r2(minY)} ${r2(
    vbW,
  )} ${r2(vbH)}" width="${r2(vbW)}" height="${r2(vbH)}" role="img" aria-label="Wevenu">
  ${withBg ? `<rect x="${r2(minX)}" y="${r2(minY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="#FFFFFF" />` : ""}
  <path d="${wordD}" fill="${SAGE}" />
  ${daisy(daisyCx, daisyCy, daisyR)}
</svg>`;
}

writeFileSync(join(OUT, "wevenu-wordmark.svg"), svg());

// PNG previews
await sharp(Buffer.from(svg()), { density: 400 })
  .resize({ width: 1200 })
  .flatten({ background: "#FFFFFF" })
  .png()
  .toFile(join(OUT, "wevenu-wordmark-preview.png"));
await sharp(Buffer.from(svg()), { density: 400 })
  .resize({ width: 1200 })
  .png()
  .toFile(join(OUT, "wevenu-wordmark.png"));

console.log("Wrote wevenu-wordmark.svg + previews");
console.log("bbox", wb, "uCenterX", r2(uCenterX), "viewBox", [minX, minY, vbW, vbH].map(r2));
