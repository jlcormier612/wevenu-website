/**
 * Shared list-body placeholder for sidebar first-paint.
 * Header stays sync outside Suspense; this only covers the deferred body.
 */
export function NavListBodyFallback({ label }: { label: string }) {
  return (
    <div
      className="space-y-3 rounded-[0.75rem] border border-[color:var(--htc-border-warm)] bg-card/40 p-4"
      role="status"
      aria-busy="true"
      aria-label={label}
      data-testid="nav-list-body-fallback"
    >
      <div className="h-9 max-w-md animate-pulse rounded-md bg-[var(--htc-eucalyptus-surface-pale)]" />
      <div className="h-8 max-w-xl animate-pulse rounded-md bg-[var(--htc-eucalyptus-surface-pale)] opacity-80" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-md bg-[var(--htc-eucalyptus-surface-pale)]"
            style={{ opacity: 1 - i * 0.08 }}
          />
        ))}
      </div>
    </div>
  );
}
