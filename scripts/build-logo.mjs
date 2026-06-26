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

// Wordmark weight: a few notches heavier (more presence, same elegant feel).
// Faux-weight via a hairline stroke in the wordmark colour — the Cormorant
// source is a single static instance, so this thickens the stems evenly
// (~3 steps) without swapping to a "Bold" cut.
const WORD_WEIGHT = r2(SIZE * 0.019); // ≈5.7 at SIZE=300 — clearly heavier, still not bold

// Right edge of the "v" as ACTUALLY rendered (kerning included) — measured from
// the bbox of the "Wev" prefix so the stem starts at the v, not under the "e".
const vRightX = word.getPath(WORD.slice(0, 3), baseX, baseY, SIZE).getBoundingBox().x2;

// botanical anchors (relative to wordmark bbox)
const rightX = wb.x2 + 0.016 * W; // hugs just outside the right edge of "u"
const daisyCx = wb.x2 - 0.065 * W; // above center/top-right of "u"
const daisyCy = wb.y1 - 0.05 * H; // hangs just above the cap line
const daisyR = 0.31 * H;

// key points of the single continuous stem.
// One clean swoosh: starts right at the right side of the "v" (not under the
// "e"), sweeps in a single shallow curve to ONE low point under the "u", then a
// wide rounded turn up the right side and a graceful curl into the daisy.
// No mid-curve dip/corner pair — that was what made it crimp and bend.
const p0 = [vRightX - 0.025 * W, wb.y2 + 0.045 * H]; // start: under the right side of the "v"
const pLow = [wb.x1 + 0.8 * W, wb.y2 + 0.135 * H]; // single low point — horizontal tangent
const pTurn = [rightX + 0.004 * W, wb.y2 + 0.02 * H]; // rounded bottom-right — vertical tangent
const pBase = [daisyCx + 0.004 * W, daisyCy + daisyR * 0.52]; // base of the daisy
const dipY = pLow[1]; // (kept for viewBox bounds)

