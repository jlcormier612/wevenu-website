import Image from "next/image";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { TimelineWorkspaceMock } from "@/components/marketing/journey/timeline-workspace-mock";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

const PRINCIPLES = [
  {
    n: "01",
    title: "Built Naturally",
    body: "The timeline grows throughout planning instead of being recreated at the last minute.",
  },
  {
    n: "02",
    title: "Everyone Stays Aligned",
    body: "Venue staff, couples, and vendors all work from the same version of the day.",
  },
  {
    n: "03",
    title: "Calm on Event Day",
    body: "When everyone already knows the plan, hospitality can take center stage.",
  },
] as const;

const FLOW = [
  "Planning",
  "Timeline Builds Automatically",
  "Vendor Updates",
  "Couple Confirmations",
  "Everyone Prepared",
  "Celebration",
] as const;

type TimelineExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Timeline journey chapter — confidence before the celebration begins.
 */
export function TimelineExperience({ prev, next }: TimelineExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 08
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Timeline
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            The celebration is ready before the day begins.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Every conversation, planning decision, vendor update, and schedule change naturally
            becomes part of the event timeline—so everyone arrives knowing exactly what&apos;s
            happening.
          </p>
          <div className="mt-14 flex flex-wrap items-center gap-4">
            <MarketingCta />
            <MarketingCta
              href="/product#connected-journey"
              label="Back to Journey"
              variant="ghost"
            />
          </div>
        </div>
      </section>

      {/* ── Section 2 · Emotional Photography ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className={`relative mx-auto aspect-[16/10] max-w-6xl ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.timelineMorning}
            alt="Event timeline for Elena & James — every moment, perfectly planned"
            fill
            className={EDITORIAL_IMAGE}
            sizes="100vw"
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
              Great events begin long before guests arrive.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Event day shouldn&apos;t be spent answering questions.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              It should be spent welcoming people.
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
          <TimelineWorkspaceMock className={`min-h-[420px] md:min-h-[520px] ${EDITORIAL_FRAME} bg-[var(--true-white)]`} />
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Every moment has context.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              The timeline isn&apos;t another document.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              It&apos;s simply the story of the celebration—already connected to everything that
              came before it.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Photography (quote baked into image) ── */}
      <section
        className={`relative aspect-[16/10] w-full bg-[var(--taupe-light)] md:aspect-[1024/493] ${EDITORIAL_BLEED}`}
      >
        <Image
          src={FILM.timelineReady}
          alt="Wooden ceremony chairs and florals in warm light — preparation creates effortless event days"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
      </section>

      {/* ── Section 7 · The Hello to Cheers Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            Less reacting.
            <br />
            More welcoming.
          </h2>
          <div className="space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            <p>
              Because planning, vendors, conversations, and schedules have stayed connected from
              the beginning, event day becomes exactly what it should be:
            </p>
            <p>Not a scramble.</p>
            <p className="border-t border-[var(--taupe-medium)]/60 pt-8 font-heading text-2xl text-[var(--forest-sage)]">
              A celebration.
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
