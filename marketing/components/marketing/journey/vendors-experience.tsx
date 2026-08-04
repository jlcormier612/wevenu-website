import Image from "next/image";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import {
  EDITORIAL_BLEED,
  EDITORIAL_FRAME,
  EDITORIAL_IMAGE,
  TYPE_HERO_SHELL,
} from "@/lib/marketing/rhythm";

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
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 07
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Vendors
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Every partner, perfectly informed.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Florists, photographers, caterers, DJs, planners, and every trusted partner stay
            connected to the same celebration—without another chain of forwarded emails.
          </p>
          <WalkthroughCtas className="mt-14">
            <MarketingCta
              href="/product#connected-journey"
              label="Back to Journey"
              variant="ghost"
            />
          </WalkthroughCtas>
        </div>
      </section>

      {/* ── Section 2 · Emotional Photography ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className={`relative mx-auto aspect-[16/10] max-w-6xl md:aspect-[2/1] ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.vendorsFlorist}
            alt="Vendor plan for Elena & James — partners confirmed, roles clear, everyone connected"
            fill
            className={EDITORIAL_IMAGE}
            sizes="(max-width:768px) 100vw, 1152px"
            priority
          />
        </div>
      </section>

      {/* ── Section 3 · Three Principles ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {PRINCIPLES.map((card) => (
            <div key={card.n} className="border-t border-[var(--taupe-medium)]/70 pt-8">
              <p className="font-heading text-sm text-[var(--heritage-sage)]/60">{card.n}</p>
              <h2 className="mt-4 font-heading text-2xl text-[var(--forest-sage)] md:text-[2.1rem]">
                {card.title}
              </h2>
              <p className="mt-4 text-sm leading-[1.7] text-[var(--forest-sage)]/70 md:text-base">
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
            <h2 className="font-heading text-[2.1rem] font-medium leading-[1.21] text-[var(--forest-sage)] md:text-[3.36rem]">
              Better communication creates better celebrations.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Vendors don&apos;t need another portal filled with features they&apos;ll never
              use.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
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
          <div>
            <div
              className={`relative aspect-[1024/545] ${EDITORIAL_FRAME} bg-[var(--linen)]`}
            >
              <Image
                src="/marketing/vendors-workspace-showcase-v2.jpg"
                alt="Vendor list for Elena & James — partners, assignments, florist timeline, and shared documents"
                fill
                className="object-contain object-center"
                sizes="(max-width:768px) 100vw, 720px"
              />
            </div>
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every vendor sees exactly what they need—when they need it.
            </p>
          </div>
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Relationships matter.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              The vendors you work with become extensions of your hospitality.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              Hello to Cheers helps those relationships feel effortless.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Photography ── */}
      <section className={`relative aspect-[16/10] w-full md:aspect-[2/1] ${EDITORIAL_BLEED}`}>
        <Image
          src={FILM.vendorsPhotograph}
          alt="Server finishing a candlelit reception table — great events happen when everyone arrives prepared"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
      </section>

      {/* ── Section 7 · The Hello to Cheers Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            Vendors shouldn&apos;t have to chase information.
          </h2>
          <div className="space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            <p>Every vendor doesn&apos;t need access to everything.</p>
            <p>
              They only need access to what helps them create an unforgettable celebration.
            </p>
            <p className="border-t border-[var(--taupe-medium)]/60 pt-8">
              That&apos;s why Hello to Cheers shares information thoughtfully—so every partner feels
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
