"use client";

/**
 * Lead detail recovery — if the RSC stream fails (deploy action-id mismatch,
 * aborted refresh, timed-out data load), do not leave the route on the parent
 * loading skeleton forever.
 */
export default function LeadDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-heading">This lead couldn’t load</h1>
      <p className="text-sm text-muted-foreground">
        Reload to try again, or go back to Leads. If you just saved a package or started a contract,
        a full reload usually recovers.
      </p>
      {process.env.NODE_ENV === "development" && error?.message ? (
        <p className="text-xs text-muted-foreground/80">{error.message}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-heading px-4 py-2 text-sm font-medium text-background"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-heading"
          onClick={() => reset()}
        >
          Try again
        </button>
        <a
          href="/leads"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-heading"
        >
          Back to Leads
        </a>
      </div>
    </div>
  );
}
