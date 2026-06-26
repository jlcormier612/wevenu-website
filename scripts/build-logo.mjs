// Wevenu logo builder — produces editable Bézier SVG artwork + PNG previews.
// Wordmark is OUTLINED to vector paths via opentype.js (font-independent).
// Botanical motif (single continuous stem, two leaves, daisy) is hand-authored
// per the refinement brief. Run: node scripts/build-logo.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "brand");
const CACHE = join(__dirname, ".fontcache");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

const FONTS = {
  word: {
    file: "CormorantGaramond.ttf",
    urls: [
      "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf",
      "https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf",
    ],
  },
  tag: {
    file: "Montserrat.ttf",
    urls: [
      "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
    ],
  },
};

async function getFont(spec) {
  const cached = join(CACHE, spec.file);
  if (existsSync(cached)) return opentype.parse(toAB(readFileSync(cached)));
  for (const url of spec.urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(cached, buf);
      return opentype.parse(toAB(buf));
    } catch {
      /* try next */
    }
  }
  throw new Error(`Could not fetch font ${spec.file}`);
}
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

const r2 = (n) => Math.round(n * 100) / 100;
function trackedPaths(font, text, x, y, size, tracking) {
  let cx = x;
  const parts = [];
  const scale = size / font.unitsPerEm;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    const p = g.getPath(cx, y, size);
    parts.push(p.toPathData(2));
    cx += g.advanceWidth * scale + tracking;
  }
  return { d: parts.join(" "), width: cx - tracking - x };
}
function trackedWidth(font, text, size, tracking) {
  const scale = size / font.unitsPerEm;
  let w = 0;
  for (const ch of text) w += font.charToGlyph(ch).advanceWidth * scale + tracking;
  return w - tracking;
}

// ---- daisy + leaf geometry -------------------------------------------------
function petal(cx, cy, deg, len, wid) {
  const d = `M0 0 C${r2(-wid * 0.5)} ${r2(-len * 0.32)} ${r2(-wid * 0.5)} ${r2(
    -len * 0.86,
  )} 0 ${r2(-len)} C${r2(wid * 0.5)} ${r2(-len * 0.86)} ${r2(wid * 0.5)} ${r2(
    -len * 0.32,
  )} 0 0 Z`;
  return `<path d="${d}" transform="translate(${r2(cx)} ${r2(cy)}) rotate(${r2(
    deg,
  )})" />`;
}
function daisy(cx, cy, radius, c) {
  const len = radius;
  const wid = radius * 0.42;
  const n = 11;
  const petals = [];
  for (let i = 0; i < n; i++) {
    petals.push(petal(cx, cy, (360 / n) * i, len, wid));
  }
  const stroke =
    c.petalStroke && c.petalStrokeW
      ? ` stroke="${c.petalStroke}" stroke-width="${c.petalStrokeW}"`
      : "";
  return `
  <g fill="${c.petalFill}"${stroke} stroke-linejoin="round">
    ${petals.join("\n    ")}
  </g>
  <circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(radius * 0.3)}" fill="${
    c.centerFill
  }" />`;
}
function leaf(x, y, deg, len, wid, fill) {
  const d = `M0 0 C${r2(wid * 0.55)} ${r2(-len * 0.3)} ${r2(wid * 0.5)} ${r2(
    -len * 0.72,
  )} 0 ${r2(-len)} C${r2(-wid * 0.5)} ${r2(-len * 0.72)} ${r2(-wid * 0.55)} ${r2(
    -len * 0.3,
  )} 0 0 Z`;
  return `<path d="${d}" fill="${fill}" transform="translate(${r2(x)} ${r2(
    y,
  )}) rotate(${r2(deg)})" />`;
}

// ---- build -----------------------------------------------------------------
const word = await getFont(FONTS.word);
const tag = await getFont(FONTS.tag);

const WORD = "Wevenu";
const TAG = "VENUE OPERATING SYSTEM";
const SIZE = 300;
const baseX = 80;
const baseY = 340;

const wordPath = word.getPath(WORD, baseX, baseY, SIZE);
const wb = wordPath.getBoundingBox(); // {x1,y1,x2,y2}
const W = wb.x2 - wb.x1;
const H = wb.y2 - wb.y1;
const wordD = wordPath.toPathData(2);

// botanical anchors (relative to wordmark bbox)
const rightX = wb.x2 + 0.016 * W; // hugs just outside the right edge of "u"
const daisyCx = wb.x2 - 0.065 * W; // above center/top-right of "u"
const daisyCy = wb.y1 - 0.05 * H; // hangs just above the cap line
const daisyR = 0.31 * H;

