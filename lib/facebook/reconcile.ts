/**
 * Reconciliation poll — the backup for a webhook Meta failed to deliver
 * (network blip, brief outage, app unreachable during a deploy). Runs
 * hourly, well under the interval needed since it deliberately re-checks
 * a 2-hour trailing window every time — overlap is intentional and safe:
 * enqueueLead's own upsert-with-ignoreDuplicates makes re-enqueuing an
 * already-queued/processed leadgen_id a no-op, so nothing double-fires.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { facebookFetch } from "@/lib/facebook/client";
import * as repo from "@/lib/facebook/repository";

const LOOKBACK_SECONDS = 2 * 60 * 60;

type LeadsResponse = { data?: { id: string; created_time: string }[]; error?: { message?: string } };

export async function reconcileFacebookLeads(): Promise<{ venuesChecked: number; leadsEnqueued: number }> {
  const admin = createAdminClient();
  let venuesChecked = 0;
  let leadsEnqueued = 0;

  const { data: forms } = await admin.from("facebook_lead_forms")
    .select("venue_id, form_id, page_id")
    .eq("is_enabled", true);

  const since = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS;

  for (const form of (forms ?? []) as { venue_id: string; form_id: string; page_id: string }[]) {
    venuesChecked++;
    const result = await facebookFetch(form.venue_id, `/${form.form_id}/leads?fields=id,created_time&since=${since}`);
    if (!result.ok) continue; // Circuit-breaker-equivalent: a disconnected/erroring venue just waits for its next real sync attempt to surface the problem.

    const data = await result.response.json() as LeadsResponse;
    for (const lead of data.data ?? []) {
      await repo.enqueueLead(admin, { venueId: form.venue_id, leadgenId: lead.id, formId: form.form_id, pageId: form.page_id });
      leadsEnqueued++;
    }
  }

  return { venuesChecked, leadsEnqueued };
}
