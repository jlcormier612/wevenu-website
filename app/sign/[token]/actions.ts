"use server";

import { signContractByToken } from "@/lib/contracts/service";
import { createClient } from "@/integrations/supabase/server";

export async function signContractAction(
  token: string,
  signerName: string,
  consent: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const result = await signContractByToken(token, signerName, consent);
  if (result.ok && result.clientId) {
    // Refresh the linked lead's commitment score — contract signed = milestone.
    // clientId comes from signContractByToken's own token-validated lookup
    // (TR-L6) rather than a second anonymous read by sign_token here.
    const clientId = result.clientId;
    void (async () => {
      try {
        const supabase = await createClient();
        const { data: client } = await supabase.from("clients")
          .select("lead_id").eq("id", clientId).maybeSingle<{ lead_id: string | null }>();
        if (!client?.lead_id) return;
        const { refreshLeadScore } = await import("@/lib/leads/scores");
        await refreshLeadScore(client.lead_id);
      } catch { /* non-blocking */ }
    })();
  }
  return result;
}
