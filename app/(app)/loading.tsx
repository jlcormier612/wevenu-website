import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading state for workspace pages. Demonstrates the reusable
 * skeleton pattern (header + content cards) used while page data is pending.
 */
export default function WorkspaceLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl bg-card p-5 ring-1 shadow-sm ring-foreground/10"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
