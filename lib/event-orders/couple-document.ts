/**
 * Couple Event Order document — /order/{review_token}.
 * Same secret-link model as /offer/{token}: no portal session, works for every
 * client. Shows the shared copy with the couple's choices inline and one
 * Approve. Every read and write is scoped by the token's own venue + event.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { proposalBrand, type ProposalBrand } from "@/lib/booking-journey/proposal-view";
import { applyChoicesToEventOrder } from "@/lib/client-choices/apply-core";
import { reconcileAnswersForDependencies } from "@/lib/client-choices/conditional-groups";
import {
  isClientChoicesClientEditable,
  isClientChoicesNeedsVenueReview,
} from "@/lib/client-choices/constants";
import { pickActiveChoices } from "@/lib/client-choices/couple-choice-preview";
import * as choicesRepo from "@/lib/client-choices/repository";
import type { ChoicesAnswers, ChoicesDefinition, ClientChoices } from "@/lib/client-choices/types";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import { clientDisplayName } from "@/lib/clients/constants";
import { pruneAnswersToDefinition } from "@/lib/event-order-templates/selection-definition";
import * as repo from "@/lib/event-orders/repository";
import type { EventOrder, EventOrderSharePayload } from "@/lib/event-orders/types";
import { versionedVenueAssetUrl } from "@/lib/venue/branding-assets";
import * as venueRepo from "@/lib/venue/repository";

type DbClient = Parameters<typeof repo.getEventOrderById>[0];

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export const EVENT_ORDER_APPROVED_NOTIFICATION = "event_order_approved";

/** Venue deep link for the approval notification — the EO document section. */
export function eventOrderApprovedLink(eventId: string): string {
  return `/events/${eventId}?tab=event-order#event-order-order`;
}

export type CoupleDocumentChoices = {
  id: string;
  name: string;
  status: string;
  /** Couple can still change picks (autosaved). */
  editable: boolean;
  definition: ChoicesDefinition;
  answers: ChoicesAnswers;
};

export type CoupleDocumentView = {
  venueName: string | null;
  brand: ProposalBrand;
  eventName: string | null;
  eventDate: string | null;
  revision: number;
  sharedAt: string;
  sections: EventOrderSharePayload["sections"];
  lines: EventOrderSharePayload["lines"];
  /** Approved at the revision the couple is looking at. */
  approved: boolean;
  approvedAt: string | null;
  approvedName: string | null;
  /** Venue reopened after sharing — Approve waits for the next shared copy. */
  updating: boolean;
  choices: CoupleDocumentChoices | null;
};

type Scope = { client: DbClient; order: EventOrder; venueId: string; eventId: string };

async function resolveToken(token: string): Promise<Scope | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const client = createAdminClient() as unknown as DbClient;
  const { data, error } = await client.from("event_orders")
    .select("id, venue_id")
    .eq("review_token", token)
    .maybeSingle<{ id: string; venue_id: string }>();
  if (error || !data) return null;
  const order = await repo.getEventOrderById(client, data.venue_id, data.id);
  if (!order?.sharedAt || !order.eventId) return null;
  return { client, order, venueId: data.venue_id, eventId: order.eventId };
}

function isApprovedNow(order: EventOrder): boolean {
  return Boolean(
    order.status === "finalized"
      && order.clientAgreedAt
      && order.clientAgreedRevision === order.revision,
  );
}

async function documentChoices(scope: Scope): Promise<ClientChoices | null> {
  const active = pickActiveChoices(await choicesRepo.listForEvent(scope.client, scope.venueId, scope.eventId));
  if (!active) return null;
  if (isClientChoicesClientEditable(active.status) || isClientChoicesNeedsVenueReview(active.status)) {
    return active;
  }
  return null;
}

function cleanAnswers(definition: ChoicesDefinition, raw: ChoicesAnswers | null | undefined): ChoicesAnswers {
  return reconcileAnswersForDependencies(definition, pruneAnswersToDefinition(raw ?? {}, definition));
}

