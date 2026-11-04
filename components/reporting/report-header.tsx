/**
 * Work Package R3 §54 — each report gets a plain-language title and one
 * short supporting sentence. Calm-blue guidance box so the orientation
 * reads as instructional, not another working card.
 */
export function ReportHeader({ title, description }: { title: string; description: string }) {
  return (
    <section
      className="htc-surface-guidance space-y-1 px-4 py-3"
      aria-label={title}
      data-testid="report-header"
    >
      <h1 className="text-xl font-semibold font-heading text-heading">{title}</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </section>
  );
}
