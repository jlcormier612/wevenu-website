import Image from "next/image";
import { FloorWorkspaceMock } from "@/components/marketing/journey/floor-workspace-mock";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

const PRINCIPLES = [
  {
    n: "01",
    title: "One Living Layout",
    body: "Floor plans stay connected to the booking instead of becoming separate documents.",
  },
  {
    n: "02",
    title: "Built Around Reality",
    body: "Guest counts, inventory, and room layouts evolve together as plans change.",
  },
  {
    n: "03",
    title: "Ready Before Setup",
    body: "When setup begins, your team already knows exactly what belongs where.",
  },
] as const;

const FLOW = [
  "Guest Count Changes",
  "Layout Reviewed",
  "Inventory Confirmed",
  "Room Prepared",
  "Setup Begins",
  "Celebration Ready",
] as const;

type FloorExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Floor & Seating Plans journey chapter (nav: Floor Plans).
 * Quiet confidence that the room you'll build matches the plan.
 */
export function FloorExperience({ prev, next }: FloorExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 09
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Floor & Seating Plans
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Every space prepared with confidence.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Floor plans, seating layouts, inventory, and guest counts stay connected to the same
            booking—so the room you&apos;re preparing is always the room you&apos;re expecting.
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
            src={FILM.floorReady}
            alt="Floor plan for Elena & James — every table, seat, and space prepared with confidence"
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
              The room shouldn&apos;t surprise you.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Changes happen.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Guest counts grow.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Tables move.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Packages evolve.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Hello to Cheers helps ensure the room reflects those changes before setup begins—not after.
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
          <FloorWorkspaceMock className={`min-h-[420px] md:min-h-[520px] ${EDITORIAL_FRAME} bg-[var(--true-white)]`} />
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Every placement has context.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              Your floor plan isn&apos;t just a drawing.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              It&apos;s connected to the people, inventory, and celebration it was created for.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Photography ── */}
      <section className={`relative aspect-[16/10] w-full md:aspect-[1024/557] ${EDITORIAL_BLEED}`}>
        <Image
          src={FILM.floorPrep}
          alt="Venue plans and seating arrangements on a wooden table — thoughtful preparation before the celebration"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
      </section>

      {/* ── Section 7 · The Hello to Cheers Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            Confidence before setup begins.
          </h2>
          <div className="space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            <p>Every room changes as planning evolves.</p>
            <p>
              The difference is knowing those changes before anyone starts moving tables.
            </p>
            <p>
              Because Hello to Cheers keeps your floor plans connected to the event—not disconnected from
              it—your team can prepare with confidence instead of discovering surprises during
              setup.
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
