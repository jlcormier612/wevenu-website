/**
 * Stage 2B implementation preview capture.
 * Injects the same staff-light CSS as app/globals.css Contemporary Botanical
 * so Sandbox shots match the branch before/while deploy rolls. No Production.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const OUT = "/Users/jensmac/Developer/wevenu-website/docs/qa/staff-light-canvas/stage2b";
mkdirSync(`${OUT}/implementation-preview`, { recursive: true });
const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const JEN = "jennifer@hellotocheers.com";
const JEN_ID = "2fa73101-337b-4530-8c77-f3c272c5463e";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

/** Mirrors Stage 2B staff light tokens + active nav indicator */
const PREVIEW_CSS = `
.htc-staff, html:has(.htc-staff) {
  --htc-botanical: #446b56;
  --htc-eucalyptus: #a7c2af;
  --htc-blush: #d99a9e;
  --htc-soft-blush: #f7e9eb;
  --htc-workspace: #fafcfa;
  --warm-gray: #fafcfa;
  --natural-cream: #fafcfa;
  --header-linen: #ffffff;
  --panel-blush: #f7e9eb;
  --panel-sage: color-mix(in oklch, #a7c2af 22%, white);
  --background: #fafcfa;
  --foreground: #24332b;
  --heading: #24332b;
  --card: #ffffff;
  --card-foreground: #24332b;
  --popover: #ffffff;
  --popover-foreground: #24332b;
  --muted: color-mix(in oklch, #a7c2af 18%, white);
  --muted-foreground: #5f6f68;
  --secondary: #ffffff;
  --secondary-foreground: #446b56;
  --border: #e3e7e4;
  --input: #e3e7e4;
  --primary: #446b56;
  --primary-foreground: #ffffff;
  --accent: #a7c2af;
  --accent-foreground: #24332b;
  --destructive: #d99a9e;
  --destructive-foreground: #24332b;
  --ring: #446b56;
  --sidebar: #ffffff;
  --sidebar-foreground: #24332b;
  --sidebar-primary: #446b56;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: color-mix(in oklch, #a7c2af 28%, white);
  --sidebar-accent-foreground: #446b56;
  --sidebar-border: #e3e7e4;
  --sidebar-ring: #446b56;
  --selected: color-mix(in oklch, #a7c2af 32%, white);
  --selected-foreground: #24332b;
  --selected-border: #a7c2af;
}
.htc-staff [data-slot="card"],
html:has(.htc-staff) [data-slot="card"] {
  border: 1px solid #e3e7e4 !important;
  box-shadow:
    0 1px 2px color-mix(in oklch, #24332b 6%, transparent),
    0 4px 14px color-mix(in oklch, #24332b 4%, transparent) !important;
}
/* Active nav indicator (matches sidebar-nav before: bar) when live build lacks it yet */
.htc-staff nav[aria-label="Primary"] a[aria-current="page"] {
  color: #446b56;
}
.htc-staff nav[aria-label="Primary"] a[aria-current="page"] svg {
  color: #446b56;
}
`;

const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: JEN });
const { data: otp } = await anon.auth.verifyOtp({ type: "email", token_hash: link!.properties!.hashed_token! });
await admin.from("venue_staff_active_context").upsert(
  { user_id: JEN_ID, active_venue_id: FANCY, updated_at: new Date().toISOString() },
  { onConflict: "user_id" },
);
const base = { domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const };
const cookies = [
  ...ssr.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)))
    .map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: FANCY },
];

const loginHtml = await (await fetch(`${APP}/login`)).text();
const dpl = (loginHtml.match(/dpl=([a-zA-Z0-9]+)/) ?? [])[1]?.slice(0, 8) ?? "?";

const browser = await chromium.launch();
const pages = [
  ["/dashboard", "dashboard"],
  ["/leads", "leads"],
  ["/library/offerings", "offerings"],
] as const;

const notes: unknown[] = [];
for (const [path, slug] of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(cookies);
  await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
  const p = await ctx.newPage();
  await p.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3200);
  await p.addStyleTag({ content: PREVIEW_CSS });
  // Reinforce active row chrome for pre-deploy builds
  await p.evaluate(`(() => {
    const active = document.querySelector('nav[aria-label="Primary"] a[aria-current="page"]');
    const row = active && active.closest('div.group\\\\/nav, div[class*="group/nav"]');
    if (row instanceof HTMLElement) {
      row.style.position = 'relative';
      row.style.background = 'color-mix(in oklch, #a7c2af 28%, white)';
      row.style.color = '#446b56';
      row.style.fontWeight = '500';
      if (!row.querySelector('[data-preview-nav-bar]')) {
        const bar = document.createElement('span');
        bar.dataset.previewNavBar = '1';
        bar.style.cssText = 'position:absolute;left:0;top:4px;bottom:4px;width:3px;border-radius:999px;background:#446B56;';
        row.prepend(bar);
      }
    }
  })()`);
  await p.waitForTimeout(300);
  const tokens = await p.evaluate(`(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = (k) => cs.getPropertyValue(k).trim();
    return {
      background: g("--background"),
      card: g("--card"),
      primary: g("--primary"),
      accent: g("--accent"),
      sidebar: g("--sidebar"),
      foreground: g("--foreground"),
      mutedForeground: g("--muted-foreground"),
      border: g("--border"),
      destructive: g("--destructive"),
      destructiveForeground: g("--destructive-foreground"),
    };
  })()`);
  await p.screenshot({ path: `${OUT}/implementation-preview/${slug}.png`, fullPage: false });
  notes.push({ path, slug, tokens });
  console.log(`OK  ${slug}`, JSON.stringify(tokens));
  await ctx.close();
}

writeFileSync(`${OUT}/implementation-preview/results.json`, JSON.stringify({
  dpl,
  note: "Preview CSS mirrors Stage 2B staff light implementation; nav bar reinforced when live build predates sidebar-nav change.",
  palette: {
    primary: "#446B56",
    eucalyptus: "#A7C2AF",
    blush: "#D99A9E",
    softBlush: "#F7E9EB",
    card: "#FFFFFF",
    sidebar: "#FFFFFF",
    page: "#FAFCFA",
    ink: "#24332B",
    muted: "#5F6F68",
    border: "#E3E7E4",
  },
  notes,
}, null, 2));
console.log(`dpl=${dpl} → implementation-preview/`);
await browser.close();
