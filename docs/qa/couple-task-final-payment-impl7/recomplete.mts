import { createAdminClient } from "../../../integrations/supabase/admin";
import {
  completeFinalPaymentTasksBoundToLine,
  celebrateFinalPaymentObligationIfNeeded,
} from "../../../lib/payments/final-payment-obligation";

const VENUE = "69cfd906-0d15-4e5c-8bab-ed106b411c34";
const EVENT = "d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11";
const FINAL = "dbb97688-f9d5-477a-9f6e-ae46df67465c";

async function main() {
  const admin = createAdminClient();
  const ids = await completeFinalPaymentTasksBoundToLine(admin as never, VENUE, FINAL);
  console.log("completed ids", ids);
  const celeb = await celebrateFinalPaymentObligationIfNeeded(
    admin as never,
    VENUE,
    EVENT,
    FINAL,
    "final",
  );
  console.log("re-celebrate", celeb);
  const { data: task, error } = await admin
    .from("event_tasks")
    .select("id,status,completed_at,completed_by,source_type,source_id,payment_line_item_id")
    .eq("id", "d315e9d6-cbf2-4161-baeb-979abbebb74d")
    .maybeSingle();
  console.log("task", task, error);
  const { data: luv } = await admin
    .from("luv_celebrations")
    .select("celebration_type,entity_id,fired_at")
    .eq("client_id", "dbfa69d6-47ad-4f9d-892d-4f06cb7f1844")
    .in("celebration_type", ["final_payment_obligation_paid", "final_payment_received"]);
  console.log("luv", luv);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
