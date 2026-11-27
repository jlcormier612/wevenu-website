/**
 * Focused Sandbox evidence: Settings → Integrations after removing
 * temporary environment-readiness copy. Does not reconnect providers.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/.worktrees/ws2-venue-comms/package.json",
);
const { config } = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");

const REPO = "/Users/jensmac/Developer/wevenu-website/.worktrees/ws2-venue-comms";
config({ path: join(REPO, ".env.local"), quiet: true });

const BASE = "https://app.sandbox.hellotocheers.com";
const EMAIL = "jennifer@hellotocheers.com";
const DAISY = "5c84e74e-355d-4ce1-9e6b-913a9267f543";
const OUT = join(homedir(), "Desktop/HTC-LAUNCH-FINAL/P1-INTEGRATION-CONNECT-CORRECTION");
mkdirSync(OUT, { recursive: true });

const FORBIDDEN = [
  "isn't ready to start in this environment",
  "working Connect button will appear",
  "this environment yet",
  "Coming soon",
  "Connection temporarily unavailable",
];

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
});
if (linkErr) throw linkErr;
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);
const { data: verified, error: vErr } = await anon.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "email",
});
if (vErr) throw vErr;
const session = verified.session;
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

const userClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
await userClient.rpc("set_active_venue", { p_venue_id: DAISY });

const cookies = [
  {
    name: `sb-${projectRef}-auth-token`,
    value: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: "bearer",
    }),
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
  },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
await context.addCookies(cookies);
const page = await context.newPage();

await page.goto(`${BASE}/settings/integrations`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(2500);

const html = await page.content();
const dpl = (html.match(/dpl=([a-f0-9]{40})/) || [])[1] || "unknown";
const bodyText = await page.locator("body").innerText();
const forbiddenHits = FORBIDDEN.filter((s) => bodyText.toLowerCase().includes(s.toLowerCase()));

const cards = [
  { id: "stripe", title: "Online Payment Collection", file: "01-stripe-card.png" },
  { id: "quickbooks", title: "QuickBooks Online", file: "02-quickbooks-card.png" },
  { id: "facebook", title: "Facebook & Instagram Lead Ads", file: "03-facebook-card.png" },
];

const findings = [];
for (const card of cards) {
  const heading = page.getByRole("heading", { name: card.title, exact: true }).first();
  await heading.scrollIntoViewIfNeeded();
  const cardRoot = heading.locator("xpath=ancestor::*[contains(@class,'rounded') or self::div][1]");
  // Prefer nearest Card by walking up from title
  const shotTarget = heading.locator("xpath=ancestor::div[contains(@class,'border')][1]");
  const el = (await shotTarget.count()) ? shotTarget : heading;
  const path = join(OUT, card.file);
  await el.screenshot({ path });
  const text = await el.innerText().catch(() => "");
  const hasConnect = /Connect (Stripe|QuickBooks|Facebook)/i.test(text);
  const hasGuide = /setup guide|step-by-step/i.test(text);
  const cardForbidden = FORBIDDEN.filter((s) => text.toLowerCase().includes(s.toLowerCase()));
  findings.push({
    card: card.title,
    hasConnectCta: hasConnect,
    hasGuideLink: hasGuide,
    forbiddenHits: cardForbidden,
    screenshot: card.file,
  });
}

await page.screenshot({ path: join(OUT, "04-integrations-full.png"), fullPage: true });

const report = {
  capturedAt: new Date().toISOString(),
  servingSha: dpl,
  url: `${BASE}/settings/integrations`,
  pageForbiddenHits: forbiddenHits,
  findings,
};
writeFileSync(join(OUT, "ACCEPTANCE.json"), JSON.stringify(report, null, 2));
writeFileSync(
  join(OUT, "ACCEPTANCE.md"),
  [
    "# Integration Connect correction — Sandbox acceptance",
    "",
    `- Serving SHA: \`${dpl}\``,
    `- URL: ${BASE}/settings/integrations`,
    `- Page-level forbidden copy hits: ${forbiddenHits.length ? forbiddenHits.join("; ") : "none"}`,
    "",
    ...findings.map(
      (f) =>
        `- **${f.card}**: Connect CTA=${f.hasConnectCta}; guide=${f.hasGuideLink}; forbidden=${f.forbiddenHits.length ? f.forbiddenHits.join("; ") : "none"}; \`${f.screenshot}\``,
    ),
    "",
  ].join("\n"),
);
writeFileSync(join(OUT, "SERVING-SHA.txt"), `${dpl}\n`);

await browser.close();
console.log(JSON.stringify(report, null, 2));
if (forbiddenHits.length) process.exit(2);
