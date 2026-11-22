"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { TrustRule } from "@/components/marketing/brand-accents";
import { CalendlyEmbed } from "@/components/marketing/calendly-embed";
import { ClosingCta } from "@/components/marketing/closing-cta";
import {
  LeadForm,
  type LeadFormSuccessPayload,
} from "@/components/marketing/lead-form";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import {
  EDITORIAL_FRAME,
  EDITORIAL_IMAGE,
  HEADING_AFTER_EYEBROW,
  SECTION_SCROLL,
  TYPE_BODY,
  TYPE_LABEL,
  TYPE_MEASURE,
  TYPE_TITLE_TO_BODY,
} from "@/lib/marketing/rhythm";
import { WALKTHROUGH_PAGE } from "@/lib/marketing/walkthrough-page";

/** Charcoal ink — matches Trust / Homepage, not green body text */
const INK = "text-[#24332b]";
const INK_MUTED = "text-[rgba(36,51,43,0.68)]";
/** Desktop hero title preserved; mobile modestly tightened for balance */
const WALKTHROUGH_H1 =
  `font-heading text-[2.35rem] font-medium leading-[1.14] tracking-tight ${INK} md:text-[3.5rem] md:leading-[1.12] lg:text-[3.85rem]`;
const WALKTHROUGH_H2 =
  `font-heading text-[2.1rem] leading-[1.14] tracking-tight ${INK} md:text-[3.4rem] md:leading-[1.12]`;

type WalkthroughExperienceProps = {
  /** Resolved Calendly URL, or null when booking is not configured. */
  calendlyUrl: string | null;
};

/**
 * Schedule a Walkthrough — intro → shared HTC intake → Calendly (after CRM save).
 * Intake fields match Contact. Calendly is gated behind durable relationship create/match.
 */
