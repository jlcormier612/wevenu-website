/**
 * Sandbox browser proof — contract resend lists every required signatory.
 * Uses disposable Fancy Venue data. Does not send real customer emails
 * (Sandbox communication mode redirects). Cleans up afterward.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

config({ path: ".env.local" });

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
const OUT_DIR = "docs/qa/contract-resend-recipients";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

const out: {
  ok: boolean;
  servingSha: string | null;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  ids: Record<string, string | null>;
  urls: Record<string, string>;
} = { ok: true, servingSha: null, checks: [], ids: {}, urls: {} };

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m = link.match(/commit\/([0-9a-f]{7,40})/i) ?? link.match(/dpl[_-]([0-9a-f]{7,40})/i);
  return m?.[1] ?? null;
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
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
  return ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  );
}

const cleanup: { clientId?: string; contractId?: string; signerIds: string[] } = {
  signerIds: [],
};

async function cleanupAll() {
  if (cleanup.contractId) {
    await admin.from("contract_activities").delete().eq("contract_id", cleanup.contractId);
    await admin.from("contract_signers").delete().eq("contract_id", cleanup.contractId);
    await admin.from("contracts").delete().eq("id", cleanup.contractId);
  }
  if (cleanup.clientId) {
    await admin.from("clients").delete().eq("id", cleanup.clientId);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = String(Date.now()).slice(-6);

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .insert({
      venue_id: FANCY,
      first_name: "Nicole",
      last_name: `Resend${stamp}`,
      email: `nicole-resend-${stamp}@hellotocheers-test.invalid`,
      partner_first_name: "Colby",
      partner_last_name: `Resend${stamp}`,
      partner_email: `colby-resend-${stamp}@hellotocheers-test.invalid`,
    })
    .select("id")
    .single();
  if (clientErr) throw clientErr;
  cleanup.clientId = client.id;
  out.ids.clientId = client.id;

  const contractToken = randomBytes(24).toString("hex");
  const { data: contract, error: contractErr } = await admin
    .from("contracts")
    .insert({
      venue_id: FANCY,
      client_id: client.id,
      title: `Resend Recipients Proof ${stamp}`,
      content: "Test agreement body for resend recipient selection.",
      status: "sent",
      sign_token: contractToken,
      sent_at: new Date().toISOString(),
      execution_origin: "htc",
    })
    .select("id, status, content")
    .single();
  if (contractErr) throw contractErr;
  cleanup.contractId = contract.id;
  out.ids.contractId = contract.id;

  const nicoleTok = randomBytes(24).toString("hex");
  const colbyTok = randomBytes(24).toString("hex");
  const { data: signers, error: signerErr } = await admin
    .from("contract_signers")
    .insert([
      {
        venue_id: FANCY,
        contract_id: contract.id,
        signer_type: "client",
        signer_role: "primary",
        signer_name: "Nicole Bethune",
        signer_email: `nicole-resend-${stamp}@hellotocheers-test.invalid`,
        is_required: true,
        sign_order: 0,
        sign_token: nicoleTok,
      },
      {
        venue_id: FANCY,
        contract_id: contract.id,
        signer_type: "client",
        signer_role: "partner",
        signer_name: "Colby Yagnesak",
        signer_email: `colby-resend-${stamp}@hellotocheers-test.invalid`,
        is_required: true,
        sign_order: 1,
        sign_token: colbyTok,
      },
      {
        venue_id: FANCY,
        contract_id: contract.id,
        signer_type: "venue",
        signer_role: "venue",
        signer_name: "Jen Fancy",
        signer_email: FANCY_EMAIL,
        is_required: true,
        sign_order: 99,
        sign_token: randomBytes(24).toString("hex"),
      },
    ])
    .select("id, signer_name, signer_email, signer_role, signed_at");
  if (signerErr) throw signerErr;
  cleanup.signerIds = (signers ?? []).map((s) => s.id);
  const nicole = (signers ?? []).find((s) => s.signer_name === "Nicole Bethune");
  const colby = (signers ?? []).find((s) => s.signer_name === "Colby Yagnesak");
  record("seed_two_signers", Boolean(nicole && colby), JSON.stringify({ nicole, colby }));

  // Pure validation against foreign id
  const { validateResendSelection } = await import("@/lib/contracts/resend-recipients");
  const foreign = validateResendSelection(
    (signers ?? [])
      .filter((s) => s.signer_name !== "Jen Fancy")
      .map((s) => ({
        id: s.id,
        contractId: contract.id,
        venueId: FANCY,
        signerType: "client" as const,
        signerRole: s.signer_role,
        signerRefId: null,
        clientContactId: null,
        signerName: s.signer_name,
        signerEmail: s.signer_email,
        isRequired: true,
        signOrder: 0,
        signToken: "x",
        signedAt: s.signed_at,
        signerIp: null,
        signerUserAgent: null,
        consentConfirmed: null,
        consentText: null,
        contentHash: null,
        createdAt: "",
        updatedAt: "",
      })),
    ["00000000-0000-0000-0000-000000000099"],
  );
  record("server_rejects_foreign_id", foreign.ok === false, JSON.stringify(foreign));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  try {
    const login = await page.goto(APP + "/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    out.servingSha = noteDeployment(login?.headers()["link"]);
    const tipOk = !EXPECTED_PREFIX || (!!out.servingSha && out.servingSha.startsWith(EXPECTED_PREFIX));
    record("serving_commit", tipOk, out.servingSha ?? "no dpl");
    if (!tipOk) throw new Error(`serving ${out.servingSha}, expected ${EXPECTED_PREFIX}`);

    out.urls.contract = `${APP}/contracts/${contract.id}`;
    await page.goto(out.urls.contract, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: /^Resend$/ }).first().waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Resend$/ }).first().click();
    await page.getByTestId("contract-resend-recipients").waitFor({ timeout: 15_000 });

    const sheetText = await page.locator("[data-slot='sheet-content'], [role='dialog']").first().innerText().catch(async () =>
      page.locator("body").innerText(),
    );
    record(
      "lists_nicole",
      sheetText.includes("Nicole Bethune")
        && sheetText.includes(`nicole-resend-${stamp}@hellotocheers-test.invalid`),
      "Nicole + email",
    );
    record(
      "lists_colby",
      sheetText.includes("Colby Yagnesak")
        && sheetText.includes(`colby-resend-${stamp}@hellotocheers-test.invalid`),
      "Colby + email",
    );
    record(
      "explanatory_copy",
      sheetText.includes("Choose who should receive another copy of their signing link"),
      "locked explanatory copy",
    );
    record(
      "both_selected_default",
      sheetText.includes("Sending to 2 of 2"),
      sheetText.match(/Sending to[^\n]+/)?.[0] ?? "no summary",
    );

    await page.screenshot({ path: `${OUT_DIR}/resend-both-1280.png`, fullPage: true });

    // Deselect Colby — Nicole alone
    if (colby) {
      await page.getByTestId(`contract-resend-check-${colby.id}`).click();
      await page.waitForTimeout(200);
      const alone = await page.getByTestId("contract-resend-selection-summary").innerText();
      record("select_nicole_alone", alone.includes("Sending to 1 of 2"), alone);
    }

    // Deselect all — Resend disabled
    if (nicole) {
      await page.getByTestId(`contract-resend-check-${nicole.id}`).click();
      await page.waitForTimeout(200);
      const disabled = await page.getByTestId("contract-resend-submit").isDisabled();
      record("nobody_disables_resend", disabled, `disabled=${disabled}`);
    }

    // Re-select both
    if (nicole) await page.getByTestId(`contract-resend-check-${nicole.id}`).click();
    if (colby) await page.getByTestId(`contract-resend-check-${colby.id}`).click();
    await page.waitForTimeout(200);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT_DIR}/resend-both-390.png`, fullPage: true });
    const mobileText = await page.getByTestId("contract-resend-recipients").innerText();
    record(
      "mobile_lists_both",
      mobileText.includes("Nicole Bethune") && mobileText.includes("Colby Yagnesak"),
      "390px recipients",
    );

    // Cancel without sending (avoid even sandbox email noise when possible)
    await page.getByRole("button", { name: "Cancel" }).click();

    // Signature / content unchanged
    const { data: after } = await admin
      .from("contracts")
      .select("id, status, content")
      .eq("id", contract.id)
      .single();
    const { data: afterSigners } = await admin
      .from("contract_signers")
      .select("id, signed_at")
      .eq("contract_id", contract.id);
    record(
      "contract_unchanged",
      after?.status === "sent" && after?.content === contract.content,
      JSON.stringify({ status: after?.status }),
    );
    record(
      "signatures_intact",
      (afterSigners ?? []).every((s) => s.signed_at == null),
      JSON.stringify(afterSigners),
    );
  } finally {
    await browser.close().catch(() => undefined);
    await cleanupAll().catch((e) => console.error("cleanup", e));
    writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({
      ok: out.ok,
      servingSha: out.servingSha,
      fail: out.checks.filter((c) => !c.pass).map((c) => c.name),
    }, null, 2));
  }
}

main().catch(async (err) => {
  console.error(err);
  await cleanupAll().catch(() => undefined);
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify({ ...out, error: String(err) }, null, 2));
  process.exit(1);
});
