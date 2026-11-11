/**
 * Extra Gate B probe: long provider failure explanations wrap, not clip.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/inbox-attention-delivery-display";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: FANCY_EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");

  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  const cookies = [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  await page.goto(`${APP}/messaging/health?attention=1`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(1000);

  let probe: Record<string, unknown> | null = null;
  for (let i = 0; i < 5; i++) {
    probe = await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll("[data-testid=message-history-row] button"),
      ) as HTMLElement[];
      const hit = btns.find(
        (b) =>
          /quota|daily email|bounce|mailbox|statusCode/i.test(b.innerText)
          || b.innerText.replace(/\s+/g, " ").trim().length > 90,
      );
      if (!hit) return null;
      hit.scrollIntoView({ block: "center" });
      return {
        text: hit.innerText.replace(/\s+/g, " ").trim().slice(0, 240),
        overflowX: hit.scrollWidth > hit.clientWidth + 1,
        clientWidth: hit.clientWidth,
        scrollWidth: hit.scrollWidth,
        clientHeight: hit.clientHeight,
        scrollHeight: hit.scrollHeight,
      };
    });
    if (probe) break;
    const more = page.locator("[data-testid=message-history-load-more]");
    if (!(await more.count())) break;
    await more.click();
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: `${OUT}/long-failure-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/long-failure-390.png` });

  const pass = Boolean(probe && !probe.overflowX);
  writeFileSync(
    `${OUT}/long-failure-probe.json`,
    JSON.stringify({ pass, probe, at: new Date().toISOString() }, null, 2),
  );
  console.log(JSON.stringify({ pass, probe }, null, 2));
  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
