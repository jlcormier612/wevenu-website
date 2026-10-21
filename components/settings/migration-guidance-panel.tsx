import Link from "next/link";

/**
 * Venue-facing migration onboarding — guidance only.
 * Does not change import engines, entity lists, or commit behavior.
 */
export function MigrationGuidancePanel({
  variant = "migration",
}: {
  variant?: "migration" | "compact";
}) {
  const steps = [
    {
      n: "1",
      title: "Prepare",
      body: (
        <>
          Gather the lists and files you want to move. If you have dated events or bookings, set up{" "}
          <Link href="/settings/availability" className="font-medium text-primary hover:underline">
            Calendar &amp; Availability
          </Link>{" "}
          (spaces and capacity) first.
        </>
      ),
    },
    {
      n: "2",
      title: "People & templates",
      body: (
        <>
          Bring over clients, leads, vendors, inventory templates, and package templates. Use{" "}
          <Link href="/settings/import" className="font-medium text-primary hover:underline">
            Import Data
          </Link>{" "}
          for a small clean list (CSV, Excel, Word, PDF, or paste), or import clients/leads/vendors/packages
          here in Migration Center when you want review before anything is created.
        </>
      ),
    },
    {
      n: "3",
      title: "Calendar",
      body: (
        <>
          Import events, tours, date holds, and calendar blocks here — one type at a time. Review
          anything flagged before you commit.
        </>
      ),
    },
    {
      n: "4",
      title: "Agreements & money on booked events",
      body: (
        <>
          After the client and event exist, bring over invoices, payment schedules, and signed
          agreements for booked events (choose that option below). Attach contract files with
          Documents when you have PDFs to keep on the client or event.
        </>
      ),
    },
    {
      n: "5",
      title: "Review & verify",
      body: (
        <>
          Resolve skipped or unclear rows, then check Clients, Calendar, and the event&apos;s invoice
          and documents in Hello to Cheers. You can leave and resume any unfinished import from Your
          import history.
        </>
      ),
    },
  ];

  return (
    <div className="rounded-sm border border-border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          {variant === "compact" ? "Suggested order" : "How to bring your existing business over"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {variant === "compact" ? (
            <>
              Use{" "}
              <Link href="/settings/import" className="font-medium text-primary hover:underline">
                Import Data
              </Link>{" "}
              for small contact or template lists. Use this page for events, tours, holds, calendar
              blocks, and booked-event invoices, payment schedules, and signed agreements.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Import Data</span> is for small, clean
              lists of clients, leads, vendors, inventory templates, or package templates.{" "}
              <span className="font-medium text-foreground">Migration Center</span> is for a real
              cutover — calendar records and booked-event finances — with review before anything is
              created. Not every record type is supported; follow the order below.
            </>
          )}
        </p>
      </div>

      <ol className="space-y-2.5">
        {steps.map((step) => (
          <li key={step.n} className="flex gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
              {step.n}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border pt-2">
        Package templates keep included-item descriptions, not automatic links to inventory stock.
        There is no one-click undo of a finished import — keep your source files and remove individual
        records if something looks wrong.{" "}
        <Link
          href="/help/what-should-i-set-up-before-i-start"
          className="font-medium text-primary hover:underline"
        >
          Full migration checklist
        </Link>
      </p>
    </div>
  );
}
