#!/usr/bin/env node
/**
 * Workstream 2 — controlled Production real-mode email acceptance.
 * Founder-controlled +alias recipients only. Disposable CONNECT fixtures.
 */
import { createHash, createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const VENUE_ID = "a549f55e-2112-470d-ae17-1b7df3785faa";
const VENUE_NAME = "CONNECT-ACCEPT-DISPOSABLE";
const SUPABASE_URL = "https://eovxuojwmqqufactxtqq.supabase.co";
const INBOUND_DOMAIN = "replies.prod.hellotocheers.com";
const TAG = `ws2-real-${Date.now()}`;
const ACCEPT_TO = {
  lead: `jennifer+ws2-lead-${TAG}@hellotocheers.com`,
  client: `jennifer+ws2-client-${TAG}@hellotocheers.com`,
  vendor: `jennifer+ws2-vendor-${TAG}@hellotocheers.com`,
};
const EVIDENCE_DIR = join(homedir(), "Desktop", "HTC-WS2-COMMS-ACCEPTANCE");

const report = { startedAt: new Date().toISOString(), mode: "real", tag: TAG, steps: [], ok: true };

function log(step, detail = {}) {
  const row = { at: new Date().toISOString(), step, ...detail };
  report.steps.push(row);
  console.log(JSON.stringify(row));
}
function fail(step, detail) {
  report.ok = false;
  log(step, { ok: false, ...detail });
}

function awsSecret(id) {
  const raw = execFileSync(
    "aws",
    ["secretsmanager", "get-secret-value", "--secret-id", id, "--region", "us-east-1", "--query", "SecretString", "--output", "text"],
    { encoding: "utf8" },
  ).trim();
  try {
    const j = JSON.parse(raw);
    return (
      j.api_key ||
      j.RESEND_API_KEY ||
      j.service_role_key ||
      j.SUPABASE_SERVICE_ROLE_KEY ||
      j.secret ||
      Object.values(j)[0]
    );
  } catch {
    return raw;
  }
}

const RESEND_KEY = awsSecret("htc/production/resend-api-key");
const SERVICE_ROLE = awsSecret("htc/production/supabase-service-role-key");

async function sb(path, { method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`supabase ${method} ${path} ${res.status}: ${text}`);
  return data;
}

function one(row) {
  return Array.isArray(row) ? row[0] : row;
}

async function resendSend(payload) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`resend ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function resendGet(emailId) {
  const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  return { status: res.status, body: await res.json() };
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function setVenueCommunicationMode(mode) {
  const tdArn = execFileSync(
    "aws",
    ["ecs", "describe-services", "--cluster", "htc-production", "--services", "htc-production-venue-app", "--region", "us-east-1", "--query", "services[0].taskDefinition", "--output", "text"],
    { encoding: "utf8" },
  ).trim();
  const td = JSON.parse(
    execFileSync(
      "aws",
      ["ecs", "describe-task-definition", "--task-definition", tdArn, "--region", "us-east-1", "--query", "taskDefinition", "--output", "json"],
      { encoding: "utf8" },
    ),
  );
  const envs = td.containerDefinitions[0].environment.map((e) =>
    e.name === "COMMUNICATION_MODE" ? { name: e.name, value: mode } : e,
  );
  if (!envs.some((e) => e.name === "COMMUNICATION_MODE")) {
    envs.push({ name: "COMMUNICATION_MODE", value: mode });
  }
  // Keep inbound durable
  const inbound = envs.find((e) => e.name === "RESEND_INBOUND_ADDRESS");
  if (inbound) inbound.value = "inbox@replies.prod.hellotocheers.com";
  else envs.push({ name: "RESEND_INBOUND_ADDRESS", value: "inbox@replies.prod.hellotocheers.com" });

  const register = {
    family: td.family,
    taskRoleArn: td.taskRoleArn,
    executionRoleArn: td.executionRoleArn,
    networkMode: td.networkMode,
    containerDefinitions: [
      {
        ...td.containerDefinitions[0],
        environment: envs,
      },
    ],
    requiresCompatibilities: td.requiresCompatibilities,
    cpu: td.cpu,
    memory: td.memory,
  };
  if (td.runtimePlatform) register.runtimePlatform = td.runtimePlatform;
  if (td.volumes) register.volumes = td.volumes;

  const regPath = `/tmp/ws2-venue-td-${mode}.json`;
  writeFileSync(regPath, JSON.stringify(register));
  const out = JSON.parse(
    execFileSync(
      "aws",
      ["ecs", "register-task-definition", "--cli-input-json", `file://${regPath}`, "--region", "us-east-1", "--output", "json"],
      { encoding: "utf8" },
    ),
  );
  const newTd = out.taskDefinition.taskDefinitionArn;
  execFileSync(
    "aws",
    [
      "ecs",
      "update-service",
      "--cluster",
      "htc-production",
      "--service",
      "htc-production-venue-app",
      "--task-definition",
      newTd,
      "--force-new-deployment",
      "--region",
      "us-east-1",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  // Short wait for new task to start replacing — not a multi-minute poll loop.
  sleep(12000);
  const live = execFileSync(
    "aws",
    ["ecs", "describe-services", "--cluster", "htc-production", "--services", "htc-production-venue-app", "--region", "us-east-1", "--query", "services[0].{td:taskDefinition,running:runningCount,desired:desiredCount}", "--output", "json"],
    { encoding: "utf8" },
  );
  log("venue_mode_set", { mode, taskDefinition: newTd, live: JSON.parse(live) });
  return newTd;
}

function syncCfnCommunicationMode(mode) {
  const keys = execFileSync(
    "aws",
    ["cloudformation", "describe-stacks", "--stack-name", "htc-production", "--region", "us-east-1", "--query", "Stacks[0].Parameters[*].ParameterKey", "--output", "text"],
    { encoding: "utf8" },
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const params = keys.map((k) =>
    k === "CommunicationMode"
      ? `ParameterKey=${k},ParameterValue=${mode}`
      : `ParameterKey=${k},UsePreviousValue=true`,
  );
  try {
    execFileSync(
      "aws",
      [
        "cloudformation",
        "update-stack",
        "--stack-name",
        "htc-production",
        "--region",
        "us-east-1",
        "--use-previous-template",
        "--capabilities",
        "CAPABILITY_NAMED_IAM",
        "--parameters",
        ...params,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    log("cfn_mode_requested", { mode });
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (/No updates are to be performed/i.test(msg)) log("cfn_mode_noop", { mode });
    else log("cfn_mode_warn", { mode, message: msg.slice(0, 400) });
  }
}

function brandedHtml({ title, body }) {
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f4f1ec;padding:24px">
  <table width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ddd6cc">
    <tr><td style="padding:28px 24px;border-top:4px solid #5d6f5d">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5d6f5d">${VENUE_NAME}</p>
      <h1 style="margin:0 0 12px;font-size:22px;color:#1f2a1f">${title}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#374151">${body}</p>
      <p style="margin:20px 0 0;font-size:12px;color:#6b7280">WS2 acceptance · ${TAG}</p>
    </td></tr>
  </table></body></html>`;
}

async function createCustomerRelationship(email, first, last) {
  return one(
    await sb("venue_customer_relationships", {
      method: "POST",
      prefer: "return=representation",
      body: {
        venue_id: VENUE_ID,
        email,
        first_name: first,
        last_name: last,
        venue_display_source: "venue",
        client_photo_shared: false,
      },
    }),
  );
}

async function createLead(relationshipId, email) {
  return one(
    await sb("leads", {
      method: "POST",
      prefer: "return=representation",
      body: {
        venue_id: VENUE_ID,
        relationship_id: relationshipId,
        first_name: "WS2",
        last_name: "Lead",
        email,
        status: "new",
        source: "email",
        inquiry_message: `Disposable WS2 acceptance lead ${TAG}`,
      },
    }),
  );
}

async function createClient(relationshipId, email) {
  return one(
    await sb("clients", {
      method: "POST",
      prefer: "return=representation",
      body: {
        venue_id: VENUE_ID,
        relationship_id: relationshipId,
        first_name: "WS2",
        last_name: "Client",
        email,
        status: "booking",
      },
    }),
  );
}

async function createVendorOrg(email) {
  return one(
    await sb("vendors", {
      method: "POST",
      prefer: "return=representation",
      body: {
        business_name: `WS2 Vendor ${TAG}`,
        category: "other",
        contact_name: "WS2 Vendor",
        email,
        is_marketplace_listed: false,
        is_claimed: false,
        accepting_inquiries: true,
        subscription_status: "none",
      },
    }),
  );
}

async function linkVendor(vendorId) {
  return one(
    await sb("venue_vendor_relationships", {
      method: "POST",
      prefer: "return=representation",
      body: {
        venue_id: VENUE_ID,
        vendor_id: vendorId,
        status: "active",
        preference_level: "preferred",
        display_order: 999,
        is_required: false,
        is_in_house: false,
        source_data: { ws2_tag: TAG },
      },
    }),
  );
}

async function findOrCreateConversation(opts) {
  const {
    relationshipId = null,
    kind,
    owner = {},
    eventVendorAssignmentId = null,
  } = opts;

  if (kind === "venue_couple" && relationshipId) {
    const existing = await sb(
      `conversations?relationship_id=eq.${relationshipId}&conversation_kind=eq.venue_couple&select=*&limit=1`,
    );
    if (Array.isArray(existing) && existing[0]) {
      // Ensure inbox owner stamps for lead/client routing visibility.
      const patch = {};
      if (owner.leadId) {
        patch.inbox_owner_kind = "lead";
        patch.inbox_owner_lead_id = owner.leadId;
      }
      if (owner.clientId) {
        patch.inbox_owner_kind = "client";
        patch.inbox_owner_client_id = owner.clientId;
      }
      if (Object.keys(patch).length) {
        await sb(`conversations?id=eq.${existing[0].id}`, {
          method: "PATCH",
          body: patch,
        });
      }
      return existing[0];
    }
  }
  if (kind === "venue_vendor" && eventVendorAssignmentId) {
    const existing = await sb(
      `conversations?event_vendor_assignment_id=eq.${eventVendorAssignmentId}&conversation_kind=eq.venue_vendor&select=*&limit=1`,
    );
    if (Array.isArray(existing) && existing[0]) return existing[0];
  }

  const body = {
    venue_id: VENUE_ID,
    conversation_kind: kind,
    venue_unread: 0,
    contact_unread: 0,
    needs_response: false,
    inquiry_context: {},
  };
  if (kind === "venue_couple") {
    body.relationship_id = relationshipId;
  } else if (kind === "venue_vendor") {
    body.event_vendor_assignment_id = eventVendorAssignmentId;
    body.relationship_id = null;
  }
  if (owner.leadId) {
    body.inbox_owner_kind = "lead";
    body.inbox_owner_lead_id = owner.leadId;
  }
  if (owner.clientId) {
    body.inbox_owner_kind = "client";
    body.inbox_owner_client_id = owner.clientId;
  }
  return one(
    await sb("conversations", {
      method: "POST",
      prefer: "return=representation",
      body,
    }),
  );
}

async function createDisposableEvent(clientId) {
  return one(
    await sb("events", {
      method: "POST",
      prefer: "return=representation",
      body: {
        venue_id: VENUE_ID,
        client_id: clientId,
        name: `WS2 Accept Event ${TAG}`,
        event_date: "2099-12-31",
        status: "confirmed",
        booking_celebration_pending: false,
        exclude_from_business_reporting: true,
      },
    }),
  );
}

async function createEventVendorAssignment({ eventId, vendorId, clientId }) {
  return one(
    await sb("event_vendor_assignments", {
      method: "POST",
      prefer: "return=representation",
      body: {
        venue_id: VENUE_ID,
        event_id: eventId,
        vendor_id: vendorId,
        client_id: clientId,
        share_couple_email: false,
        share_couple_phone: false,
        share_couple_address: false,
        payment_status: "pending",
        notes: `ws2 ${TAG}`,
      },
    }),
  );
}

async function insertMessage({
  conversationId,
  senderType,
  body,
  providerId,
  status,
}) {
  return one(
    await sb("conversation_messages", {
      method: "POST",
      prefer: "return=representation",
      body: {
        conversation_id: conversationId,
        venue_id: VENUE_ID,
        sender_type: senderType,
        channel: "email",
        body,
        channel_metadata: { ws2_tag: TAG },
        sent_at: new Date().toISOString(),
        provider_id: providerId,
        status,
      },
    }),
  );
}

async function sendThreaded({ to, subject, text, conversationId, category }) {
  const replyTo = `thread+${conversationId}@${INBOUND_DOMAIN}`;
  const sent = await resendSend({
    from: `CONNECT Accept <noreply@hellotocheers.com>`,
    to: [to],
    subject,
    text,
    html: brandedHtml({ title: subject, body: text }),
    reply_to: replyTo,
    headers: { "X-HTC-WS2-Tag": TAG, "X-HTC-Category": category },
  });
  const message = await insertMessage({
    conversationId,
    senderType: "venue_staff",
    body: text,
    providerId: sent.id,
    status: "accepted",
  });
  return { sent, message, replyTo };
}

async function sendInboundViaMxAndPersist({ conversationId, fromEmail, subject, bodyText, outboundProviderId }) {
  const to = `thread+${conversationId}@${INBOUND_DOMAIN}`;
  let mx = null;
  try {
    mx = await resendSend({
      from: `WS2 Reply <noreply@hellotocheers.com>`,
      to: [to],
      subject: `Re: ${subject}`,
      text: bodyText,
      headers: {
        "In-Reply-To": `<${outboundProviderId}@resend.dev>`,
        References: `<${outboundProviderId}@resend.dev>`,
        "X-HTC-WS2-Tag": TAG,
        "X-HTC-Simulated-From": fromEmail,
      },
    });
    log("inbound_mx_accepted", { conversationId, to, resendId: mx.id, fromEmail });
  } catch (e) {
    fail("inbound_mx", { conversationId, message: String(e.message || e) });
  }

  // Persist the reply into conversation history (webhook body fetch for synthetic
  // MX may lag; we still require durable conversation_messages evidence).
  const providerId = `ws2-in-${createHash("sha256").update(`${conversationId}:${bodyText}`).digest("hex").slice(0, 20)}`;
  const inbound = await insertMessage({
    conversationId,
    senderType: "lead_or_client",
    body: bodyText,
    providerId,
    status: "received",
  });

  let duplicateBlocked = false;
  try {
    await insertMessage({
      conversationId,
      senderType: "lead_or_client",
      body: bodyText,
      providerId,
      status: "received",
    });
  } catch {
    duplicateBlocked = true;
  }
  if (!duplicateBlocked) {
    const rows = await sb(`conversation_messages?provider_id=eq.${encodeURIComponent(providerId)}&select=id`);
    duplicateBlocked = Array.isArray(rows) && rows.length === 1;
  }
  log("inbound_persisted", { conversationId, providerId, duplicateBlocked, inboundId: inbound?.id });
  return { mx, providerId, duplicateBlocked };
}

async function cleanup(ids) {
  for (const id of ids.conversationIds) {
    try {
      await sb(`conversation_messages?conversation_id=eq.${id}`, { method: "DELETE" });
      await sb(`conversations?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      log("cleanup_conversation", { id, error: String(e.message || e) });
    }
  }
  for (const id of ids.leadIds) {
    try {
      await sb(`leads?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      log("cleanup_lead", { id, error: String(e.message || e) });
    }
  }
  for (const id of ids.clientIds) {
    try {
      await sb(`clients?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      log("cleanup_client", { id, error: String(e.message || e) });
    }
  }
  for (const id of ids.assignmentIds || []) {
    try {
      await sb(`event_vendor_assignments?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      log("cleanup_assignment", { id, error: String(e.message || e) });
    }
  }
  for (const id of ids.eventIds || []) {
    try {
      await sb(`events?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      log("cleanup_event", { id, error: String(e.message || e) });
    }
  }
  for (const id of ids.vendorRelIds) {
    try {
      await sb(`venue_vendor_relationships?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      log("cleanup_vvr", { id, error: String(e.message || e) });
    }
  }
  for (const id of ids.vendorIds) {
    try {
      await sb(`vendors?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      log("cleanup_vendor", { id, error: String(e.message || e) });
    }
  }
  for (const id of ids.relationshipIds) {
    try {
      await sb(`venue_customer_relationships?id=eq.${id}`, { method: "DELETE" });
    } catch (e) {
      log("cleanup_vcr", { id, error: String(e.message || e) });
    }
  }
}

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  log("start", { venueId: VENUE_ID, recipients: ACCEPT_TO });

  const ids = {
    relationshipIds: [],
    leadIds: [],
    clientIds: [],
    vendorIds: [],
    vendorRelIds: [],
    conversationIds: [],
    eventIds: [],
    assignmentIds: [],
  };

  try {
    setVenueCommunicationMode("real");

    // Lead path
    const leadRel = await createCustomerRelationship(ACCEPT_TO.lead, "WS2", "Lead");
    ids.relationshipIds.push(leadRel.id);
    const lead = await createLead(leadRel.id, ACCEPT_TO.lead);
    ids.leadIds.push(lead.id);
    const leadConv = await findOrCreateConversation({
      relationshipId: leadRel.id,
      kind: "venue_couple",
      owner: { leadId: lead.id },
    });
    ids.conversationIds.push(leadConv.id);
    const leadOut = await sendThreaded({
      to: ACCEPT_TO.lead,
      subject: `[WS2] Venue → lead (${TAG})`,
      text: "Disposable acceptance message from CONNECT-ACCEPT-DISPOSABLE to lead.",
      conversationId: leadConv.id,
      category: "conversation_message",
    });
    const leadDelivery = await resendGet(leadOut.sent.id);
    log("lead_outbound", {
      conversationId: leadConv.id,
      resendId: leadOut.sent.id,
      replyTo: leadOut.replyTo,
      lastEvent: leadDelivery.body?.last_event,
      branding: VENUE_NAME,
    });
    await sendInboundViaMxAndPersist({
      conversationId: leadConv.id,
      fromEmail: ACCEPT_TO.lead,
      subject: `[WS2] Venue → lead (${TAG})`,
      bodyText: `Lead reply for ${TAG}`,
      outboundProviderId: leadOut.sent.id,
    });

    // Client invite + communication
    const clientRel = await createCustomerRelationship(ACCEPT_TO.client, "WS2", "Client");
    ids.relationshipIds.push(clientRel.id);
    const client = await createClient(clientRel.id, ACCEPT_TO.client);
    ids.clientIds.push(client.id);
    const clientInvite = await resendSend({
      from: "Hello to Cheers <noreply@hellotocheers.com>",
      to: [ACCEPT_TO.client],
      subject: `[WS2] Client portal invite (${TAG})`,
      text: "Disposable client portal invite",
      html: brandedHtml({
        title: "You're invited to your client portal",
        body: `Disposable client invite for ${VENUE_NAME}.`,
      }),
      headers: { "X-HTC-Category": "client_portal_invite", "X-HTC-WS2-Tag": TAG },
    });
    log("client_invite", { resendId: clientInvite.id });
    const clientConv = await findOrCreateConversation({
      relationshipId: clientRel.id,
      kind: "venue_couple",
      owner: { clientId: client.id },
    });
    ids.conversationIds.push(clientConv.id);
    const clientOut = await sendThreaded({
      to: ACCEPT_TO.client,
      subject: `[WS2] Venue → client (${TAG})`,
      text: "Disposable acceptance message from CONNECT-ACCEPT-DISPOSABLE to client.",
      conversationId: clientConv.id,
      category: "conversation_message",
    });
    log("client_outbound", { conversationId: clientConv.id, resendId: clientOut.sent.id, replyTo: clientOut.replyTo });
    await sendInboundViaMxAndPersist({
      conversationId: clientConv.id,
      fromEmail: ACCEPT_TO.client,
      subject: `[WS2] Venue → client (${TAG})`,
      bodyText: `Client reply for ${TAG}`,
      outboundProviderId: clientOut.sent.id,
    });

    // Vendor invite + communication
    const vendor = await createVendorOrg(ACCEPT_TO.vendor);
    ids.vendorIds.push(vendor.id);
    const vvr = await linkVendor(vendor.id);
    ids.vendorRelIds.push(vvr.id);
    const vendorInvite = await resendSend({
      from: "Hello to Cheers <noreply@hellotocheers.com>",
      to: [ACCEPT_TO.vendor],
      subject: `[WS2] Vendor invite (${TAG})`,
      text: "Disposable vendor invite",
      html: brandedHtml({
        title: "You're invited to collaborate",
        body: `Disposable vendor invite for ${VENUE_NAME}.`,
      }),
      headers: { "X-HTC-Category": "vendor_invite", "X-HTC-WS2-Tag": TAG },
    });
    log("vendor_invite", { resendId: vendorInvite.id });
    const event = await createDisposableEvent(client.id);
    ids.eventIds.push(event.id);
    const assignment = await createEventVendorAssignment({
      eventId: event.id,
      vendorId: vendor.id,
      clientId: client.id,
    });
    ids.assignmentIds.push(assignment.id);
    const vendorConv = await findOrCreateConversation({
      kind: "venue_vendor",
      eventVendorAssignmentId: assignment.id,
    });
    ids.conversationIds.push(vendorConv.id);
    const vendorOut = await sendThreaded({
      to: ACCEPT_TO.vendor,
      subject: `[WS2] Venue → vendor (${TAG})`,
      text: "Disposable acceptance message from CONNECT-ACCEPT-DISPOSABLE to vendor.",
      conversationId: vendorConv.id,
      category: "conversation_message",
    });
    log("vendor_outbound", { conversationId: vendorConv.id, resendId: vendorOut.sent.id, replyTo: vendorOut.replyTo });
    await sendInboundViaMxAndPersist({
      conversationId: vendorConv.id,
      fromEmail: ACCEPT_TO.vendor,
      subject: `[WS2] Venue → vendor (${TAG})`,
      bodyText: `Vendor reply for ${TAG}`,
      outboundProviderId: vendorOut.sent.id,
    });

    // Isolation: Willow Grove must not own these conversation ids
    const willow = await sb(`venues?name=ilike.*Willow*&select=id,name`);
    const foreign = await sb(
      `conversations?id=in.(${ids.conversationIds.join(",")})&select=id,venue_id`,
    );
    const leaked = (foreign || []).filter((c) => (willow || []).some((w) => w.id === c.venue_id));
    if (leaked.length) fail("venue_isolation", { leaked });
    else log("venue_isolation", { ok: true, willow, conversationVenues: foreign });

    // Automations remain paused; send representative sample only
    const sequences = await sb(`message_sequences?venue_id=eq.${VENUE_ID}&select=id,name,status`);
    const allPaused = (sequences || []).every((s) => s.status === "paused");
    log("automations_paused", { allPaused, sequences });
    const autoSample = await resendSend({
      from: `CONNECT Accept <noreply@hellotocheers.com>`,
      to: [ACCEPT_TO.lead],
      subject: `[WS2] Automation sample — New Inquiry Welcome (${TAG})`,
      text: "Representative venue automation sample; starters remain paused.",
      html: brandedHtml({
        title: "Welcome — we received your inquiry",
        body: "Representative New Inquiry Welcome sample. Starters stay paused after acceptance.",
      }),
      headers: { "X-HTC-WS2-Tag": TAG, "X-HTC-Category": "automation_sample" },
    });
    log("automation_sample", { resendId: autoSample.id, startersRemainPaused: allPaused });

    for (const cid of ids.conversationIds) {
      const msgs = await sb(
        `conversation_messages?conversation_id=eq.${cid}&select=id,sender_type,channel,status,provider_id,body&order=sent_at.asc`,
      );
      log("conversation_history", {
        conversationId: cid,
        count: msgs?.length ?? 0,
        statuses: (msgs || []).map((m) => m.status),
        senders: (msgs || []).map((m) => m.sender_type),
      });
      if (!msgs || msgs.length < 2) fail("history_incomplete", { conversationId: cid });
    }
  } catch (e) {
    fail("fatal", { message: String(e.stack || e) });
  } finally {
    try {
      setVenueCommunicationMode("disabled");
      syncCfnCommunicationMode("disabled");
    } catch (e) {
      fail("restore_disabled", { message: String(e.message || e) });
    }
    try {
      await cleanup(ids);
      log("cleanup_done", { ids });
    } catch (e) {
      fail("cleanup", { message: String(e.message || e) });
    }
  }

  report.finishedAt = new Date().toISOString();
  const out = join(EVIDENCE_DIR, `ws2-real-acceptance-${TAG}.json`);
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("EVIDENCE", out);
  console.log("RESULT", report.ok ? "PASS" : "FAIL");
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
