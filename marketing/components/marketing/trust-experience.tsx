import Image from "next/image";
import Link from "next/link";

import { TrustRule } from "@/components/marketing/brand-accents";
import { SignatureClosingCta } from "@/components/marketing/signature-closing-cta";
import { FILM } from "@/lib/marketing/film";
import {
  EDITORIAL_FRAME,
  EDITORIAL_IMAGE,
  HEADING_AFTER_EYEBROW,
  HOVER_LINK,
  SECTION_SCROLL,
  TYPE_LABEL,
  TYPE_MEASURE,
  TYPE_TITLE_TO_BODY,
} from "@/lib/marketing/rhythm";
import { TRUST_PAGE } from "@/lib/marketing/trust-page";

/** Match Pricing / Contact / Features — forest-sage headings, charcoal-muted body. */
const HEADING = "text-[var(--forest-sage)]";
const BODY_MUTED = "text-[rgba(36,51,43,0.68)]";
const TRUST_H2 =
  `font-heading text-[2.2rem] leading-[1.14] tracking-tight ${HEADING} md:text-[3.05rem] md:leading-[1.12]`;
/** Three-line ownership headline — same voice, slightly tighter stack. */
const TRUST_OWNERSHIP_H2 =
  `font-heading text-[2.05rem] leading-[1.2] tracking-tight ${HEADING} md:text-[2.85rem] md:leading-[1.16]`;
const TRUST_BODY = `text-base leading-[1.7] ${BODY_MUTED} md:text-lg`;
/** Soft emphasis line within a multi-line editorial heading. */
const EMPHASIS_LINE = "italic text-[var(--forest-sage)]/88";

/**
 * Trust experience — approved five-section editorial page.
 * Meaningful anchors: #data-ownership, #security, #privacy.
 */
export function TrustExperience() {
  const page = TRUST_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── 01 Hero ── */}
      <section
        className="border-b border-[var(--taupe-medium)]/35 bg-[var(--header-linen)] px-6 pt-[140px] pb-16 md:pb-24"
        aria-labelledby="trust-hero-heading"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14 xl:gap-16">
          <div className="max-w-xl">
            <TrustRule className="mb-5" />
            <p className={TYPE_LABEL}>{page.hero.eyebrow}</p>
            <h1
              id="trust-hero-heading"
              className={`mt-8 max-w-[11.5em] font-heading text-[2.45rem] font-medium leading-[1.1] tracking-tight ${HEADING} md:text-[3.35rem] md:leading-[1.08] lg:text-[3.65rem]`}
            >
              {page.hero.headlineLines.map((line, index) => (
                <span
                  key={line.text}
                  className={[
                    "block",
                    index > 0 ? "mt-1 md:mt-1.5" : "",
                    line.emphasis ? EMPHASIS_LINE : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {line.text}
                </span>
              ))}
            </h1>
            <p className={`mt-7 ${TRUST_BODY} ${TYPE_MEASURE}`}>
              {page.hero.body}
            </p>
            <p
              className={`mt-7 font-heading text-xl leading-snug ${HEADING} md:text-[1.35rem]`}
            >
              {page.hero.closing}
            </p>
          </div>

          <figure
            className={`relative mx-auto aspect-[16/10] w-full max-w-2xl lg:max-w-none ${EDITORIAL_FRAME}`}
          >
            <Image
              src={FILM.trustEarned}
              alt={page.hero.imageAlt}
              fill
              className={EDITORIAL_IMAGE}
              sizes="(max-width: 1024px) 100vw, 48vw"
              priority
            />
          </figure>
        </div>
      </section>

      {/* ── 02 Data Ownership ── */}
      <section
        id="data-ownership"
        className={`${SECTION_SCROLL} bg-[var(--true-white)]`}
        aria-labelledby="trust-data-heading"
      >
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TYPE_LABEL}>{page.dataOwnership.eyebrow}</p>
          <h2
            id="trust-data-heading"
            className={`${HEADING_AFTER_EYEBROW} max-w-[14em] ${TRUST_OWNERSHIP_H2}`}
          >
            {page.dataOwnership.headlineLines.map((line, index) => (
              <span
                key={line.text}
                className={[
                  "block",
                  index > 0 ? "mt-0.5 md:mt-1" : "",
                  line.emphasis ? EMPHASIS_LINE : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {line.text}
              </span>
            ))}
          </h2>
          <div
            className={`${TYPE_TITLE_TO_BODY} space-y-5 ${TRUST_BODY} ${TYPE_MEASURE}`}
          >
            {page.dataOwnership.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 Security & Reliability ── */}
      <section
        id="security"
        className={`${SECTION_SCROLL} border-y border-[var(--taupe-medium)]/30 bg-[var(--header-linen)]`}
        aria-labelledby="trust-security-heading"
      >
        <div className="mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <TrustRule className="mb-5" />
            <p className={TYPE_LABEL}>{page.security.eyebrow}</p>
            <h2
              id="trust-security-heading"
              className={`${HEADING_AFTER_EYEBROW} ${TRUST_H2}`}
            >
              {page.security.headline}
            </h2>
            <p className={`${TYPE_TITLE_TO_BODY} ${TRUST_BODY} ${TYPE_MEASURE}`}>
              {page.security.intro}
            </p>
          </div>

          <div className="mt-11 grid gap-x-12 md:mt-12 md:grid-cols-2">
            {page.security.commitments.map((item) => (
              <div
                key={item.title}
                className="border-t border-[var(--taupe-medium)]/35 py-7 md:py-8"
              >
                <h3 className={`font-heading text-xl ${HEADING} md:text-2xl`}>
                  {item.title}
                </h3>
                <p className={`mt-3 ${TRUST_BODY} ${TYPE_MEASURE}`}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 04 Privacy — shorter bottom pad for compact copy (section-local only) ── */}
      <section
        id="privacy"
        className="scroll-mt-28 bg-[var(--true-white)] px-6 pt-28 pb-20 md:pt-36 md:pb-28"
        aria-labelledby="trust-privacy-heading"
      >
        <div className="mx-auto max-w-3xl">
          <TrustRule className="mb-5" />
          <p className={TYPE_LABEL}>{page.privacy.eyebrow}</p>
          <h2
            id="trust-privacy-heading"
            className={`${HEADING_AFTER_EYEBROW} ${TRUST_H2}`}
          >
            {page.privacy.headline}
          </h2>
          <p className={`${TYPE_TITLE_TO_BODY} ${TRUST_BODY} ${TYPE_MEASURE}`}>
            {page.privacy.body}
          </p>
          <p className="mt-10">
            <Link
              href={page.privacy.cta.href}
              className={`font-heading text-xl ${HEADING} underline-offset-8 md:text-2xl ${HOVER_LINK}`}
            >
              {page.privacy.cta.label}
            </Link>
          </p>
        </div>
      </section>

      {/* ── 05 Closing ── */}
      <SignatureClosingCta
        id="trust-close"
        headingId="trust-closing-heading"
        headline={page.close.headline}
        body={page.close.body}
        bodyVariant="paragraphs"
        surface="botanical"
        primaryLabel={page.close.primaryCta.label}
      />
    </div>
  );
}
