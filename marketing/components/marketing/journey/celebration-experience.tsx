import Image from "next/image";
import Link from "next/link";

import { CelebrationWorkspaceMock } from "@/components/marketing/journey/celebration-workspace-mock";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";

const PRINCIPLES = [
  {
    n: "01",
    title: "Nothing Gets Lost",
    body: "Every conversation, payment, document, timeline, and decision remains part of the event history.",
  },
  {
    n: "02",
    title: "Learn From Every Event",
    body: "Past celebrations become valuable references for future bookings and your growing team.",
  },
  {
    n: "03",
    title: "The Next Relationship Begins",
    body: "Reviews, referrals, anniversaries, and future celebrations naturally continue from the same story.",
  },
] as const;

const LIFECYCLE = [
  { label: "Inquiry", kind: "text" as const },
  { label: "Tour", kind: "text" as const },
  { label: "Proposal", kind: "text" as const },
  { label: "Planning", kind: "text" as const },
  { label: "Celebration", kind: "text" as const },
  { label: "heart", kind: "heart" as const },
  { label: "Next Inquiry", kind: "text" as const },
];

type CelebrationExperienceProps = {
  prev: { id: string; title: string };
  next?: { id: string; title: string } | null;
};

/**
 * Celebration journey chapter — the relationship continues; the thread never drops.
 */
export function CelebrationExperience({ prev, next }: CelebrationExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            Connected journey · 12
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl lg:text-7xl">
            Celebration
          </h1>
          <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            The celebration ends. The relationship doesn&apos;t.
          </p>
          <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            Photos, memories, reviews, referrals, and every detail of the event become part of a
            complete story—preserved long after the last guest goes home.
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

      {/* ── Section 2 · Lifestyle + Product ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-stretch gap-8 md:grid-cols-[11fr_9fr] md:gap-10">
          <div className="relative min-h-[420px] overflow-hidden md:min-h-[560px]">
            <Image
              src={FILM.celebrationJoy}
              alt="Joy on the day — the relationship continues afterward"
              fill
              className="object-cover object-[center_30%]"
              sizes="(max-width:768px) 100vw, 55vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <CelebrationWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every celebration becomes a lasting record instead of disappearing into archived
              emails.
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

      {/* ── Section 4 · Emotional lifecycle ── */}
      <section className="bg-[var(--warm-gray)] px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:items-start md:gap-20">
          <div>
            <h2 className="font-heading text-3xl font-medium leading-[1.15] text-[var(--forest-sage)] md:text-5xl">
              Great hospitality deserves to be remembered.
            </h2>
            <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              A successful celebration isn&apos;t just measured by one beautiful day.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              It&apos;s measured by the memories it creates, the confidence it builds, and the
              relationships it inspires afterward.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Technology shouldn&apos;t disappear when the event ends.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              It should help preserve everything that made it meaningful.
            </p>
          </div>
          <div>
            <ol className="space-y-0">
              {LIFECYCLE.map((item, i) => (
                <li key={`${item.label}-${i}`} className="flex flex-col items-start">
                  {item.kind === "heart" ? (
                    <span
                      className="font-heading text-2xl leading-none text-[var(--heritage-sage)] md:text-3xl"
                      aria-label="Love and relationship"
                    >
                      ♥
                    </span>
                  ) : (
                    <span className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                      {item.label}
                    </span>
                  )}
                  {i < LIFECYCLE.length - 1 ? (
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
          <CelebrationWorkspaceMock className="min-h-[420px] overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-48px_rgba(47,55,47,0.4)] md:min-h-[520px]" />
          <div>
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Your best work deserves a permanent home.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              Instead of closing files and starting over, every celebration remains part of your
              venue&apos;s growing history.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Lifestyle Photography ── */}
      <section className="relative min-h-[70vh] md:min-h-[85vh]">
        <Image
          src={FILM.celebrationNight}
          alt="Nighttime reception with string lights glowing — the story continues after the music"
          fill
          className="object-cover object-[center_40%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[rgba(47,55,47,0.42)]" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center text-[var(--true-white)] md:min-h-[85vh]">
          <p className="font-heading text-3xl italic leading-snug md:text-5xl">
            “Long after the music ends, the story remains.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-white/70 md:text-base">
            The best events deserve more than an archived folder.
            <br />
            They deserve to become part of your venue&apos;s legacy.
          </p>
        </div>
      </section>

      {/* ── Bottom Navigation ── */}
      <div className="pb-28 md:pb-36">
        <JourneyNav prev={prev} next={next} />
      </div>
    </div>
  );
}
