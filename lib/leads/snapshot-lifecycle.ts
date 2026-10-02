/**
 * Relationship Snapshot — authoritative lifecycle precedence for Interest / Commitment.
 *
 * Stronger current lifecycle facts must not be described as earlier states.
 * Scores remain for Responsiveness and as fallbacks when no stronger fact exists.
 *
 * Precedence (conceptual, not a numeric score):
 * early inquiry < engagement < proposal < contract sent < client signed
 * < fully executed < booked
 *
 * Signed / Fully Executed ≠ Booked. Venue Booked decision remains authoritative.
 */

import {
  deriveContractSigningUiState,
  type ContractSigningUiState,
} from "@/lib/contracts/signers";
import { scoreDescriptor } from "@/lib/leads/momentum";

export type SnapshotLifecycleFacts = {
  /** Authoritative Booked = first_booked_at / venue Booked decision — never sales_stage alone. */
  isBooked: boolean;
  /** Latest relevant contract status when known. */
  contractStatus: string | null;
  venueSigned: boolean;
  requiredClientTotal: number;
  requiredClientSigned: number;
  /** Optional payment context — never redefines Booked. */
  hasPaymentOutstanding?: boolean;
};

export type SnapshotLifecycleMilestone =
  | "booked"
  | "fully_executed"
  | "client_signed"
  | "contract_sent"
  | "early";

export function classifySnapshotLifecycleMilestone(
  facts: SnapshotLifecycleFacts,
): SnapshotLifecycleMilestone {
  if (facts.isBooked) return "booked";

  if (!facts.contractStatus) return "early";

  const { state } = deriveContractSigningUiState({
    status: facts.contractStatus,
    venueSigned: facts.venueSigned,
    requiredClientTotal: facts.requiredClientTotal,
    requiredClientSigned: facts.requiredClientSigned,
    expiresAt: null,
  });

  if (state === "fully_signed") return "fully_executed";
  if (state === "awaiting_venue_signature") return "client_signed";
  if (state === "sent_to_client") return "contract_sent";
  return "early";
}

export function contractSigningStateFromFacts(
  facts: SnapshotLifecycleFacts,
): ContractSigningUiState | null {
  if (!facts.contractStatus) return null;
  return deriveContractSigningUiState({
    status: facts.contractStatus,
    venueSigned: facts.venueSigned,
    requiredClientTotal: facts.requiredClientTotal,
    requiredClientSigned: facts.requiredClientSigned,
    expiresAt: null,
  }).state;
}

function commitmentWithPayment(base: string, facts: SnapshotLifecycleFacts): string {
  if (facts.hasPaymentOutstanding) {
    return `${base} · Initial payment outstanding`;
  }
  return base;
}

/**
 * Interest descriptor — lifecycle facts win over weak/stale score language.
 */
export function snapshotInterestDescriptor(
  facts: SnapshotLifecycleFacts,
  interestScore: number,
): string {
  const milestone = classifySnapshotLifecycleMilestone(facts);
  switch (milestone) {
    case "booked":
      return "Booked";
    case "fully_executed":
      return "Contract fully executed";
    case "client_signed":
      return "Contract signed";
    case "contract_sent":
      return "Contract sent";
    case "early":
    default:
      return scoreDescriptor("interest", interestScore);
  }
}

/**
 * Commitment descriptor — never says "Progressing toward booking" / early
 * language when a stronger contract or Booked fact exists.
 */
export function snapshotCommitmentDescriptor(
  facts: SnapshotLifecycleFacts,
  commitmentScore: number,
): string {
  const milestone = classifySnapshotLifecycleMilestone(facts);
  switch (milestone) {
    case "booked":
      return "Booked";
    case "fully_executed":
      return commitmentWithPayment(
        "Contract fully executed · Not yet marked Booked",
        facts,
      );
    case "client_signed":
      return commitmentWithPayment(
        "Contract signed · Not yet marked Booked",
        facts,
      );
    case "contract_sent":
      return "Contract sent · Awaiting signatures";
    case "early":
    default:
      return scoreDescriptor("commitment", commitmentScore);
  }
}

/** Responsiveness stays score-based — do not invent patterns from lifecycle. */
export function snapshotResponsivenessDescriptor(responsivenessScore: number): string {
  return scoreDescriptor("responsiveness", responsivenessScore);
}

/**
 * A signed / executed / booked relationship must not render the early
 * "new" / "observing" card shells that say "still early".
 */
export function snapshotForcesInsightsStage(facts: SnapshotLifecycleFacts): boolean {
  const milestone = classifySnapshotLifecycleMilestone(facts);
  return (
    milestone === "booked"
    || milestone === "fully_executed"
    || milestone === "client_signed"
    || milestone === "contract_sent"
  );
}