export function WalkthroughExperience({
  calendlyUrl,
}: WalkthroughExperienceProps) {
  const page = WALKTHROUGH_PAGE;
  const [intake, setIntake] = useState<LeadFormSuccessPayload | null>(null);

  const calendlyPrefill = useMemo(
    () =>
      intake
        ? {
            name: `${intake.firstName} ${intake.lastName}`.trim(),
            email: intake.email,
            handoffToken: intake.handoffToken,
          }
        : null,
    [intake],
  );

  return (
    <div className="bg-[var(--true-white)]">
      {/* ── 01 Editorial introduction ── */}
      <section
        className="border-b border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 pt-[120px] pb-12 md:pt-[140px] md:pb-24"
        aria-labelledby="walkthrough-intro-heading"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-7 md:gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14 xl:gap-16">
          <div className="max-w-xl">
            <TrustRule className="mb-4 md:mb-5" />
            <p className={TYPE_LABEL}>{page.intro.eyebrow}</p>
            <h1
              id="walkthrough-intro-heading"
              className={`mt-6 md:mt-8 ${WALKTHROUGH_H1}`}
            >
              {page.intro.headline}
            </h1>
            <p
              className={`mt-5 md:mt-7 ${TYPE_BODY} ${INK_MUTED} ${TYPE_MEASURE}`}
            >
              {page.intro.body}
            </p>
            <p
              className={`mt-5 font-heading text-[1.2rem] leading-snug ${INK} md:mt-7 md:text-[1.35rem]`}
            >
              {page.intro.closing}
            </p>
          </div>

          <figure
            className={`relative mx-auto aspect-[16/10] w-full max-w-2xl lg:max-w-none ${EDITORIAL_FRAME}`}
          >
            <Image
              src={page.intro.imageSrc}
              alt={page.intro.imageAlt}
              fill
              className={`${EDITORIAL_IMAGE} object-[center_42%]`}
              sizes="(max-width: 1024px) 100vw, 48vw"
              priority
            />
          </figure>
        </div>
      </section>

      {/* ── 02 Unified HTC intake (same fields as Contact) ── */}
      <section
        id="intake"
        className={`${SECTION_SCROLL} bg-[var(--true-white)]`}
        aria-labelledby="walkthrough-intake-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <TrustRule className="mx-auto mb-5" />
          <h2
            id="walkthrough-intake-heading"
            className={`${HEADING_AFTER_EYEBROW} ${WALKTHROUGH_H2}`}
          >
            {page.intake.headline}
          </h2>
          <p
            className={`${TYPE_TITLE_TO_BODY} mx-auto ${TYPE_BODY} ${INK_MUTED} ${TYPE_MEASURE}`}
          >
            {page.intake.body}
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-lg md:mt-12">
          {!intake ? (
            <div className="rounded-[2rem] border border-[var(--taupe-light)] bg-[var(--true-white)] px-6 py-8 shadow-[0_18px_40px_-34px_rgba(47,55,47,0.18)] md:px-8 md:py-10">
              <LeadForm
                intent="walkthrough"
                submitLabel={page.intake.submitLabel}
                messagePlaceholder={page.intake.messagePlaceholder}
                buttonAccent="botanical"
                onSuccess={(payload) => {
                  setIntake(payload);
                  // Reveal calendar without losing the intake confirmation.
                  requestAnimationFrame(() => {
                    document
                      .getElementById("schedule")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              />
            </div>
          ) : (
            <p
              className={`mx-auto ${TYPE_BODY} ${INK_MUTED} ${TYPE_MEASURE}`}
              role="status"
            >
              {page.booking.afterIntake}
            </p>
          )}
        </div>
      </section>

      {/* ── 03 Calendly — only after durable intake ── */}
      {intake ? (
        <section
          id="schedule"
          className={`${SECTION_SCROLL} border-t border-[var(--taupe-medium)]/40 bg-[var(--true-white)]`}
          aria-labelledby="walkthrough-booking-heading"
        >
          <div className="mx-auto max-w-4xl text-center">
            <TrustRule className="mx-auto mb-5" />
            <h2
              id="walkthrough-booking-heading"
              className={`${HEADING_AFTER_EYEBROW} ${WALKTHROUGH_H2}`}
            >
              {calendlyUrl
                ? page.booking.headline
                : page.bookingUnavailable.headline}
            </h2>
            <p
              className={`${TYPE_TITLE_TO_BODY} mx-auto ${TYPE_BODY} ${INK_MUTED} ${TYPE_MEASURE}`}
            >
              {calendlyUrl ? page.booking.body : page.bookingUnavailable.body}
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-4xl md:mt-14">
            {calendlyUrl ? (
              <CalendlyEmbed
                url={calendlyUrl}
                labelledBy="walkthrough-booking-heading"
                prefill={calendlyPrefill}
              />
            ) : (
              <div className="rounded-sm border border-[var(--taupe-medium)]/45 bg-[var(--linen)]/55 px-6 py-10 text-center md:px-10 md:py-12">
                <p className={`mx-auto ${TYPE_BODY} ${INK_MUTED} ${TYPE_MEASURE}`}>
                  Online scheduling is not available yet. We&apos;ve saved your
                  walkthrough request and will follow up personally.
                </p>
                <div className="mt-8 flex justify-center">
                  <MarketingCta
                    href={page.bookingUnavailable.cta.href}
                    label={page.bookingUnavailable.cta.label}
                    variant="secondary"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ── 04 Quiet Contact alternative — compact closing ── */}
      <section
        className="scroll-mt-28 border-t border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-14 md:py-20"
        aria-labelledby="walkthrough-contact-heading"
      >
        <div className="mx-auto max-w-3xl text-center">
          <TrustRule className="mx-auto mb-4 md:mb-5" />
          <h2
            id="walkthrough-contact-heading"
            className={`${HEADING_AFTER_EYEBROW} ${WALKTHROUGH_H2}`}
          >
            {page.contactAlternative.headline}
          </h2>
          <p
            className={`mt-5 mx-auto md:mt-6 ${TYPE_BODY} ${INK_MUTED} ${TYPE_MEASURE}`}
          >
            {page.contactAlternative.body}
          </p>
          <ClosingCta className="mt-6 md:mt-7">
            <MarketingCta
              href={page.contactAlternative.cta.href}
              label={page.contactAlternative.cta.label}
              variant="primary"
            />
          </ClosingCta>
        </div>
      </section>
    </div>
  );
}
