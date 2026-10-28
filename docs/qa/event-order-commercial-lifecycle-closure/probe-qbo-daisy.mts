/**
 * Sandbox-only: prove Daisy QBO token refresh + CompanyInfo (read-only).
 * Does not create invoices. Loads secrets from /tmp/htc-qbo-probe/env.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: "/tmp/htc-qbo-probe/env", quiet: true });
process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";

const DAISY = "5c84e74e-355d-4ce1-9e6b-913a9267f543";

async function main() {
  const { getValidAccessToken, quickBooksFetch } = await import("@/lib/quickbooks/client");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const before = await admin
    .from("quickbooks_connections")
    .select("company_name,environment,status,last_health_check_ok,last_error,access_token_expires_at")
    .eq("venue_id", DAISY)
    .maybeSingle();

  const token = await getValidAccessToken(DAISY);
  const out: Record<string, unknown> = {
    before: before.data,
    tokenOk: token.ok,
    error: token.ok ? null : token.error,
    refreshDead: token.ok ? null : (token as { refreshTokenDead?: boolean }).refreshTokenDead,
    realmPrefix: token.ok ? `${token.realmId.slice(0, 4)}…` : null,
  };

  if (token.ok) {
    const r = await quickBooksFetch(DAISY, `/companyinfo/${token.realmId}`);
    if (!r.ok) {
      out.companyInfo = { ok: false, error: r.error };
    } else {
      const body = (await r.response.json().catch(() => null)) as {
        CompanyInfo?: { CompanyName?: string; Country?: string };
      } | null;
      out.companyInfo = {
        ok: r.response.ok,
        status: r.response.status,
        companyName: body?.CompanyInfo?.CompanyName ?? null,
        country: body?.CompanyInfo?.Country ?? null,
      };
    }
  }

  const after = await admin
    .from("quickbooks_connections")
    .select("company_name,environment,status,last_health_check_ok,last_error,access_token_expires_at")
    .eq("venue_id", DAISY)
    .maybeSingle();
  out.after = after.data;

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
