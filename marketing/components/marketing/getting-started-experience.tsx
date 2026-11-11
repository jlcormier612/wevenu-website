import Image from "next/image";
import Link from "next/link";

import { SignatureClosingCta } from "@/components/marketing/signature-closing-cta";
import { GETTING_STARTED_PAGE } from "@/lib/marketing/getting-started-page";
import { TYPE_HERO_SHELL, TYPE_LABEL } from "@/lib/marketing/rhythm";

/**
 * Introductory Getting Started page — accurate claims only.
 */
export function GettingStartedExperience() {
  const page = GETTING_STARTED_PAGE;

  return (
    <div className="bg-[var(--true-white)]">
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className={`${TYPE_LABEL} text-[var(--heritage-sage)]`}>{page.hero.kicker}</p>
          <h1 className="mt-5 font-heading text-[2.52rem] font-medium leading-[1.16] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem]">
            {page.hero.headline}
          </h1>
          <p className="mt-8 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            {page.hero.lede}
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="space-y-8">
            {page.principles.map((item) => (
              <article key={item.title} className="max-w-[48ch]">
                <h2 className="font-heading text-[1.55rem] font-medium tracking-tight text-[var(--forest-sage)] md:text-[1.85rem]">
                  {item.title}
                </h2>
                <p className="mt-3 text-base leading-[1.7] text-[var(--forest-sage)]/75">
                  {item.body}
                </p>
              </article>
            ))}
          </div>

          <figure className="overflow-hidden rounded-[1.25rem] border border-[var(--taupe-medium)]/40 bg-white shadow-[0_28px_56px_-40px_rgba(36,51,43,0.4)]">
            <Image
              src="/marketing/homepage-v3/setup-hub.png"
              alt="Hello to Cheers Setup Hub — guided venue configuration"
              width={1100}
              height={720}
              className="h-auto w-full object-cover object-top"
            />
            <figcaption className="px-5 py-4 text-sm text-[var(--forest-sage)]/65">
              Setup Hub — authentic Sandbox configuration experience
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-[65ch]">
          <h2 className="font-heading text-[2rem] font-medium tracking-tight text-[var(--forest-sage)] md:text-[2.6rem]">
            {page.importHonesty.title}
          </h2>
          <div className="mt-6 space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg">
            {page.importHonesty.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--taupe-medium)]/40 bg-[var(--calm-blue,#eaf1f7)] px-6 py-20 md:py-28">
        <div className="mx-auto max-w-[65ch]">
          <h2 className="font-heading text-[2rem] font-medium tracking-tight text-[var(--forest-sage)] md:text-[2.6rem]">
            {page.whiteGlove.title}
          </h2>
          <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg">
            {page.whiteGlove.body}
          </p>
          <div className="mt-10">
            <Link
              href={page.whiteGlove.cta.href}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--botanical,#446b56)] px-6 text-sm font-medium text-white transition hover:opacity-90"
            >
              {page.whiteGlove.cta.label}
            </Link>
          </div>
        </div>
      </section>

      <SignatureClosingCta
        headingId="getting-started-close-heading"
        headline={page.nextSteps.title}
        body={page.nextSteps.body}
        bodyVariant="paragraphs"
        surface="white"
        actions={[
          {
            href: page.nextSteps.primaryCta.href,
            label: page.nextSteps.primaryCta.label,
            variant: "secondary",
          },
          {
            href: page.nextSteps.secondaryCta.href,
            label: page.nextSteps.secondaryCta.label,
            variant: "primary",
          },
          {
            href: page.nextSteps.tertiaryCta.href,
            label: page.nextSteps.tertiaryCta.label,
            variant: "secondary",
          },
        ]}
      />
    </div>
  );
}
