/**
 * Sandbox runtime check: submit a synthetic website inquiry and confirm the
 * venue notification email HTML is branded (logo + CTA). Uses Resend API
 * read-only after send. No Production. No real customer records.
 */
import { mkdirSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const OUT = "docs/qa/inquiry-notification-branding";
const INQUIRY_KEY = "cd9e89529e65480ba8cfc6e154193d5a";
const BASE = "https://app.sandbox.hellotocheers.com";
const stamp = Date.now();
const email = `jlcormier612+inqbrand${stamp}@gmail.com`;

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function check(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  check("Sandbox health", health?.ok === true, JSON.stringify(health));

  const inquire = await fetch(`${BASE}/api/public/inquire`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      embedKey: INQUIRY_KEY,
      firstName: "Brand",
      lastName: `Probe${stamp}`,
      email,
      phone: "5551212121",
      eventType: "wedding",
      eventDate: "2028-08-08",
      guestCount: 75,
      message: `Inquiry branding probe ${stamp}`,
    }),
  }).then(async (r) => ({ status: r.status, json: await r.json() }));
  check("Inquiry submitted", inquire.json?.ok === true, JSON.stringify(inquire));

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: lead } = await admin
    .from("leads")
    .select("id,first_name,last_name,email,created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  check("Lead created", !!lead?.id, JSON.stringify(lead));

  // Poll Resend for the branded subject (Sandbox may redirect to COMMUNICATION_SANDBOX_EMAIL)
  const resendKey = process.env.RESEND_API_KEY;
  let html: string | null = null;
  let subject: string | null = null;
  if (resendKey) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const list = await fetch("https://api.resend.com/emails?limit=20", {
        headers: { Authorization: `Bearer ${resendKey}` },
      }).then((r) => r.json());
      const match = (list?.data ?? []).find((row: { subject?: string }) =>
        String(row.subject ?? "").includes(`New inquiry from Brand Probe${stamp}`),
      );
      if (match?.id) {
        const full = await fetch(`https://api.resend.com/emails/${match.id}`, {
          headers: { Authorization: `Bearer ${resendKey}` },
        }).then((r) => r.json());
        html = full?.html ?? null;
        subject = full?.subject ?? match.subject ?? null;
        break;
      }
    }
  }

  check("Resend email found", !!html && !!subject, `subject=${subject}`);
  if (html) {
    writeFileSync(`${OUT}/captured-email.html`, html);
    check("Has HTC logo asset", /hello-to-cheers-logo-primary-transparent/.test(html), "logo");
    check("Has Heritage Sage CTA", /background:#5D6F5D/.test(html), "cta color");
    check("Has View lead CTA label", /View Brand/.test(html), "cta label");
    check("Lead deep link present", lead?.id ? html.includes(`/leads/${lead.id}`) : false, lead?.id ?? "no lead");
    const visible = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    check("No visible raw http URL in body text", !/https?:\/\//.test(visible), visible.slice(0, 200));
  }

  const out = { stamp, email, lead, inquire, subject, checks, pass: checks.every((c) => c.pass) };
  writeFileSync(`${OUT}/verify-results.json`, JSON.stringify(out, null, 2));
  console.log(out.pass ? "INQUIRY_BRANDING_RUNTIME_PASS" : "INQUIRY_BRANDING_RUNTIME_FAIL");
  if (!out.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
