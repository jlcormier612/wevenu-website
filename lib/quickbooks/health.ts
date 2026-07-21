/**
 * Connection health — surfaced from the last real sync attempt, not a
 * separate health-poll cron. A periodic CompanyInfo ping would only answer
 * "is OAuth valid," not the thing a venue actually cares about ("are my
 * real syncs succeeding"). The queue processor calls recordHealthCheck as
 * a side effect of every real API call it makes, success or failure.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import * as repo from "@/lib/quickbooks/repository";

export async function recordHealthCheck(venueId: string, ok: boolean, error?: string): Promise<void> {
  const admin = createAdminClient();
  await repo.recordHealthCheck(admin, venueId, ok, error);
}
