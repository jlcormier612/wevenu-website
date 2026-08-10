/**
 * Full Website Studio visual review harness.
 *
 * CRITICAL NAV TRUTH (2026-08 Program 5):
 * Website is NOT in the top nav. Top nav is venue-ops only
 * (Home/Tasks/Timeline/Documents/Payments/Messages/Venue Guide/Preferred Vendors).
 * Studio opens from Home → "Wedding Website" launch card → "Open Website".
 *
 * Dimensions are edited via "Your Website Style" → Edit → wizard overlays.
 * Color Stories in the wizard are the curated 12 (resolveCuratedColorStories),
 * not every collection-native row and never sidebar emoji labels.
 *
 * Report-only. No product fixes.
 *
 * Env:
 *   QA_SMOKE=1           one collection × one color × one photo style
 *   QA_WAIT_MS=1000
 *   PORTAL_TOKEN / PORTAL_BASE
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
const EVIDENCE = path.join(OUT, "evidence");
const TOKEN = process.env.PORTAL_TOKEN ?? "seedcoupleportal00000000000000000000000000000001";
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const PORTAL = `${BASE}/p/${TOKEN}`;
const WAIT = Number(process.env.QA_WAIT_MS ?? 900);
const SMOKE = process.env.QA_SMOKE === "1";
const CHROME =
  process.env.PLAYWRIGHT_CHROME_PATH ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

/** Curated Color Story display names (keys from curated-color-stories.ts; names come from catalog). */
const CURATED_KEYS = [
  "coastal-blue", "sage-garden", "dusty-rose", "peach-bellini", "lavender-haze",
  "champagne-curated", "terracotta-curated", "french-blue", "black-tie",
  "berry", "golden-hour", "meadow",
];

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function dismiss(page) {
  for (const sel of ["[data-nextjs-dialog-overlay]", "[data-nextjs-toast]", 'button[aria-label="Close"]']) {
    const el = page.locator(sel).first();
    if (await el.count()) await el.click({ force: true }).catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function assertOnStudio(page) {
  const markers = await page.evaluate(() => {
    const t = document.body?.innerText || "";
    return {
      hasStudio: /Website Studio/i.test(t),
      hasStyle: /Your Website Style/i.test(t),
      hasPreview: /Live Preview/i.test(t),
      hasVendors: /Preferred Vendors/i.test(t) && /Your Vendor Team/i.test(t),
      titleSample: t.slice(0, 200).replace(/\s+/g, " "),
    };
  });
  if (!markers.hasStudio || !markers.hasStyle) {
    throw new Error(
      `Not on Website Studio. markers=${JSON.stringify(markers)}`,
    );
  }
  return markers;
}

async function openStudio(page) {
  await page.goto(PORTAL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  await dismiss(page);

  // Legal gate if present
  const acceptLegal = page.getByRole("button", { name: /Accept|I agree|Continue/i }).first();
  if (await acceptLegal.count()) {
    await acceptLegal.click().catch(() => {});
    await page.waitForTimeout(800);
  }

  // Ensure Home (overview) — Website is a launch card, not top-nav
  const homeNav = page.getByRole("button", { name: /Home/i }).first();
  if (await homeNav.count()) {
    await homeNav.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Launch card lives under "Your Wedding" — often below the fold on Home.
  // Scroll until visible; Playwright's default wait requires visibility.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /Wedding Website/i.test(b.innerText || "") || /Open Website/i.test(b.innerText || ""),
    );
    btn?.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await page.waitForTimeout(400);
  const launch = page.getByRole("button", { name: /Wedding Website/i }).first();
  await launch.waitFor({ state: "visible", timeout: 30000 });
  await launch.scrollIntoViewIfNeeded();
  await launch.click();
  await page.waitForTimeout(2500);
  await dismiss(page);

  // First-open wizard may show — skip through to shell if Welcome appears
  if (await page.getByText(/This is your wedding website|Welcome/i).count()) {
    await leaveWizardToStudio(page);
  }

  await page.getByText("Website Studio", { exact: false }).first().waitFor({ timeout: 45000 });
  await page.getByText("Your Website Style", { exact: false }).first().waitFor({ timeout: 20000 });
  await assertOnStudio(page);
}

async function editStyleRow(page, label) {
  const ok = await page.evaluate((lab) => {
    const summary = [...document.querySelectorAll("p")].find((p) =>
      /Your Website Style/i.test(p.textContent || ""),
    );
    const root = summary?.closest("div.rounded-2xl");
    if (!root) return false;
    for (const row of root.querySelectorAll("div.flex.items-center.justify-between")) {
      const labEl = row.querySelector("p");
      if (labEl && labEl.textContent?.trim() === lab) {
        const btn = [...row.querySelectorAll("button")].find((b) => /^Edit$/i.test(b.textContent || ""));
        if (btn) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  }, label);
  await page.waitForTimeout(WAIT);
  return ok;
}

async function selectWizardCardByTitle(page, title) {
  // Cards put the name in a bold/font-bold paragraph inside a button
  const clicked = await page.evaluate((name) => {
    const buttons = [...document.querySelectorAll("button")];
    for (const btn of buttons) {
      const bold = btn.querySelector("p.font-bold, p.text-xs.font-bold, p.text-\\[11px\\].font-bold");
      const candidates = bold
        ? [bold]
        : [...btn.querySelectorAll("p")].filter((p) => (p.className || "").includes("font-bold") || (p.className || "").includes("font-semibold"));
      for (const p of candidates.length ? candidates : [...btn.querySelectorAll("p")].slice(0, 2)) {
        if ((p.textContent || "").trim() === name) {
          btn.scrollIntoView({ block: "center" });
          btn.click();
          return true;
        }
      }
    }
    // Fallback: exact text node in button
    for (const btn of buttons) {
      const text = (btn.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
      if (text[0] === name || text.includes(name)) {
        // Avoid top-nav / unrelated matches
        if (btn.closest(".fixed.inset-0") || btn.querySelector("p")) {
          btn.scrollIntoView({ block: "center" });
          btn.click();
          return true;
        }
      }
    }
    return false;
  }, title);
  await page.waitForTimeout(WAIT);
  return clicked;
}

/** Skip/advance wizard until Studio shell is visible again. Skip advances; finish needs "Love it — continue". */
async function leaveWizardToStudio(page) {
  for (let i = 0; i < 14; i++) {
    const state = await page.evaluate(() => {
      const t = document.body?.innerText || "";
      return {
        onStudio: /Website Studio/i.test(t) && /Your Website Style/i.test(t) && !/Choose your Collection|Create your Color Story|Choose your typography|Choose your Photo Style|Tell your story|This is your wedding website/i.test(t),
        hasLoveIt: /Love it — continue/i.test(t),
        hasSkip: /Skip →/i.test(t),
        wizardish: /Choose your Collection|Create your Color Story|Choose your typography|Choose your Photo Style|Tell your story|This is your wedding website|Looking good/i.test(t),
      };
    });
    if (state.onStudio) return;

    if (state.hasLoveIt) {
      await page.getByRole("button", { name: /Love it — continue/i }).click();
      await page.waitForTimeout(WAIT);
      continue;
    }
    if (state.hasSkip) {
      await page.getByRole("button", { name: /Skip →/i }).click();
      await page.waitForTimeout(WAIT);
      continue;
    }
    // Footers: This is us / Love it / Beautiful / Perfect / Start writing
    const next = page.getByRole("button", { name: /This is us|Love it|Beautiful|Perfect|Start writing|Continue|Next|→/i }).last();
    if (await next.count()) {
      await next.click().catch(() => {});
      await page.waitForTimeout(WAIT);
      continue;
    }
    break;
  }
  await dismiss(page);
  await assertOnStudio(page);
}

async function setDevice(page, device) {
  await page.evaluate((d) => {
    const bars = [...document.querySelectorAll("div")].filter(
      (el) => /Live Preview/i.test(el.textContent || "") && el.querySelectorAll("button").length >= 2,
    );
    const bar = bars.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (!bar) return;
    const btns = [...bar.querySelectorAll("button")];
    // Phone first, monitor second (lucide icons)
    btns[d === "mobile" ? 0 : 1]?.click();
  }, device);
  await page.waitForTimeout(700);
}

async function chromeState(page) {
  return page.evaluate(() => {
    const summary = [...document.querySelectorAll("p")].find((p) => /Your Website Style/i.test(p.textContent || ""));
    const root = summary?.closest("div.rounded-2xl");
    if (!root) return {};
    const out = {};
    for (const row of root.querySelectorAll("div.flex.items-center.justify-between")) {
      const ps = row.querySelectorAll("p");
      if (ps.length >= 2) out[ps[0].textContent.trim()] = ps[1].textContent.trim();
    }
    return out;
  });
}

async function previewMetrics(page, device) {
  return page.evaluate((dev) => {
    const sc =
      dev === "mobile"
        ? document.querySelector(".ww-phone-frame-scroll")
        : [...document.querySelectorAll("div")].find((d) => {
            const r = d.getBoundingClientRect();
            return (
              r.width > 520 &&
              r.height > 360 &&
              d.scrollHeight > d.clientHeight + 40 &&
              !d.classList.contains("ww-phone-frame-scroll") &&
              (d.textContent || "").includes("Emma")
            );
          });
    if (!sc) return { err: "no-preview", device: dev };
    const text = (sc.innerText || "").replace(/\s+/g, " ").trim();
    const imgs = [...sc.querySelectorAll("img")];
    const soft = imgs
      .map((img) => {
        const r = img.getBoundingClientRect();
        const nw = img.naturalWidth || 0;
        const zoom = nw > 0 ? Math.max(r.width / nw, r.height / Math.max(1, img.naturalHeight || 1)) : 0;
        return { zoom: +zoom.toFixed(2), w: Math.round(r.width), h: Math.round(r.height), nw };
      })
      .filter((i) => i.zoom > 2.2 && Math.min(i.w, i.h) > 120);
    let pageBg = null;
    for (const d of sc.querySelectorAll("div")) {
      const cn = d.className?.toString?.() || "";
      if (cn.includes("@container/wedding")) {
        pageBg = getComputedStyle(d).backgroundColor;
        break;
      }
    }
    const m = String(pageBg || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    const lum = m ? (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 : null;
    const opacHidden = [...sc.querySelectorAll("section,div")].filter((el) => {
      const st = getComputedStyle(el);
      return el.getBoundingClientRect().height > 100 && st.opacity === "0";
    }).length;
    return {
      device: dev,
      textLen: text.length,
      textSample: text.slice(0, 240),
      imgCount: imgs.length,
      softSuspectCount: soft.length,
      soft,
      overflowX: sc.scrollWidth > sc.clientWidth + 2,
      pageBg,
      pageLuminance: lum == null ? null : +lum.toFixed(3),
      opacHidden,
      looksBlank: text.length < 50,
      scrollHeight: sc.scrollHeight,
      clientHeight: sc.clientHeight,
    };
  }, device);
}

async function scrollPreview(page, device, frac) {
  await page.evaluate(
    ({ dev, f }) => {
      const sc =
        dev === "mobile"
          ? document.querySelector(".ww-phone-frame-scroll")
          : [...document.querySelectorAll("div")].find((d) => {
              const r = d.getBoundingClientRect();
              return (
                r.width > 520 &&
                r.height > 360 &&
                d.scrollHeight > d.clientHeight + 40 &&
                !d.classList.contains("ww-phone-frame-scroll")
              );
            });
      if (!sc) return;
      sc.scrollTop = Math.max(0, sc.scrollHeight - sc.clientHeight) * f;
    },
    { dev: device, f: frac },
  );
  await page.waitForTimeout(400);
}

async function shot(page, name) {
  const file = path.join(EVIDENCE, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function main() {
  await rm(EVIDENCE, { recursive: true, force: true }).catch(() => {});
  await mkdir(EVIDENCE, { recursive: true });
  await writeFile(path.join(OUT, "findings.ndjson"), "");
  const findings = [];
  const log = async (row) => {
    findings.push(row);
    await appendFile(path.join(OUT, "findings.ndjson"), JSON.stringify(row) + "\n");
    console.log(JSON.stringify(row));
  };

  console.error(`Launching Chrome: ${CHROME}`);
  console.error(`SMOKE=${SMOKE} PORTAL=${PORTAL}`);

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(25000);

  await openStudio(page);
  await shot(page, "00-studio-home.png");
  const studioCheck = await assertOnStudio(page);
  console.error("On studio:", JSON.stringify(studioCheck));

  const catalog = await page.evaluate(async () => {
    const r = await fetch("/api/portal/website/catalog");
    if (!r.ok) throw new Error("catalog " + r.status);
    return r.json();
  });

  const collections = (catalog.collections || []).filter((c) => c.name && c.key !== "industrial");
  const photoStyles = catalog.photoStyles || [];
  const allStories = collections.flatMap((c) => c.colorStories || []);
  const curated = CURATED_KEYS.map((key) => {
    const s = allStories.find((cs) => cs.key === key);
    return s ? { key: s.key, name: s.name, id: s.id } : null;
  }).filter(Boolean);

  const matrix = {
    startedAt: new Date().toISOString(),
    smoke: SMOKE,
    collections: collections.map((c) => ({ key: c.key, name: c.name })),
    curatedColorStories: curated,
    photoStyles: photoStyles.map((p) => ({ key: p.key, name: p.name })),
  };
  await writeFile(path.join(OUT, "catalog-snapshot.json"), JSON.stringify(matrix, null, 2));
  console.error(
    `Catalog: ${collections.length} collections, ${curated.length} curated CS, ${photoStyles.length} photo styles`,
  );

  // Matrix strategy:
  // - Full: every Collection × every curated Color Story (hero/story desktop+mobile)
  //         then every Photo Style on each Collection with one representative CS (first curated)
  // - Smoke: Midnight × Black Tie (or first curated) × Magazine only
  let collectionList = collections;
  let colorListForAll = curated;
  let photoList = photoStyles;

  if (SMOKE) {
    collectionList = collections.filter((c) => c.name === "Midnight").slice(0, 1);
    if (!collectionList.length) collectionList = collections.slice(0, 1);
    const blackTie = curated.find((c) => /black/i.test(c.name)) || curated[0];
    colorListForAll = blackTie ? [blackTie] : curated.slice(0, 1);
    photoList = photoStyles.filter((p) => p.name === "Magazine").slice(0, 1);
    if (!photoList.length) photoList = photoStyles.slice(0, 1);
    console.error("SMOKE matrix:", collectionList[0]?.name, colorListForAll[0]?.name, photoList[0]?.name);
  }

  for (const collection of collectionList) {
    console.error(`\n=== Collection: ${collection.name} ===`);
    if (!(await editStyleRow(page, "Collection"))) {
      await log({ severity: "critical", area: "nav", issue: "Could not open Collection Edit", collection: collection.name });
      await shot(page, `FAIL-edit-collection-${slug(collection.name)}.png`);
      continue;
    }
    await page.getByText("Choose your Collection", { exact: false }).first().waitFor({ timeout: 15000 });
    await shot(page, `picker-collection-${slug(collection.name)}.png`);
    // Confirm picker shot is really the wizard
    const pickerOk = await page.evaluate(() => /Choose your Collection/i.test(document.body?.innerText || ""));
    if (!pickerOk) {
      await log({ severity: "critical", area: "nav", collection: collection.name, issue: "Collection Edit did not open wizard" });
      await leaveWizardToStudio(page).catch(() => {});
      continue;
    }
    if (!(await selectWizardCardByTitle(page, collection.name))) {
      await log({ severity: "high", area: "picker", collection: collection.name, issue: "Could not click Collection card" });
      await leaveWizardToStudio(page).catch(() => {});
      continue;
    }
    // Persist via footer (also saves) then exit wizard
    const thisIsUs = page.getByRole("button", { name: /This is us/i }).first();
    if (await thisIsUs.count()) await thisIsUs.click();
    else await page.getByRole("button", { name: /Skip →/i }).click();
    await page.waitForTimeout(WAIT);
    await leaveWizardToStudio(page);

    for (const cs of colorListForAll) {
      console.error(`  Color: ${cs.name}`);
      if (!(await editStyleRow(page, "Color Story"))) {
        await log({ severity: "high", area: "nav", collection: collection.name, colorStory: cs.name, issue: "Could not open Color Story Edit" });
        continue;
      }
      await page.getByText("Create your Color Story", { exact: false }).first().waitFor({ timeout: 15000 });
      await shot(page, `picker-cs-${slug(collection.name)}__${slug(cs.name)}.png`);
      if (!(await selectWizardCardByTitle(page, cs.name))) {
        await log({
          severity: "high",
          area: "picker",
          collection: collection.name,
          colorStory: cs.name,
          issue: `Could not select curated Color Story "${cs.name}"`,
        });
        await leaveWizardToStudio(page).catch(() => {});
        continue;
      }
      const loveIt = page.getByRole("button", { name: /Love it/i }).first();
      if (await loveIt.count()) await loveIt.click();
      else await page.getByRole("button", { name: /Skip →/i }).click();
      await page.waitForTimeout(WAIT);
      await leaveWizardToStudio(page);

      const chrome = await chromeState(page);
      if (chrome.Collection && chrome.Collection !== collection.name) {
        await log({
          severity: "high",
          area: "identity",
          collection: collection.name,
          colorStory: cs.name,
          issue: `Summary Collection shows "${chrome.Collection}"`,
          chrome,
        });
      }

      for (const device of ["desktop", "mobile"]) {
        await setDevice(page, device);
        await scrollPreview(page, device, 0);
        const hero = await previewMetrics(page, device);
        await shot(page, `${slug(collection.name)}__${slug(cs.name)}__${device}__hero.png`);
        await scrollPreview(page, device, 0.35);
        const story = await previewMetrics(page, device);
        await shot(page, `${slug(collection.name)}__${slug(cs.name)}__${device}__story.png`);

        if (hero.looksBlank || story.looksBlank) {
          await log({
            severity: "critical",
            area: "live-preview",
            collection: collection.name,
            colorStory: cs.name,
            device,
            issue: "Blank / near-empty preview text",
            hero,
            story,
          });
        }
        if ((hero.opacHidden || 0) > 0 || (story.opacHidden || 0) > 0) {
          await log({
            severity: "high",
            area: "live-preview",
            collection: collection.name,
            colorStory: cs.name,
            device,
            issue: "Opacity-0 sections still occupying layout",
            heroOpacHidden: hero.opacHidden,
            storyOpacHidden: story.opacHidden,
          });
        }
        if (collection.name === "Midnight" && story.pageLuminance != null && story.pageLuminance > 0.72) {
          await log({
            severity: "high",
            area: "identity",
            collection: collection.name,
            colorStory: cs.name,
            device,
            issue: `Midnight does not read nocturnal (page luminance ${story.pageLuminance})`,
            chrome,
            pageBg: story.pageBg,
          });
        }
        if (hero.overflowX || story.overflowX) {
          await log({
            severity: "medium",
            area: "layout",
            collection: collection.name,
            colorStory: cs.name,
            device,
            issue: "Horizontal overflow",
          });
        }
      }
    }

    // Photo styles: one representative Color Story (first curated / smoke CS)
    const psColor = colorListForAll[0];
    if (psColor) {
      // Ensure CS applied
      if (!(await editStyleRow(page, "Color Story"))) {
        /* continue photo anyway */
      } else {
        await page.getByText("Create your Color Story", { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => {});
        await selectWizardCardByTitle(page, psColor.name);
        const loveIt = page.getByRole("button", { name: /Love it/i }).first();
        if (await loveIt.count()) await loveIt.click();
        else await page.getByRole("button", { name: /Skip →/i }).click().catch(() => {});
        await leaveWizardToStudio(page).catch(() => {});
      }
    }

    for (const ps of photoList) {
      console.error(`  Photo Style: ${ps.name}`);
      if (!(await editStyleRow(page, "Photo Style"))) {
        await log({ severity: "high", area: "nav", collection: collection.name, photoStyle: ps.name, issue: "Could not open Photo Style Edit" });
        continue;
      }
      await page.getByText("Choose your Photo Style", { exact: false }).first().waitFor({ timeout: 15000 });
      await shot(page, `picker-ps-${slug(collection.name)}__${slug(ps.name)}.png`);
      if (!(await selectWizardCardByTitle(page, ps.name))) {
        await log({
          severity: "high",
          area: "picker",
          collection: collection.name,
          photoStyle: ps.name,
          issue: `Could not select Photo Style "${ps.name}"`,
        });
        await leaveWizardToStudio(page).catch(() => {});
        continue;
      }
      const perfect = page.getByRole("button", { name: /Perfect/i }).first();
      if (await perfect.count()) await perfect.click();
      else await page.getByRole("button", { name: /Skip →/i }).click();
      await page.waitForTimeout(WAIT);
      await leaveWizardToStudio(page);

      for (const device of ["desktop", "mobile"]) {
        await setDevice(page, device);
        await scrollPreview(page, device, 0.55);
        const g = await previewMetrics(page, device);
        await shot(page, `${slug(collection.name)}__ps-${slug(ps.name)}__${device}__gallery.png`);
        if (g.looksBlank) {
          await log({
            severity: "critical",
            area: "gallery",
            collection: collection.name,
            photoStyle: ps.name,
            device,
            issue: "Gallery preview looks blank",
            g,
          });
        }
        if (g.softSuspectCount > 0) {
          await log({
            severity: "high",
            area: "gallery",
            collection: collection.name,
            photoStyle: ps.name,
            device,
            issue: `Possible over-zoom / soft crop (${g.softSuspectCount} img)`,
            soft: g.soft,
          });
        }
        if (g.overflowX) {
          await log({
            severity: "medium",
            area: "gallery",
            collection: collection.name,
            photoStyle: ps.name,
            device,
            issue: "Gallery horizontal overflow / cut-off risk",
          });
        }
      }
    }
  }

  await writeFile(
    path.join(OUT, "findings.json"),
    JSON.stringify({ finishedAt: new Date().toISOString(), count: findings.length, findings }, null, 2),
  );
  await writeFile(
    path.join(OUT, "matrix.json"),
    JSON.stringify({ ...matrix, finishedAt: new Date().toISOString(), findingCount: findings.length }, null, 2),
  );
  console.error(`\nDone. Findings: ${findings.length}. Evidence: ${EVIDENCE}`);
  await browser.close();
}

main().catch(async (e) => {
  console.error(e);
  await writeFile(path.join(OUT, "capture-error.txt"), String(e?.stack || e));
  process.exit(1);
});