// key points of the single continuous stem
const p0 = [wb.x1 + 0.34 * W, wb.y2 + 0.1 * H]; // start under v/e gap
const pDip = [wb.x1 + 0.6 * W, wb.y2 + 0.185 * H]; // lowest point of the sweep
const pTurn = [wb.x2 - 0.012 * W, wb.y2 + 0.105 * H]; // bottom-right turn under u
const pRise = [rightX, wb.y1 + 0.54 * H]; // rising outside the u
const pBase = [daisyCx + 0.004 * W, daisyCy + daisyR * 0.52]; // base of the daisy
const dipY = pDip[1]; // (kept for viewBox bounds)

// single continuous open Bézier chain: under v/e gap -> sweep tight along the
// bottom -> turn up outside the "u" -> graceful curl into the daisy base.
const stem = [
  `M ${r2(p0[0])} ${r2(p0[1])}`,
  `C ${r2(p0[0] + 0.12 * W)} ${r2(p0[1] + 0.1 * H)} ${r2(pDip[0] - 0.1 * W)} ${r2(
    pDip[1],
  )} ${r2(pDip[0])} ${r2(pDip[1])}`,
  `C ${r2(pDip[0] + 0.19 * W)} ${r2(pDip[1])} ${r2(pTurn[0] - 0.05 * W)} ${r2(
    pTurn[1] + 0.04 * H,
  )} ${r2(pTurn[0])} ${r2(pTurn[1])}`,
  `C ${r2(pTurn[0] + 0.03 * W)} ${r2(pTurn[1] - 0.05 * H)} ${r2(
    pRise[0] + 0.012 * W,
  )} ${r2(pRise[1] + 0.16 * H)} ${r2(pRise[0])} ${r2(pRise[1])}`,
  `C ${r2(pRise[0] - 0.018 * W)} ${r2(pRise[1] - 0.2 * H)} ${r2(
    pBase[0] + 0.05 * W,
  )} ${r2(pBase[1] + 0.12 * H)} ${r2(pBase[0])} ${r2(pBase[1])}`,
].join(" ");

// two leaves on the rising stem, near the flower
const leaf1 = { x: rightX + 0.012 * W, y: wb.y1 + 0.5 * H, deg: 64, len: 0.23 * H, wid: 0.105 * H };
const leaf2 = { x: daisyCx + 0.065 * W, y: daisyCy + daisyR * 0.9, deg: 32, len: 0.19 * H, wid: 0.09 * H };

// tagline centered under the wordmark
const tagSize = 0.135 * H;
const tagTrack = tagSize * 0.42;
const tagW = trackedWidth(tag, TAG, tagSize, tagTrack);
const wordCx = (wb.x1 + wb.x2) / 2;
const tagY = wb.y2 + 0.5 * H;
const tagOut = trackedPaths(tag, TAG, wordCx - tagW / 2, tagY, tagSize, tagTrack);

// bounds for viewBox / cropping
const pad = 46;
const minX = Math.min(wb.x1, p0[0], daisyCx - daisyR) - pad;
const minY = Math.min(wb.y1, daisyCy - daisyR) - pad;
const maxX = Math.max(wb.x2, rightX, daisyCx + daisyR, wordCx + tagW / 2) + pad;
const maxY = Math.max(tagY + tagSize * 0.3, dipY) + pad;
const vbW = maxX - minX;
const vbH = maxY - minY;

const stemW = r2(0.02 * H);

function compose(c, { withTag = true } = {}) {
  const strokeDaisy =
    c.petalStroke && c.petalStrokeW
      ? ` stroke="${c.petalStroke}" stroke-width="${c.petalStrokeW}"`
      : "";
  void strokeDaisy;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r2(minX)} ${r2(
    minY,
  )} ${r2(vbW)} ${r2(vbH)}" width="${r2(vbW)}" height="${r2(vbH)}" role="img" aria-label="Wevenu">
  <g>
    <path d="${stem}" fill="none" stroke="${c.stem}" stroke-width="${stemW}" stroke-linecap="round" />
    ${leaf(leaf1.x, leaf1.y, leaf1.deg, leaf1.len, leaf1.wid, c.leaf)}
    ${leaf(leaf2.x, leaf2.y, leaf2.deg, leaf2.len, leaf2.wid, c.leaf)}
    ${daisy(daisyCx, daisyCy, daisyR, c)}
  </g>
  <path d="${wordD}" fill="${c.word}" />
  ${withTag ? `<path d="${tagOut.d}" fill="${c.tagline}" />` : ""}