// Three cubics, tangent-continuous (G1) at every anchor: horizontal at pLow,
// vertical at pTurn. A clean, rounded line — no kinks.
const stem = [
  `M ${r2(p0[0])} ${r2(p0[1])}`,
  // p0 -> pLow : one gentle shallow sweep, easing to a horizontal low point
  `C ${r2(p0[0] + 0.2 * W)} ${r2(p0[1] + 0.03 * H)} ${r2(pLow[0] - 0.17 * W)} ${r2(
    pLow[1],
  )} ${r2(pLow[0])} ${r2(pLow[1])}`,
  // pLow -> pTurn : leave horizontal (collinear), arrive vertical — wide round
  `C ${r2(pLow[0] + 0.17 * W)} ${r2(pLow[1])} ${r2(pTurn[0])} ${r2(
    pTurn[1] + 0.075 * H,
  )} ${r2(pTurn[0])} ${r2(pTurn[1])}`,
  // pTurn -> pBase : leave vertical (collinear), rise and curl into the daisy
  `C ${r2(pTurn[0])} ${r2(pTurn[1] - 0.45 * H)} ${r2(pBase[0] + 0.06 * W)} ${r2(
    pBase[1] + 0.22 * H,
  )} ${r2(pBase[0])} ${r2(pBase[1])}`,
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
  <path d="${wordD}" fill="${c.word}" stroke="${c.word}" stroke-width="${WORD_WEIGHT}" stroke-linejoin="round" />
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
    centerFill: "#D7C49C", // warm champagne / candlelight (not golden sunflower)
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

// ---- Brand Presentation sheet (founder approval package) -------------------
// One composed board showing every required lockup, colourway, background and
// in-application example. Built from the same vector sources above, so it can
// never drift from the shipped logo files.
{
  const PAL = {
    linen: "#F5F4F2",
    ink: "#4F5F4F", // forest sage
    sage: "#5D6F5D", // heritage sage
    fresh: "#B8CEC1",
    freshSoft: "#E4ECE5",
    muted: "#8E978E",
    border: "#E6E3DC",
    evening: "#161B16",
    eveningText: "#F5F4F2",
    champagne: "#D7C49C",
    white: "#FFFFFF",
  };

  // pre-rendered vector sources
  const SRC = {
    primary: compose(schemes["wevenu-logo"], { withTag: true }),
    lockup: compose(schemes["wevenu-logo"], { withTag: false }),
    white: compose(schemes["wevenu-logo-white"], { withTag: true }),
    whiteLockup: compose(schemes["wevenu-logo-white"], { withTag: false }),
    black: compose(schemes["wevenu-logo-black"], { withTag: true }),
    sage: compose(schemes["wevenu-logo-sage"], { withTag: true }),
    icon: iconSVG(schemes["wevenu-logo"], PAL.linen),
    iconMono: iconSVG(schemes["wevenu-logo-white"], null),
    iconEvening: iconSVG(schemes["wevenu-logo"], PAL.evening),
  };

  // place an inner SVG into a box with aspect-fit, using a transform group
  // (avoids nested <svg>, which some rasterisers handle inconsistently).
  function place(svg, x, y, boxW, boxH, align = "mid") {
    const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const inner = svg.replace(/^[\s\S]*?>/, "").replace(/<\/svg>\s*$/, "");
    const [mx, my, w, h] = vb;
    const s = Math.min(boxW / w, boxH / h);
    const ox = align === "left" ? 0 : (boxW - w * s) / 2;
    const dx = x + ox - mx * s;
    const dy = y + (boxH - h * s) / 2 - my * s;
    return `<g transform="translate(${r2(dx)} ${r2(dy)}) scale(${r2(s)})">${inner}</g>`;
  }

  // outlined Montserrat label (uppercase, tracked) — font-independent
  function cap(text, x, y, size, color, track) {
    const t = trackedPaths(tag, text.toUpperCase(), x, y, size, track ?? size * 0.16);
    return { svg: `<path d="${t.d}" fill="${color}" />`, w: t.width };
  }
  const capW = (text, size, track) =>
    trackedWidth(tag, text.toUpperCase(), size, track ?? size * 0.16);
  // Montserrat, normal case (for nav/body text in mockups)
  function txt(text, x, y, size, color, track = 0) {
    const t = trackedPaths(tag, text, x, y, size, track);
    return { svg: `<path d="${t.d}" fill="${color}" />`, w: t.width };
  }
  // Cormorant serif (for headings + the "Wevenu" lockup text)
  function serif(text, x, y, size, color) {
    const p = word.getPath(text, x, y, size);
    return `<path d="${p.toPathData(2)}" fill="${color}" />`;
  }

  const els = [];
  let photoTop = 0; // captured for the clip rect declared in <defs>
  const CW = 1680;
  const M = 90;
  const innerW = CW - 2 * M;
  const card = (x, y, w, h, bg = PAL.white, stroke = PAL.border, rx = 18) =>
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(
      h,
    )}" rx="${rx}" fill="${bg}" stroke="${stroke}" stroke-width="1.5" />`;
  const cellLabel = (x, y, text) => cap(text, x + 2, y + 16, 14.5, PAL.muted).svg;
  const LBL = 30; // vertical space a cell label occupies before its card

  let y = 84;

  // ---- title block ---------------------------------------------------------
  els.push(place(SRC.icon, M, y - 4, 92, 92));
  els.push(serif("Brand Presentation", M + 116, y + 46, 56, PAL.sage));
  els.push(cap("Founder Approval Package", M + 119, y + 78, 15.5, PAL.muted).svg);
  {
    const metaY = y + 20;
    const m1 = "Venue Operating System";
    const w1 = capW(m1, 14.5);
    els.push(cap(m1, CW - M - w1, metaY, 14.5, PAL.ink).svg);
    const m2 = "Identity v1.0  ·  2026-06-25";
    const w2 = capW(m2, 12, 12 * 0.14);
    els.push(cap(m2, CW - M - w2, metaY + 26, 12, PAL.muted, 12 * 0.14).svg);
  }
  y += 118;
  els.push(
    `<line x1="${M}" y1="${y}" x2="${CW - M}" y2="${y}" stroke="${PAL.border}" stroke-width="1.5" />`,
  );
  y += 46;

  const sectionTitle = (text) => {
    els.push(serif(text, M, y + 26, 32, PAL.ink));
    const w = capW("section", 1); // unused
    void w;
    y += 52;
  };

  // ==== SECTION 1 — Logo System ============================================
  sectionTitle("Logo System");

  // Primary (full width)
  els.push(cellLabel(M, y, "Primary Logo"));
  els.push(card(M, y + LBL, innerW, 300));
  els.push(place(SRC.primary, M + 60, y + LBL + 34, innerW - 120, 232));
  y += LBL + 300 + 34;

  // 3-col: Horizontal lockup · Icon · Single-colour (sage)
  {
    const g = 30;
    const w3 = (innerW - 2 * g) / 3;
    const h = 222;
    const xs = [M, M + w3 + g, M + 2 * (w3 + g)];
    els.push(cellLabel(xs[0], y, "Horizontal Lockup"));
    els.push(card(xs[0], y + LBL, w3, h));
    els.push(place(SRC.lockup, xs[0] + 36, y + LBL + 30, w3 - 72, h - 60));

    els.push(cellLabel(xs[1], y, "App Icon"));
    els.push(card(xs[1], y + LBL, w3, h));
    {
      const isz = 150;
      const ix = xs[1] + (w3 - isz) / 2;
      const iy = y + LBL + (h - isz) / 2;
      els.push(place(SRC.icon, ix, iy, isz, isz));
      els.push(
        `<rect x="${r2(ix)}" y="${r2(iy)}" width="${isz}" height="${isz}" rx="${r2(
          isz * 0.22,
        )}" fill="none" stroke="${PAL.border}" stroke-width="1.3" />`,
      );
    }

    els.push(cellLabel(xs[2], y, "Single-Colour (Heritage Sage)"));
    els.push(card(xs[2], y + LBL, w3, h));
    els.push(place(SRC.sage, xs[2] + 36, y + LBL + 30, w3 - 72, h - 60));
    y += LBL + h + 34;
  }

  // 2-col: Black on white · White on evening
  {
    const g = 30;
    const w2 = (innerW - g) / 2;
    const h = 220;
    els.push(cellLabel(M, y, "Black Version"));
    els.push(card(M, y + LBL, w2, h));
    els.push(place(SRC.black, M + 44, y + LBL + 30, w2 - 88, h - 60));

    els.push(cellLabel(M + w2 + g, y, "White Version"));
    els.push(card(M + w2 + g, y + LBL, w2, h, PAL.evening, PAL.evening));
    els.push(place(SRC.white, M + w2 + g + 44, y + LBL + 30, w2 - 88, h - 60));
    y += LBL + h + 50;
  }

  // ==== SECTION 2 — On Backgrounds =========================================
  sectionTitle("On Backgrounds");
  {
    const g = 30;
    const w2 = (innerW - g) / 2;
    const h = 240;
    els.push(cellLabel(M, y, "On Linen"));
    els.push(card(M, y + LBL, w2, h, PAL.linen, PAL.border));
    els.push(place(SRC.primary, M + 50, y + LBL + 36, w2 - 100, h - 72));

    els.push(cellLabel(M + w2 + g, y, "On Heritage Sage"));
    els.push(card(M + w2 + g, y + LBL, w2, h, PAL.sage, PAL.sage));
    els.push(place(SRC.white, M + w2 + g + 50, y + LBL + 36, w2 - 100, h - 72));
    y += LBL + h + 34;
  }

  // Over photography (subtle gradient + bokeh stand-in)
  {
    const h = 320;
    const x = M;
    const cy = y + LBL;
    photoTop = cy;
    els.push(cellLabel(x, y, "Over Photography (example)"));
    els.push(`<g clip-path="url(#photoClip)">
      <rect x="${x}" y="${cy}" width="${innerW}" height="${h}" fill="url(#photoGrad)" />
      <circle cx="${x + innerW * 0.16}" cy="${cy + h * 0.34}" r="120" fill="#FFFFFF" opacity="0.10" />
      <circle cx="${x + innerW * 0.30}" cy="${cy + h * 0.7}" r="70" fill="#FFFFFF" opacity="0.08" />
      <circle cx="${x + innerW * 0.86}" cy="${cy + h * 0.26}" r="150" fill="#FFFFFF" opacity="0.07" />
      <circle cx="${x + innerW * 0.72}" cy="${cy + h * 0.8}" r="90" fill="#FFFFFF" opacity="0.06" />
      <rect x="${x}" y="${cy}" width="${innerW}" height="${h}" fill="url(#photoScrim)" />
    </g>`);
    els.push(place(SRC.white, x + 60, cy + 44, innerW - 120, h - 88));
    y += LBL + h + 50;
  }

  // ==== SECTION 3 — In Application =========================================
  sectionTitle("In Application");

  // Application header mockup
  {
    const h = 96;
    const x = M;
    const top = y + LBL;
    els.push(cellLabel(x, y, "Application Header"));
    els.push(card(x, top, innerW, h, PAL.white));
    const midY = top + h / 2;
    // left lockup
    els.push(place(SRC.icon, x + 26, midY - 22, 44, 44));
    els.push(serif("Wevenu", x + 82, midY + 11, 34, PAL.sage));
    // nav items (right of lockup)
    const nav = ["Dashboard", "Calendar", "Events", "Clients", "Analytics"];
    let nx = x + 300;
    nav.forEach((n, i) => {
      const active = i === 0;
      const t = txt(n, nx, midY + 5, 15, active ? PAL.sage : PAL.muted, 0.2);
      if (active)
        els.push(
          `<rect x="${r2(nx - 14)}" y="${r2(midY - 17)}" width="${r2(
            t.w + 28,
          )}" height="34" rx="17" fill="${PAL.freshSoft}" />`,
        );
      els.push(t.svg);
      nx += t.w + 44;
    });
    // right cluster: search pill + avatar
    const av = x + innerW - 30 - 36;
    els.push(`<circle cx="${r2(av + 18)}" cy="${r2(midY)}" r="20" fill="${PAL.sage}" />`);
    els.push(serif("M", av + 11, midY + 9, 26, PAL.white));
    const pillW = 180;
    const px = av - 24 - pillW;
    els.push(
      `<rect x="${r2(px)}" y="${r2(midY - 17)}" width="${pillW}" height="34" rx="17" fill="${PAL.linen}" stroke="${PAL.border}" stroke-width="1.2" />`,
    );
    els.push(`<circle cx="${r2(px + 19)}" cy="${r2(midY)}" r="5.5" fill="none" stroke="${PAL.muted}" stroke-width="2" />`);
    els.push(`<line x1="${r2(px + 23)}" y1="${r2(midY + 4)}" x2="${r2(px + 28)}" y2="${r2(midY + 9)}" stroke="${PAL.muted}" stroke-width="2" stroke-linecap="round" />`);
    els.push(txt("Search events, clients…", px + 38, midY + 4, 12.5, PAL.muted).svg);
    y += LBL + h + 34;
  }

  // Sidebar mockup + Favicon panel
  {
    const g = 30;
    const sideW = 430;
    const favW = innerW - sideW - g;
    const h = 596;
    const sx = M;
    const fx = M + sideW + g;
    const top = y + LBL;

    // --- sidebar ---
    els.push(cellLabel(sx, y, "Application Sidebar"));
    els.push(card(sx, top, sideW, h, PAL.white));
    // brand lockup
    els.push(place(SRC.icon, sx + 26, top + 24, 38, 38));
    els.push(serif("Wevenu", sx + 74, top + 50, 30, PAL.sage));
    els.push(
      `<line x1="${sx + 26}" y1="${top + 80}" x2="${sx + sideW - 26}" y2="${top + 80}" stroke="${PAL.border}" stroke-width="1.2" />`,
    );
    const NAV = [
      ["Overview", [["Dashboard", true], ["Calendar", false]]],
      ["Relationships", [["Leads", false], ["Clients", false], ["Vendors", false]]],
      ["Events", [["Events", false], ["Tasks", false], ["Timeline", false], ["Floor Plan", false]]],
      ["Finance", [["Contracts", false], ["Payments", false]]],
    ];
    let ny = top + 112;
    const padX = sx + 26;
    const itemH = 30;
    for (const [label, items] of NAV) {
      els.push(cap(label, padX, ny, 11, PAL.muted, 11 * 0.22).svg);
      ny += 22;
      for (const [name, active] of items) {
        if (active)
          els.push(
            `<rect x="${padX - 8}" y="${r2(ny - 19)}" width="${sideW - 36}" height="${itemH}" rx="9" fill="${PAL.freshSoft}" />`,
          );
        const chip = active ? PAL.sage : "#CBD4CB";
        els.push(
          `<rect x="${padX}" y="${r2(ny - 16)}" width="18" height="18" rx="5" fill="none" stroke="${chip}" stroke-width="2" />`,
        );
        els.push(txt(name, padX + 32, ny - 2, 14.5, active ? PAL.sage : PAL.ink, 0.1).svg);
        ny += itemH;
      }
      ny += 12;
    }

    // --- favicon / app icon panel ---
    els.push(cellLabel(fx, y, "Favicon / App Icon"));
    els.push(card(fx, top, favW, h));
    const fpad = fx + 36;
    let fy = top + 36;
    const iconFrame = (ix, iy, s) =>
      `<rect x="${r2(ix)}" y="${r2(iy)}" width="${r2(s)}" height="${r2(
        s,
      )}" rx="${r2(s * 0.22)}" fill="none" stroke="${PAL.border}" stroke-width="1.2" />`;
    // hero app icon
    els.push(place(SRC.icon, fpad, fy, 132, 132));
    els.push(iconFrame(fpad, fy, 132));
    els.push(serif("App Icon", fpad + 160, fy + 52, 30, PAL.ink));
    els.push(cap("Rounded · 512 px master", fpad + 162, fy + 80, 12.5, PAL.muted).svg);
    fy += 132 + 44;
    els.push(
      `<line x1="${fpad}" y1="${fy}" x2="${fx + favW - 36}" y2="${fy}" stroke="${PAL.border}" stroke-width="1.2" />`,
    );
    fy += 40;
    // size ladder
    els.push(cap("Scales Cleanly", fpad, fy - 16, 11, PAL.muted, 11 * 0.22).svg);
    fy += 14;
    const sizes = [80, 56, 40, 28, 18];
    let lx = fpad;
    const ladderBase = fy + 80;
    for (const s of sizes) {
      els.push(place(SRC.icon, lx, ladderBase - s, s, s));
      els.push(iconFrame(lx, ladderBase - s, s));
      els.push(cap(`${s}`, lx, ladderBase + 22, 10.5, PAL.muted).svg);
      lx += s + 26;
    }
    fy = ladderBase + 56;
    els.push(
      `<line x1="${fpad}" y1="${fy}" x2="${fx + favW - 36}" y2="${fy}" stroke="${PAL.border}" stroke-width="1.2" />`,
    );
    fy += 36;
    // browser tab mock
    els.push(cap("Browser Tab", fpad, fy - 8, 11, PAL.muted, 11 * 0.22).svg);
    fy += 14;
    const tabW = 300;
    const tabH = 44;
    els.push(
      `<path d="M ${fpad} ${fy + tabH} L ${fpad} ${fy + 12} Q ${fpad} ${fy} ${fpad + 12} ${fy} L ${fpad + tabW - 12} ${fy} Q ${fpad + tabW} ${fy} ${fpad + tabW} ${fy + 12} L ${fpad + tabW} ${fy + tabH} Z" fill="${PAL.white}" stroke="${PAL.border}" stroke-width="1.2" />`,
    );
    els.push(place(SRC.icon, fpad + 14, fy + (tabH - 20) / 2, 20, 20));
    els.push(serif("Wevenu — Venue OS", fpad + 44, fy + tabH / 2 + 6, 19, PAL.ink));
    els.push(`<line x1="${fpad + tabW - 26}" y1="${fy + tabH / 2 - 5}" x2="${fpad + tabW - 16}" y2="${fy + tabH / 2 + 5}" stroke="${PAL.muted}" stroke-width="1.6" stroke-linecap="round" />`);
    els.push(`<line x1="${fpad + tabW - 16}" y1="${fy + tabH / 2 - 5}" x2="${fpad + tabW - 26}" y2="${fy + tabH / 2 + 5}" stroke="${PAL.muted}" stroke-width="1.6" stroke-linecap="round" />`);
    fy += tabH + 30;
    // monochrome favicon on dark
    els.push(cap("Monochrome", fpad, fy - 8, 11, PAL.muted, 11 * 0.22).svg);
    fy += 14;
    els.push(`<rect x="${fpad}" y="${fy}" width="60" height="60" rx="14" fill="${PAL.evening}" />`);
    els.push(place(SRC.iconMono, fpad + 9, fy + 9, 42, 42));
    els.push(`<rect x="${fpad + 76}" y="${fy}" width="60" height="60" rx="14" fill="${PAL.sage}" />`);
    els.push(place(SRC.iconMono, fpad + 76 + 9, fy + 9, 42, 42));
    els.push(txt("Reverses to a single colour on dark or sage surfaces.", fpad + 152, fy + 35, 12.5, PAL.muted).svg);

    y += LBL + h + 30;
  }

  // ---- footer --------------------------------------------------------------
  els.push(
    `<line x1="${M}" y1="${y}" x2="${CW - M}" y2="${y}" stroke="${PAL.border}" stroke-width="1.5" />`,
  );
  y += 30;
  els.push(
    cap(
      "Wevenu Brand Standard — frozen upon founder approval",
      M,
      y,
      12.5,
      PAL.muted,
      12.5 * 0.14,
    ).svg,
  );
  {
    const rt = "© 2026 Wevenu";
    const rw = capW(rt, 12.5, 12.5 * 0.14);
    els.push(cap(rt, CW - M - rw, y, 12.5, PAL.muted, 12.5 * 0.14).svg);
  }
  y += 60;

  const CH = Math.round(y);
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${CW}" height="${CH}" role="img" aria-label="Wevenu Brand Presentation">
  <defs>
    <linearGradient id="photoGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6E7F6A" />
      <stop offset="0.45" stop-color="#52624F" />
      <stop offset="1" stop-color="#2C3A2C" />
    </linearGradient>
    <linearGradient id="photoScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#13180F" stop-opacity="0.05" />
      <stop offset="1" stop-color="#13180F" stop-opacity="0.42" />
    </linearGradient>
    <clipPath id="photoClip"><rect x="${M}" y="${photoTop}" width="${innerW}" height="320" rx="18" /></clipPath>
  </defs>
  <rect width="${CW}" height="${CH}" fill="${PAL.linen}" />
  ${els.join("\n  ")}
</svg>`;
  writeFileSync(join(OUT, "wevenu-brand-presentation.svg"), sheet);
  written.push("wevenu-brand-presentation.svg");
  await sharp(Buffer.from(sheet), { density: 144 })
    .png()
    .toFile(join(OUT, "wevenu-brand-presentation.png"));
  written.push("wevenu-brand-presentation.png");
}

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
