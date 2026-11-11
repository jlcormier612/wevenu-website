/** Debug: Floor Plans Change button after Set up on serving tip. */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const EMAIL = "jennifer@hellotocheers.com";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

async function cookies() {
  for (let i = 0; i < 4; i++) {
    const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
    const { data: otp, error } = await anon.auth.verifyOtp({
      type: "email",
      token_hash: link!.properties!.hashed_token!,
    });
    if (!error && otp?.session) {
      await admin.from("venue_staff_active_context").upsert({
        user_id: otp.session.user.id,
        active_venue_id: FANCY,
      });
      const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
      const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
      return [
        ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
          name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
          httpOnly: false, secure: true, sameSite: "Lax" as const,
        })),
        {
          name: "htc_active_venue_id", value: FANCY,
          domain: "app.sandbox.hellotocheers.com", path: "/",
          httpOnly: false, secure: true, sameSite: "Lax" as const,
        },
      ];
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw new Error("auth");
}

async function main() {
  const tag = Date.now().toString(36);
  const { data: client } = await admin.from("clients").insert({
    venue_id: FANCY, first_name: "FPDBG", last_name: tag,
    email: `fpdbg-${tag}@hellotocheers-test.invalid`, status: "confirmed",
  }).select("id").single();
  const { data: event } = await admin.from("events").insert({
    venue_id: FANCY, client_id: client!.id, name: `FPDBG-${tag}`,
    event_type: "wedding", event_date: "2027-11-18", event_end_date: "2027-11-18",
    status: "confirmed", booked_at: new Date().toISOString(), space_id: BARN,
  }).select("id").single();
  await admin.rpc("replace_event_space_assignments", {
    p_venue_id: FANCY, p_event_id: event!.id, p_primary_space_id: BARN,
    p_assignments: [
      { useKey: "ceremony", useLabel: "Ceremony", spaceId: BARN, startTime: null, endTime: null, scheduledDate: null, sortOrder: 0 },
    ],
  });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(await cookies());
  const page = await ctx.newPage();
  await page.goto(`${APP}/events/${event!.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector("[data-testid=event-setup-panel]", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const card = page.locator("[data-testid=event-setup-card-floor_plans]");
  console.log("BEFORE", (await card.innerText()).slice(0, 600));
  console.log("change", await page.locator("[data-testid=event-setup-change-floor_plans]").count());
  console.log("setup", await card.getByRole("button", { name: /^Set up$/i }).count());
  const setUp = card.getByRole("button", { name: /^Set up$/i }).first();
  if (await setUp.count()) {
    await setUp.click();
    await page.waitForTimeout(5000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=event-setup-panel]", { timeout: 60_000 });
    await page.waitForTimeout(1500);
  }
  console.log("AFTER", (await card.innerText()).slice(0, 900));
  console.log("change after", await page.locator("[data-testid=event-setup-change-floor_plans]").count());
  console.log("open after", await page.locator("[data-testid=event-setup-open-floor_plans]").count());
  console.log("outstanding", await page.locator("[data-testid=event-setup-outstanding]").innerText().catch(() => "(none)"));
  await page.screenshot({
    path: "docs/qa/floor-plans-release-acceptance/reacceptance/debug-change-btn-1280.png",
    fullPage: true,
  });
  // Cleanup
  await admin.from("event_space_assignments").delete().eq("event_id", event!.id);
  await admin.from("events").delete().eq("id", event!.id);
  await admin.from("clients").delete().eq("id", client!.id);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
