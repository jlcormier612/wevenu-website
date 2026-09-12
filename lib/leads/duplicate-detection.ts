/**
 * Strong-signal possible-duplicate detection.
 *
 * Deterministic matches only — never fuzzy names, last-name-only, event-date,
 * property, or partial phone. Does not merge or re-parent records.
 */
import type { createClient } from "@/integrations/supabase/server";
import { leadDisplayName } from "@/lib/leads/constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type DuplicateSignal = "email" | "phone" | "partner_email" | "name_pair";

export type InquiryIdentity = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  partnerEmail?: string | null;
};

export type DuplicateCandidate = {
  leadId: string | null;
  clientId: string | null;
  relationshipId: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  salesStage: string | null;
  signals: DuplicateSignal[];
};

const SIGNAL_RANK: Record<DuplicateSignal, number> = {
  email: 4,
  partner_email: 3,
  phone: 2,
  name_pair: 1,
};

export function normalizeEmail(raw: string | null | undefined): string | null {
  const t = raw?.trim().toLowerCase() ?? "";
  return t.includes("@") ? t : null;
}

/** Digits only. Returns null when fewer than 10 digits (avoids partial matches). */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Compare on last 10 digits so +1 / country-code prefixes still match US numbers.
  return digits.slice(-10);
}

function normName(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function personKey(first: string, last: string): string | null {
  const f = normName(first);
  const l = normName(last);
  if (!f || !l) return null;
  return `${f}|${l}`;
}

/** Order-insensitive primary+partner pair when both people are fully named. */
export function namePairKey(identity: InquiryIdentity): string | null {
  const a = personKey(identity.firstName, identity.lastName);
  const b = personKey(identity.partnerFirstName ?? "", identity.partnerLastName ?? "");
  if (!a || !b) return null;
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

type LeadRow = {
  id: string;
  relationship_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  partner_first_name: string | null;
  partner_last_name: string | null;
  partner_email: string | null;
  sales_stage: string | null;
};

type ClientRow = {
  id: string;
  lead_id: string | null;
  relationship_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  partner_first_name: string | null;
  partner_last_name: string | null;
  partner_email: string | null;
  status: string | null;
};

type RelRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

function addSignal(map: Map<string, DuplicateCandidate>, key: string, next: DuplicateCandidate) {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { ...next, signals: [...next.signals] });
    return;
  }
  const signals = new Set<DuplicateSignal>([...existing.signals, ...next.signals]);
  map.set(key, {
    ...existing,
    ...next,
    leadId: existing.leadId ?? next.leadId,
    clientId: existing.clientId ?? next.clientId,
    relationshipId: existing.relationshipId ?? next.relationshipId,
    email: existing.email ?? next.email,
    phone: existing.phone ?? next.phone,
    salesStage: existing.salesStage ?? next.salesStage,
    displayName: existing.displayName || next.displayName,
    signals: [...signals].sort((a, b) => SIGNAL_RANK[b] - SIGNAL_RANK[a]),
  });
}

function score(c: DuplicateCandidate): number {
  return c.signals.reduce((sum, s) => sum + SIGNAL_RANK[s], 0);
}

/**
 * Pure evaluation of one existing record against the incoming identity.
 * Used by unit tests and the DB aggregator.
 */
export function signalsAgainstRecord(
  incoming: InquiryIdentity,
  record: {
    email?: string | null;
    phone?: string | null;
    partnerEmail?: string | null;
    firstName: string;
    lastName: string;
    partnerFirstName?: string | null;
    partnerLastName?: string | null;
  },
): DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];
  const inEmail = normalizeEmail(incoming.email);
  const inPartnerEmail = normalizeEmail(incoming.partnerEmail);
  const recEmail = normalizeEmail(record.email);
  const recPartnerEmail = normalizeEmail(record.partnerEmail);
  const inPhone = normalizePhone(incoming.phone);
  const recPhone = normalizePhone(record.phone);

  if (inEmail && recEmail && inEmail === recEmail) signals.push("email");
  if (
    (inEmail && recPartnerEmail && inEmail === recPartnerEmail) ||
    (inPartnerEmail && recEmail && inPartnerEmail === recEmail) ||
    (inPartnerEmail && recPartnerEmail && inPartnerEmail === recPartnerEmail)
  ) {
    signals.push("partner_email");
  }
  if (inPhone && recPhone && inPhone === recPhone) signals.push("phone");

  const inPair = namePairKey(incoming);
  const recPair = namePairKey({
    firstName: record.firstName,
    lastName: record.lastName,
    partnerFirstName: record.partnerFirstName,
    partnerLastName: record.partnerLastName,
  });
  if (inPair && recPair && inPair === recPair) signals.push("name_pair");

  return [...new Set(signals)];
}

/**
 * Find strong possible matches at a venue.
 *
 * @param opts.excludeLeadId — never return this Lead
 * @param opts.excludeRelationshipId — when set (post-create), drop candidates
 *   that only share this Relationship via primary email (normal returning
 *   Opportunity). Cross-relationship signals still surface.
 */
