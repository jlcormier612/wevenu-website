/**
 * Shared import matching — Use existing / Create new / Skip.
 *
 * Exact identity requires more than a shared email. Distinct people who
 * share an office address stay as likely matches for review. The same
 * person with several events is an exact name+email match so a second
 * client row is not created.
 *
 * Field-level updates of an existing record are deferred.
 */

export type PersonMatchKind = "exact" | "likely" | "new";

export type PersonMatchAction = "use_existing" | "create_new" | "skip";

export type PersonMatchCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

export type IncomingPerson = {
  firstName: string;
  lastName: string;
  email?: string | null;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
};

export type PersonMatchDecision = {
  kind: PersonMatchKind;
  matchedId: string | null;
  matchedName: string | null;
  matchedEmail: string | null;
  reason: string;
  defaultAction: PersonMatchAction;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function namesEqual(a: IncomingPerson, b: PersonMatchCandidate): boolean {
  return norm(a.firstName) === norm(b.firstName) && norm(a.lastName) === norm(b.lastName);
}

function partnerMentionsCandidate(incoming: IncomingPerson, candidate: PersonMatchCandidate): boolean {
  const pf = norm(incoming.partnerFirstName);
  const pl = norm(incoming.partnerLastName);
  if (!pf && !pl) return false;
  return pf === norm(candidate.firstName) && pl === norm(candidate.lastName);
}

function fromCandidate(candidate: PersonMatchCandidate | null): Pick<PersonMatchDecision, "matchedName" | "matchedEmail"> {
  if (!candidate) return { matchedName: null, matchedEmail: null };
  return {
    matchedName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    matchedEmail: candidate.email,
  };
}

/**
 * Classify one incoming person against at most one email hit and one name hit.
 * Callers must not pass two different people as if they were the same row.
 */
export function classifyPersonMatch(
  incoming: IncomingPerson,
  byEmail: PersonMatchCandidate | null,
  byName: PersonMatchCandidate | null,
): PersonMatchDecision {
  const email = norm(incoming.email);
  if (byEmail && namesEqual(incoming, byEmail)) {
    return {
      kind: "exact",
      matchedId: byEmail.id,
      ...fromCandidate(byEmail),
      reason: "Same name and email as an existing person. Additional events stay on this person.",
      defaultAction: "use_existing",
    };
  }
  if (byEmail && partnerMentionsCandidate(incoming, byEmail)) {
    return {
      kind: "likely",
      matchedId: byEmail.id,
      ...fromCandidate(byEmail),
      reason: "This email already belongs to someone listed as a partner on the incoming row.",
      defaultAction: "skip",
    };
  }
  if (byEmail && !namesEqual(incoming, byEmail)) {
    return {
      kind: "likely",
      matchedId: byEmail.id,
      ...fromCandidate(byEmail),
      reason: "This email is already in Hello to Cheers under a different name. Shared addresses are not conclusive.",
      defaultAction: "skip",
    };
  }
  if (byName && email && norm(byName.email) && norm(byName.email) !== email) {
    return {
      kind: "likely",
      matchedId: byName.id,
      ...fromCandidate(byName),
      reason: "Same name as an existing person, but the email is different.",
      defaultAction: "skip",
    };
  }
  if (byName && !email) {
    return {
      kind: "likely",
      matchedId: byName.id,
      ...fromCandidate(byName),
      reason: "Same name as an existing person, with no email to confirm they are the same person.",
      defaultAction: "skip",
    };
  }
  return {
    kind: "new",
    matchedId: null,
    matchedName: null,
    matchedEmail: null,
    reason: "No matching person in Hello to Cheers.",
    defaultAction: "create_new",
  };
}

/** Resolve the action that will actually run. Unknown actions fall back to the default. */
export function resolvePersonMatchAction(
  decision: PersonMatchDecision,
  requested?: PersonMatchAction | null,
): PersonMatchAction {
  if (requested === "use_existing" || requested === "create_new" || requested === "skip") {
    if (decision.kind === "new" && requested === "use_existing") return "create_new";
    return requested;
  }
  return decision.defaultAction;
}

export function personMatchSkipMessage(decision: PersonMatchDecision, action: PersonMatchAction): string {
  if (action === "use_existing") {
    return "Used the person already in Hello to Cheers. No second record was created.";
  }
  if (action === "skip") {
    return decision.kind === "likely"
      ? `Left out for review — ${decision.reason}`
      : "Left out of this import.";
  }
  return "";
}

export type PersonImportPlanCounts = {
  createCount: number;
  useExistingCount: number;
  skipCount: number;
  attentionCount: number;
};

export type PersonImportPlanRow = {
  previewSkipped: boolean;
  kind: PersonMatchKind;
  action: PersonMatchAction;
};

export function summarizePersonImportPlan(rows: readonly PersonImportPlanRow[]): PersonImportPlanCounts {
  const counts: PersonImportPlanCounts = {
    createCount: 0,
    useExistingCount: 0,
    skipCount: 0,
    attentionCount: 0,
  };
  for (const row of rows) {
    if (row.kind === "likely") counts.attentionCount += 1;
    if (row.previewSkipped || row.action === "skip") {
      counts.skipCount += 1;
      continue;
    }
    if (row.action === "use_existing") {
      counts.useExistingCount += 1;
      continue;
    }
    counts.createCount += 1;
  }
  return counts;
}

/** "1 client" / "2 clients"; "1 inventory template" / "2 inventory templates". */
export function countedEntityLabel(count: number, pluralLabel: string): string {
  const plural = pluralLabel.trim().toLowerCase();
  const singular = plural.endsWith("s") ? plural.slice(0, -1) : plural;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function personImportConfirmLabel(
  counts: PersonImportPlanCounts,
  entityLabel: string,
): string {
  const parts: string[] = [];
  if (counts.createCount > 0) {
    const entity = countedEntityLabel(counts.createCount, entityLabel).replace(/^\d+\s+/, "");
    parts.push(`Create ${counts.createCount} new ${entity}`);
  }
  if (counts.useExistingCount > 0) {
    parts.push(`use ${counts.useExistingCount} existing`);
  }
  if (counts.skipCount > 0) {
    parts.push(`skip ${counts.skipCount}`);
  }
  if (parts.length === 0) return `Nothing to import`;
  return parts.join(" · ");
}
