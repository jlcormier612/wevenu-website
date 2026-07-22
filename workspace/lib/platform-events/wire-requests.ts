/**
 * Stub for the product app's platform-events wire.
 *
 * Workspace raises turbopack.root to the monorepo parent (shared/relationships),
 * which causes Next to load the root instrumentation.ts. That file imports
 * `@/lib/platform-events/wire-requests`; under workspace `@/` is this app.
 * Export a no-op so boot succeeds without pulling in the product Request stack.
 */
export function register(): void {
  // no-op
}
