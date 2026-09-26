/**
 * Required client signer candidates for Contract Builder.
 *
 * A multi-person client relationship (e.g. "Lydia & Ali") is never one signer.
 * Candidates come from client_contacts and from client primary/partner emails.
 * Only people with an identifiable email are selectable.
 */

import type { Client } from "@/lib/clients/types";
import type { ClientContact } from "@/lib/contacts/types";
import type { ClientSignerSeed } from "@/lib/contracts/repository";

export const RELATIONSHIP_PRIMARY_SIGNER_ID = "relationship:primary";
export const RELATIONSHIP_PARTNER_SIGNER_ID = "relationship:partner";

export type SignerCandidate = {
  id: string;
  name: string;
  email: string | null;
  roleLabel: string | null;
  /** True when an email exists — only then can they be a required signer. */
  selectable: boolean;
  source: "contact" | "client_primary" | "client_partner";
};

function personName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

function emailsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Build explicit signer candidates for a client relationship. */
export function buildSignerCandidates(
  client: Pick<
    Client,
    | "id"
    | "firstName"
    | "lastName"
    | "email"
    | "partnerFirstName"
    | "partnerLastName"
    | "partnerEmail"
  >,
  contacts: ClientContact[],
): SignerCandidate[] {
  const candidates: SignerCandidate[] = [];
  const seenEmails = new Set<string>();

  const noteEmail = (email: string | null | undefined) => {
    if (email?.trim()) seenEmails.add(email.trim().toLowerCase());
  };

  for (const c of contacts) {
    const email = c.email?.trim() || null;
    const name = personName(c.firstName, c.lastName) || "Contact";
    candidates.push({
      id: c.id,
      name,
      email,
      roleLabel: c.roleLabel || c.relationship || (c.isPrimary ? "primary" : null),
      selectable: Boolean(email),
      source: "contact",
    });
    noteEmail(email);
  }

  const primaryName = personName(client.firstName, client.lastName) || "Primary contact";
  const primaryEmail = client.email?.trim() || null;
  const primaryAlready =
    contacts.some((c) => c.isPrimary && c.email?.trim())
    || (primaryEmail != null && contacts.some((c) => emailsEqual(c.email, primaryEmail)));
  if (!primaryAlready) {
    candidates.unshift({
      id: RELATIONSHIP_PRIMARY_SIGNER_ID,
      name: primaryName,
      email: primaryEmail,
      roleLabel: "primary",
      selectable: Boolean(primaryEmail),
      source: "client_primary",
    });
    noteEmail(primaryEmail);
  }

  const partnerName = personName(client.partnerFirstName, client.partnerLastName);
  if (partnerName) {
    const partnerEmail = client.partnerEmail?.trim() || null;
    const partnerAlready =
      contacts.some((c) => c.relationship === "partner" && c.email?.trim())
      || (partnerEmail != null && (
        seenEmails.has(partnerEmail.toLowerCase())
        || contacts.some((c) => emailsEqual(c.email, partnerEmail))
      ))
      || contacts.some((c) => {
        const n = personName(c.firstName, c.lastName).toLowerCase();
        return n === partnerName.toLowerCase() && Boolean(c.email?.trim());
      });
    if (!partnerAlready) {
      candidates.push({
        id: RELATIONSHIP_PARTNER_SIGNER_ID,
        name: partnerName,
        email: partnerEmail,
        roleLabel: "partner",
        selectable: Boolean(partnerEmail),
        source: "client_partner",
      });
    }
  }

  return candidates;
}

/** Default: primary selectable person only — never auto-assumes a couple needs two. */
export function defaultSelectedSignerIds(candidates: SignerCandidate[]): string[] {
  const primary =
    candidates.find((c) => c.selectable && (c.roleLabel === "primary" || c.source === "client_primary"))
    ?? candidates.find((c) => c.selectable);
  return primary ? [primary.id] : [];
}

