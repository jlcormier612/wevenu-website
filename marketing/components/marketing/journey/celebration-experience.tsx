import Image from "next/image";
import { CelebrationWhisper } from "@/components/marketing/brand-accents";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

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
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 12
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Celebration
          </h1>
          <p className="mt-4 font-heading text-2xl italic leading-snug whitespace-pre-line text-[var(--forest-sage)]/80 md:text-3xl">
            {"The celebration ends.\nThe relationship doesn't."}
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Photos, memories, reviews, referrals, and every detail of the event become part of a
            complete story—preserved long after the last guest goes home.
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
        <div className={`relative mx-auto aspect-[16/10] max-w-6xl ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.celebrationJoy}
            alt="Guests dancing under warm lights — the celebration ends, the relationship doesn't"
            fill
            className={EDITORIAL_IMAGE}
            sizes="(max-width:768px) 100vw, 1152px"
            priority
          />
          <CelebrationWhisper />
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

      {/* ── Section 4 · Emotional lifecycle ── */}
      <section className="bg-[var(--warm-gray)] px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:items-start md:gap-20">
          <div>
            <h2 className="font-heading text-[2.1rem] font-medium leading-[1.21] text-[var(--forest-sage)] md:text-[3.36rem]">
              Great hospitality deserves to be remembered.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              A successful celebration isn&apos;t just measured by one beautiful day.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              It&apos;s measured by the memories it creates, the confidence it builds, and the
              relationships it inspires afterward.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Technology shouldn&apos;t disappear when the event ends.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
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
          <div>
            <div
              className={`relative aspect-[1024/635] ${EDITORIAL_FRAME} bg-[var(--linen)]`}
            >
              <Image
                src="/marketing/celebration-workspace-showcase-v2.jpg"
                alt="Completed event for Elena & James — financial summary, finished work, reviews, gallery, and what continues"
                fill
                className="object-contain object-center"
                sizes="(max-width:768px) 100vw, 720px"
              />
            </div>
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every celebration becomes a lasting record instead of disappearing into archived
              emails.
            </p>
          </div>
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Your best work deserves a permanent home.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              Instead of closing files and starting over, every celebration remains part of your
              venue&apos;s growing history.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Lifestyle Photography ── */}
      <section className={`relative aspect-[16/10] w-full md:aspect-[1024/596] ${EDITORIAL_BLEED}`}>
        <Image
          src={FILM.celebrationNight}
          alt="Nighttime reception with string lights glowing — the story continues after the music"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
        <CelebrationWhisper className="top-6 right-6 md:top-8 md:right-10" />
      </section>

      {/* ── Bottom Navigation ── */}
      <div className="pb-28 md:pb-36">
        <JourneyNav prev={prev} next={next} />
      </div>
    </div>
  );
}
