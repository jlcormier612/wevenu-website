/**
 * Process-local guard against double-click / concurrent invite sends for one client.
 * Mirrors invoice beginOutboundSend — does not replace DB shouldSendClientInvitation.
 */
const inFlight = new Set<string>();

export function beginClientInviteSend(key: string): boolean {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}

export function endClientInviteSend(key: string): void {
  inFlight.delete(key);
}
