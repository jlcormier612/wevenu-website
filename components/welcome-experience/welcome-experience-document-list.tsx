/**
 * Quiet document list for the Welcome Experience (titles + meta only).
 */

import {
  formatWelcomeEffectiveDate,
} from "./welcome-experience-helpers";
import type { WelcomeExperienceDocument } from "./types";

export function WelcomeExperienceDocumentList({
  documents,
}: {
  documents: readonly WelcomeExperienceDocument[];
}) {
  if (documents.length === 0) return null;

  return (
    <ul className="mt-8 space-y-4" aria-label="Documents to review">
      {documents.map((doc) => {
        const key = doc.id ?? `${doc.title}-${doc.version}`;
        return (
          <li
            key={key}
            className="flex flex-col gap-1 border-t border-[color-mix(in_srgb,var(--taupe-medium)_35%,transparent)] pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--forest-sage)]">
                {doc.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[color-mix(in_oklch,var(--forest-sage)_58%,transparent)]">
                Version {doc.version}
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
                Effective {formatWelcomeEffectiveDate(doc.effectiveDate)}
              </p>
            </div>
            <a
              href={doc.viewHref}
              target="_blank"
              rel="noreferrer"
              className="mt-1 shrink-0 text-sm font-medium text-[var(--heritage-sage)] underline-offset-4 transition-opacity hover:underline hover:opacity-80 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--heritage-sage)]/40 sm:mt-0"
            >
              View →
            </a>
          </li>
        );
      })}
    </ul>
  );
}