export async function getEventOrderDocumentByToken(token: string): Promise<CoupleDocumentView | null> {
  const scope = await resolveToken(token);
  if (!scope) return null;
  const { client, order, venueId, eventId } = scope;

  const snapshot = await repo.getLatestShareSnapshot(client, venueId, order.id);
  if (!snapshot) return null;

  const [venueRes, eventRes, choices] = await Promise.all([
    client.from("venues")
      .select("name, primary_color, secondary_color, accent_color, neutral_color, logo_url, updated_at")
      .eq("id", venueId)
      .maybeSingle<{
        name: string | null; primary_color: string | null; secondary_color: string | null;
        accent_color: string | null; neutral_color: string | null; logo_url: string | null; updated_at: string | null;
      }>(),
    client.from("events").select("name, event_date").eq("id", eventId).eq("venue_id", venueId)
      .maybeSingle<{ name: string | null; event_date: string | null }>(),
    documentChoices(scope),
  ]);
  const venue = venueRes.data;

  return {
    venueName: venue?.name ?? null,
    brand: proposalBrand({
      primaryColor: venue?.primary_color,
      secondaryColor: venue?.secondary_color,
      accentColor: venue?.accent_color,
      neutralColor: venue?.neutral_color,
      logoUrl: versionedVenueAssetUrl(venue?.logo_url, venue?.updated_at),
    }),
    eventName: eventRes.data?.name ?? null,
    eventDate: eventRes.data?.event_date ?? null,
    revision: snapshot.revision,
    sharedAt: snapshot.sharedAt,
    sections: [...snapshot.payload.sections].sort((a, b) => a.sortOrder - b.sortOrder),
    lines: [...snapshot.payload.lines].sort((a, b) => a.sortOrder - b.sortOrder),
    approved: isApprovedNow(order),
    approvedAt: order.clientAgreedAt,
    approvedName: order.clientAgreedName,
    updating: order.status !== "finalized",
    choices: choices
      ? {
          id: choices.id,
          name: choices.name,
          status: choices.status,
          editable: order.status === "finalized" && isClientChoicesClientEditable(choices.status),
          definition: choices.definition,
          answers: cleanAnswers(choices.definition, choices.answers),
        }
      : null,
  };
}

export type CoupleDocumentResult = { ok: true; already?: boolean } | { ok: false; message: string };

