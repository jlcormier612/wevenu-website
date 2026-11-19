/**
 * Couple reminder processor verification — real processReminders /
 * processObligationReminders with reminderIds scope (Sandbox Fancy fixtures).
 *
 * Does NOT call global /api/notifications/process.
 * Does NOT process Sweet Daisy or other venue due rows.
 * Recipients: @mail.hellotocheers.test only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";

import { processReminders } from "../../lib/notifications/engine.ts";
import { processObligationReminders } from "../../lib/notifications/obligation-engine.ts";
import { resolveVenueCoupleThreadId } from "../../lib/conversations/resolve-couple-thread.ts";

config({ path: ".env.local", quiet: true });

const OUT = "docs/qa/couple-email-threading-gaps";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const FANCY_BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const STAMP = String(Date.now()).slice(-8);
const CLIENT_EMAIL = `rem-proc-${STAMP}@mail.hellotocheers.test`;
const SWEET_DAISY_IDS = [
  "60a733b1-6ec4-47a8-b014-302d1c559b77",
  "e04f480c-165d-43f2-8e4b-26979b0e717e",
];
const FANCY_VENDOR_ID = "7353c325-b1de-4567-9fe4-45cfbc08cd61";

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

const out: Record<string, unknown> = {
  ok: true,
  stamp: STAMP,
  clientEmail: CLIENT_EMAIL,
  payment: {},
  contract: {},
  tour: {},
  untouched: {},
  checks: [] as Check[],
};

function secretValue(valueFrom: string): string {
  const m = valueFrom.match(
    /^(arn:aws:secretsmanager:[^:]+:[^:]+:secret:[^:]+)(?::([^:]*))?(?::([^:]*))?(?::([^:]*))?$/,
  );
  if (!m) throw new Error("unrecognized secretsmanager valueFrom");
  const raw = execSync(
    `aws secretsmanager get-secret-value --secret-id ${JSON.stringify(m[1]!)} --query SecretString --output text`,
    { encoding: "utf8" },
  ).trim();
  if (raw.startsWith("{")) {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const jsonKey = m[2] && m[2].length > 0 ? m[2] : "value";
    return parsed[jsonKey] ?? parsed.value ?? parsed.RESEND_API_KEY!;
  }
  return raw;
}

async function getResendEmail(apiKey: string, id: string) {
  const res = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { reply_to?: string[] | string; to?: string[]; subject?: string };
}

function replyToMatches(actual: string[] | string | undefined, expected: string): boolean {
  if (!actual) return false;
  if (typeof actual === "string") return actual.includes(expected);
  return actual.some((a) => a.includes(expected));
}

async function sendControlledReply(opts: {
  apiKey: string;
  fromEmail: string;
  expectedTo: string;
  marker: string;
  subjectTag: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.fromEmail,
      to: [opts.expectedTo],
      subject: `Re: ${opts.subjectTag} ${opts.marker}`,
      text: `Controlled reminder reply ${opts.marker}`,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: res.ok && !!body.id, id: body.id };
}

async function waitForInbound(
  admin: ReturnType<typeof createClient>,
  convId: string,
  marker: string,
) {
  for (let i = 0; i < 24; i++) {
    const { data } = await admin
      .from("conversation_messages")
      .select("id")
      .eq("conversation_id", convId)
      .eq("sender_type", "lead_or_client")
      .ilike("body", `%${marker}%`)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}

const created = {
  leadId: null as string | null,
  clientId: null as string | null,
  eventId: null as string | null,
  invoiceId: null as string | null,
  scheduleId: null as string | null,
  lineItemId: null as string | null,
  contractId: null as string | null,
  tourId: null as string | null,
  payRemId: null as string | null,
  conRemId: null as string | null,
  tourRemId: null as string | null,
};

async function cleanup(admin: ReturnType<typeof createClient>) {
  for (const id of [created.payRemId, created.conRemId, created.tourRemId]) {
    if (id) await admin.from("task_reminders").delete().eq("id", id);
  }
  if (created.tourId) await admin.from("tour_appointments").delete().eq("id", created.tourId);
  if (created.contractId) await admin.from("contracts").delete().eq("id", created.contractId);
  if (created.scheduleId) {
    await admin.from("payment_line_items").delete().eq("schedule_id", created.scheduleId);
    await admin.from("payment_schedules").delete().eq("id", created.scheduleId);
  }
  if (created.invoiceId) {
    await admin.from("invoice_line_items").delete().eq("invoice_id", created.invoiceId);
    await admin.from("invoices").delete().eq("id", created.invoiceId);
  }
  if (created.eventId) {
    await admin.from("event_setup_states").delete().eq("event_id", created.eventId);
    await admin.from("events").delete().eq("id", created.eventId);
  }
  if (created.clientId) await admin.from("clients").delete().eq("id", created.clientId);
  if (created.leadId) await admin.from("leads").delete().eq("id", created.leadId);
}

async function reminderStatus(admin: ReturnType<typeof createClient>, id: string) {
  const { data } = await admin.from("task_reminders").select("id,status,sent_at").eq("id", id).maybeSingle();
  return data;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");

  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  const task = JSON.parse(
    execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].{image:containers[0].image,td:taskDefinitionArn}' --output json`,
      { encoding: "utf8" },
    ),
  );
  out.servingImage = task.image;

  const tdEnv = JSON.parse(
    execSync(
      `aws ecs describe-task-definition --task-definition ${task.td} --query 'taskDefinition.containerDefinitions[0].environment[?name==\`FROM_EMAIL\` || name==\`RESEND_INBOUND_ADDRESS\` || name==\`COMMUNICATION_MODE\` || name==\`NEXT_PUBLIC_APP_URL\`].[name,value]' --output json`,
      { encoding: "utf8" },
    ),
  ) as string[][];
  const envMap = Object.fromEntries(tdEnv);
  const fromEmail = envMap.FROM_EMAIL ?? "Hello to Cheers <onboarding@resend.dev>";
  const inboundAddress =
    envMap.RESEND_INBOUND_ADDRESS ?? "inbox@replies.hellotocheers.com";
  const secretArns = JSON.parse(
    execSync(
      `aws ecs describe-task-definition --task-definition ${task.td} --query 'taskDefinition.containerDefinitions[0].secrets[?name==\`RESEND_API_KEY\`].[name,valueFrom]' --output json`,
      { encoding: "utf8" },
    ),
  ) as string[][];
  const apiKey = secretValue(secretArns.find((r) => r[0] === "RESEND_API_KEY")![1]!);
  process.env.RESEND_API_KEY = apiKey;
  process.env.FROM_EMAIL = fromEmail;
  process.env.RESEND_INBOUND_ADDRESS = inboundAddress;
  process.env.COMMUNICATION_MODE = "real";
  process.env.NEXT_PUBLIC_APP_URL =
    envMap.NEXT_PUBLIC_APP_URL ?? "https://app.sandbox.hellotocheers.com";
  out.resendInboundAddress = inboundAddress;

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Snapshot foreign due rows BEFORE
  const beforeSweet = await Promise.all(SWEET_DAISY_IDS.map((id) => reminderStatus(admin, id)));
  const beforeVendor = await reminderStatus(admin, FANCY_VENDOR_ID);
  record(
    "precondition_sweet_daisy_still_pending",
    beforeSweet.every((r) => r?.status === "pending"),
    JSON.stringify(beforeSweet.map((r) => r?.status)),
  );
  record(
    "precondition_fancy_vendor_still_pending",
    beforeVendor?.status === "pending",
    `status=${beforeVendor?.status}`,
  );

  const eventDate = new Date(Date.UTC(2036, 5, 10 + (Number(STAMP) % 20)))
    .toISOString()
    .slice(0, 10);
  const duePast = new Date(Date.now() - 60_000).toISOString();

  try {
    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .insert({
        venue_id: FANCY,
        first_name: "RemProc",
        last_name: `Path${STAMP}`,
        email: CLIENT_EMAIL,
        event_date: eventDate,
        event_type: "wedding",
        sales_stage: "new_inquiry",
        status: "active",
        source: "website",
        inquiry_message: `[qa] reminder processor ${STAMP}`,
        inquiry_message_origin: "venue",
      })
      .select("id")
      .single();
    if (leadErr) throw leadErr;
    created.leadId = lead.id;

    const { data: client, error: clientErr } = await admin
      .from("clients")
      .insert({
        venue_id: FANCY,
        lead_id: lead.id,
        first_name: "RemProc",
        last_name: `Path${STAMP}`,
        email: CLIENT_EMAIL,
        event_date: eventDate,
        event_type: "wedding",
        status: "booking",
      })
      .select("id")
      .single();
    if (clientErr) throw clientErr;
    created.clientId = client.id;

    const { data: relId, error: relErr } = await admin.rpc("find_or_create_relationship", {
      p_venue_id: FANCY,
      p_email: CLIENT_EMAIL,
      p_first_name: "RemProc",
      p_last_name: `Path${STAMP}`,
    });
    if (relErr || !relId) throw relErr ?? new Error("relationship");
    await admin.from("clients").update({ relationship_id: relId }).eq("id", client.id);
    await admin.from("leads").update({ relationship_id: relId }).eq("id", lead.id);

    const { data: booked, error: bookErr } = await admin.rpc("book_relationship", {
      p_venue_id: FANCY,
      p_client_id: client.id,
      p_space_id: FANCY_BARN,
      p_name: `RemProc ${STAMP}`,
      p_event_type: "wedding",
      p_event_date: eventDate,
    });
    if (bookErr || !booked?.ok) throw bookErr ?? new Error(booked?.message ?? "book failed");
    created.eventId = booked.event_id as string;
    await admin
      .from("events")
      .update({ exclude_from_business_reporting: true })
      .eq("id", created.eventId!);

    const convId = await resolveVenueCoupleThreadId(admin, FANCY, { clientId: client.id });
    if (!convId) throw new Error("no conversation");
    out.conversationId = convId;
    const expectedReplyTo = `thread+${convId}@replies.hellotocheers.com`;

    // Payment fixture
    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .insert({
        venue_id: FANCY,
        client_id: client.id,
        event_id: created.eventId,
        invoice_number: `INV-REM-${STAMP}`,
        display_name: `RemProc Invoice ${STAMP}`,
        status: "sent",
        subtotal: 500,
        discount_amount: 0,
        tax_amount: 0,
        total: 500,
        balance_due: 500,
        issued_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (invErr) throw invErr;
    created.invoiceId = invoice.id;
    await admin.from("invoice_line_items").insert({
      venue_id: FANCY,
      invoice_id: invoice.id,
      description: "Deposit",
      quantity: 1,
      unit_price: 500,
      amount: 500,
      type: "package",
      sort_order: 0,
    });
    const { data: schedule, error: schErr } = await admin
      .from("payment_schedules")
      .insert({
        venue_id: FANCY,
        client_id: client.id,
        event_id: created.eventId,
        invoice_id: invoice.id,
        title: `RemProc pay ${STAMP}`,
        total_amount: 500,
        currency: "USD",
      })
      .select("id")
      .single();
    if (schErr) throw schErr;
    created.scheduleId = schedule.id;
    const { data: lineItem, error: liErr } = await admin
      .from("payment_line_items")
      .insert({
        venue_id: FANCY,
        schedule_id: schedule.id,
        label: "Deposit",
        amount: 500,
        due_date: eventDate,
        status: "pending",
        obligation_kind: "deposit",
        sort_order: 0,
      })
      .select("id")
      .single();
    if (liErr) throw liErr;
    created.lineItemId = lineItem.id;
    created.payRemId = randomUUID();
    await admin.from("task_reminders").insert({
      id: created.payRemId,
      venue_id: FANCY,
      payment_line_item_id: lineItem.id,
      reminder_type: "upcoming",
      notify_role: "couple",
      status: "pending",
      scheduled_for: duePast,
    });

    // Contract fixture
    created.contractId = null;
    const { data: contract, error: cErr } = await admin
      .from("contracts")
      .insert({
        venue_id: FANCY,
        client_id: client.id,
        event_id: created.eventId,
        title: `RemProc Contract ${STAMP}`,
        content: `[qa] reminder processor contract ${STAMP}`,
        status: "sent",
        sign_token: randomUUID(),
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (cErr) throw cErr;
    created.contractId = contract.id;
    created.conRemId = randomUUID();
    await admin.from("task_reminders").insert({
      id: created.conRemId,
      venue_id: FANCY,
      contract_id: contract.id,
      reminder_type: "upcoming",
      notify_role: "couple",
      status: "pending",
      scheduled_for: duePast,
    });

    // Tour fixture (couple) — far-future slot avoids Fancy capacity collisions
    const tourAt = new Date(
      Date.UTC(2035, 6, 15 + (Number(STAMP) % 20), 14, Number(STAMP) % 50, 0),
    ).toISOString();
    const { data: tour, error: tErr } = await admin
      .from("tour_appointments")
      .insert({
        venue_id: FANCY,
        lead_id: lead.id,
        scheduled_at: tourAt,
        duration_minutes: 30,
        contact_name: `RemProc ${STAMP}`,
        contact_email: CLIENT_EMAIL,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (tErr) throw tErr;
    created.tourId = tour.id;
    created.tourRemId = randomUUID();
    await admin.from("task_reminders").insert({
      id: created.tourRemId,
      venue_id: FANCY,
      tour_appointment_id: tour.id,
      reminder_type: "upcoming",
      notify_role: "couple",
      status: "pending",
      scheduled_for: duePast,
    });

    record(
      "fixtures_created",
      true,
      `pay=${created.payRemId} con=${created.conRemId} tour=${created.tourRemId} to=${CLIENT_EMAIL}`,
    );

    // ── Payment via processObligationReminders (scoped) ───────────────────
    const payResult = await processObligationReminders({
      reminderIds: [created.payRemId!],
    });
    (out.payment as Record<string, unknown>).processorResult = payResult;
    const payAfter = await reminderStatus(admin, created.payRemId!);
    record(
      "payment_processor_sent",
      payResult.sent >= 1 && payAfter?.status === "sent",
      `result=${JSON.stringify(payResult)} status=${payAfter?.status}`,
    );
    const { data: payLog } = await admin
      .from("notification_log")
      .select("provider_message_id,recipient_email,subject")
      .eq("source_id", created.payRemId!)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    (out.payment as Record<string, unknown>).log = payLog;
    const payProvider = payLog?.provider_message_id ?? null;
    if (payProvider) {
      const detail = await getResendEmail(apiKey, payProvider);
      record(
        "payment_outbound_reply_to",
        replyToMatches(detail?.reply_to, expectedReplyTo) &&
          (Array.isArray(detail?.to) ? detail!.to!.includes(CLIENT_EMAIL) : String(detail?.to ?? "").includes(CLIENT_EMAIL)),
        `to=${JSON.stringify(detail?.to)} reply_to=${JSON.stringify(detail?.reply_to)}`,
      );
      (out.payment as Record<string, unknown>).providerId = payProvider;
      (out.payment as Record<string, unknown>).resend = detail;
    } else {
      record("payment_outbound_reply_to", false, "no provider id");
    }
    const payMarker = `QA-pay-proc-${STAMP}`;
    const payReply = await sendControlledReply({
      apiKey,
      fromEmail,
      expectedTo: expectedReplyTo,
      marker: payMarker,
      subjectTag: "payment-proc",
    });
    record("payment_reply_accepted", payReply.ok, `id=${payReply.id?.slice(0, 8)}`);
    const payInbound = await waitForInbound(admin, convId, payMarker);
    record("payment_reply_one_row", !!payInbound, `msg=${payInbound?.id ?? "none"}`);
    (out.payment as Record<string, unknown>).inboundMsgId = payInbound?.id ?? null;

    // ── Contract via processObligationReminders (scoped) ──────────────────
    const conResult = await processObligationReminders({
      reminderIds: [created.conRemId!],
    });
    (out.contract as Record<string, unknown>).processorResult = conResult;
    const conAfter = await reminderStatus(admin, created.conRemId!);
    record(
      "contract_processor_sent",
      conResult.sent >= 1 && conAfter?.status === "sent",
      `result=${JSON.stringify(conResult)} status=${conAfter?.status}`,
    );
    const { data: conLog } = await admin
      .from("notification_log")
      .select("provider_message_id,recipient_email,subject")
      .eq("source_id", created.conRemId!)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const conProvider = conLog?.provider_message_id ?? null;
    if (conProvider) {
      const detail = await getResendEmail(apiKey, conProvider);
      record(
        "contract_outbound_reply_to",
        replyToMatches(detail?.reply_to, expectedReplyTo),
        `reply_to=${JSON.stringify(detail?.reply_to)} to=${JSON.stringify(detail?.to)}`,
      );
      (out.contract as Record<string, unknown>).providerId = conProvider;
    } else {
      record("contract_outbound_reply_to", false, "no provider id");
    }
    const conMarker = `QA-con-proc-${STAMP}`;
    const conReply = await sendControlledReply({
      apiKey,
      fromEmail,
      expectedTo: expectedReplyTo,
      marker: conMarker,
      subjectTag: "contract-proc",
    });
    record("contract_reply_accepted", conReply.ok, `id=${conReply.id?.slice(0, 8)}`);
    const conInbound = await waitForInbound(admin, convId, conMarker);
    record("contract_reply_one_row", !!conInbound, `msg=${conInbound?.id ?? "none"}`);
    (out.contract as Record<string, unknown>).inboundMsgId = conInbound?.id ?? null;

    // ── Tour via processReminders (scoped) ────────────────────────────────
    const tourResult = await processReminders({ reminderIds: [created.tourRemId!] });
    (out.tour as Record<string, unknown>).processorResult = tourResult;
    const tourAfter = await reminderStatus(admin, created.tourRemId!);
    record(
      "tour_processor_sent",
      tourResult.sent >= 1 && tourAfter?.status === "sent",
      `result=${JSON.stringify(tourResult)} status=${tourAfter?.status}`,
    );
    const { data: tourLog } = await admin
      .from("notification_log")
      .select("provider_message_id,recipient_email,subject")
      .eq("source_id", created.tourRemId!)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const tourProvider = tourLog?.provider_message_id ?? null;
    if (tourProvider) {
      const detail = await getResendEmail(apiKey, tourProvider);
      record(
        "tour_outbound_reply_to",
        replyToMatches(detail?.reply_to, expectedReplyTo),
        `reply_to=${JSON.stringify(detail?.reply_to)} to=${JSON.stringify(detail?.to)}`,
      );
      (out.tour as Record<string, unknown>).providerId = tourProvider;
    } else {
      record("tour_outbound_reply_to", false, "no provider id");
    }
    const tourMarker = `QA-tour-proc-${STAMP}`;
    const tourReply = await sendControlledReply({
      apiKey,
      fromEmail,
      expectedTo: expectedReplyTo,
      marker: tourMarker,
      subjectTag: "tour-proc",
    });
    record("tour_reply_accepted", tourReply.ok, `id=${tourReply.id?.slice(0, 8)}`);
    const tourInbound = await waitForInbound(admin, convId, tourMarker);
    record("tour_reply_one_row", !!tourInbound, `msg=${tourInbound?.id ?? "none"}`);
    (out.tour as Record<string, unknown>).inboundMsgId = tourInbound?.id ?? null;

    const { data: convAfter } = await admin
      .from("conversations")
      .select("venue_unread,needs_response")
      .eq("id", convId)
      .single();
    record(
      "conversation_needs_response_after_replies",
      convAfter?.needs_response === true && (convAfter?.venue_unread ?? 0) >= 1,
      `unread=${convAfter?.venue_unread} needs_response=${convAfter?.needs_response}`,
    );

    // Idempotency: re-run same payment reminder id — should not send again (status already sent)
    const payAgain = await processObligationReminders({ reminderIds: [created.payRemId!] });
    record(
      "payment_idempotent_no_second_send",
      payAgain.sent === 0 && payAgain.processed === 0,
      JSON.stringify(payAgain),
    );

    // Untouched foreign + Fancy vendor
    const afterSweet = await Promise.all(SWEET_DAISY_IDS.map((id) => reminderStatus(admin, id)));
    const afterVendor = await reminderStatus(admin, FANCY_VENDOR_ID);
    out.untouched = {
      sweetDaisyBefore: beforeSweet,
      sweetDaisyAfter: afterSweet,
      fancyVendorBefore: beforeVendor,
      fancyVendorAfter: afterVendor,
    };
    record(
      "sweet_daisy_untouched",
      afterSweet.every((r, i) => r?.status === beforeSweet[i]?.status && r?.status === "pending"),
      JSON.stringify(afterSweet.map((r) => ({ id: r?.id?.slice(0, 8), status: r?.status }))),
    );
    record(
      "fancy_vendor_untouched",
      afterVendor?.status === beforeVendor?.status && afterVendor?.status === "pending",
      `status=${afterVendor?.status}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    record("fatal", false, msg);
    out.ok = false;
  } finally {
    // Keep reminder rows that were sent for evidence; delete only unsent fixture debris carefully.
    // Cleanup related entities but leave notification_log / conversation messages.
    await cleanup(admin).catch((e) => console.error("cleanup", e));
  }

  out.checks = checks;
  out.ok = checks.every((c) => c.pass);
  writeFileSync(`${OUT}/reminder-processor-results.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, checks: checks.length, failed: checks.filter((c) => !c.pass).map((c) => c.name) }, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(
    `${OUT}/reminder-processor-results.json`,
    JSON.stringify({ ok: false, error: String(err), checks }, null, 2),
  );
  process.exit(1);
});
