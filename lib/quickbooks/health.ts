/**
 * Connection health — surfaced from the last real Intuit sync attempt, not a
 * separate health-poll cron. A periodic CompanyInfo ping would only answer
 * "is OAuth valid," not the thing a venue actually cares about ("are my
 * real syncs succeeding"). The queue processor calls recordHealthCheck as
 * a side effect of every real API call it makes, success or failure.
 *
 * Dependency waits (invoice waiting on customer, payment waiting on invoice)
 * are not connection-health events — they never reach Intuit — and must not
 * overwrite last_health_check_ok / last_error. A successful sync clears
 * last_error so Settings cannot show a stale failure after recovery.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import * as repo from "@/lib/quickbooks/repository";

export async function recordHealthCheck(venueId: string, ok: boolean, error?: string): Promise<void> {
  const admin = createAdminClient();
  await repo.recordHealthCheck(admin, venueId, ok, error);
}
