import Image from "next/image";
import Link from "next/link";

import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { VendorsWorkspaceMock } from "@/components/marketing/journey/vendors-workspace-mock";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";

const PRINCIPLES = [
  {
    n: "01",
    title: "One Shared Celebration",
    body: "Every trusted partner contributes from the same plan instead of separate conversations.",
  },
  {
    n: "02",
    title: "Clear Expectations",
    body: "Arrival times, setup windows, responsibilities, and updates stay connected to the event.",
  },
  {
    n: "03",
    title: "Less Email",
    body: "Instead of forwarding information, your team simply keeps planning—and everyone stays informed.",
  },
] as const;

const FLOW = [
  "Venue Updates Timeline",
  "Vendor Automatically Sees Update",
  "Arrival Adjusted",
  "Everyone Prepared",
  "Event Runs Smoothly",
] as const;

type VendorsExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Vendors journey chapter — hospitality extended beyond your team.
 */
export function VendorsExperience({ prev, next }: VendorsExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            Connected journey · 07
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl lg:text-7xl">
            Vendors
          </h1>
          <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Every partner, perfectly informed.
          </p>
          <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            Florists, photographers, caterers, DJs, planners, and every trusted partner stay
            connected to the same celebration—without another chain of forwarded emails.
          </p>
          <div className="mt-14 flex flex-wrap items-center gap-5">
            <MarketingCta />
            <Link
              href="/product#connected-journey"
              className="text-sm tracking-wide text-[var(--forest-sage)]/55 underline-offset-4 transition hover:underline"
            >
              Back to Journey
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 2 · Hospitality + Product ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-stretch gap-8 md:grid-cols-[11fr_9fr] md:gap-10">
          <div className="relative min-h-[420px] overflow-hidden md:min-h-[560px]">
            <Image
              src={FILM.vendorsFlorist}
              alt="Florist arranging peach roses on a prepared reception table — calm professional hospitality"
              fill
              className="object-cover object-[center_35%]"
              sizes="(max-width:768px) 100vw, 55vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <VendorsWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every vendor sees exactly what they need—when they need it.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3 · Three Principles ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {PRINCIPLES.map((card) => (
            <div key={card.n} className="border-t border-[var(--taupe-medium)]/70 pt-8">
              <p className="font-heading text-sm text-[var(--heritage-sage)]/60">{card.n}</p>
              <h2 className="mt-4 font-heading text-2xl text-[var(--forest-sage)] md:text-3xl">
                {card.title}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--forest-sage)]/70 md:text-base">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4 · The Difference ── */}
      <section className="bg-[var(--warm-gray)] px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:items-start md:gap-20">
          <div>
            <h2 className="font-heading text-3xl font-medium leading-[1.15] text-[var(--forest-sage)] md:text-5xl">
              Better communication creates better celebrations.
            </h2>
            <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Vendors don&apos;t need another portal filled with features they&apos;ll never
              use.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              They simply need the right information at the right moment.
            </p>
          </div>
          <div>
            <ol className="space-y-0">
              {FLOW.map((label, i) => (
                <li key={label} className="flex flex-col items-start">
                  <span className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                    {label}
                  </span>
                  {i < FLOW.length - 1 ? (
                    <span
                      className="my-2 pl-1 text-lg leading-none text-[var(--heritage-sage)]/45"
                      aria-hidden
                    >
                      ↓
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Section 5 · Product Showcase ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.35fr_0.65fr] md:gap-16">
          <VendorsWorkspaceMock className="min-h-[420px] overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-48px_rgba(47,55,47,0.4)] md:min-h-[480px]" />
          <div>
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Relationships matter.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              The vendors you work with become extensions of your hospitality.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              Wevenu helps those relationships feel effortless.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Photography ── */}
      <section className="relative min-h-[70vh] md:min-h-[85vh]">
        <Image
          src={FILM.vendorsPhotograph}
          alt="Photographer framing a couple on the grounds — partners prepared as part of the celebration"
          fill
          className="object-cover object-[center_40%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[rgba(47,55,47,0.4)]" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center text-[var(--true-white)] md:min-h-[85vh]">
          <p className="font-heading text-3xl italic leading-snug md:text-5xl">
            “Great events happen when everyone arrives prepared.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-white/70 md:text-base">
            Hospitality extends far beyond your own staff.
          </p>
        </div>
      </section>

      {/* ── Section 7 · The Wevenu Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            Vendors shouldn&apos;t have to chase information.
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            <p>Every vendor doesn&apos;t need access to everything.</p>
            <p>
              They only need access to what helps them create an unforgettable celebration.
            </p>
            <p className="border-t border-[var(--taupe-medium)]/60 pt-8">
              That&apos;s why Wevenu shares information thoughtfully—so every partner feels
              included without feeling overwhelmed.
            </p>
          </div>
        </div>
      </section>

      {/* ── Bottom Navigation ── */}
      <div className="pb-28 md:pb-36">
        <JourneyNav prev={prev} next={next} />
      </div>
    </div>
  );
}