/** Autosave — working picks only; nothing is applied or billed. */
export async function saveEventOrderDocumentAnswers(
  token: string,
  choicesId: string,
  answers: ChoicesAnswers,
): Promise<CoupleDocumentResult> {
  const scope = await resolveToken(token);
  if (!scope) return { ok: false, message: "This link is no longer available." };
  if (scope.order.status !== "finalized") {
    return { ok: false, message: "Your venue is updating this Event Order. Check back soon." };
  }
  const row = await documentChoices(scope);
  if (!row || row.id !== choicesId || !isClientChoicesClientEditable(row.status)) {
    return { ok: false, message: "These choices are locked right now." };
  }
  const { error } = await scope.client.from("client_choices")
    .update({
      answers: cleanAnswers(row.definition, answers),
      status: row.status === "sent" ? "in_progress" : row.status,
      opened_at: row.openedAt ?? new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("venue_id", scope.venueId)
    .in("status", ["sent", "in_progress", "changes_requested"]);
  if (error) return { ok: false, message: "Could not save your choices. Try again." };
  return { ok: true };
}

/** Record the couple's picks exactly as the portal submit does (status claim is the lock). */
async function submitDocumentChoices(
  scope: Scope,
  row: ClientChoices,
  answers: ChoicesAnswers,
): Promise<{ ok: true; row: ClientChoices } | { ok: false; message: string }> {
  const outcome = row.status === "changes_requested" ? "resubmitted" : "submitted";
  const now = new Date().toISOString();
  const { data: claimed, error } = await scope.client.from("client_choices")
    .update({
      answers,
      status: outcome,
      submitted_at: now,
      changes_requested_note: null,
      changes_requested_at: null,
      opened_at: row.openedAt ?? now,
    })
    .eq("id", row.id)
    .eq("venue_id", scope.venueId)
    .in("status", ["sent", "in_progress", "changes_requested"])
    .select("id");
  if (error) return { ok: false, message: "Could not record your choices. Try again." };
  if (!claimed?.length) return { ok: false, message: "This Event Order just changed. Refresh the page to see the latest." };

  const submissionNumber = await choicesRepo.nextSubmissionNumber(scope.client, row.id);
  await choicesRepo.insertSubmission(scope.client, scope.venueId, {
    clientChoicesId: row.id,
    eventId: row.eventId,
    submissionNumber,
    outcomeStatus: outcome,
    snapshot: { definition: row.definition, answers, name: row.name },
    submittedBy: "client",
  });
  await choicesRepo.insertActivity(
    scope.client, scope.venueId, row.id, outcome,
    outcome === "resubmitted" ? "Client resubmitted choices" : "Client submitted choices",
  );
  return { ok: true, row: { ...row, answers, status: outcome } };
}

/**
 * One Approve: record the picks, apply them to the Event Order immediately
 * (like an approved proposal), refresh the couple's copy, record approval,
 * and notify the venue. Never creates or sends an invoice.
 */
export async function approveEventOrderDocument(
  token: string,
  answers: ChoicesAnswers | null,
): Promise<CoupleDocumentResult> {
  const scope = await resolveToken(token);
  if (!scope) return { ok: false, message: "This link is no longer available." };
  const { client, venueId, eventId } = scope;
  if (scope.order.status !== "finalized") {
    return { ok: false, message: "Your venue is updating this Event Order. Check back soon." };
  }
  if (isApprovedNow(scope.order)) return { ok: true, already: true };

  const venue = await venueRepo.getVenueById(client, venueId);
  if (!venue) return { ok: false, message: "This link is no longer available." };

  const { data: event } = await client.from("events")
    .select("name, client_id")
    .eq("id", eventId).eq("venue_id", venueId)
    .maybeSingle<{ name: string | null; client_id: string | null }>();
  const { data: couple } = event?.client_id
    ? await client.from("clients")
        .select("first_name, last_name, partner_first_name, partner_last_name")
        .eq("id", event.client_id).eq("venue_id", venueId)
        .maybeSingle<{ first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null }>()
    : { data: null };
  const coupleName = couple
    ? clientDisplayName(couple.first_name, couple.last_name, couple.partner_first_name, couple.partner_last_name)
    : "The couple";

  let row = await documentChoices(scope);
  let delta = 0;
  if (row) {
    if (isClientChoicesClientEditable(row.status)) {
      const picked = cleanAnswers(row.definition, answers ?? row.answers);
      const validated = validateChoicesAnswers(row.definition, picked);
      if (!validated.ok) return { ok: false, message: validated.message ?? "Finish your choices first." };
      const submitted = await submitDocumentChoices(scope, row, picked);
      if (!submitted.ok) return submitted;
      row = submitted.row;
    }
    const applied = await applyChoicesToEventOrder(client, venueId, row, { submittedBy: "client" });
    if (!applied.ok) {
      return { ok: false, message: "Your choices were received. Your venue will finish updating the Event Order." };
    }
    delta = applied.financialDelta;

    // Applying reopened the order; lock the new version and refresh the
    // couple's copy (no email — they are looking at it).
    const reopened = await repo.getEventOrderById(client, venueId, scope.order.id);
    if (!reopened) return { ok: false, message: "This link is no longer available." };
    if (reopened.status !== "finalized") {
      await repo.finalizeEventOrder(client, venueId, reopened.id, reopened.revision + 1);
      await repo.insertActivity(client, venueId, reopened.id, "finalized", `Finalized — v${reopened.revision + 1}`);
    }
    const { shareEventOrderCore } = await import("@/lib/event-orders/representation");
    const shared = await shareEventOrderCore(client, venue, reopened.id, {
      actor: event?.client_id ? { type: "relationship", id: event.client_id } : { type: "system" },
      emailClient: false,
    });
    if (!shared.ok) {
      return { ok: false, message: "Your choices were received. Your venue will finish updating the Event Order." };
    }
  }

  const current = await repo.getEventOrderById(client, venueId, scope.order.id);
  if (!current || current.status !== "finalized") {
    return { ok: false, message: "Your venue is updating this Event Order. Check back soon." };
  }
  const { data: agreed, error } = await client.from("event_orders")
    .update({
      client_agreed_at: new Date().toISOString(),
      client_agreed_name: coupleName,
      client_agreed_revision: current.revision,
    })
    .eq("id", current.id)
    .eq("venue_id", venueId)
    .eq("status", "finalized")
    .eq("revision", current.revision)
    .select("id");
  if (error) return { ok: false, message: "Could not record your approval. Try again." };
  if (!agreed?.length) return { ok: false, message: "This Event Order just changed. Refresh the page to see the latest." };

  await repo.insertActivity(
    client, venueId, current.id, "client_agreed",
    "Client approved Event Order",
    `Approved by ${coupleName} on the Event Order link — revision ${current.revision}`,
  );

  try {
    const eventName = event?.name ?? "their event";
    const body = delta > 0
      ? `${coupleName} approved the Event Order for ${eventName}. New charges: $${delta.toFixed(2)} — not invoiced yet.`
      : `${coupleName} approved the Event Order for ${eventName}.`;
    await client.rpc("create_venue_notification", {
      p_venue_id: venueId,
      p_event_id: eventId,
      p_type: EVENT_ORDER_APPROVED_NOTIFICATION,
      p_title: "Event Order approved",
      p_body: body,
      p_link: eventOrderApprovedLink(eventId),
      p_emoji: "✅",
    });
  } catch { /* non-blocking — approval already recorded */ }

  if (row) {
    try {
      const { triggerAutoComplete } = await import("@/lib/playbooks/service");
      await triggerAutoComplete(client, venueId, eventId, "client_choices_submitted", "client_choices", row.id);
    } catch { /* non-blocking */ }
  }

  return { ok: true };
}
