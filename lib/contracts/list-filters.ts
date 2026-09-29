import { deriveContractSigningUiState } from "@/lib/contracts/signers";
import { selectCurrentAgreements } from "@/lib/contracts/version-lineage";
import type { Contract } from "@/lib/contracts/types";

export type ContractWorkflowListRow = Contract & {
  listVersionNumber: number;
  listFamilySize: number;
  listFamilyTitles: string[];
};

/** List/badge population: one row per amends_contract_id family (current tip). */
export function rollupContractsToCurrentAgreements(
  contracts: readonly Contract[],
): ContractWorkflowListRow[] {
  const selections = selectCurrentAgreements(
    contracts.map((c) => ({
      id: c.id,
      amendsContractId: c.amendsContractId,
      createdAt: c.createdAt,
    })),
  );
  const byId = new Map(contracts.map((c) => [c.id, c]));
  return selections
    .map((s) => {
      const current = byId.get(s.currentId);
      if (!current) return null;
      return {
        ...current,
        listVersionNumber: s.versionNumber,
        listFamilySize: s.familyIds.length,
        listFamilyTitles: s.familyIds
          .map((id) => byId.get(id)?.title)
          .filter((title): title is string => Boolean(title)),
      };
    })
    .filter((row): row is ContractWorkflowListRow => row != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type ContractListFilterKey =
  | "action_required"
  | "all"
  | "draft"
  | "sent_to_client"
  | "awaiting_venue_signature"
  | "fully_signed"
  | "cancelled"
  | "expired";

export const CONTRACT_LIST_FILTERS: { value: ContractListFilterKey; label: string }[] = [
  { value: "action_required", label: "Action Required" },
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent_to_client", label: "Sent to Client" },
  { value: "awaiting_venue_signature", label: "Awaiting Venue Signature" },
  { value: "fully_signed", label: "Fully Executed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

export const DEFAULT_CONTRACT_LIST_FILTER: ContractListFilterKey = "action_required";

export function contractSigningFilterKey(c: Contract): Exclude<ContractListFilterKey, "action_required" | "all"> {
  if (c.status === "cancelled") return "cancelled";
  const progressive = deriveContractSigningUiState({
    status: c.status,
    venueSigned: c.venueSigned ?? false,
    requiredClientTotal: c.requiredClientTotal ?? 1,
    requiredClientSigned: c.requiredClientSigned ?? 0,
    expiresAt: c.expiresAt,
  });
  if (progressive.state === "fully_signed") return "fully_signed";
  if (progressive.state === "awaiting_venue_signature") return "awaiting_venue_signature";
  if (progressive.state === "sent_to_client") return "sent_to_client";
  if (progressive.state === "expired") return "expired";
  if (progressive.state === "draft") return "draft";
  if (progressive.state === "cancelled") return "cancelled";
  return "draft";
}

/** Venue-action-required: Draft + Awaiting Venue Signature. Sent to Client does not count. */
export function isVenueActionRequiredContract(c: Contract): boolean {
  const key = contractSigningFilterKey(c);
  return key === "draft" || key === "awaiting_venue_signature";
}

export function contractMatchesListFilter(c: Contract, filter: ContractListFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "action_required") return isVenueActionRequiredContract(c);
  return contractSigningFilterKey(c) === filter;
}

export function countVenueActionRequiredContracts(contracts: readonly Contract[]): number {
  return contracts.filter(isVenueActionRequiredContract).length;
}

/** Search current rows, including titles from explicit family members. */
export function contractMatchesWorkflowSearch(
  row: Pick<ContractWorkflowListRow, "title" | "clientName" | "listFamilyTitles">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.title, row.clientName, ...(row.listFamilyTitles ?? [])].some((s) =>
    s?.toLowerCase().includes(q),
  );
}

export function parseContractListFilter(raw: string | undefined): ContractListFilterKey {
  if (!raw) return DEFAULT_CONTRACT_LIST_FILTER;
  if (CONTRACT_LIST_FILTERS.some((f) => f.value === raw)) {
    return raw as ContractListFilterKey;
  }
  return DEFAULT_CONTRACT_LIST_FILTER;
}
