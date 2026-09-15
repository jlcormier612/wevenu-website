import {
  formatTemplateOfferingPrice,
  linesForSection,
  unsectionedLines,
} from "@/lib/event-order-templates/offerings";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

export function EventOrderTemplatePreviewView({
  template,
}: {
  template: EventOrderTemplateWithDetails;
}) {
  const sections = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <article className="space-y-6 overflow-x-hidden">
      <header className="space-y-2">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Event Order Template
        </p>
        <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
        {template.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{template.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          A reusable template. Applying it to an event creates that event’s own structure — it is not itself a client commitment.
        </p>
      </header>

      {sections.length === 0 && template.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sections yet.</p>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => {
            const offerings = linesForSection(template.lines, section.id);
            return (
              <section key={section.id} className="space-y-3">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-heading">
                  {section.name}
                </h2>
                {section.guidance ? (
                  <p className="text-sm text-muted-foreground">{section.guidance}</p>
                ) : null}
                {offerings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No offerings in this section yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {offerings.map((line) => (
                      <li key={line.id} className="border-b border-border/70 pb-3 last:border-0">
                        <p className="text-sm font-medium text-heading">{line.description}</p>
                        {line.descriptionDetail ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">{line.descriptionDetail}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-foreground">{formatTemplateOfferingPrice(line)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {unsectionedLines(template.lines).length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-heading">
                Other offerings
              </h2>
              <ul className="space-y-3">
                {unsectionedLines(template.lines).map((line) => (
                  <li key={line.id} className="border-b border-border/70 pb-3 last:border-0">
                    <p className="text-sm font-medium text-heading">{line.description}</p>
                    <p className="mt-1 text-sm text-foreground">{formatTemplateOfferingPrice(line)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </article>
  );
}