</svg>`;
}

const schemes = {
  "wevenu-logo": {
    word: "#4F5F4F",
    stem: "#5D6F5D",
    leaf: "#6F8B6B",
    petalFill: "#FFFFFF",
    petalStroke: "#DED7CB",
    petalStrokeW: 1.4,
    centerFill: "#E0B968",
    tagline: "#B7AEA1",
  },
  "wevenu-logo-black": {
    word: "#1B1B1B",
    stem: "#1B1B1B",
    leaf: "#1B1B1B",
    petalFill: "none",
    petalStroke: "#1B1B1B",
    petalStrokeW: 2.2,
    centerFill: "#1B1B1B",
    tagline: "#1B1B1B",
  },
  "wevenu-logo-white": {
    word: "#FFFFFF",
    stem: "#FFFFFF",
    leaf: "#FFFFFF",
    petalFill: "none",
    petalStroke: "#FFFFFF",
    petalStrokeW: 2.2,
    centerFill: "#FFFFFF",
    tagline: "#FFFFFF",
  },
  "wevenu-logo-sage": {
    word: "#5D6F5D",
    stem: "#5D6F5D",
    leaf: "#5D6F5D",
    petalFill: "none",
    petalStroke: "#5D6F5D",
    petalStrokeW: 2.2,
    centerFill: "#5D6F5D",
    tagline: "#5D6F5D",
  },
};

const written = [];
for (const [name, c] of Object.entries(schemes)) {
  const svg = compose(c);
  writeFileSync(join(OUT, `${name}.svg`), svg);
  written.push(`${name}.svg`);
}
// "horizontal" alias = primary master
writeFileSync(join(OUT, "wevenu-logo-horizontal.svg"), compose(schemes["wevenu-logo"]));

// ---- icon / favicon (daisy motif in a square) ------------------------------
function iconSVG(c, bg) {
  const S = 512;
  const cx = S / 2;
  const cy = S / 2 + 6;
  const R = S * 0.34;
  const bgRect = bg ? `<rect width="${S}" height="${S}" rx="${S * 0.22}" fill="${bg}" />` : "";
  const stemLocal = `M ${r2(cx - R * 0.05)} ${r2(cy + R * 1.05)} C ${r2(
    cx - R * 0.4,
  )} ${r2(cy + R * 0.8)} ${r2(cx - R * 0.32)} ${r2(cy + R * 0.25)} ${r2(cx)} ${r2(
    cy + R * 0.42,
  )}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="Wevenu">
  ${bgRect}
  <path d="${stemLocal}" fill="none" stroke="${c.stem}" stroke-width="${r2(
    R * 0.07,
  )}" stroke-linecap="round" />
  ${leaf(cx - R * 0.34, cy + R * 0.74, -28, R * 0.5, R * 0.22, c.leaf)}
  ${daisy(cx, cy, R, c)}
</svg>`;
}
writeFileSync(join(OUT, "wevenu-icon.svg"), iconSVG(schemes["wevenu-logo"], "#F5F4F2"));
writeFileSync(
  join(OUT, "wevenu-icon-mono.svg"),
  iconSVG(schemes["wevenu-logo-white"], null),
);
written.push("wevenu-logo-horizontal.svg", "wevenu-icon.svg", "wevenu-icon-mono.svg");

// ---- PNG previews ----------------------------------------------------------
async function png(svgName, outName, { bg, width = 1600 } = {}) {
  const svg = readFileSync(join(OUT, svgName));
  let img = sharp(svg, { density: 300 }).resize({ width });
  if (bg) img = img.flatten({ background: bg });
  await img.png().toFile(join(OUT, outName));
}
await png("wevenu-logo.svg", "wevenu-logo.png", {}); // transparent
await png("wevenu-logo.svg", "wevenu-logo-preview-linen.png", { bg: "#F5F4F2" });
await png("wevenu-logo-white.svg", "wevenu-logo-preview-evening.png", { bg: "#161B16" });
await png("wevenu-icon.svg", "wevenu-icon.png", { width: 512 });

// ---- PDF (vector, font-independent) ----------------------------------------
function pdf(svgName, outName, w, h) {
  return new Promise((resolve, reject) => {
    const svg = readFileSync(join(OUT, svgName), "utf8");
    const doc = new PDFDocument({ size: [w, h], margin: 0 });
    const stream = createWriteStream(join(OUT, outName));
    doc.pipe(stream);
    SVGtoPDF(doc, svg, 0, 0, { width: w, height: h, assumePt: true });
    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
const pdfW = Math.round(vbW);
const pdfH = Math.round(vbH);
await pdf("wevenu-logo.svg", "wevenu-logo.pdf", pdfW, pdfH);
await pdf("wevenu-logo-black.svg", "wevenu-logo-black.pdf", pdfW, pdfH);
await pdf("wevenu-logo-white.svg", "wevenu-logo-white.pdf", pdfW, pdfH);
await pdf("wevenu-logo-sage.svg", "wevenu-logo-sage.pdf", pdfW, pdfH);
await pdf("wevenu-icon.svg", "wevenu-icon.pdf", 512, 512);
written.push(
  "wevenu-logo.pdf",
  "wevenu-logo-black.pdf",
  "wevenu-logo-white.pdf",
  "wevenu-logo-sage.pdf",
  "wevenu-icon.pdf",
);

console.log("Wrote:\n" + written.map((w) => "  public/brand/" + w).join("\n"));
console.log("Wordmark bbox:", wb, "viewBox:", [minX, minY, vbW, vbH].map(r2));
