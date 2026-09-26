"use client";

import { ContractBuilder } from "@/components/contracts/contract-builder";
import type { Client } from "@/lib/clients/types";
import type { ContractBrandingSnapshot } from "@/lib/contracts/branding";
import type { ContractTemplate } from "@/lib/contracts/types";
import type { ClientContact } from "@/lib/contacts/types";

/** New-contract entry — same Contract Builder used for pre-send draft editing. */
export function NewContractForm({
  templates,
  clients,
  initialTemplateId,
  contactsByClientId = {},
  initialClientId,
  initialEventId,
  selectionId,
  selectionSummary,
  venueBrand = null,
}: {
  templates: ContractTemplate[];
  clients: Client[];
  initialTemplateId?: string;
  contactsByClientId?: Record<string, ClientContact[]>;
  initialClientId?: string;
  initialEventId?: string;
  selectionId?: string;
  selectionSummary?: { name: string; totalAmount: number; depositAmount: number } | null;
  venueBrand?: ContractBrandingSnapshot | null;
}) {
  return (
    <ContractBuilder
      mode="create"
      templates={templates}
      clients={clients}
      contactsByClientId={contactsByClientId}
      initialTemplateId={initialTemplateId}
      initialClientId={initialClientId}
      initialEventId={initialEventId}
      selectionId={selectionId}
      selectionSummary={selectionSummary}
      venueBrand={venueBrand}
    />
  );
}
