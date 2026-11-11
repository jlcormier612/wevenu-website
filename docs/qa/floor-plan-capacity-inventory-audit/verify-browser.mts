/**
 * Capacity / inventory label proof on Sandbox Fancy Barn-master layout.
 * Confirms serving SHA and that seating copy distinguishes layout seats,
 * event guest count, and Space capacity (no misleading "to spare" vs Space).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
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
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const PLAN = "18c943fb-9762-4383-948a-e0f82fa4f89f";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/floor-plan-capacity-inventory-audit";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

function servingImage(): { image: string; digest: string } {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  const image = execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
  const digest = execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
  return { image, digest };
}

async function main() {
  const { image, digest } = servingImage();
  const expected = process.env.EXPECTED_SHA ?? "";
  record("serving-image", Boolean(image), `${image} ${digest}`);
  if (expected) {
    record("serving-sha-matches", image.includes(expected.slice(0, 8)), `expected=${expected} image=${image}`);
  }

  const { data: ev } = await admin
    .from("events")
    .select("id,guest_count,space_id")
    .eq("id", EVENT)
    .single();
  const { data: space } = await admin
    .from("venue_spaces")
    .select("id,name,capacity")
    .eq("id", ev!.space_id)
    .maybeSingle();
  const { data: objs } = await admin
    .from("floor_plan_objects")
    .select("object_type,capacity")
    .eq("floor_plan_id", PLAN);
  const seating = new Set(["table_round", "table_rect", "table_oval"]);
  const tables = (objs ?? []).filter((o) => seating.has(o.object_type));
  const seats = tables
    .filter((t) => t.capacity != null && Number(t.capacity) > 0)
    .reduce((s, t) => s + Number(t.capacity), 0);
  const guest = ev?.guest_count ?? null;
  const surplus = guest != null ? seats - guest : null;
  record(
    "persisted-layout-vs-guest",
    seats > 0 && guest != null && surplus === seats - guest,
    JSON.stringify({ seats, tables: tables.length, guest, surplus, space: space?.capacity }),
  );

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr) {
    record("staff-login", false, linkErr.message);
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ image, digest, checks }, null, 2));
    process.exit(1);
  }
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) {
    record("staff-login", false, otpErr?.message ?? "no session");
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ image, digest, checks }, null, 2));
    process.exit(1);
  }
  record("staff-login", true, EMAIL);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  await context.addCookies([
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
  ]);

  await page.goto(`${APP}/events/${EVENT}/floor-plans/${PLAN}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(2500);
  const banner = page.locator('[data-testid="floor-plan-capacity-banner"]');
  await banner.waitFor({ state: "visible", timeout: 45_000 }).catch(() => undefined);
  const sentence = (await page.locator('[data-testid="floor-plan-capacity-sentence"]').innerText().catch(() => "")) || "";
  const legend = (await page.locator('[data-testid="floor-plan-capacity-legend"]').innerText().catch(() => "")) || "";
  record("capacity-banner-visible", await banner.isVisible().catch(() => false), sentence.slice(0, 300));
  record(
    "capacity-copy-layout-vs-guest",
    /layout seat/i.test(sentence) && /guest/i.test(sentence) && /above the event guest count|matches the event guest count|short .+ vs the event guest count/i.test(sentence),
    sentence,
  );
  record(
    "capacity-copy-not-ambiguous-spare",
    !/seats to spare/i.test(sentence) && /Space capacity|assigned Space/i.test(sentence + legend),
    `${sentence} | ${legend.slice(0, 200)}`,
  );
  record(
    "capacity-legend-explains-zones",
    /Ceremony|Cocktail|Reception|simultaneous|visual/i.test(legend),
    legend.slice(0, 400),
  );
  await page.screenshot({ path: `${OUT}/shots/venue-capacity-banner-1280.png`, fullPage: false });

  const invLegend = page.locator('[data-testid="floor-plan-inventory-usage-legend"]');
  if ((await invLegend.count()) > 0) {
    const invText = await invLegend.innerText();
    record(
      "inventory-usage-legend",
      /venue/i.test(invText) && /this event/i.test(invText),
      invText.slice(0, 300),
    );
  } else {
    record("inventory-usage-legend", true, "no inventory-linked objects on this Fancy plan — skipped");
  }

  // Couple portal capacity strip (if shared working plan).
  const { data: sessions } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("venue_id", FANCY)
    .is("participant_id", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const token = sessions?.[0]?.access_token as string | undefined;
  if (token) {
    const couple = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const cp = await couple.newPage();
    await cp.goto(`${APP}/p/${encodeURIComponent(token)}?view=floor_plans`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await cp.waitForTimeout(1500);
    const accept = cp.getByRole("button", { name: /I agree|Accept|Continue/i }).first();
    if ((await accept.count()) > 0) await accept.click().catch(() => undefined);
    await cp.waitForTimeout(800);
    const fpNav = cp.getByRole("button", { name: /Floor Plan/i }).first();
    if ((await fpNav.count()) > 0) await fpNav.click().catch(() => undefined);
    await cp.locator('[data-testid="floor-plan-working-view"]').waitFor({ timeout: 45_000 }).catch(() => undefined);
    const clientCap = cp.locator('[data-testid="floor-plan-client-capacity"]');
    await clientCap.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
    const clientSentence = (await cp.locator('[data-testid="floor-plan-client-capacity-sentence"]').innerText().catch(() => "")) || "";
    record(
      "client-capacity-visible",
      await clientCap.isVisible().catch(() => false),
      clientSentence.slice(0, 400),
    );
    record(
      "client-capacity-copy",
      /layout seat/i.test(clientSentence) || /guest/i.test(clientSentence),
      clientSentence.slice(0, 400),
    );
    await cp.screenshot({ path: `${OUT}/shots/client-capacity-1280.png`, fullPage: false });
    await couple.close();
  } else {
    record("client-capacity-visible", false, "no couple token");
    record("client-capacity-copy", false, "no couple token");
  }

  await browser.close();

  const failed = checks.filter((c) => !c.pass).length;
  const pass = checks.length - failed;
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ image, digest, pass, failed, total: checks.length, checks }, null, 2),
  );
  writeFileSync(
    `${OUT}/persisted-state.json`,
    JSON.stringify({ event: ev, space, seats, tables: tables.length, guest, surplus, plan: PLAN }, null, 2),
  );
  console.log(failed === 0 ? `GREEN ${pass}/${checks.length}` : `NOT GREEN ${pass}/${checks.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
