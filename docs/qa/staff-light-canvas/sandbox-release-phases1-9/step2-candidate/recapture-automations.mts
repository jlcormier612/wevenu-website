import { createRequire } from "node:module";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const WT = "/Users/jensmac/Developer/htc-visual-p1-9-release";
config({ path: `${WT}/.env.local`, quiet: true });
const require = createRequire(`${WT}/marketing/package.json`);
const { chromium } = require("playwright");
const ssr = require(`${WT}/node_modules/@supabase/ssr/dist/main/utils/index.js`);

const APP = "http://127.0.0.1:3019";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});
const { data: link } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "jennifer@hellotocheers.com",
});
const { data: otp } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: link!.properties!.hashed_token!,
});
const base = {
  domain: "127.0.0.1",
  path: "/",
  httpOnly: false,
  secure: false,
  sameSite: "Lax" as const,
};
const cookies = [
  ...ssr
    .createChunks(
      "sb-wvpsldwwjqdannqasrdf-auth-token",
      "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)),
    )
    .map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: FANCY },
];

const browser = await chromium.launch();
const resultsPath = `${WT}/docs/qa/staff-light-canvas/sandbox-release-phases1-9/step2-candidate/browser-results.json`;
const results = JSON.parse(readFileSync(resultsPath, "utf8")).filter(
  (r: { label: string }) => r.label !== "automations",
);

for (const vp of [
  { width: 1440, height: 900, tag: "desktop" },
  { width: 390, height: 844, tag: "mobile" },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const page = await ctx.newPage();
  const res = await page.goto(`${APP}/communication/series`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1600);
  const probe = await page.evaluate(`(() => {
    const el = document.querySelector("section.htc-automations-help");
    const cs = el ? getComputedStyle(el) : null;
    return {
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      url: location.pathname,
      present: el
        ? [{
            sel: "section.htc-automations-help",
            bg: cs.backgroundColor,
            color: cs.color,
            text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100),
          }]
        : [null],
      phase10Markers: 0,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  })()`);
  const file = join(
    WT,
    "docs/qa/staff-light-canvas/sandbox-release-phases1-9/step2-candidate/evidence",
    `automations-${vp.tag}.png`,
  );
  await page.screenshot({ path: file, fullPage: false });
  results.push({
    label: "automations",
    viewport: vp.tag,
    status: res?.status() ?? null,
    file,
    ...probe,
  });
  console.log(JSON.stringify(results[results.length - 1]));
  await ctx.close();
}

await browser.close();
writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log("updated automations shots");
