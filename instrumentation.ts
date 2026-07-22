/**
 * Next.js instrumentation hook — runs once per server instance boot.
 *
 * Currently registers exactly one thing: the Platform Event Framework's
 * Request-lifecycle wrap (lib/platform-events/wire-requests.ts), which
 * itself registers against the pre-existing seam in lib/requests/hooks.ts.
 * Nothing else in the app is touched by this file — it only calls
 * register() functions that are themselves purely additive.
 *
 * When marketing/workspace raise turbopack.root to the monorepo parent so
 * they can import shared/relationships, Next also loads this file. Their
 * `@/` alias points at the child app (not this repo root), so the dynamic
 * import below may be missing — soft-skip in that case so those apps boot.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { register: registerRequestEvents } = await import(
        "@/lib/platform-events/wire-requests"
      );
      registerRequestEvents();
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      const message = error instanceof Error ? error.message : String(error);
      if (
        code === "MODULE_NOT_FOUND" ||
        message.includes("Cannot find module") ||
        message.includes("Can't resolve")
      ) {
        return;
      }
      throw error;
    }
  }
}
