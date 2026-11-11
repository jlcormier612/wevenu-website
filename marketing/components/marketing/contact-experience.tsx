import {
  HospitalityHeart,
  TrustRule,
} from "@/components/marketing/brand-accents";
import { LeadForm } from "@/components/marketing/lead-form";
import { CONTACT_PAGE } from "@/lib/marketing/contact-page";
import {
  HEADING_AFTER_EYEBROW,
  TYPE_BODY,
  TYPE_LABEL,
  TYPE_MEASURE,
  TYPE_TITLE_TO_BODY,
} from "@/lib/marketing/rhythm";

/** Match Pricing / Features / Our Story heading + body tokens. */
const HEADING = "text-[var(--forest-sage)]";
const BODY = "text-[rgba(36,51,43,0.88)]";
const CONTACT_H1 =
  `font-heading text-[2.35rem] font-medium leading-[1.14] tracking-tight ${HEADING} md:text-[3.5rem] md:leading-[1.12] lg:text-[3.85rem]`;

/**
 * Contact experience — centered editorial intro, shared LeadForm,
 * and a restrained personal closing (heart + line, no second CTA).
 */
export function ContactExperience() {
  const page = CONTACT_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      <section
        className="px-6 pt-[120px] pb-14 md:pt-[140px] md:pb-20"
        aria-labelledby="contact-intro-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <TrustRule className="mx-auto mb-4 md:mb-5" />
          <p className={TYPE_LABEL}>{page.intro.eyebrow}</p>
          <h1
            id="contact-intro-heading"
            className={`${HEADING_AFTER_EYEBROW} ${CONTACT_H1} text-balance`}
          >
            {page.intro.headline}
          </h1>
          <p
            className={`${TYPE_TITLE_TO_BODY} mx-auto ${TYPE_BODY} ${BODY} ${TYPE_MEASURE}`}
          >
            {page.intro.body}
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-lg md:mt-12">
          <div className="rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 shadow-[0_18px_40px_-34px_rgba(47,55,47,0.18)] md:px-8 md:py-10">
            <LeadForm
              intent="contact"
              submitLabel={page.form.submitLabel}
              messagePlaceholder={page.form.messagePlaceholder}
              buttonAccent="botanical"
            />
          </div>

          <div className="mt-8 flex flex-col items-center md:mt-9">
            {/*
              Static closing heart — do not use `.story-end-heart` here.
              That class starts at opacity:0 until `.is-lit` (scroll CTA only).
            */}
            <span
              className="inline-flex text-[var(--dusty-rose)]"
              aria-hidden
            >
              <HospitalityHeart size={16} className="!opacity-100" />
            </span>
            <p
              className={`mt-4 font-heading text-lg leading-snug ${HEADING} md:text-xl`}
            >
              {page.closing.line}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
