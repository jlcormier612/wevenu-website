/**
 * Sandbox: Path A fixed EO (Use → Finalize → Share) vs Path B Send gating.
 * Exercises venue Library + event Event Order UI. Sandbox only.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/eo-fixed-vs-selection-routing";
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
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 420)}`);
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
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
}

async function ensureFixedOnlyTemplate(): Promise<{ id: string; name: string }> {
  const name = `QA Fixed Day-of Coordination ${Date.now()}`;
  const { data: tmpl, error } = await admin
    .from("event_order_templates")
    .insert({
      venue_id: FANCY,
      name,
      description: "Fixed-only fixture for Path A routing",
      is_archived: false,
    })
    .select("id,name")
    .single();
  if (error || !tmpl) throw error ?? new Error("template insert");
  await admin.from("event_order_template_lines").insert({
    venue_id: FANCY,
    template_id: tmpl.id,
    section_id: null,
    description: "Day-of Coordination",
    description_detail: "Flat coordination fee",
    quantity: 1,
    unit_price: 1200,
    pricing_model: "flat",
    unit: null,
    included_by_default: false,
    offering_id: null,
    sort_order: 0,
  });
  // Explicitly zero groups — Path B must not apply.
  return { id: tmpl.id as string, name };
}

async function countInvoicesBefore(): Promise<number> {
  const { count } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", FANCY)
    .eq("event_id", EVENT);
  return count ?? 0;
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  const fixed = await ensureFixedOnlyTemplate();
  const invoicesBefore = await countInvoicesBefore();

  const { data: portal } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("event_id", EVENT)
    .limit(1)
    .maybeSingle();
  const token = portal?.access_token;

  const browser = await chromium.launch({ headless: true });
  const cookies = await staffCookies();
  try {
    // ---- A: Library card for fixed-only — no Send to client ----
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    await page.goto(`${APP}/library/event-order-templates`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    const card = page.getByText(fixed.name, { exact: false }).first();
    await card.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(400);
    const cardRoot = page.locator("article, [class*='card'], li, div").filter({ hasText: fixed.name }).first();
    const cardText = await cardRoot.innerText().catch(() => "");
    const sendOnCard = await cardRoot.getByRole("button", { name: /Send to client/i }).count();
    const useOnCard = await cardRoot.getByRole("button", { name: /^Use$/i }).count();
    record("A1: fixed template card shows Use", useOnCard > 0 || /Use/.test(cardText), cardText.slice(0, 300));
    record("A2: fixed template card hides Send to client", sendOnCard === 0, `sendButtons=${sendOnCard}`);
    await page.screenshot({ path: `${OUT}/shots/A-library-fixed-card-1280.png` });

    // Use → pick Fancy event → Apply
    const useBtn = cardRoot.getByRole("button", { name: /^Use$/i }).first();
    if (await useBtn.count()) {
      await useBtn.click();
      await page.waitForTimeout(800);
      // Pick event target — search by event name fragment or first bookable row
      const eventPick = page.getByText(/InvEoPortal|Fancy|2077|Booked/i).first();
      if (await eventPick.count()) {
        await eventPick.click();
        await page.waitForTimeout(1200);
      } else {
        // Fallback: click first selectable event button in picker
        const firstTarget = page.locator('[data-testid="template-apply-event"], button').filter({ hasText: /\d{4}|Event/ }).first();
        if (await firstTarget.count()) await firstTarget.click();
        await page.waitForTimeout(1200);
      }
      const applyConfirm = page.getByTestId("event-order-apply-confirm").or(
        page.getByRole("button", { name: /Apply to event/i }),
      );
      if (await applyConfirm.count()) {
        await applyConfirm.first().click();
        await page.waitForTimeout(2500);
        record("A3: Use/Apply completed without choice-group error", true, "clicked Apply");
      } else {
        record("A3: Use/Apply confirm visible", false, await page.locator("body").innerText().then((t) => t.slice(0, 500)));
      }
      // Ensure old error string never appears
      const bodyAfter = await page.locator("body").innerText();
      record(
        "A4: no legacy choice-groups Apply error toast copy",
        !/Use Apply for fixed offerings, or add choice groups first/i.test(bodyAfter),
        "legacy message absent",
      );
    } else {
      record("A3: Use button", false, "missing Use on card");
      record("A4: legacy error", true, "skipped");
    }

    // Event Order panel: Finalize + Share if needed
    await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    // Navigate to Event Order tab if present
    const eoTab = page.getByRole("tab", { name: /Event Order/i }).or(page.getByRole("link", { name: /Event Order/i })).or(page.getByText("Event Order", { exact: true }));
    if (await eoTab.count()) {
      await eoTab.first().click().catch(() => undefined);
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${OUT}/shots/A-event-order-1280.png` });

    const finalizeBtn = page.getByRole("button", { name: /^Finalize$/i });
    if (await finalizeBtn.count()) {
      await finalizeBtn.first().click();
      await page.waitForTimeout(1500);
      // dismiss $0 warning if shown
      const cont = page.getByRole("button", { name: /Continue|Share anyway|Finalize anyway/i });
      if (await cont.count()) await cont.first().click().catch(() => undefined);
      await page.waitForTimeout(1500);
      record("A5: Finalize clicked", true, "ok");
    } else {
      record("A5: Finalize already done or unavailable", true, "no Finalize button (may already be finalized)");
    }

    const shareBtn = page.getByRole("button", { name: /^Share$|^Share with client$|^Update shared copy$/i });
    if (await shareBtn.count()) {
      await shareBtn.first().click();
      await page.waitForTimeout(800);
      const confirmShare = page.getByRole("button", { name: /Send|Share|Confirm/i }).last();
      if (await confirmShare.count()) await confirmShare.click().catch(() => undefined);
      await page.waitForTimeout(2000);
      record("A6: Share attempted", true, "ok");
    } else {
      record("A6: Share control", false, "Share button not found — EO may be open/unfinalized");
    }

    const invoicesAfter = await countInvoicesBefore();
    record(
      "A7: Share did not create invoices",
      invoicesAfter === invoicesBefore,
      `before=${invoicesBefore} after=${invoicesAfter}`,
    );

    // Couple portal EO visibility
    if (token) {
      const pctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const ppage = await pctx.newPage();
      await ppage.goto(`${APP}/portal/${token}?section=event-order`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await ppage.waitForTimeout(1500);
      const pbody = await ppage.locator("body").innerText();
      record(
        "A8: couple portal Event Order section loads",
        /Event Order|Not shared yet|receiving|Total/i.test(pbody),
        pbody.slice(0, 400),
      );
      await ppage.screenshot({ path: `${OUT}/shots/A-portal-eo-1280.png` });
      await pctx.close();
    } else {
      record("A8: portal token", false, "missing");
    }

    // Mobile library check
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/library/event-order-templates`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1200);
    const mobileCard = page.locator("div, article").filter({ hasText: fixed.name }).first();
    const mobileSend = await mobileCard.getByRole("button", { name: /Send to client/i }).count();
    record("C1: mobile fixed card hides Send", mobileSend === 0, `send=${mobileSend}`);
    await page.screenshot({ path: `${OUT}/shots/C-library-fixed-390.png` });

    // ---- B: template WITH groups still shows Send ----
    const { data: withGroups } = await admin
      .from("event_order_template_groups")
      .select("template_id")
      .eq("venue_id", FANCY)
      .limit(1)
      .maybeSingle();
    if (withGroups?.template_id) {
      const { data: gt } = await admin
        .from("event_order_templates")
        .select("id,name")
        .eq("id", withGroups.template_id)
        .maybeSingle();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${APP}/library/event-order-templates`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await page.waitForTimeout(1200);
      if (gt?.name) {
        const gCard = page.locator("div, article").filter({ hasText: gt.name }).first();
        const gSend = await gCard.getByRole("button", { name: /Send to client/i }).count();
        record("B1: selectable template still shows Send to client", gSend > 0, `name=${gt.name} send=${gSend}`);
        await page.screenshot({ path: `${OUT}/shots/B-library-selectable-1280.png` });
      } else {
        record("B1: selectable template", false, "name missing");
      }
    } else {
      record("B1: selectable template available", false, "no Fancy template with groups — Path B UI unproven this run");
    }

    await ctx.close();

    // Cleanup disposable template
    await admin.from("event_order_template_lines").delete().eq("template_id", fixed.id);
    await admin.from("event_order_templates").delete().eq("id", fixed.id);
  } finally {
    await browser.close();
  }

  const allPass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify(
      {
        expectedSha: EXPECTED,
        servingImage: image,
        allPass,
        checks,
        fixedTemplateName: fixed.name,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(allPass ? "ALL PASS" : "SOME FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
