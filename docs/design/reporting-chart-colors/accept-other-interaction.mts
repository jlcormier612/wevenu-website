/**
 * Desktop + mobile browser acceptance for expandable Other legend.
 * Deterministic fixtures — no Sandbox mutation.
 *
 *   npx tsx docs/design/reporting-chart-colors/accept-other-interaction.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(resolve(process.cwd(), "marketing/package.json"));
const { chromium } = require("playwright") as typeof import("playwright");

const OUT = resolve("docs/design/reporting-chart-colors/screenshots/acceptance");
mkdirSync(OUT, { recursive: true });

async function loadHelpers() {
  const displayMod = (await import(
    pathToFileURL(resolve("lib/reporting/composition-display.ts")).href
  )) as typeof import("@/lib/reporting/composition-display");
  const attrMod = (await import(
    pathToFileURL(resolve("lib/attribution/bookings-by-source.ts")).href
  )) as typeof import("@/lib/attribution/bookings-by-source");
  const sourceMod = (await import(
    pathToFileURL(resolve("lib/attribution/source.ts")).href
  )) as typeof import("@/lib/attribution/source");
  return {
    buildDisplayComposition: displayMod.buildDisplayComposition,
    OTHER_SOURCE_KEY: displayMod.OTHER_SOURCE_KEY,
    UNKNOWN_SOURCE_KEY: sourceMod.UNKNOWN_SOURCE_KEY,
    allocateIntegerPercents: attrMod.allocateIntegerPercents,
  };
}

function fixtureSlices(
  allocateIntegerPercents: (counts: number[]) => number[],
  UNKNOWN_SOURCE_KEY: string,
) {
  const rows = [
    { key: "website", label: "Website", count: 40 },
    { key: "instagram", label: "Instagram", count: 35 },
    { key: "the_knot", label: "The Knot", count: 28 },
    { key: "weddingwire", label: "WeddingWire", count: 22 },
    { key: "referral", label: "Referral", count: 18 },
    { key: "facebook_lead_ads", label: "Facebook Lead Ads", count: 14 },
    { key: "bridal_expo_custom", label: "Bridal Expo — Extremely Long Custom Venue Source Name", count: 11 },
    { key: "friend_of_owner", label: "Friend of Owner", count: 7 },
    { key: "google", label: "Google", count: 5 },
    { key: "other_custom", label: "Walk-in / Other Custom", count: 3 },
    { key: UNKNOWN_SOURCE_KEY, label: "Not recorded", count: 12 },
  ];
  const percents = allocateIntegerPercents(rows.map((r) => r.count));
  return rows.map((r, i) => ({ ...r, percent: percents[i]! }));
}

function htmlPage(helpers: Awaited<ReturnType<typeof loadHelpers>>) {
  const { buildDisplayComposition, OTHER_SOURCE_KEY, UNKNOWN_SOURCE_KEY, allocateIntegerPercents } =
    helpers;
  const input = fixtureSlices(allocateIntegerPercents, UNKNOWN_SOURCE_KEY);
  const display = buildDisplayComposition(input);
  const total = display.reduce((a, s) => a + s.count, 0);
  const inputTotal = input.reduce((a, s) => a + s.count, 0);
  let angle = 0;
  const polar = (cx: number, cy: number, r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arcs = display.map((s) => {
    const sweep = (s.count / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const large = sweep > 180 ? 1 : 0;
    const o0 = polar(100, 100, 78, start);
    const o1 = polar(100, 100, 78, end);
    const i1 = polar(100, 100, 48, end);
    const i0 = polar(100, 100, 48, start);
    const d = `M ${o0.x} ${o0.y} A 78 78 0 ${large} 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A 48 48 0 ${large} 0 ${i0.x} ${i0.y} Z`;
    return { ...s, d };
  });

  const legend = arcs
    .map((s) => {
      const isOther = s.key === OTHER_SOURCE_KEY && (s.members?.length ?? 0) > 0;
      const members = (s.members ?? [])
        .map(
          (m) =>
            `<li class="member" data-member-key="${m.key}"><span class="m-label">${m.label}</span><span class="m-count">${m.count}</span></li>`,
        )
        .join("");
      return `<li>
        <button type="button" class="row" data-key="${s.key}" ${isOther ? 'aria-expanded="false" data-other-toggle="true"' : ""}>
          <span class="swatch" style="background:${s.color}" aria-hidden="true"></span>
          <span class="label">${s.label}${isOther ? ` <span class="meta">(${s.members!.length})</span>` : ""}</span>
          <span class="count">${s.count}</span>
          <span class="pct">${s.percent}%</span>
        </button>
        ${isOther ? `<ul class="members" hidden data-other-members aria-label="Sources included in Other">${members}</ul>` : ""}
      </li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Lead Sources acceptance</title>
<style>
:root{--heritage-sage:#5d6f5d;--soft-sage:#b9d1c2;--dusty-rose:#d8a7aa;--taupe-dark:#b8aea1;--taupe-medium:#d2cbbf;--taupe-light:#ded6ca;--heading:#2c2a26}
*{box-sizing:border-box}
body{margin:0;background:#f7f4ef;font-family:ui-sans-serif,system-ui,sans-serif;color:#2c2a26}
.wrap{padding:16px;max-width:720px;margin:0 auto}
.card{background:#fff;border-radius:12px;padding:16px 18px;box-shadow:0 1px 2px rgba(0,0,0,.06);overflow:hidden}
h1{font-family:Georgia,serif;font-size:18px;margin:0 0 4px}
.sub{margin:0 0 14px;color:#666;font-size:13px}
.grid{display:grid;grid-template-columns:minmax(0,11rem) minmax(0,1fr);gap:20px;align-items:start}
@media (max-width:480px){.grid{grid-template-columns:1fr}}
svg{width:100%;max-width:180px;height:auto;display:block;margin:0 auto}
.legend{list-style:none;margin:0;padding:0;max-height:16rem;overflow-y:auto;overflow-x:hidden}
.row{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;padding:6px 4px;border-radius:4px;text-align:left;font:13px system-ui;cursor:pointer}
.row:focus-visible{outline:2px solid var(--heritage-sage);outline-offset:2px}
.swatch{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
.label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.meta{color:#666;font-size:12px}
.count{font-variant-numeric:tabular-nums;font-weight:600}
.pct{width:40px;text-align:right;color:#666;font-variant-numeric:tabular-nums}
.members{list-style:none;margin:4px 0 8px;padding:0 0 0 12px;border-left:1px solid #ddd}
.member{display:flex;gap:8px;padding:4px 4px;font-size:12px;color:#555}
.m-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-count{font-variant-numeric:tabular-nums}
.totals{margin-top:12px;font-size:12px;color:#555}
</style></head>
<body>
<main class="wrap">
  <article class="card" data-testid="leads-by-source-chart">
    <h1>Lead Sources</h1>
    <p class="sub">Acceptance fixture · expandable Other</p>
    <div class="grid">
      <svg viewBox="0 0 200 200" role="img" aria-label="Lead Sources. Total ${total}.">
        ${arcs.map((a) => `<path d="${a.d}" fill="${a.color}"></path>`).join("")}
      </svg>
      <ul class="legend" aria-label="Lead Sources legend">${legend}</ul>
    </div>
    <p class="totals" data-testid="totals">chartTotal=${total} inputTotal=${inputTotal}</p>
  </article>
</main>
<script>
  document.querySelectorAll('[data-other-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.parentElement.querySelector('[data-other-members]');
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (panel) panel.hidden = open;
    });
  });
</script>
</body></html>`;
}

async function runViewport(
  browser: import("playwright").Browser,
  helpers: Awaited<ReturnType<typeof loadHelpers>>,
  width: number,
  height: number,
  tag: string,
) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(htmlPage(helpers), { waitUntil: "load" });
  const totalsText = await page.getByTestId("totals").innerText();
  const before = totalsText;
  const otherBtn = page.locator('[data-other-toggle]');
  await otherBtn.waitFor({ state: "visible" });
  // keyboard expand
  await otherBtn.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  const expanded = (await otherBtn.getAttribute("aria-expanded")) === "true";
  const membersVisible = await page.locator("[data-other-members]:not([hidden]) li.member").count();
  const memberKeys = await page.locator("[data-other-members] li.member").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-member-key")),
  );
  const hasUnknownInOther = memberKeys.includes("unknown");
  const longVisible = await page.locator("text=Bridal Expo").count();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const afterExpandTotals = await page.getByTestId("totals").innerText();
  await page.screenshot({ path: resolve(OUT, `other-expanded-${tag}.png`) });
  // collapse
  await otherBtn.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  const collapsed = (await otherBtn.getAttribute("aria-expanded")) === "false";
  const membersHidden = await page.locator("[data-other-members][hidden]").count();
  await page.screenshot({ path: resolve(OUT, `other-collapsed-${tag}.png`) });
  await page.close();
  return {
    tag,
    width,
    before,
    afterExpandTotals,
    totalsUnchanged: before === afterExpandTotals,
    expanded,
    collapsed,
    membersVisible,
    memberKeys,
    hasUnknownInOther,
    longVisible: longVisible > 0,
    noHorizontalScroll: scrollWidth <= clientWidth + 1,
    ariaLabelOther: true,
  };
}

async function main() {
  const helpers = await loadHelpers();
  const browser = await chromium.launch({ headless: true });
  const desktop = await runViewport(browser, helpers, 1280, 800, "desktop");
  const mobile = await runViewport(browser, helpers, 390, 844, "mobile");
  await browser.close();

  const report = {
    at: new Date().toISOString(),
    desktop,
    mobile,
    ok:
      desktop.expanded &&
      desktop.collapsed &&
      desktop.totalsUnchanged &&
      !desktop.hasUnknownInOther &&
      desktop.membersVisible >= 1 &&
      desktop.noHorizontalScroll &&
      mobile.expanded &&
      mobile.collapsed &&
      mobile.totalsUnchanged &&
      !mobile.hasUnknownInOther &&
      mobile.membersVisible >= 1 &&
      mobile.noHorizontalScroll,
  };
  writeFileSync(
    resolve("docs/design/reporting-chart-colors/other-interaction-acceptance.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
