import Image from "next/image";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { TourWorkspaceMock } from "@/components/marketing/journey/tour-workspace-mock";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

const DURING_TOUR = [
  {
    n: "01",
    title: "Every Detail Captured",
    body: "Questions, preferences, favorite spaces, family notes, and conversations become part of the booking automatically.",
  },
  {
    n: "02",
    title: "Follow-Up Feels Personal",
    body: "When you reach out afterward, everyone remembers exactly what mattered most.",
  },
  {
    n: "03",
    title: "One Shared Understanding",
    body: "Sales, planning, and ownership all see the same conversation—without asking anyone to repeat themselves.",
  },
] as const;

const TOUR_FLOW = ["Tour", "Notes", "Follow-up", "Proposal"] as const;

type TourExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Tour journey chapter — aspirational, immersive.
 * The tour shouldn't end when the couple leaves.
 */
export function TourExperience({ prev, next }: TourExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 02
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Tour
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Time on property, remembered beautifully.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Every visit becomes part of the same living booking. Notes, impressions,
            preferences, questions, and follow-ups stay connected from the moment your guests
            arrive.
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

      {/* ── Section 2 · Emotional Photography + Workspace ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-start gap-8 md:grid-cols-[3fr_2fr] md:gap-10">
          <div className={`relative aspect-[16/10] w-full md:aspect-[5/3] ${EDITORIAL_FRAME}`}>
            <Image
              src={FILM.tourGrounds}
              alt="Open doors onto a sunlit courtyard — time on property, remembered"
              fill
              className={EDITORIAL_IMAGE}
              sizes="(max-width:768px) 100vw, 60vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center self-stretch">
            <TourWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every impression stays with the relationship.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3 · What Happens During a Tour ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {DURING_TOUR.map((card) => (
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
              Great tours create excitement.
              <br />
              Great follow-up creates trust.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Most venues rely on memory, notebooks, scattered emails, or disconnected systems after a tour.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Hello to Cheers quietly preserves everything, so every future conversation feels like a
              continuation—not a restart.
            </p>
          </div>
          <div>
            <ol className="space-y-0">
              {TOUR_FLOW.map((label, i) => (
                <li key={label} className="flex flex-col items-start">
                  <span className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                    {label}
                  </span>
                  {i < TOUR_FLOW.length - 1 ? (
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
            <p className="mt-8 text-sm tracking-wide text-[var(--forest-sage)]/50">
              One uninterrupted line.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Venue Moment ── */}
      <section className={`relative aspect-[16/10] w-full md:aspect-[1024/485] ${EDITORIAL_BLEED}`}>
        <Image
          src={FILM.tourVenueMoment}
          alt="Venue host touring a couple through a candlelit outdoor setup — where imagination begins"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
      </section>

      {/* ── Bottom Navigation ── */}
      <div className="py-28 md:py-36">
        <JourneyNav prev={prev} next={next} />
      </div>
    </div>
  );
}
