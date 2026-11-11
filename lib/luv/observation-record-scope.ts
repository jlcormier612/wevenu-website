/**
 * Record-surface scope for Luv observations.
 *
 * Dashboard / HQ / digest call getLuvObservations with no scope (venue-wide).
 * Client Workspace / lead / contract record surfaces pass the viewed record so
 * venue-wide intelligence is not computed on that page's critical path.
 */

export type LuvObservationRecordScope = {
  leadId?: string;
  eventId?: string;
  contractId?: string;
  contractIds?: readonly string[];
  clientId?: string;
  invoiceId?: string;
};

export function isRecordScoped(scope?: LuvObservationRecordScope): boolean {
  if (!scope) return false;
  return Boolean(
    scope.leadId ||
      scope.eventId ||
      scope.contractId ||
      scope.invoiceId ||
      scope.clientId ||
      (scope.contractIds && scope.contractIds.length > 0),
  );
}

/** Lead-pipeline observations (/leads/… tours, S3, momentum). */
export function recordScopeWantsLeadPipeline(scope?: LuvObservationRecordScope): boolean {
  return !isRecordScoped(scope) || Boolean(scope?.leadId);
}

/** Event-window observations (21-day briefing, 90-day P7, questionnaires, S1/S2). */
export function recordScopeWantsEventWindow(scope?: LuvObservationRecordScope): boolean {
  return !isRecordScoped(scope) || Boolean(scope?.eventId);
}

/** Client-surface observations (website, portal inactivity). */
export function recordScopeWantsClientSurface(scope?: LuvObservationRecordScope): boolean {
  return !isRecordScoped(scope) || Boolean(scope?.clientId);
}

export function recordScopeContractIds(scope?: LuvObservationRecordScope): string[] {
  if (!scope) return [];
  const ids = [
    ...(scope.contractId ? [scope.contractId] : []),
    ...(scope.contractIds ?? []),
  ];
  return [...new Set(ids)];
}
