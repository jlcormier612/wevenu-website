import Image from "next/image";
import Link from "next/link";

import { GuestWorkspaceMock } from "@/components/marketing/journey/guest-workspace-mock";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";

const PRINCIPLES = [
  {
    n: "01",
    title: "Everything Guests Need",
    body: "Directions, schedules, accommodations, FAQs, and important updates all live together.",
  },
  {
    n: "02",
    title: "Fewer Questions",
    body: "Because the answers are already waiting for them.",
  },
  {
    n: "03",
    title: "A Better First Impression",
    body: "Your hospitality begins before guests ever arrive.",
  },
] as const;

const FLOW = ["Invitation", "Guest Portal", "RSVP", "Travel", "Celebration"] as const;

type GuestExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Guest Portal journey chapter — informed guests, quieter teams, better arrivals.
 */
export function GuestExperience({ prev, next }: GuestExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            Connected journey · 11
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl lg:text-7xl">
            Guest Portal
          </h1>
          <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Every guest arrives a little more prepared.
          </p>
          <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            Guests receive a beautifully organized event experience with everything they
            need—from invitations and RSVPs to directions, accommodations, schedules, and helpful
            updates—all in one welcoming place.
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
              src={FILM.guestArrive}
              alt="Guests gathered for an outdoor celebration — arriving informed and ready for a wonderful day"
              fill
              className="object-cover object-[center_40%]"
              sizes="(max-width:768px) 100vw, 55vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <GuestWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Guests spend less time asking questions—and more time looking forward to the
              celebration.
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
              Hospitality starts before the first hello.
            </h2>
            <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              The guest experience doesn&apos;t begin when someone walks through your doors.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              It begins the first time they look for directions, RSVP, book a hotel, or wonder what
              to expect.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              A thoughtful experience beforehand creates a smoother celebration for everyone.
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
            <p className="mt-10 font-heading text-xl italic text-[var(--forest-sage)]/70 md:text-2xl">
              One continuous experience.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 5 · Product Showcase ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.35fr_0.65fr] md:gap-16">
          <GuestWorkspaceMock className="min-h-[420px] overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-48px_rgba(47,55,47,0.4)] md:min-h-[520px]" />
          <div>
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Beautifully organized.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              Guests shouldn&apos;t have to search through emails to find important information.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              Everything they need is always exactly where they expect it.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Lifestyle Photography ── */}
      <section className="relative min-h-[70vh] md:min-h-[85vh]">
        <Image
          src={FILM.guestCelebrate}
          alt="Warm celebration with friends toasting — hospitality that feels natural"
          fill
          className="object-cover object-[center_35%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[rgba(47,55,47,0.42)]" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center text-[var(--true-white)] md:min-h-[85vh]">
          <p className="font-heading text-3xl italic leading-snug md:text-5xl">
            “When guests feel informed, they arrive ready to celebrate.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-white/70 md:text-base">
            Thoughtful experiences create memorable celebrations long before the ceremony begins.
          </p>
        </div>
      </section>

      {/* ── Section 7 · The Wevenu Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            Less administration.
            <br />
            More hospitality.
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            <p>Every answered question is one less interruption for your team.</p>
            <p>Every informed guest arrives more relaxed.</p>
            <p>Every smooth arrival creates a better experience for everyone involved.</p>
            <p className="border-t border-[var(--taupe-medium)]/60 pt-8 font-heading text-2xl text-[var(--forest-sage)]">
              That&apos;s the quiet value of thoughtful technology.
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
