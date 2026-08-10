/**
 * Product-matrix capture for Website Studio visual review.
 * Evidence only — judgment happens by reading PNGs into FINDINGS-REPORT.md.
 *
 * QA_MATRIX=product (default):
 *   - every Collection: picker + desktop/mobile hero+story
 *   - every curated Color Story × Wildflower + Midnight: desktop/mobile hero+story
 *   - every Photo Style on Wildflower + Sage Garden: picker + desktop/mobile gallery
 *   - risk: Midnight × Sage Garden + Meadow; Magazine desktop already covered
 *
 * QA_SMOKE=1: Midnight × Black Tie × Magazine only
 */
import { createRequire } from "node:module";
import { mkdir, writeFile, appendFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const EVIDENCE = path.join(OUT, "manual-evidence", "live");
const TOKEN = process.env.PORTAL_TOKEN ?? "seedcoupleportal00000000000000000000000000000001";
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const PORTAL = `${BASE}/p/${TOKEN}`;
const WAIT = Number(process.env.QA_WAIT_MS ?? 800);
const SMOKE = process.env.QA_SMOKE === "1";
const CHROME =
  process.env.PLAYWRIGHT_CHROME_PATH ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const CURATED_KEYS = [
  "coastal-blue", "sage-garden", "dusty-rose", "peach-bellini", "lavender-haze",
  "champagne-curated", "terracotta-curated", "french-blue", "black-tie",
  "berry", "golden-hour", "meadow",
];

function slug(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function dismiss(page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-toast]").forEach((n) => n.remove());
  }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
}

async function assertOnStudio(page) {
  const m = await page.evaluate(() => {
    const t = document.body?.innerText || "";
    return {
      hasStudio: /Website Studio/i.test(t),
      hasStyle: /Your Website Style/i.test(t),
      wizard: /Choose your Collection|Create your Color Story|Choose your typography|Choose your Photo Style|This is your wedding website|Love it — continue/i.test(t),
      sample: t.slice(0, 160).replace(/\s+/g, " "),
    };
  });
  if (!m.hasStudio || !m.hasStyle || m.wizard) {
    throw new Error(`Not on Studio shell: ${JSON.stringify(m)}`);
  }
  return m;
}

async function openStudio(page) {
  await page.goto(PORTAL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  await dismiss(page);
  const homeNav = page.getByRole("button", { name: /Home/i }).first();
  if (await homeNav.count()) { await homeNav.click().catch(() => {}); await page.waitForTimeout(800); }
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /Wedding Website/i.test(b.innerText || ""));
    btn?.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Wedding Website/i }).first().click();
  await page.waitForTimeout(2800);
  await dismiss(page);
  if (await page.getByText(/This is your wedding website|Welcome/i).count()) {
    await leaveWizard(page);
  }
  // If wizard left open from previous session
  if (await page.getByText(/Choose your Collection|Create your Color Story|Choose your Photo Style/i).count()) {
    await leaveWizard(page);
  }
  await page.getByText("Website Studio", { exact: false }).first().waitFor({ timeout: 45000 });
  await leaveWizard(page).catch(() => {});
  await assertOnStudio(page);
}

async function leaveWizard(page) {
  for (let i = 0; i < 16; i++) {
    await dismiss(page);
    const st = await page.evaluate(() => {
      const t = document.body?.innerText || "";
      return {
        shell: /Website Studio/i.test(t) && /Your Website Style/i.test(t)
          && !/Choose your Collection|Create your Color Story|Choose your typography|Choose your Photo Style|Tell your story|This is your wedding website|Love it — continue/i.test(t),
        love: /Love it — continue/i.test(t),
        skip: /Skip →/i.test(t),
      };
    });
    if (st.shell) return;
    if (st.love) { await page.getByRole("button", { name: /Love it — continue/i }).click(); await page.waitForTimeout(WAIT); continue; }
    if (st.skip) { await page.getByRole("button", { name: /Skip →/i }).click(); await page.waitForTimeout(WAIT); continue; }
    const next = page.getByRole("button", { name: /This is us|Love it|Beautiful|Perfect|Start writing|Continue|→/i }).last();
    if (await next.count()) { await next.click().catch(() => {}); await page.waitForTimeout(WAIT); continue; }
    break;
  }
}

