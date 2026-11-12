import { cn } from "@/lib/utils";

/**
 * Honest route-level loading shells for venue App Router navigations.
 * Keeps the workspace shell stable while RSC content streams in.
 * Skeletons mirror page structure — they do not claim data has loaded.
 */

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-[var(--htc-eucalyptus-surface-pale)] animate-pulse",
        className,
      )}
      aria-hidden
    />
  );
}

function HeadingCard({ titleWidth = "w-40" }: { titleWidth?: string }) {
  return (
    <div className="htc-hospitality-heading htc-hospitality-intro-accent space-y-3">
      <Bone className={cn("h-7", titleWidth)} />
      <Bone className="h-4 w-full max-w-xl opacity-70" />
    </div>
  );
}

function KpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="htc-hospitality-elevated rounded-[0.75rem] p-4 space-y-3"
        >
          <Bone className="h-3 w-24 opacity-80" />
          <Bone className="h-8 w-28" />
          <Bone className="h-3 w-16 opacity-60" />
        </div>
      ))}
    </div>
  );
}

function ListRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="htc-hospitality-elevated overflow-hidden divide-y divide-[color:var(--htc-border-warm)]">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Bone className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className={cn("h-4", i % 2 === 0 ? "w-48 max-w-[55%]" : "w-36 max-w-[45%]")} />
            <Bone className="h-3 w-56 max-w-[70%] opacity-70" />
          </div>
          <Bone className="hidden h-6 w-16 shrink-0 sm:block opacity-70" />
        </div>
      ))}
    </div>
  );
}

function SectionCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="htc-hospitality-elevated overflow-hidden">
      <div className="border-b border-[color:var(--htc-border-warm)] bg-[var(--htc-eucalyptus-surface-pale)] px-4 py-3 space-y-2">
        <Bone className="h-4 w-36" />
        <Bone className="h-3 w-56 opacity-70" />
      </div>
      <div className="divide-y divide-[color:var(--htc-border-warm)]">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Bone className="h-4 w-4 shrink-0 rounded-sm opacity-60" />
            <Bone className={cn("h-4 flex-1", i % 3 === 0 ? "max-w-[70%]" : "max-w-[55%]")} />
            <Bone className="h-3 w-12 shrink-0 opacity-50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailHeader() {
  return (
    <div className="htc-hospitality-heading htc-hospitality-intro-accent">
      <div className="flex flex-wrap items-start gap-4">
        <Bone className="h-14 w-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <Bone className="h-7 w-48 max-w-full" />
          <Bone className="h-4 w-64 max-w-full opacity-70" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Bone className="h-8 w-24 rounded-full" />
            <Bone className="h-8 w-28 rounded-full opacity-80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TabStrip({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-[color:var(--htc-border-warm)] pb-2">
      {Array.from({ length: count }, (_, i) => (
        <Bone
          key={i}
          className={cn("h-8 rounded-full", i === 0 ? "w-24 opacity-100" : "w-20 opacity-60")}
        />
      ))}
    </div>
  );
}

export type HospitalityRouteLoadingVariant =
  | "dashboard"
  | "list"
  | "detail"
  | "reporting"
  | "calendar"
  | "payments";

const LABELS: Record<HospitalityRouteLoadingVariant, string> = {
  dashboard: "Loading dashboard",
  list: "Loading list",
  detail: "Loading workspace",
  reporting: "Loading reports",
  calendar: "Loading calendar",
  payments: "Loading payments",
};

export function HospitalityRouteLoading({
  variant = "list",
  label,
  className,
}: {
  variant?: HospitalityRouteLoadingVariant;
  /** Accessible status label — must stay honest (loading, not done). */
  label?: string;
  className?: string;
}) {
  const status = label ?? LABELS[variant];

  return (
    <div
      className={cn("htc-hospitality-page space-y-4 sm:space-y-6", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="hospitality-route-loading"
      data-loading-variant={variant}
    >
      <span className="sr-only">{status}</span>

      {variant === "dashboard" && (
        <>
          <HeadingCard titleWidth="w-56" />
          <KpiRow count={4} />
          <SectionCard rows={5} />
          <SectionCard rows={3} />
        </>
      )}

      {variant === "list" && (
        <>
          <HeadingCard />
          <div className="flex flex-wrap gap-2">
            <Bone className="h-9 w-20 rounded-full" />
            <Bone className="h-9 w-24 rounded-full opacity-80" />
            <Bone className="h-9 w-28 rounded-full opacity-70" />
          </div>
          <ListRows rows={7} />
        </>
      )}

      {variant === "detail" && (
        <>
          <DetailHeader />
          <TabStrip count={7} />
          <SectionCard rows={5} />
        </>
      )}

      {variant === "reporting" && (
        <>
          <HeadingCard titleWidth="w-36" />
          <div className="flex flex-wrap gap-2">
            <Bone className="h-9 w-28 rounded-md" />
            <Bone className="h-9 w-24 rounded-md opacity-80" />
            <Bone className="h-9 w-24 rounded-md opacity-70" />
          </div>
          <KpiRow count={4} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="htc-hospitality-elevated p-4 space-y-3">
              <Bone className="h-4 w-40" />
              <Bone className="h-48 w-full opacity-80" />
            </div>
            <div className="htc-hospitality-elevated p-4 space-y-3">
              <Bone className="h-4 w-36" />
              <Bone className="h-48 w-full opacity-80" />
            </div>
          </div>
        </>
      )}

      {variant === "calendar" && (
        <>
          <HeadingCard titleWidth="w-32" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Bone className="h-9 w-9 rounded-md" />
              <Bone className="h-9 w-28 rounded-md" />
              <Bone className="h-9 w-9 rounded-md" />
            </div>
            <div className="flex gap-2">
              <Bone className="h-9 w-16 rounded-full" />
              <Bone className="h-9 w-16 rounded-full opacity-80" />
              <Bone className="h-9 w-14 rounded-full opacity-70" />
            </div>
          </div>
          <div className="htc-hospitality-elevated p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-2 mb-3">
              {Array.from({ length: 7 }, (_, i) => (
                <Bone key={i} className="h-3 w-full opacity-50" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }, (_, i) => (
                <Bone key={i} className="aspect-square w-full rounded-md opacity-70" />
              ))}
            </div>
          </div>
        </>
      )}

      {variant === "payments" && (
        <>
          <HeadingCard titleWidth="w-36" />
          <div className="flex flex-wrap gap-2">
            <Bone className="h-9 w-16 rounded-full" />
            <Bone className="h-9 w-24 rounded-full opacity-80" />
            <Bone className="h-9 w-28 rounded-full opacity-70" />
          </div>
          <ListRows rows={6} />
        </>
      )}
    </div>
  );
}
