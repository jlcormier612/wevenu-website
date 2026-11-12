/** Inline skeletons for Dashboard Suspense islands (honest loading, not completion). */

function Bone({ className }: { className: string }) {
  return (
    <div
      className={`rounded-md bg-[var(--htc-eucalyptus-surface-pale)] animate-pulse ${className}`}
      aria-hidden
    />
  );
}

export function DashboardHeaderFallback() {
  return (
    <div
      className="htc-hospitality-heading htc-hospitality-intro-accent space-y-3"
      role="status"
      aria-busy="true"
      aria-label="Loading greeting"
      data-testid="dashboard-header-fallback"
    >
      <Bone className="h-7 w-56" />
      <Bone className="h-4 w-full max-w-md opacity-70" />
    </div>
  );
}

export function DashboardSnapshotFallback() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-busy="true"
      aria-label="Loading business snapshot"
      data-testid="dashboard-snapshot-fallback"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="htc-hospitality-elevated rounded-[0.75rem] p-4 space-y-3">
          <Bone className="h-3 w-24 opacity-80" />
          <Bone className="h-8 w-28" />
          <Bone className="h-3 w-16 opacity-60" />
        </div>
      ))}
    </div>
  );
}

export function DashboardFocusFallback() {
  return (
    <div
      className="htc-hospitality-elevated overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading today's focus"
      data-testid="dashboard-focus-fallback"
    >
      <div className="border-b border-[color:var(--htc-border-warm)] bg-[var(--htc-eucalyptus-surface-pale)] px-4 py-3 space-y-2">
        <Bone className="h-4 w-36" />
        <Bone className="h-3 w-56 opacity-70" />
      </div>
      <div className="divide-y divide-[color:var(--htc-border-warm)]">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Bone className="h-4 w-4 shrink-0 rounded-sm opacity-60" />
            <Bone className={`h-4 flex-1 ${i % 2 === 0 ? "max-w-[70%]" : "max-w-[55%]"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