async function editRow(page, label) {
  await leaveWizard(page).catch(() => {});
  await dismiss(page);
  await page.evaluate((lab) => {
    const summary = [...document.querySelectorAll("p")].find((p) => /Your Website Style/i.test(p.textContent || ""));
    summary?.scrollIntoView({ block: "center", behavior: "instant" });
    const root = summary?.closest("div.rounded-2xl");
    if (!root) return false;
    for (const row of root.querySelectorAll("div.flex.items-center.justify-between")) {
      const labEl = row.querySelector("p");
      if (labEl && labEl.textContent?.trim() === lab) {
        const btn = [...row.querySelectorAll("button")].find((b) => /^Edit$/i.test(b.textContent || ""));
        if (btn) { btn.click(); return true; }
      }
    }
    return false;
  }, label);
  await page.waitForTimeout(WAIT);
  // confirm heading
  const heading = {
    Collection: /Choose your Collection/i,
    "Color Story": /Create your Color Story/i,
    "Photo Style": /Choose your Photo Style/i,
    Typography: /Choose your typography/i,
  }[label];
  if (heading) {
    try {
      await page.getByText(heading).first().waitFor({ timeout: 12000 });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

async function pickCard(page, title) {
  const ok = await page.evaluate((name) => {
    const buttons = [...document.querySelectorAll("button")].filter((b) => b.closest(".fixed.inset-0"));
    for (const btn of buttons) {
      const lines = (btn.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.includes(name) || lines[0] === name) {
        // Prefer cards with font-bold name paragraph matching exactly
        const ps = [...btn.querySelectorAll("p")];
        if (ps.some((p) => p.textContent?.trim() === name)) {
          btn.scrollIntoView({ block: "center" });
          btn.click();
          return true;
        }
      }
    }
    for (const btn of buttons) {
      const ps = [...btn.querySelectorAll("p")];
      if (ps.some((p) => p.textContent?.trim() === name)) {
        btn.scrollIntoView({ block: "center" });
        btn.click();
        return true;
      }
    }
    return false;
  }, title);
  await page.waitForTimeout(WAIT);
  return ok;
}

async function footerConfirm(page, re) {
  const btn = page.getByRole("button", { name: re }).first();
  if (await btn.count()) await btn.click();
  else await page.getByRole("button", { name: /Skip →/i }).click();
  await page.waitForTimeout(WAIT);
}

async function setDevice(page, device) {
  await page.evaluate((d) => {
    const bars = [...document.querySelectorAll("div")].filter(
      (el) => /Live Preview/i.test(el.textContent || "") && el.querySelectorAll("button").length >= 2,
    );
    const bar = bars.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (!bar) return;
    [...bar.querySelectorAll("button")][d === "mobile" ? 0 : 1]?.click();
  }, device);
  await page.waitForTimeout(900);
}

async function scrollPreview(page, device, frac) {
  await page.evaluate(({ d, f }) => {
    const sc = d === "mobile"
      ? document.querySelector(".ww-phone-frame-scroll")
      : [...document.querySelectorAll("div")].find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 520 && r.height > 360 && el.scrollHeight > el.clientHeight + 40
            && !el.classList.contains("ww-phone-frame-scroll")
            && (el.textContent || "").includes("Emma");
        });
    if (!sc) return;
    sc.scrollTop = Math.max(0, sc.scrollHeight - sc.clientHeight) * f;
  }, { d: device, f: frac });
  await page.waitForTimeout(450);
}

async function metrics(page, device) {
  return page.evaluate((d) => {
    const sc = d === "mobile"
      ? document.querySelector(".ww-phone-frame-scroll")
      : [...document.querySelectorAll("div")].find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 520 && r.height > 360 && el.scrollHeight > el.clientHeight + 40
            && !el.classList.contains("ww-phone-frame-scroll")
            && (el.textContent || "").includes("Emma");
        });
    if (!sc) return { err: "no-preview", device: d };
    const text = (sc.innerText || "").replace(/\s+/g, " ").trim();
    let pageBg = null;
    for (const el of sc.querySelectorAll("div")) {
      if ((el.className?.toString?.() || "").includes("@container/wedding")) {
        pageBg = getComputedStyle(el).backgroundColor;
        break;
      }
    }
    const m = String(pageBg || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    const lum = m ? (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 : null;
    const opac0 = [...sc.querySelectorAll("section,div")].filter((el) => {
      const st = getComputedStyle(el);
      return el.getBoundingClientRect().height > 100 && st.opacity === "0";
    }).length;
    const imgs = [...sc.querySelectorAll("img")].map((img) => {
      const r = img.getBoundingClientRect();
      const nw = img.naturalWidth || 0;
      const zoom = nw > 0 ? Math.max(r.width / nw, r.height / Math.max(1, img.naturalHeight || 1)) : 0;
      return { zoom: +zoom.toFixed(2), w: Math.round(r.width), h: Math.round(r.height), nw };
    }).filter((i) => i.zoom > 2.2 && Math.min(i.w, i.h) > 120);
    return {
      device: d, textLen: text.length, textSample: text.slice(0, 220), imgCount: sc.querySelectorAll("img").length,
      softSuspectCount: imgs.length, soft: imgs, overflowX: sc.scrollWidth > sc.clientWidth + 2,
      pageBg, pageLuminance: lum == null ? null : +lum.toFixed(3), opacHidden: opac0,
      looksBlank: text.length < 50, scrollH: sc.scrollHeight, clientH: sc.clientHeight,
    };
  }, device);
}

async function shot(page, name) {
  const file = path.join(EVIDENCE, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function chromeState(page) {
  return page.evaluate(() => {
    const summary = [...document.querySelectorAll("p")].find((p) => /Your Website Style/i.test(p.textContent || ""));
    const root = summary?.closest("div.rounded-2xl");
    const out = {};
    if (!root) return out;
    for (const row of root.querySelectorAll("div.flex.items-center.justify-between")) {
      const ps = row.querySelectorAll("p");
      if (ps.length >= 2) out[ps[0].textContent.trim()] = ps[1].textContent.trim();
    }
    return out;
  });
}

async function applyCollection(page, name) {
  if (!(await editRow(page, "Collection"))) throw new Error("edit Collection failed");
  await shot(page, `picker-coll__${slug(name)}.png`);
  if (!(await pickCard(page, name))) throw new Error(`pick Collection ${name}`);
  await footerConfirm(page, /This is us/i);
  await leaveWizard(page);
  await assertOnStudio(page);
}

async function applyColor(page, name) {
  if (!(await editRow(page, "Color Story"))) throw new Error("edit Color Story failed");
  await shot(page, `picker-cs__${slug(name)}.png`);
  if (!(await pickCard(page, name))) throw new Error(`pick CS ${name}`);
  await footerConfirm(page, /Love it/i);
  await leaveWizard(page);
  await assertOnStudio(page);
}

async function applyPhoto(page, name) {
  if (!(await editRow(page, "Photo Style"))) throw new Error("edit Photo Style failed");
  await shot(page, `picker-ps__${slug(name)}.png`);
  if (!(await pickCard(page, name))) throw new Error(`pick PS ${name}`);
  await footerConfirm(page, /Perfect/i);
  await leaveWizard(page);
  await assertOnStudio(page);
}

async function captureLP(page, prefix, findings, ctx) {
  for (const device of ["desktop", "mobile"]) {
    await setDevice(page, device);
    await scrollPreview(page, device, 0);
    const hero = await metrics(page, device);
    await shot(page, `${prefix}__${device}__hero.png`);
    await scrollPreview(page, device, 0.35);
    const story = await metrics(page, device);
    await shot(page, `${prefix}__${device}__story.png`);
    const chrome = await chromeState(page);
    const row = { ...ctx, device, chrome, hero, story };
    if (hero.looksBlank || story.looksBlank || hero.err || story.err) {
      findings.push({ severity: "critical", issue: "Blank or missing Live Preview", ...row });
    }
    if ((hero.opacHidden || 0) > 0 || (story.opacHidden || 0) > 0) {
      findings.push({ severity: "high", issue: "Opacity-0 sections occupying space", ...row });
    }
    if (ctx.collection === "Midnight" && ((story.pageLuminance != null && story.pageLuminance > 0.65) || (hero.pageLuminance != null && hero.pageLuminance > 0.65))) {
      findings.push({
        severity: "critical",
        issue: `Midnight Live Preview does not read nocturnal (lum≈${story.pageLuminance ?? hero.pageLuminance})`,
        ...row,
      });
    }
    if (hero.overflowX || story.overflowX) {
      findings.push({ severity: "medium", issue: "Horizontal overflow in preview", ...row });
    }
    if ((hero.softSuspectCount || 0) > 0 || (story.softSuspectCount || 0) > 0) {
      findings.push({ severity: "high", issue: "Possible over-zoom / soft crop", ...row });
    }
  }
}

async function captureGallery(page, prefix, findings, ctx) {
  for (const device of ["desktop", "mobile"]) {
    await setDevice(page, device);
    await scrollPreview(page, device, 0.55);
    const g = await metrics(page, device);
    await shot(page, `${prefix}__${device}__gallery.png`);
    if (g.looksBlank || g.err) findings.push({ severity: "critical", issue: "Gallery blank/missing", ...ctx, device, g });
    if (g.softSuspectCount > 0) findings.push({ severity: "high", issue: "Gallery soft/over-zoom", ...ctx, device, soft: g.soft });
    if (g.overflowX) findings.push({ severity: "medium", issue: "Gallery overflow", ...ctx, device });
    if (g.imgCount < 3) findings.push({ severity: "medium", issue: `Low gallery image count (${g.imgCount})`, ...ctx, device });
  }
}

async function main() {
  await rm(EVIDENCE, { recursive: true, force: true }).catch(() => {});
  await mkdir(EVIDENCE, { recursive: true });
  const findings = [];
  const logPath = path.join(OUT, "live-findings.ndjson");
  await writeFile(logPath, "");
  const push = async (f) => {
    findings.push(f);
    await appendFile(logPath, JSON.stringify(f) + "\n");
    console.error("FINDING", f.severity, f.issue, f.collection || "", f.colorStory || "", f.photoStyle || "");
  };

  console.error("Chrome", CHROME, "SMOKE", SMOKE);
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(25000);

  await openStudio(page);
  await shot(page, "00-studio-shell.png");
  const catalog = await page.evaluate(async () => (await fetch("/api/portal/website/catalog")).json());
  const collections = (catalog.collections || []).filter((c) => c.key !== "industrial");
  const allStories = collections.flatMap((c) => c.colorStories || []);
  const curated = CURATED_KEYS.map((k) => allStories.find((s) => s.key === k)).filter(Boolean);
  const photoStyles = catalog.photoStyles || [];
  await writeFile(path.join(OUT, "catalog-snapshot.json"), JSON.stringify({
    collections: collections.map((c) => c.name),
    curated: curated.map((c) => c.name),
    photoStyles: photoStyles.map((p) => p.name),
  }, null, 2));

  let collList = collections;
  let csHosts = ["Wildflower", "Midnight"];
  let csList = curated;
  let psHost = "Wildflower";
  let psColor = curated.find((c) => c.name === "Sage Garden") || curated[0];
  let psList = photoStyles;

  if (SMOKE) {
    collList = collections.filter((c) => c.name === "Midnight");
    csHosts = ["Midnight"];
    csList = curated.filter((c) => c.name === "Black Tie").slice(0, 1);
    psList = photoStyles.filter((p) => p.name === "Magazine").slice(0, 1);
    psHost = "Midnight";
    psColor = csList[0];
  }

  // ── Phase A: Collections ──────────────────────────────────────────
  console.error("\n=== PHASE A: Collections ===");
  for (const c of collList) {
    console.error("Collection", c.name);
    try {
      await applyCollection(page, c.name);
      await captureLP(page, `coll-${slug(c.name)}`, findings, { collection: c.name, phase: "A" });
      // auto-flag identity: Midnight
      if (c.name === "Midnight") {
        const chrome = await chromeState(page);
        if (chrome["Color Story"] && !/Black Tie|Onyx|Indigo|Plum|Noir|Berry/i.test(chrome["Color Story"])) {
          await push({
            severity: "high",
            area: "identity",
            collection: "Midnight",
            colorStory: chrome["Color Story"],
            issue: `Midnight paired with non-nocturnal Color Story "${chrome["Color Story"]}" after Collection apply (CS independent)`,
            chrome,
          });
        }
      }
    } catch (e) {
      await push({ severity: "critical", area: "nav", collection: c.name, issue: String(e.message || e) });
      await shot(page, `FAIL-coll-${slug(c.name)}.png`);
      await leaveWizard(page).catch(() => {});
    }
  }

  // ── Phase B: Color Stories × hosts ────────────────────────────────
  console.error("\n=== PHASE B: Color Stories ===");
  for (const host of csHosts) {
    try { await applyCollection(page, host); } catch (e) {
      await push({ severity: "critical", area: "nav", collection: host, issue: `host apply: ${e.message || e}` });
      continue;
    }
    for (const cs of csList) {
      console.error("CS", host, cs.name);
      try {
        await applyColor(page, cs.name);
        await captureLP(page, `cs-${slug(host)}__${slug(cs.name)}`, findings, {
          collection: host, colorStory: cs.name, phase: "B",
        });
      } catch (e) {
        await push({ severity: "high", area: "nav", collection: host, colorStory: cs.name, issue: String(e.message || e) });
        await shot(page, `FAIL-cs-${slug(host)}__${slug(cs.name)}.png`);
        await leaveWizard(page).catch(() => {});
      }
    }
  }

  // Risk Midnights with light CS already in B. Extra explicit names if not smoke:
  if (!SMOKE) {
    for (const risk of ["Sage Garden", "Meadow", "Peach Bellini"]) {
      if (!csList.find((c) => c.name === risk)) continue;
      // already captured in Midnight host loop
    }
  }

  // ── Phase C: Photo Styles on one host ─────────────────────────────
  console.error("\n=== PHASE C: Photo Styles ===");
  try {
    await applyCollection(page, psHost);
    if (psColor) await applyColor(page, psColor.name);
  } catch (e) {
    await push({ severity: "critical", area: "nav", issue: `PS host setup: ${e.message || e}` });
  }
  for (const ps of psList) {
    console.error("PS", ps.name);
    try {
      await applyPhoto(page, ps.name);
      await captureGallery(page, `ps-${slug(psHost)}__${slug(ps.name)}`, findings, {
        collection: psHost, colorStory: psColor?.name, photoStyle: ps.name, phase: "C",
      });
    } catch (e) {
      await push({ severity: "high", area: "nav", photoStyle: ps.name, issue: String(e.message || e) });
      await shot(page, `FAIL-ps-${slug(ps.name)}.png`);
      await leaveWizard(page).catch(() => {});
    }
  }

  await writeFile(logPath, findings.map((f) => JSON.stringify(f)).join("\n") + (findings.length ? "\n" : ""));
  await writeFile(path.join(OUT, "live-findings.json"), JSON.stringify({
    finishedAt: new Date().toISOString(),
    smoke: SMOKE,
    count: findings.length,
    findings,
  }, null, 2));

  console.error(`\nDone. Findings ${findings.length}. Evidence ${EVIDENCE}`);
  await browser.close();
}

main().catch(async (e) => {
  console.error(e);
  await writeFile(path.join(OUT, "capture-error.txt"), String(e?.stack || e));
  process.exit(1);
});
