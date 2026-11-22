/**
 * Operational CRM slice — excludes sandbox_demo + disposable from metrics /
 * Today buckets / unread badges. Detail pages and acceptance fixtures still
 * use full getRelationships() / getRelationship(id).
 */

import {
  filterByOperationalRelationshipId,
  filterOperationalRelationships,
  isOperationalRelationship,
  operationalRelationshipIdSet,
  resolveCrmRole,
  type DemoIsolationCrmRole,
} from "@shared/relationships";

import type {
  CrmRole,
  Notification,
  Relationship,
  WorkspaceData,
} from "@/lib/types";

export function relationshipCrmRole(r: Relationship): CrmRole {
  return resolveCrmRole(r) as CrmRole;
}

export function isOpsRelationship(r: Relationship): boolean {
  return isOperationalRelationship(r);
}

/** Sales/CS boards: hide demo-registry rows; keep disposable for acceptance. */
export function isBoardVisibleRelationship(r: Relationship): boolean {
  return resolveCrmRole(r) !== "sandbox_demo";
}

export function toOperationalWorkspaceData(data: WorkspaceData): WorkspaceData {
  const relationships = filterOperationalRelationships(
    data.relationships,
  ) as Relationship[];
  const ids = operationalRelationshipIdSet(data.relationships);
  const subscriptions = filterByOperationalRelationshipId(
    data.subscriptions,
    ids,
  );
  const mrrCents = subscriptions
    .filter((s) => s.status === "active" || s.status === "trialing")
    .reduce((sum, s) => sum + (s.mrrCents || 0), 0);
  const foundingCount = relationships.filter((r) => r.foundingMember).length;
  return {
    ...data,
    relationships,
    subscriptions,
    walkthroughs: filterByOperationalRelationshipId(data.walkthroughs, ids),
    tasks: filterByOperationalRelationshipId(data.tasks, ids),
    timelineEvents: filterByOperationalRelationshipId(data.timelineEvents, ids),
    communications: filterByOperationalRelationshipId(data.communications, ids),
    notifications: filterByOperationalRelationshipId(data.notifications, ids),
    documents: filterByOperationalRelationshipId(data.documents, ids),
    invoices: filterByOperationalRelationshipId(data.invoices, ids),
    onboardingMilestones: filterByOperationalRelationshipId(
      data.onboardingMilestones,
      ids,
    ),
    founderProgram: {
      ...data.founderProgram,
      currentCount: foundingCount,
    },
    reports: {
      ...data.reports,
      mrrCents,
      arrCents: mrrCents * 12,
    },
  };
}

export function filterOperationalNotifications(
  notifications: Notification[],
  relationships: Relationship[],
): Notification[] {
  const ids = operationalRelationshipIdSet(relationships);
  return notifications.filter((n) => {
    if (!n.relationshipId) return false;
    return ids.has(n.relationshipId);
  });
}

export type { DemoIsolationCrmRole };
