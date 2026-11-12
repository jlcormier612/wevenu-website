"use server";

/**
 * Wave C1 prototype — deferred Lead workspace tab packs.
 * Documents + Luv drafts are omitted from the initial Overview RSC path and
 * loaded on demand via these actions (or eagerly when deep-linked).
 */

import { getDocuments } from "@/lib/documents/service";
import { getPinnedDocumentKeys, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";
import type { WorkspaceDocument } from "@/lib/document-workspace/types";
import type { Document } from "@/lib/documents/types";
import { getDraftsForLead, type LuvDraft } from "@/lib/luv/drafts";
import { getLead } from "@/lib/leads/service";

export type LeadDocumentsPack = {
  documents: Document[];
  workspaceDocuments: WorkspaceDocument[];
  pinnedDocumentKeys: string[];
};

export type LeadLuvDraftsPack = {
  drafts: LuvDraft[];
};

/** Authz: getLead scopes to the active venue; missing lead → empty pack. */
export async function loadLeadDocumentsPackAction(leadId: string): Promise<LeadDocumentsPack> {
  const lead = await getLead(leadId);
  if (!lead) {
    return { documents: [], workspaceDocuments: [], pinnedDocumentKeys: [] };
  }
  const [documents, workspaceDocuments, pinnedKeys] = await Promise.all([
    getDocuments("lead", leadId),
    getVenueWorkspaceDocuments({ leadId }),
    getPinnedDocumentKeys(),
  ]);
  return {
    documents,
    workspaceDocuments,
    pinnedDocumentKeys: [...pinnedKeys],
  };
}

export async function loadLeadLuvDraftsPackAction(leadId: string): Promise<LeadLuvDraftsPack> {
  const lead = await getLead(leadId);
  if (!lead) return { drafts: [] };
  const drafts = await getDraftsForLead(leadId);
  return { drafts };
}
