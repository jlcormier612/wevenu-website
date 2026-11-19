/**
 * Live negative/positive execution checks for acquire_resend_send_slot.
 *
 *   DOTENV_CONFIG_PATH=../.env.local npx tsx scripts/verify-resend-pacing-rpc-roles.mts
 *
 * Read-only aside from any granted slot inserts (cleaned up). Does not apply migrations.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) {
  console.error("refusing non-sandbox supabase url");
  process.exit(2);
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!anonKey || !serviceKey) {
  console.error("missing anon or service role key");
  process.exit(2);
}

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
function rec(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function main() {
  const anon = createClient(url, anonKey!, { auth: { persistSession: false } });
  const svc = createClient(url, serviceKey!, { auth: { persistSession: false } });
  const now = Date.now() + 9e12;

  try {
    const svcRes = await svc.rpc("acquire_resend_send_slot", {
      p_priority: "bulk",
      p_max_total: 9,
      p_max_bulk: 6,
      p_window_ms: 1000,
      p_now_ms: now,
    });
    rec(
      "service-role-allowed",
      !svcRes.error && svcRes.data?.granted === true,
      JSON.stringify({ err: svcRes.error?.message, data: svcRes.data }).slice(0, 240),
    );

    const anonRes = await anon.rpc("acquire_resend_send_slot", {
      p_priority: "bulk",
      p_max_total: 9,
      p_max_bulk: 6,
      p_window_ms: 1000,
      p_now_ms: now + 1,
    });
    // Before Phase D migration: anon may still succeed (known defect).
    // After migration: expect permission error and no data grant.
    const anonDenied = !!anonRes.error && !anonRes.data?.granted;
    rec(
      "anon-denied",
      anonDenied,
      JSON.stringify({ err: anonRes.error?.message, data: anonRes.data }).slice(0, 240),
    );

    // Authenticated: sign-in optional; if no creds, report skipped.
    const email = process.env.SANDBOX_STAFF_EMAIL;
    const password = process.env.SANDBOX_STAFF_PASSWORD;
    if (email && password) {
      const authClient = createClient(url, anonKey!, { auth: { persistSession: false } });
      const { error: signErr } = await authClient.auth.signInWithPassword({ email, password });
      if (signErr) {
        rec("authenticated-denied", false, `sign-in failed: ${signErr.message}`);
      } else {
        const aRes = await authClient.rpc("acquire_resend_send_slot", {
          p_priority: "bulk",
          p_max_total: 9,
          p_max_bulk: 6,
          p_window_ms: 1000,
          p_now_ms: now + 2,
        });
        rec(
          "authenticated-denied",
          !!aRes.error && !aRes.data?.granted,
          JSON.stringify({ err: aRes.error?.message, data: aRes.data }).slice(0, 240),
        );
        await authClient.auth.signOut();
      }
    } else {
      rec("authenticated-denied", true, "skipped (no SANDBOX_STAFF_EMAIL/PASSWORD)");
    }

    // Capacity unchanged smoke: isolated timestamp band (clear prior probes first)
    await svc.from("resend_send_events").delete().gte("acquired_at_ms", now);
    let grants = 0;
    const base = now + 10_000;
    for (let i = 0; i < 8; i++) {
      const { data } = await svc.rpc("acquire_resend_send_slot", {
        p_priority: "bulk",
        p_max_total: 9,
        p_max_bulk: 6,
        p_window_ms: 1000,
        p_now_ms: base + i,
      });
      if (data?.granted) grants++;
    }
    const deny = await svc.rpc("acquire_resend_send_slot", {
      p_priority: "bulk",
      p_max_total: 9,
      p_max_bulk: 6,
      p_window_ms: 1000,
      p_now_ms: base + 20,
    });
    rec(
      "capacity-unchanged-6",
      grants === 6 && deny.data?.granted === false,
      JSON.stringify({ grants, reason: deny.data?.reason }),
    );
  } finally {
    await svc.from("resend_send_events").delete().gte("acquired_at_ms", now);
  }

  const pass = checks.every((c) => c.ok);
  console.log(pass ? "\nGREEN pacing RPC role checks" : "\nNOT GREEN pacing RPC role checks (pre-migration anon deny expected FAIL)");
  process.exit(pass ? 0 : 1);
}

await main();
