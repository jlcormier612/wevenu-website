/**
 * Sandbox browser + render proof for venue email footer contact prefs.
 * Does not email real customers. Disposable venue optional; Fancy for UI.
 * Never logs secrets.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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
const FANCY = "jennifer@hellotocheers.com";
const OUT = "docs/qa/email-footer-contact-prefs";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
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

async function main() {
  // Schema columns present
  const { data: venueProbe, error: probeErr } = await admin
    .from("venues")
    .select(
      "id, email, phone, email_signature, email_footer_show_signature, email_footer_show_email, email_footer_show_phone",
    )
    .limit(1);
  record(
    "schema_columns_present",
    !probeErr && Array.isArray(venueProbe),
    probeErr?.message ?? `rows=${venueProbe?.length ?? 0}`,
  );

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(await cookiesFor(FANCY));
  const page = await ctx.newPage();

  try {
    await page.goto(`${APP}/settings/communications#identity`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(2500);

    const dpl =
      (await page.content()).match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
    if (EXPECT_SHA) {
      record("runtime_dpl", dpl.startsWith(EXPECT_SHA), `dpl=${dpl}`);
    } else {
      record("runtime_dpl", Boolean(dpl), `dpl=${dpl || "missing"}`);
    }

    record(
      "settings_heading",
      (await page.getByText(/How clients see you/i).count()) > 0,
      "identity card",
    );
    record(
      "phone_control_visible",
      (await page.getByText(/Show venue phone number/i).count()) > 0,
      "phone checkbox label",
    );
    record(
      "email_control_visible",
      (await page.getByText(/Show venue email address/i).count()) > 0,
      "email checkbox label",
    );
    record(
      "signature_control_visible",
      (await page.getByText(/Show venue \/ team sign-off/i).count()) > 0,
      "signature checkbox label",
    );
    record(
      "preview_iframe",
      (await page.locator('iframe[title="Email brand preview"]').count()) > 0,
      "preview present",
    );

    await page.screenshot({ path: `${OUT}/settings-identity.png`, fullPage: false });

    // Venue isolation: prefs columns are per-venue (two Fancy memberships if any)
    const { data: fancyUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = fancyUser?.users?.find(
      (u) => u.email?.toLowerCase() === FANCY.toLowerCase(),
    );
    if (user) {
      const { data: memberships } = await admin
        .from("venue_staff")
        .select("venue_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(5);
      const ids = (memberships ?? []).map((m) => m.venue_id as string);
      if (ids.length >= 2) {
        const { data: rows } = await admin
          .from("venues")
          .select("id, email_footer_show_phone")
          .in("id", ids);
        record(
          "prefs_are_per_venue_rows",
          Boolean(rows && rows.length >= 2),
          `venues=${rows?.length ?? 0}`,
        );
      } else {
        record("prefs_are_per_venue_rows", true, "single membership — skipped multi compare");
      }
    } else {
      record("prefs_are_per_venue_rows", false, "fancy user not found");
    }
  } finally {
    await browser.close();
  }

  // Pure render proof (same module as production) — no customer send
  const { emailBrandFromVenue, renderBrandedEmailHtml } = await import(
    "@/lib/email/venue-brand"
  );
  const hiddenPhone = renderBrandedEmailHtml(
    emailBrandFromVenue({
      name: "Proof Venue",
      emailSignature: "Warmly,\nProof Venue",
      email: "proof@example.test",
      phone: "9788703988",
    }),
    "<p>Body</p>",
  );
  record(
    "render_default_hides_phone",
    /proof@example\.test/.test(hiddenPhone) && !/870-3988/.test(hiddenPhone),
    "default footer",
  );
  const shownPhone = renderBrandedEmailHtml(
    emailBrandFromVenue({
      name: "Proof Venue",
      email: "proof@example.test",
      phone: "9788703988",
      emailFooterShowPhone: true,
      emailFooterShowEmail: false,
      emailFooterShowSignature: false,
    }),
    "<p>Body</p>",
  );
  record(
    "render_phone_only_no_separator_artifact",
    /\(978\) 870-3988/.test(shownPhone) &&
      !/proof@example\.test/.test(shownPhone) &&
      !/ · /.test(shownPhone),
    "phone-only footer",
  );

  const required = [
    "schema_columns_present",
    "runtime_dpl",
    "phone_control_visible",
    "email_control_visible",
    "signature_control_visible",
    "preview_iframe",
    "render_default_hides_phone",
    "render_phone_only_no_separator_artifact",
  ];
  const report = {
    observedAt: new Date().toISOString(),
    expectSha: EXPECT_SHA || null,
    checks,
    hardFail: checks.filter((c) => required.includes(c.name) && !c.pass).map((c) => c.name),
    ok: required.every((n) => checks.find((c) => c.name === n)?.pass),
  };
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN email footer contact prefs" : "NOT GREEN email footer contact prefs");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
