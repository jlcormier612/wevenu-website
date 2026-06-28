"use server";

import { signContractByToken } from "@/lib/contracts/service";
import { createClient } from "@/integrations/supabase/server";

export async function signContractAction(
  token: string,
  signerName: string,
): Promise<{ ok: boolean; message?: string }> {
  const result = await signContractByToken(token, signerName);
  if (result.ok) {
    // Refresh the linked lead's commitment score — contract signed = milestone
    void (async () => {
      try {
        const supabase = await createClient();
        const { data: contract } = await supabase.from("contracts")
          .select("client_id").eq("sign_token", token).maybeSingle<{ client_id: string | null }>();
        if (!contract?.client_id) return;
        const { data: client } = await supabase.from("clients")
          .select("lead_id").eq("id", contract.client_id).maybeSingle<{ lead_id: string | null }>();
        if (!client?.lead_id) return;
        const { refreshLeadScore } = await import("@/lib/leads/scores");
        await refreshLeadScore(client.lead_id);
      } catch { /* non-blocking */ }
    })();
  }
  return result;
}
