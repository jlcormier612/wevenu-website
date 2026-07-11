/**
 * Request lifecycle hooks.
 *
 * This is deliberately NOT a notification system — it does not send email,
 * in-app alerts, or anything else. It is the seam a future notification
 * system (or any other future consumer) will register against so it never
 * has to modify lib/requests/service.ts directly. Nothing calls
 * onRequestLifecycleEvent() yet; the registry starts empty and staying
 * empty is the correct state until a future feature opts in.
 */
import type { Request, RequestStatus } from "./types";

export type RequestLifecycleEvent =
  | { type: "created"; request: Request }
  | { type: "status_changed"; request: Request; fromStatus: RequestStatus; toStatus: RequestStatus }
  | { type: "assigned"; request: Request; staffId: string }
  | { type: "reassigned"; request: Request; fromStaffId: string | null; toStaffId: string }
  // A client-initiated transition (Wedding Workspace – Request Experience).
  // These originate from a token-scoped SQL RPC, not lib/requests/service.ts,
  // so only the fields a portal route actually has on hand are carried —
  // never a full Request (which would need a venue-staff-authorized read).
  | { type: "client_submitted"; requestId: string; clientId: string; fromStatus: RequestStatus; toStatus: RequestStatus };

export type RequestLifecycleHandler = (event: RequestLifecycleEvent) => void | Promise<void>;

const handlers: RequestLifecycleHandler[] = [];

/** Register a handler to be called on every future Request lifecycle event. */
export function onRequestLifecycleEvent(handler: RequestLifecycleHandler): void {
  handlers.push(handler);
}

/** Internal — called by lib/requests/service.ts at each lifecycle transition. */
export async function emitRequestLifecycleEvent(event: RequestLifecycleEvent): Promise<void> {
  for (const handler of handlers) {
    await handler(event);
  }
}
