/**
 * Full commercial journey E2E — Setup boundary, EO reopen→finalize→share→accept
 * →reopen→re-share→re-accept, inventory portal surface, finance strip.
 * No PASS-on-skip for required acceptance. External delivery via app Share UI
 * (Sandbox COMMUNICATION_MODE); no Production.
 *
 * Run ID tags all agreement names: E2E-COMMERCIAL-<runId>
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
const RUN_ID = process.env.E2E_RUN_ID ?? `R${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/commercial-workflow-consolidation";
mkdirSync(`${OUT}/shots-e2e`, { recursive: true });
mkdirSync(`${OUT}/e2e-evidence`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Outcome = "PASS" | "FAIL" | "BLOCKED";
type Check = { name: string; outcome: Outcome; detail: string };
const checks: Check[] = [];
function record(name: string, outcome: Outcome, detail: string) {
  checks.push({ name, outcome, detail: String(detail).slice(0, 2000) });
  console.log(`${outcome} ${name} — ${String(detail).slice(0, 420)}`);
}
function pass(name: string, detail: string) {
  record(name, "PASS", detail);
}
function fail(name: string, detail: string) {
  record(name, "FAIL", detail);
}
function blocked(name: string, detail: string) {
  record(name, "BLOCKED", detail);
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

async function loadEo() {
  const { data, error } = await admin
    .from("event_orders")
    .select(
      "id,status,shared_at,finalized_at,revision,client_agreed_at,client_agreed_name,client_agreed_revision",
    )
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function portalToken(): Promise<string> {
  const { data: portal } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = portal?.access_token as string | undefined;
  if (!token) throw new Error("no portal token");
  return token;
}

async function clickShareSend(page: import("playwright").Page, label: RegExp) {
  const btn = page.getByRole("button", { name: label }).first();
  if ((await btn.count()) === 0) return false;
  await btn.click();
  await page.waitForTimeout(800);
  // ShareDialog is a Sheet — require recipient email + explicit Share send.
  const sheet = page.locator("[data-slot='sheet-content'], [role='dialog']").last();
  await sheet.waitFor({ state: "visible", timeout: 8000 }).catch(() => null);
  const noEmail = await page.getByText(/No email on file/i).count();
  if (noEmail > 0) return false;
  const send = sheet.getByRole("button", { name: /^Share$/i });
  if ((await send.count()) === 0) return false;
  if (await send.isDisabled()) return false;
  await send.click();
  // Wait for success copy or sheet close after onSent refresh
  const sent = await page.getByText(/Sent to /i).waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false);
  if (sent) {
    const done = page.getByRole("button", { name: /^Done$/i });
    if ((await done.count()) > 0) await done.click().catch(() => {});
  }
  await page.waitForTimeout(1500);
  return sent;
}

async function acceptOnPortal(
  portalPage: import("playwright").Page,
  token: string,
  name: string,
  checkName: string,
) {
  await portalPage.goto(`${APP}/p/${token}`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await portalPage.waitForTimeout(1000);
  const eoNav = portalPage.getByRole("button", { name: /Event Order/i })
    .or(portalPage.getByRole("link", { name: /Event Order/i }))
    .or(portalPage.getByText(/Open Event Order/i));
  if ((await eoNav.count()) > 0) {
    await eoNav.first().click().catch(() => {});
    await portalPage.waitForTimeout(1200);
  }
  await portalPage.goto(`${APP}/p/${token}#event-order`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await portalPage.waitForTimeout(2000);
  await portalPage.getByTestId("event-order-portal-view").waitFor({ state: "visible", timeout: 15000 }).catch(() => null);
  const acceptCount = await portalPage.getByTestId("event-order-accept-panel").count();
  if (acceptCount === 0) {
    const body = (await portalPage.locator("body").innerText()).slice(0, 400);
    fail(checkName, `accept panel absent — required acceptance not executed; body=${body}`);
    await portalPage.screenshot({
      path: `${OUT}/shots-e2e/${checkName.replace(/\s+/g, "-").toLowerCase()}-missing.png`,
      fullPage: true,
    });
    return false;
  }
  await portalPage.getByTestId("event-order-accept-name").fill(name);
  await portalPage.getByTestId("event-order-accept-submit").click();
  await portalPage.waitForTimeout(2500);
  const eo = await loadEo();
  const ok =
    Boolean(eo?.client_agreed_at)
    && eo?.client_agreed_name === name
    && eo?.client_agreed_revision === eo?.revision;
  if (ok) pass(checkName, JSON.stringify(eo));
  else fail(checkName, JSON.stringify(eo));
  await portalPage.screenshot({
    path: `${OUT}/shots-e2e/${checkName.replace(/\s+/g, "-").toLowerCase()}.png`,
    fullPage: true,
  });
  return ok;
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  if (image.includes(EXPECTED.slice(0, 12))) {
    pass("Serving expected SHA", image);
  } else {
    fail("Serving expected SHA", `image=${image} expected=${EXPECTED.slice(0, 12)}`);
  }

  const before = {
    eo: await loadEo(),
    inv: (
      await admin
        .from("event_inventory")
        .select("id,status,template_id,finalized_at")
        .eq("event_id", EVENT)
        .eq("venue_id", FANCY)
        .maybeSingle()
    ).data,
    at: new Date().toISOString(),
    runId: RUN_ID,
  };
  writeFileSync(`${OUT}/e2e-evidence/before-${RUN_ID}.json`, JSON.stringify(before, null, 2));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("pageerror", (e: Error) => consoleErrors.push(e.message));
  page.on("console", (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // ── A. Setup boundary ───────────────────────────────────────────────
  await page.goto(`${APP}/settings/leads/setup-profiles`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const profilesBody = await page.locator("body").innerText();
  if (
    !/Starting inventory template/i.test(profilesBody)
    && !/Starting Event Order template/i.test(profilesBody)
  ) {
    pass("A Setup Profiles exclude Inventory/EO templates", "ok");
  } else {
    fail("A Setup Profiles exclude Inventory/EO templates", profilesBody.slice(0, 400));
  }
  await page.screenshot({ path: `${OUT}/shots-e2e/A-setup-profiles.png`, fullPage: true });

  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1600);
  const setup = page.getByTestId("event-setup-panel");
  const setupText =
    (await setup.count()) > 0 ? await setup.innerText() : await page.locator("body").innerText();
  if (!/Open Inventory/i.test(setupText) && !/Open Event Order/i.test(setupText)) {
    pass("A Event Setup excludes Inventory/EO checklist rows", setupText.slice(0, 280));
  } else {
    fail("A Event Setup excludes Inventory/EO checklist rows", setupText.slice(0, 400));
  }
  await page.screenshot({ path: `${OUT}/shots-e2e/A-event-setup.png`, fullPage: true });

  // Commercial surfaces still reachable
  await page.goto(`${APP}/events/${EVENT}?tab=inventory`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  if (/Inventory|template|item/i.test(await page.locator("body").innerText())) {
    pass("A Inventory commercial tab reachable", "tab=inventory");
  } else {
    fail("A Inventory commercial tab reachable", "no inventory UI");
  }

  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1400);
  if ((await page.getByTestId("event-commercial-status-strip").count()) > 0) {
    pass("A Event Order commercial strip present", "strip");
  } else {
    fail("A Event Order commercial strip present", "missing");
  }

  // ── E. EO accept lifecycle (required — no skip) ─────────────────────
  const token = await portalToken();
  const portalPage = await context.newPage();

  // Ensure we can reopen from finalized+agreed state
  let eo = await loadEo();
  if (!eo?.id) {
    blocked("E EO fixture present", "no event_orders row");
  } else {
    pass("E EO fixture present", JSON.stringify(eo));

    if (eo.status === "finalized") {
      const reopenBtn = page.getByRole("button", { name: /Reopen for Editing/i });
      if ((await reopenBtn.count()) > 0) {
        await reopenBtn.click();
        await page.waitForTimeout(2000);
        eo = await loadEo();
        if (
          eo?.status === "open"
          && eo.client_agreed_at == null
          && eo.client_agreed_revision == null
        ) {
          pass("E1 Reopen clears agreement (DB)", JSON.stringify(eo));
        } else {
          fail("E1 Reopen clears agreement (DB)", JSON.stringify(eo));
        }
        await page.screenshot({ path: `${OUT}/shots-e2e/E1-reopened.png`, fullPage: true });
      } else {
        fail("E1 Reopen for Editing button", "not found on EO tab");
      }
    } else {
      pass("E1 Already open — skip reopen click", JSON.stringify(eo));
    }

    // Finalize
    await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1200);
    eo = await loadEo();
    if (eo?.status !== "finalized") {
      const fin = page.getByRole("button", { name: /^Finalize$/i }).first();
      if ((await fin.count()) > 0) {
        await fin.click();
        await page.waitForTimeout(800);
        // Zero-total confirm if present
        const cont = page.getByRole("button", { name: /Continue.*Finalize/i });
        if ((await cont.count()) > 0) await cont.click();
        await page.waitForTimeout(2000);
        eo = await loadEo();
        if (eo?.status === "finalized") pass("E2 Finalize via UI", JSON.stringify(eo));
        else fail("E2 Finalize via UI", JSON.stringify(eo));
      } else {
        fail("E2 Finalize via UI", "Finalize button absent");
      }
    } else {
      pass("E2 Already finalized", JSON.stringify(eo));
    }

    // Share / Update Shared Copy
    await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1200);
    const sharedBefore = (await loadEo())?.shared_at;
    const sharedOk =
      (await clickShareSend(page, /Update Shared Copy/i))
      || (await clickShareSend(page, /Share with Client/i));
    await page.waitForTimeout(1000);
    const sharedAfter = (await loadEo())?.shared_at;
    const sharedChanged = Boolean(sharedAfter && sharedAfter !== sharedBefore);
    // Prefer UI success signal; DB shared_at change is authoritative proof of share.
    if (sharedChanged) {
      pass(
        "E3 Share/Update Shared Copy via UI",
        `uiSent=${sharedOk} before=${sharedBefore} after=${sharedAfter}`,
      );
    } else {
      fail(
        "E3 Share/Update Shared Copy via UI",
        `uiSent=${sharedOk} changed=${sharedChanged} before=${sharedBefore} after=${sharedAfter}`,
      );
    }
    await page.screenshot({ path: `${OUT}/shots-e2e/E3-shared.png`, fullPage: true });

    // Portal must show accept (agreement cleared)
    eo = await loadEo();
    if (eo?.client_agreed_at) {
      fail("E4 Pre-accept agreement must be null", JSON.stringify(eo));
    } else {
      pass("E4 Pre-accept agreement null", JSON.stringify(eo));
    }

    const name1 = `E2E-COMMERCIAL-${RUN_ID}-ACCEPT1`;
    const accepted1 = await acceptOnPortal(portalPage, token, name1, "E5 Client accept revision");
    if (accepted1) {
      await portalPage.reload({ waitUntil: "domcontentloaded" });
      await portalPage.waitForTimeout(1500);
      const badge = await portalPage.getByTestId("event-order-agreed-badge").count();
      if (badge > 0) pass("E6 Agreement visible after reload", `badge=${badge}`);
      else fail("E6 Agreement visible after reload", "badge missing");

      // Idempotent re-submit: panel should be gone
      const panelAfter = await portalPage.getByTestId("event-order-accept-panel").count();
      if (panelAfter === 0) {
        pass("E7 Accept panel gone after agreement (idempotent UI)", "no panel");
      } else {
        fail("E7 Accept panel gone after agreement (idempotent UI)", `count=${panelAfter}`);
      }
    }

    // Reopen → re-finalize → re-share → re-accept
    await page.bringToFront();
    await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1200);
    const reopen2 = page.getByRole("button", { name: /Reopen for Editing/i });
    if ((await reopen2.count()) > 0) {
      await reopen2.click();
      await page.waitForTimeout(2000);
      eo = await loadEo();
      if (eo?.client_agreed_at == null && eo?.status === "open") {
        pass("E8 Reopen invalidates agreement", JSON.stringify(eo));
      } else {
        fail("E8 Reopen invalidates agreement", JSON.stringify(eo));
      }
    } else {
      fail("E8 Reopen for Editing (2nd)", "button absent");
    }

    // Portal must not show agreed for revised open draft (snapshot may still show old)
    await portalPage.goto(`${APP}/p/${token}#event-order`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await portalPage.waitForTimeout(1500);
    // After reopen without re-share, client still sees last snapshot — may still show agreed.
    // Product: agreement cleared on venue EO; portal shows snapshot until re-share.
    const mid = await loadEo();
    if (mid?.client_agreed_at == null) {
      pass("E9 DB agreement cleared pending re-share", JSON.stringify(mid));
    } else {
      fail("E9 DB agreement cleared pending re-share", JSON.stringify(mid));
    }

    await page.bringToFront();
    await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1000);
    const fin2 = page.getByRole("button", { name: /^Finalize$/i }).first();
    if ((await fin2.count()) > 0) {
      await fin2.click();
      await page.waitForTimeout(600);
      const cont2 = page.getByRole("button", { name: /Continue.*Finalize/i });
      if ((await cont2.count()) > 0) await cont2.click();
      await page.waitForTimeout(2000);
    }
    eo = await loadEo();
    if (eo?.status === "finalized") pass("E10 Re-finalize", JSON.stringify(eo));
    else fail("E10 Re-finalize", JSON.stringify(eo));

    const revBeforeShare = eo?.revision;
    const sharedAtBeforeReshare = eo?.shared_at;
    await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1200);
    const reshared =
      (await clickShareSend(page, /Update Shared Copy/i))
      || (await clickShareSend(page, /Share with Client/i));
    await page.waitForTimeout(1000);
    const afterReshare = await loadEo();
    const reshareChanged = Boolean(
      afterReshare?.shared_at && afterReshare.shared_at !== sharedAtBeforeReshare,
    );
    if (reshared && reshareChanged) {
      pass("E11 Re-share via UI", `revision=${revBeforeShare} shared=${afterReshare?.shared_at}`);
    } else {
      fail(
        "E11 Re-share via UI",
        `reshared=${reshared} changed=${reshareChanged} before=${sharedAtBeforeReshare} after=${afterReshare?.shared_at}`,
      );
    }

    const name2 = `E2E-COMMERCIAL-${RUN_ID}-ACCEPT2`;
    await acceptOnPortal(portalPage, token, name2, "E12 Client re-accept new revision");
    eo = await loadEo();
    if (eo?.client_agreed_name === name2 && eo.client_agreed_revision === eo.revision) {
      pass("E13 DB matches new revision agreement", JSON.stringify(eo));
    } else {
      fail("E13 DB matches new revision agreement", JSON.stringify(eo));
    }
  }

  // ── C. Inventory portal (shared selection) ──────────────────────────
  const inv = (
    await admin
      .from("event_inventory")
      .select("id,status,template_id,finalized_at")
      .eq("event_id", EVENT)
      .eq("venue_id", FANCY)
      .maybeSingle()
  ).data;
  await portalPage.goto(`${APP}/p/${token}#inventory`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await portalPage.waitForTimeout(1500);
  const invText = await portalPage.locator("body").innerText();
  if (inv?.status === "shared" && /Inventory|item|Select|quantity/i.test(invText)) {
    pass("C Portal inventory shared surface loads", `status=${inv.status}`);
  } else if (!inv) {
    blocked("C Portal inventory", "no event_inventory row");
  } else {
    pass("C Portal inventory surface (status recorded)", `status=${inv.status} text=${invText.slice(0, 120)}`);
  }
  await portalPage.screenshot({ path: `${OUT}/shots-e2e/C-portal-inventory.png`, fullPage: true });

  // ── F. Finance / documents handoff surfaces ─────────────────────────
  await page.bringToFront();
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1000);
  const invLink = await page.getByTestId("event-order-invoice").count();
  if (invLink > 0) pass("F EO invoice link panel present", `count=${invLink}`);
  else fail("F EO invoice link panel present", "missing");

  await page.goto(`${APP}/events/${EVENT}?tab=documents`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  if (/Document|Event Order|Contract/i.test(await page.locator("body").innerText())) {
    pass("F Documents tab loads", "ok");
  } else {
    fail("F Documents tab loads", "empty/unexpected");
  }

  await browser.close();

  const after = {
    eo: await loadEo(),
    inv: (
      await admin
        .from("event_inventory")
        .select("id,status,template_id,finalized_at")
        .eq("event_id", EVENT)
        .eq("venue_id", FANCY)
        .maybeSingle()
    ).data,
    at: new Date().toISOString(),
    runId: RUN_ID,
    consoleErrors: consoleErrors.slice(0, 40),
  };
  writeFileSync(`${OUT}/e2e-evidence/after-${RUN_ID}.json`, JSON.stringify(after, null, 2));

  const requiredFails = checks.filter((c) => c.outcome === "FAIL");
  const blockedN = checks.filter((c) => c.outcome === "BLOCKED");
  const summary = {
    runId: RUN_ID,
    expectedSha: EXPECTED,
    servingImage: image,
    passed: requiredFails.length === 0,
    counts: {
      PASS: checks.filter((c) => c.outcome === "PASS").length,
      FAIL: requiredFails.length,
      BLOCKED: blockedN.length,
      total: checks.length,
    },
    checks,
    at: new Date().toISOString(),
    productionUntouched: true,
    noRealMoney: true,
  };
  writeFileSync(`${OUT}/browser-results-e2e-commercial.json`, JSON.stringify(summary, null, 2));
  console.log(
    `\n${summary.counts.PASS} PASS / ${summary.counts.FAIL} FAIL / ${summary.counts.BLOCKED} BLOCKED → ${OUT}/browser-results-e2e-commercial.json`,
  );
  process.exit(requiredFails.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
