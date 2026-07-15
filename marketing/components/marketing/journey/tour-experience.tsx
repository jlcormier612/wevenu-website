import Image from "next/image";
import Link from "next/link";

import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { TourWorkspaceMock } from "@/components/marketing/journey/tour-workspace-mock";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";

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
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            Connected journey · 02
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl lg:text-7xl">
            Tour
          </h1>
          <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Time on property, remembered beautifully.
          </p>
          <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            Every visit becomes part of the same living booking. Notes, impressions,
            preferences, questions, and follow-ups stay connected from the moment your guests
            arrive.
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

      {/* ── Section 2 · Emotional Photography + Workspace ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-stretch gap-8 md:grid-cols-[3fr_2fr] md:gap-10">
          <div className="relative min-h-[420px] overflow-hidden md:min-h-[560px]">
            <Image
              src={FILM.tourGrounds}
              alt="Couple on the grounds of an elegant estate venue — a warm, natural tour moment"
              fill
              className="object-cover object-[center_35%]"
              sizes="(max-width:768px) 100vw, 60vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <TourWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every impression stays with the relationship.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3 · What Happens During a Tour ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {DURING_TOUR.map((card) => (
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
              Great tours create excitement.
              <br />
              Great follow-up creates trust.
            </h2>
            <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Most venues rely on memory, notebooks, or scattered emails after a tour.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Wevenu quietly preserves everything, so every future conversation feels like a
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

      {/* ── Section 5 · Product Showcase ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.35fr_0.65fr] md:gap-16">
          <TourWorkspaceMock className="min-h-[420px] overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-48px_rgba(47,55,47,0.4)] md:min-h-[480px]" />
          <div>
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Hospitality doesn&apos;t happen by accident.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              It happens when everyone remembers what matters.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              Wevenu gives your team shared context before every conversation.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Venue Moment ── */}
      <section className="relative min-h-[70vh] md:min-h-[85vh]">
        <Image
          src={FILM.tourVenueMoment}
          alt="Empty wooden ceremony chairs and aisle flowers in golden light — quiet before the day"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[rgba(47,55,47,0.38)]" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center text-[var(--true-white)] md:min-h-[85vh]">
          <p className="font-heading text-3xl italic leading-snug md:text-5xl">
            “The tour is where couples begin imagining their future.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-white/70 md:text-base">
            Wevenu makes sure your team remembers exactly what inspired it.
          </p>
        </div>
      </section>

      {/* ── Bottom Navigation ── */}
      <div className="py-28 md:py-36">
        <JourneyNav prev={prev} next={next} />
      </div>
    </div>
  );
}
