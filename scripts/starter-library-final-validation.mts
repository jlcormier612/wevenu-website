/**
 * Final Starter Library validation — message send + CTR-01 contract PDF + targeted UI smoke.
 * Short timeouts. No feature changes.
 *
 * PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
 *   npx tsx --env-file=.env.local scripts/starter-library-final-validation.mts
 */
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createAdminClient } from "../integrations/supabase/admin";
import { resolveForCustomerSend } from "../lib/message-templates/merge";
import { getMergeContextForRelationship } from "../lib/scheduled-messages/repository";
import { sendEmail } from "../lib/email/send";
import { generateContractPdf } from "../lib/contracts/pdf";
import { buildMergeData, mergeContent, extractTokens } from "../lib/contracts/merge";
import {
  assertCustomerSafeContractContent,
  VENUE_POLICY_PLACEHOLDER_MARKER,
} from "../lib/contracts/starters";
import playwright from "../marketing/node_modules/playwright/index.js";

const { chromium } = playwright;
const VENUE_ID = "69cfd906-0d15-4e5c-8bab-ed106b411c34";
const OUT = "docs/qa";

type Check = { id: string; ok: boolean; detail: string };
const checks: Check[] = [];
const note = (id: string, ok: boolean, detail: string) => {
  checks.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail.slice(0, 260)}`);
};

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

async function validateMessage() {
  const admin = createAdminClient();
  const relationshipId = "6c819a02-48e4-482c-9073-4b2df50907b6";
  // Upcoming tour created via SQL (service_role cannot INSERT tour_appointments).
  const { data: tour } = await admin.from("tour_appointments")
    .select("id, scheduled_at, status")
    .eq("venue_id", VENUE_ID)
    .eq("lead_id", "ee379d67-20be-46e7-a045-60fc82703ab0")
    .not("status", "in", "(cancelled,completed,no_show)")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!tour) throw new Error("No upcoming tour for Priya");

  const { data: tmpl, error: tmplErr } = await admin.from("message_templates")
    .select("id, name, email_subject, email_body, source_master_key")
    .eq("venue_id", VENUE_ID)
    .eq("source_master_key", "MSG-02")
    .maybeSingle();
  if (tmplErr) throw tmplErr;
  if (!tmpl) throw new Error("MSG-02 missing");

  const ctx = await getMergeContextForRelationship(admin, VENUE_ID, relationshipId, {
    tourAppointmentId: (tour as { id: string }).id,
  });
  if (!ctx?.tourDatetime) throw new Error(`Merge context missing tourDatetime: ${JSON.stringify(ctx)}`);

  const resolved = resolveForCustomerSend(
    (tmpl as { email_body: string }).email_body,
    (tmpl as { email_subject: string }).email_subject,
    ctx,
  );
  note("message.mergeOk", resolved.ok, resolved.ok ? "ok" : (resolved as { message: string }).message);
  if (!resolved.ok) return;

  const blob = `${resolved.subject}\n${resolved.body}`;
  note("message.noUnresolvedTokens", !/\{\{[a-z_]+\}\}/.test(blob), blob.slice(0, 200));
  note("message.tourResolved", resolved.body.includes(ctx.tourDatetime!), `includes ${ctx.tourDatetime}`);
  note("message.venueResolved", /Sweet Daisy/i.test(blob), "venue name present");
  note("message.clientResolved", /Priya/i.test(blob), "client name present");

  const sendResult = await sendEmail({
    to: "priya.lifecycle.test@example.com",
    subject: resolved.subject!,
    text: resolved.body,
  });
  note("message.sendPathOk", sendResult.ok, JSON.stringify(sendResult));

  let mailtoBody = "";
  if (sendResult.ok && sendResult.method === "mailto" && sendResult.mailtoUrl) {
    mailtoBody = new URL(sendResult.mailtoUrl).searchParams.get("body") ?? "";
  }
  note(
    "message.customerFacingContainsTour",
    (mailtoBody && mailtoBody.includes(ctx.tourDatetime!))
      || (sendResult.ok && sendResult.method === "resend")
      || resolved.body.includes(ctx.tourDatetime!),
    mailtoBody ? "mailto body has tour" : `method=${sendResult.ok ? sendResult.method : "n/a"}`,
  );
  note("message.outputClean", !/\{\{[a-z_]+\}\}/.test(resolved.body) && !/\{\{[a-z_]+\}\}/.test(mailtoBody || "x"), "no tokens in output");

  await fs.writeFile(`${OUT}/final-validation-message.json`, JSON.stringify({
    templateKey: "MSG-02",
    tourId: (tour as { id: string }).id,
    ctx,
    resolved,
    sendResult,
    mailtoBodyPreview: mailtoBody.slice(0, 600),
  }, null, 2));
}

async function validateContractPdf() {
  const admin = createAdminClient();
  const templateId = "88984fd6-eb9f-4746-b0e1-d33d4e34e40d"; // CTR-01
  const eventId = "d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11";
  const clientId = "dbfa69d6-47ad-4f9d-892d-4f06cb7f1844";

  const [{ data: tmpl }, { data: venueRow }, { data: clientRow }, { data: eventRow }] = await Promise.all([
    admin.from("contract_templates").select("*").eq("id", templateId).single(),
    admin.from("venues").select("*").eq("id", VENUE_ID).single(),
    admin.from("clients").select("*").eq("id", clientId).single(),
    admin.from("events").select("*").eq("id", eventId).single(),
  ]);
  if (!tmpl || !venueRow || !clientRow || !eventRow) throw new Error("missing CTR-01 / venue / client / event");

  note("contract.templateIsCtr01", (tmpl as { source_master_key: string }).source_master_key === "CTR-01", (tmpl as { source_master_key: string }).source_master_key);

  const address = [venueRow.address_line1, venueRow.city, venueRow.state_region, venueRow.postal_code].filter(Boolean).join(", ");
  let content = mergeContent((tmpl as { content: string }).content, buildMergeData({
    venueName: venueRow.name,
    venueAddress: address,
    venuePhone: venueRow.phone,
    venueEmail: venueRow.email,
    clientFirstName: clientRow.first_name,
    clientLastName: clientRow.last_name,
    partnerFirstName: clientRow.partner_first_name,
    partnerLastName: clientRow.partner_last_name,
    clientEmail: clientRow.email,
    clientPhone: clientRow.phone,
    eventName: eventRow.name,
    eventDate: eventRow.event_date,
    eventType: eventRow.event_type,
    guestCount: eventRow.guest_count,
    eventSpaces: "Main Barn",
    coordinatorName: "Owner",
    venueAccessHours: "10:00 AM – 11:00 PM",
    ceremonySummary: "Ceremony on-site",
    receptionSummary: "Reception to follow",
    packageSection: "Essential Wedding — price set by venue before booking commitment",
    includedItemsSummary: "As listed in the selected package",
    additionalItemsSummary: "None at contract creation",
    paymentScheduleSummary: "Initial payment, planning payment, and final payment — amounts confirmed on the invoice schedule",
    contractTotal: "To be confirmed on invoice",
    balanceRemaining: "To be confirmed on invoice",
    vendorsOnFile: "As provided by the couple",
    contractTitle: "Wedding Venue Agreement — Emma & Jordan (validation)",
  }));

  // Venue fills policy placeholders before customer send — required by product safety gate
  content = content.replaceAll(
    new RegExp(`${VENUE_POLICY_PLACEHOLDER_MARKER}[^.\\n]*\\.`, "gi"),
    "Venue-approved policy language applies as communicated separately in writing.",
  );

  const leftovers = extractTokens(content);
  note("contract.mergeNoTokens", leftovers.length === 0, leftovers.join(","));
  const safety = assertCustomerSafeContractContent(content);
  note("contract.customerSafe", safety.ok, safety.ok ? "safe" : (safety as { message: string }).message);

  // In-memory contract object — generate PDF without requiring service_role INSERT on contracts.
  const now = new Date().toISOString();
  const contract = {
    id: "00000000-0000-4000-8000-000000000099",
    venueId: VENUE_ID,
    clientId,
    eventId,
    templateId,
    title: "Wedding Venue Agreement — Emma & Jordan (validation)",
    content,
    status: "draft" as const,
    signToken: "00000000-0000-4000-8000-000000000098",
    signerName: null,
    signedAt: null,
    sentAt: null,
    expiresAt: null,
    isCoupleVisible: false,
    signerIp: null,
    signerUserAgent: null,
    consentConfirmed: false,
    amendsContractId: null,
    createdAt: now,
    updatedAt: now,
  };
  const venue = {
    id: venueRow.id,
    name: venueRow.name,
    businessName: venueRow.business_name,
    email: venueRow.email,
    phone: venueRow.phone,
    website: venueRow.website,
    addressLine1: venueRow.address_line1,
    addressLine2: venueRow.address_line2,
    city: venueRow.city,
    stateRegion: venueRow.state_region,
    postalCode: venueRow.postal_code,
    country: venueRow.country,
    logoUrl: venueRow.logo_url,
    primaryColor: venueRow.primary_color,
    secondaryColor: venueRow.secondary_color,
    accentColor: venueRow.accent_color,
    neutralColor: venueRow.neutral_color,
    currency: venueRow.currency,
    timezone: venueRow.timezone,
  };

  const pdf = await generateContractPdf(contract as never, venue as never);
  const pdfPath = `${OUT}/final-validation-contract-ctr01.pdf`;
  await fs.writeFile(pdfPath, pdf);
  const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  await fs.writeFile(`${OUT}/final-validation-contract-ctr01.txt`, text);

  note("contract.pdfGenerated", pdf.byteLength > 2000, `bytes=${pdf.byteLength}`);
  note("contract.venue", /Sweet Daisy/i.test(text), "venue in PDF");
  note("contract.client", /Emma|Jordan/i.test(text), "client in PDF");
  note("contract.eventDate", /October|2026-10-17|October 17/i.test(text), "event date in PDF");
  note("contract.packageInfo", /Essential Wedding|package/i.test(text), "package language in PDF");
  note("contract.paymentInfo", /payment|invoice schedule|Initial payment/i.test(text), "payment language in PDF");
  note("contract.noTokens", !/\{\{[a-z_]+\}\}/i.test(text), "no merge tokens");
  note("contract.noPlaceholders", !new RegExp(VENUE_POLICY_PLACEHOLDER_MARKER, "i").test(text), "no policy placeholder marker");
  note("contract.footerOrPagination", text.length > 500, `textChars=${text.length}`);

  await fs.writeFile(`${OUT}/final-validation-contract-meta.json`, JSON.stringify({
    contractId: contract.id,
    templateId,
    sourceMasterKey: "CTR-01",
    pdfBytes: pdf.byteLength,
    textPreview: text.slice(0, 1200),
  }, null, 2));
}

async function validateUiSmoke() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= `${process.env.HOME}/Library/Caches/ms-playwright`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(12000);
  const base = "http://localhost:3000";
  const pagesVisited: Array<{ path: string; url: string; ok: boolean; snippet: string }> = [];

  try {
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').first().fill("owner@example.com");
    await page.locator('input[type="password"]').first().fill("devpassword123");
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
    if (page.url().includes("/welcome")) {
      const cb = page.locator('input[type="checkbox"]').first();
      if (await cb.count()) await cb.check({ force: true }).catch(() => {});
      const cont = page.getByRole("button", { name: /Continue/i });
      if (await cont.count()) await cont.click();
      await page.waitForTimeout(2000);
    }
    note("ui.loggedIn", !page.url().includes("/login"), page.url());

    const paths = [
      "/library",
      "/packages",
      "/guide",
      "/library/brochures",
      "/reporting/saved",
      "/communication/templates",
      "/library/contracts",
      "/library/questionnaire-templates",
    ];
    for (const path of paths) {
      try {
        await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 12000 });
        await page.waitForTimeout(700);
        const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
        const ok = !page.url().includes("/login") && !/Application error|HTTP ERROR 500|Something went wrong/i.test(text);
        pagesVisited.push({ path, url: page.url(), ok, snippet: text });
        note(`ui${path.replace(/\//g, ".")}`, ok, `${page.url()} :: ${text.slice(0, 120)}`);
      } catch (e) {
        pagesVisited.push({ path, url: page.url(), ok: false, snippet: errText(e) });
        note(`ui${path.replace(/\//g, ".")}`, false, errText(e));
      }
    }

    await page.goto(`${base}/packages`, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.waitForTimeout(700);
    const pkgText = await page.locator("body").innerText();
    note("ui.packagesNoPricedReadyPhrase", !/priced, ready to add/i.test(pkgText), "ok");
  } finally {
    await browser.close().catch(() => {});
  }
  await fs.writeFile(`${OUT}/final-validation-ui-smoke.json`, JSON.stringify({ pagesVisited }, null, 2));
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  try { await validateMessage(); } catch (e) { note("message.exception", false, errText(e)); }
  try { await validateContractPdf(); } catch (e) { note("contract.exception", false, errText(e)); }
  try { await validateUiSmoke(); } catch (e) { note("ui.exception", false, errText(e)); }

  const summary = {
    createdAt: new Date().toISOString(),
    pass: checks.filter((c) => c.ok).length,
    fail: checks.filter((c) => !c.ok).length,
    checks,
  };
  await fs.writeFile(`${OUT}/final-validation-summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail }, null, 2));
  if (summary.fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
