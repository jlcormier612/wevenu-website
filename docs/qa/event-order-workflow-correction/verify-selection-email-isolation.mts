/**
 * Focused proof: Send selection request emails a choices link and does not
 * mutate Event Order shared_at / client_agreed_at / booking / invoice count.
 * Safe Sandbox fixture. Does not require the full invoice journey.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { execSync } from "node:child_process";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/event-order-workflow-correction";
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
  checks.push({ name, pass, detail: redact(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${redact(detail).slice(0, 400)}`);
}
function redact(s: string) {
  return s.replace(/\/p\/[^/?#\s]+/gi, "/p/[redacted]");
}

async function staffCookies() {
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = listed?.users?.find((u) => u.email === EMAIL);
  if (!user) throw new Error("staff user missing");
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (error || !link?.properties?.hashed_token) throw new Error(error?.message ?? "no link");
  const { data: sess, error: vErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (vErr || !sess.session) throw new Error(vErr?.message ?? "no session");
  await admin.from("profiles").update({ active_venue_id: FANCY }).eq("id", user.id);
  const cookieName =
    `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const payload = {
    access_token: sess.session.access_token,
    refresh_token: sess.session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: sess.session.user,
  };
  const encoded = ssrUtils.stringToBase64URL(JSON.stringify(payload));
  const chunks = ssrUtils.createChunks(cookieName, `base64-${encoded}`);
  return chunks.map((c: { name: string; value: string }) => ({
    name: c.name,
    value: c.value,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax" as const,
  }));
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
  record("serving-image", Boolean(image), `${image} ${digest}`);

  const { data: eoBefore } = await admin
    .from("event_orders")
    .select("id,status,shared_at,client_agreed_at,finalized_at,revision")
    .eq("event_id", EVENT)
    .maybeSingle();
  const { data: eventBefore } = await admin
    .from("events")
    .select("status,booked_at")
    .eq("id", EVENT)
    .maybeSingle();
  const { count: invBefore } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("client_id", CLIENT);
  const mailBefore = (
    await admin
      .from("conversation_messages")
      .select("id,sent_at")
      .eq("venue_id", FANCY)
      .eq("channel", "email")
      .order("sent_at", { ascending: false })
      .limit(1)
  ).data?.[0]?.sent_at ?? null;

  const browser = await chromium.launch({ headless: true });
  try {
    const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await staff.addCookies(await staffCookies());
    const page = await staff.newPage();
    await page.goto(`${APP}/events/${EVENT}#event-order-choices`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForSelector('[data-testid="client-choices-panel"]', { timeout: 60_000 });

    let send = page.locator('[data-testid="choices-send-selection-request"]').first();
    if ((await send.count()) === 0) {
      const prepare = page.locator('[data-testid="choices-start-selections"]').first();
      if ((await prepare.count()) > 0) {
        await prepare.click();
        await page.waitForTimeout(2500);
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-testid="client-choices-panel"]', { timeout: 45_000 });
        send = page.locator('[data-testid="choices-send-selection-request"]').first();
      } else {
        const amend = page.getByRole("button", { name: /^Amend$/ }).first();
        if ((await amend.count()) > 0) {
          await amend.click();
          await page.waitForTimeout(2000);
          send = page.locator('[data-testid="choices-send-selection-request"]').first();
        }
      }
    }
    record("send-cta", (await send.count()) > 0, `count=${await send.count()}`);
    if ((await send.count()) === 0) throw new Error("no send CTA");

    await send.click();
    await page.waitForTimeout(600);
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /selection request/i });
    await page.screenshot({ path: `${OUT}/shots/isolation-send-dialog-1280.png`, fullPage: false });
    await dialog.getByRole("button", { name: /^(Send|Resend)$/ }).click();
    await page.getByRole("button", { name: /Sending/i }).waitFor({ state: "detached", timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(2000);

    const { data: mails } = await admin
      .from("conversation_messages")
      .select("id,body,body_html,sent_at,status,provider_id,channel_metadata")
      .eq("venue_id", FANCY)
      .eq("channel", "email")
      .order("sent_at", { ascending: false })
      .limit(8);
    const selectionMail = (mails ?? []).find((m) => {
      const meta = m.channel_metadata as { sourceType?: string } | null;
      return meta?.sourceType === "client_choices_request"
        && (!mailBefore || (m.sent_at && m.sent_at > mailBefore));
    }) ?? (mails ?? []).find((m) => (m.channel_metadata as { sourceType?: string } | null)?.sourceType === "client_choices_request");

    const rawUrl = String(`${selectionMail?.body_html ?? ""}\n${selectionMail?.body ?? ""}`).match(
      /https?:\/\/[^"'\s<]+/,
    )?.[0] ?? "";
    record(
      "selection-email-accepted",
      selectionMail?.status === "accepted" && Boolean(selectionMail.provider_id),
      JSON.stringify({
        status: selectionMail?.status,
        provider_id: selectionMail?.provider_id,
        sent_at: selectionMail?.sent_at,
        sourceType: (selectionMail?.channel_metadata as { sourceType?: string } | null)?.sourceType,
      }),
    );
    record(
      "selection-url-is-choices",
      /\/p\/[^/?#\s]+\?view=choices#choices/.test(rawUrl),
      redact(rawUrl) || "missing",
    );

    const { data: eoAfter } = await admin
      .from("event_orders")
      .select("id,status,shared_at,client_agreed_at,finalized_at,revision")
      .eq("event_id", EVENT)
      .maybeSingle();
    const { data: eventAfter } = await admin
      .from("events")
      .select("status,booked_at")
      .eq("id", EVENT)
      .maybeSingle();
    const { count: invAfter } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT);

    record(
      "shared-at-unchanged",
      (eoBefore?.shared_at ?? null) === (eoAfter?.shared_at ?? null),
      `before=${eoBefore?.shared_at} after=${eoAfter?.shared_at}`,
    );
    record(
      "client-agreed-still-null",
      eoAfter?.client_agreed_at == null,
      String(eoAfter?.client_agreed_at),
    );
    record(
      "eo-status-unchanged-by-send",
      eoBefore?.status === eoAfter?.status
        && (eoBefore?.finalized_at ?? null) === (eoAfter?.finalized_at ?? null),
      `${eoBefore?.status}->${eoAfter?.status}`,
    );
    record("invoice-count-unchanged", invBefore === invAfter, `${invBefore}->${invAfter}`);
    record(
      "booking-unchanged",
      eventBefore?.booked_at === eventAfter?.booked_at
        && eventBefore?.status === eventAfter?.status,
      JSON.stringify({ before: eventBefore, after: eventAfter }),
    );

    if (rawUrl) {
      const couple = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const cp = await couple.newPage();
      await cp.goto(rawUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await cp.waitForTimeout(1500);
      const accept = cp.getByRole("button", { name: /I agree|Accept|Continue/i }).first();
      if ((await accept.count()) > 0) await accept.click().catch(() => undefined);
      await cp.getByRole("heading", { name: "Your Choices" }).waitFor({ timeout: 25_000 }).catch(() => undefined);
      const body = await cp.locator("body").innerText();
      record(
        "link-opens-choices-not-eo-accept",
        /Your Choices/i.test(body) && !/Accept this Event Order/i.test(body),
        body.slice(0, 400),
      );
      await cp.screenshot({ path: `${OUT}/shots/isolation-selection-link-1280.png`, fullPage: false });
      await couple.close();
    } else {
      record("link-opens-choices-not-eo-accept", false, "no url");
    }

    await staff.close();
  } finally {
    await browser.close();
  }

  const persisted = {
    image,
    digest,
    eoBefore,
    eventBefore,
    invBefore,
    checks,
  };
  writeFileSync(`${OUT}/selection-email-isolation-results.json`, JSON.stringify(persisted, null, 2));
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} ${checks.length - failed.length}/${checks.length}`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