export function resolveSignerSeedsFromSelection(
  client: Pick<
    Client,
    | "id"
    | "firstName"
    | "lastName"
    | "email"
    | "partnerFirstName"
    | "partnerLastName"
    | "partnerEmail"
  >,
  contacts: ClientContact[],
  selectedIds?: string[],
): { ok: true; seeds: ClientSignerSeed[] } | { ok: false; message: string } {
  const candidates = buildSignerCandidates(client, contacts);
  const ids =
    selectedIds && selectedIds.length > 0
      ? selectedIds
      : defaultSelectedSignerIds(candidates);

  if (ids.length === 0) {
    return {
      ok: false,
      message: "This client has no email on file — add one before creating a contract.",
    };
  }

  const seeds: ClientSignerSeed[] = [];
  for (const id of ids) {
    if (id === RELATIONSHIP_PRIMARY_SIGNER_ID) {
      if (!client.email?.trim()) {
        return {
          ok: false,
          message: `${personName(client.firstName, client.lastName) || "Primary contact"} has no email on file — add an email before making them a required signer.`,
        };
      }
      seeds.push({
        clientContactId: null,
        signerRefId: client.id,
        signerName: personName(client.firstName, client.lastName) || "Primary contact",
        signerEmail: client.email.trim(),
        signerRole: "primary",
      });
      continue;
    }
    if (id === RELATIONSHIP_PARTNER_SIGNER_ID) {
      const name = personName(client.partnerFirstName, client.partnerLastName);
      if (!name) {
        return { ok: false, message: "Partner is not on this client relationship." };
      }
      if (!client.partnerEmail?.trim()) {
        return {
          ok: false,
          message: `${name} has no email on file — add a partner email before making them a required signer.`,
        };
      }
      // signer_ref_id is uuid — do not use `${client.id}:partner` (invalid UUID).
      // Partner identity is carried by signer_role + email; primary uses client.id.
      seeds.push({
        clientContactId: null,
        signerRefId: null,
        signerName: name,
        signerEmail: client.partnerEmail.trim(),
        signerRole: "partner",
      });
      continue;
    }

    const contact = contacts.find((c) => c.id === id);
    if (!contact) {
      return { ok: false, message: "One of the selected signers was not found." };
    }
    if (!contact.email?.trim()) {
      return {
        ok: false,
        message: `${personName(contact.firstName, contact.lastName) || "Contact"} has no email on file — add an email before making them a required signer.`,
      };
    }
    seeds.push({
      clientContactId: contact.id,
      signerRefId: contact.id,
      signerName: personName(contact.firstName, contact.lastName) || "Contact",
      signerEmail: contact.email.trim(),
      signerRole: contact.roleLabel || contact.relationship || null,
    });
  }

  // De-dupe by email — one signing path per address.
  const byEmail = new Map<string, ClientSignerSeed>();
  for (const s of seeds) {
    byEmail.set(s.signerEmail.trim().toLowerCase(), s);
  }
  return { ok: true, seeds: [...byEmail.values()] };
}

/** Map existing draft signers back to candidate ids for checkbox state. */
export function selectedIdsFromExistingSigners(
  candidates: SignerCandidate[],
  signers: Array<{
    signerType: string;
    isRequired: boolean;
    clientContactId: string | null;
    signerEmail: string | null;
    signerRole: string | null;
  }>,
): string[] {
  const required = signers.filter((s) => s.signerType === "client" && s.isRequired);
  if (required.length === 0) return defaultSelectedSignerIds(candidates);

  const ids: string[] = [];
  for (const s of required) {
    if (s.clientContactId) {
      const hit = candidates.find((c) => c.id === s.clientContactId);
      if (hit) {
        ids.push(hit.id);
        continue;
      }
    }
    const byEmail = candidates.find(
      (c) => c.email && s.signerEmail && emailsEqual(c.email, s.signerEmail),
    );
    if (byEmail) {
      ids.push(byEmail.id);
      continue;
    }
    if (s.signerRole === "partner" || s.signerRole === "Partner") {
      const partner = candidates.find((c) => c.id === RELATIONSHIP_PARTNER_SIGNER_ID);
      if (partner) ids.push(partner.id);
      continue;
    }
    const primary = candidates.find((c) => c.id === RELATIONSHIP_PRIMARY_SIGNER_ID);
    if (primary) ids.push(primary.id);
  }
  return ids.length > 0 ? ids : defaultSelectedSignerIds(candidates);
}
