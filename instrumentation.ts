/**
 * Next.js instrumentation hook — runs once per server instance boot.
 *
 * Currently registers exactly one thing: the Platform Event Framework's
 * Request-lifecycle wrap (lib/platform-events/wire-requests.ts), which
 * itself registers against the pre-existing seam in lib/requests/hooks.ts.
 * Nothing else in the app is touched by this file — it only calls
 * register() functions that are themselves purely additive.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { register: registerRequestEvents } = await import("@/lib/platform-events/wire-requests");
    registerRequestEvents();
  }
}
