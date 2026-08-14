/**
 * Work Package R3 §54 — each report gets a plain-language title and one
 * short supporting sentence ("Revenue — See what you've booked, collected,
 * and still have outstanding."), not a card-title-only page. The active
 * ReportTabs entry already shows *which* report you're on; this answers
 * the next question — what does this report actually do for me.
 */
export function ReportHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-0.5">
      <h1 className="text-xl font-semibold font-heading text-heading">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
