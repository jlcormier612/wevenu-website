/**
 * Local failure-injection for legal proxy fail-closed behavior.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import assert from "node:assert/strict";
import { writeFile } from "fs/promises";
import path from "path";

import { LEGAL_ENFORCEMENT_UNAVAILABLE_PATH } from "../../../lib/legal/enforcement-fail-mode.ts";
import { decideLegalProxyEnforcement } from "../../../lib/legal/enforce-legal-in-proxy.ts";

const OUT = path.join(
  process.cwd(),
  "docs/design/legal-launch-consolidated-audit",
  "proxy-fail-closed-repro.json",
);

async function main() {
  const evidence: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
  };
  const user = { id: "00000000-0000-0000-0000-000000000001" };

  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  const missingKey = await decideLegalProxyEnforcement(
    {
      user: user as never,
      pathname: "/dashboard",
      search: "",
      prefer: "venue",
    },
    { failOpenEnabled: () => false },
  );
  evidence.missingServiceRoleKey = missingKey;
  assert.equal(missingKey.action, "unavailable");

  process.env.SUPABASE_SERVICE_ROLE_KEY = "invalid-service-role-for-repro";
  const adminFail = await decideLegalProxyEnforcement(
    {
      user: user as never,
      pathname: "/clients",
      search: "",
      prefer: "venue",
    },
    {
      failOpenEnabled: () => false,
      createAdminClient: () => {
        throw new Error("admin init failed");
      },
    },
  );
  evidence.adminClientFailure = adminFail;
  assert.equal(adminFail.action, "unavailable");

  const engineFail = await decideLegalProxyEnforcement(
    {
      user: user as never,
      pathname: "/api/events",
      search: "",
      prefer: "venue",
    },
    {
      failOpenEnabled: () => false,
      createAdminClient: (() => ({})) as never,
      resolveUserType: async () => ({
        userType: "venue_owner",
        kind: "venue_owner_signup",
      }),
      requiresAcceptance: async () => {
        throw new Error("engine exploded");
      },
    },
  );
  evidence.engineErrorApi = engineFail;
  assert.equal(engineFail.action, "block_api");
  if (engineFail.action === "block_api") {
    assert.equal(engineFail.code, "legal_enforcement_unavailable");
  }

  if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;

  evidence.recoveryPath = LEGAL_ENFORCEMENT_UNAVAILABLE_PATH;
  evidence.verdict =
    "decideLegalProxyEnforcement fails closed (unavailable / 503 API) when service role missing, admin init fails, or engine throws — unless local LEGAL_ENFORCEMENT_FAIL_OPEN override is active";

  await writeFile(OUT, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