export async function findPossibleDuplicateMatches(
  client: DbClient,
  venueId: string,
  incoming: InquiryIdentity,
  opts?: {
    excludeLeadId?: string | null;
    excludeRelationshipId?: string | null;
  },
): Promise<DuplicateCandidate[]> {
  const inEmail = normalizeEmail(incoming.email);
  const inPartnerEmail = normalizeEmail(incoming.partnerEmail);
  const inPhone = normalizePhone(incoming.phone);
  const inPair = namePairKey(incoming);

  if (!inEmail && !inPartnerEmail && !inPhone && !inPair) return [];

  const emails = [...new Set([inEmail, inPartnerEmail].filter((e): e is string => !!e))];

  const [{ data: leads }, { data: clients }, { data: allRels }] = await Promise.all([
    client
      .from("leads")
      .select(
        "id, relationship_id, first_name, last_name, email, phone, partner_first_name, partner_last_name, partner_email, sales_stage",
      )
      .eq("venue_id", venueId),
    client
      .from("clients")
      .select(
        "id, lead_id, relationship_id, first_name, last_name, email, phone, partner_first_name, partner_last_name, partner_email, status",
      )
      .eq("venue_id", venueId),
    emails.length > 0
      ? client
          .from("venue_customer_relationships")
          .select("id, email, first_name, last_name")
          .eq("venue_id", venueId)
      : Promise.resolve({ data: [] as RelRow[] }),
  ]);

  const relRows = ((allRels ?? []) as RelRow[]).filter((r) => {
    const e = normalizeEmail(r.email);
    return e != null && emails.includes(e);
  });

  const byKey = new Map<string, DuplicateCandidate>();
  const excludeLead = opts?.excludeLeadId ?? null;
  const excludeRel = opts?.excludeRelationshipId ?? null;

  for (const row of (leads ?? []) as LeadRow[]) {
    if (excludeLead && row.id === excludeLead) continue;
    const signals = signalsAgainstRecord(incoming, {
      email: row.email,
      phone: row.phone,
      partnerEmail: row.partner_email,
      firstName: row.first_name,
      lastName: row.last_name,
      partnerFirstName: row.partner_first_name,
      partnerLastName: row.partner_last_name,
    });
    if (signals.length === 0) continue;

    // Post-create: same Relationship + only primary-email signal = normal returning Opportunity.
    if (
      excludeRel &&
      row.relationship_id === excludeRel &&
      signals.length === 1 &&
      signals[0] === "email"
    ) {
      continue;
    }

    addSignal(byKey, `lead:${row.id}`, {
      leadId: row.id,
      clientId: null,
      relationshipId: row.relationship_id,
      displayName: leadDisplayName(
        row.first_name,
        row.last_name,
        row.partner_first_name,
        row.partner_last_name,
      ),
      email: row.email,
      phone: row.phone,
      salesStage: row.sales_stage,
      signals,
    });
  }

  for (const row of (clients ?? []) as ClientRow[]) {
    if (excludeLead && row.lead_id && row.lead_id === excludeLead) continue;
    const signals = signalsAgainstRecord(incoming, {
      email: row.email,
      phone: row.phone,
      partnerEmail: row.partner_email,
      firstName: row.first_name,
      lastName: row.last_name,
      partnerFirstName: row.partner_first_name,
      partnerLastName: row.partner_last_name,
    });
    if (signals.length === 0) continue;
    if (
      excludeRel &&
      row.relationship_id === excludeRel &&
      signals.length === 1 &&
      signals[0] === "email"
    ) {
      continue;
    }

    const key = row.lead_id ? `lead:${row.lead_id}` : `client:${row.id}`;
    addSignal(byKey, key, {
      leadId: row.lead_id,
      clientId: row.id,
      relationshipId: row.relationship_id,
      displayName: leadDisplayName(
        row.first_name,
        row.last_name,
        row.partner_first_name,
        row.partner_last_name,
      ),
      email: row.email,
      phone: row.phone,
      salesStage: row.status,
      signals,
    });
  }

  for (const row of relRows) {
    if (excludeRel && row.id === excludeRel) continue;
    const e = normalizeEmail(row.email);
    if (!e || !inEmail || e !== inEmail) continue;
    // Prefer an existing Lead/Client candidate already keyed by this relationship.
    const existingForRel = [...byKey.values()].find((c) => c.relationshipId === row.id);
    if (existingForRel) {
      addSignal(byKey, existingForRel.leadId ? `lead:${existingForRel.leadId}` : `client:${existingForRel.clientId}`, {
        ...existingForRel,
        signals: ["email"],
      });
      continue;
    }
    addSignal(byKey, `rel:${row.id}`, {
      leadId: null,
      clientId: null,
      relationshipId: row.id,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(" ") || e,
      email: row.email,
      phone: null,
      salesStage: null,
      signals: ["email"],
    });
  }

  return [...byKey.values()].sort((a, b) => score(b) - score(a) || (a.displayName).localeCompare(b.displayName));
}

export function signalLabel(signal: DuplicateSignal): string {
  switch (signal) {
    case "email":
      return "Same email";
    case "phone":
      return "Same phone";
    case "partner_email":
      return "Email matches partner contact";
    case "name_pair":
      return "Same couple names";
  }
}
