import Image from "next/image";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

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
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 11
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Guest Portal
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Every guest arrives a little more prepared.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Guests receive a beautifully organized event experience with everything they
            need—from invitations and RSVPs to directions, accommodations, schedules, and helpful
            updates—all in one welcoming place.
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
            src={FILM.guestArrive}
            alt="Guest portal welcome on a phone — every guest arrives a little more prepared"
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
              Hospitality starts before the first hello.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              The guest experience doesn&apos;t begin when someone walks through your doors.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              It begins the first time they look for directions, RSVP, book a hotel, or wonder what
              to expect.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
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
          <div>
            <div
              className={`relative aspect-[1024/634] ${EDITORIAL_FRAME} bg-[var(--linen)]`}
            >
              <Image
                src="/marketing/guest-workspace-showcase-v2.jpg"
                alt="Guest portal for Elena & James — invitation, RSVP, day-of schedule, travel, stay, and helpful links"
                fill
                className="object-contain object-center"
                sizes="(max-width:768px) 100vw, 720px"
              />
            </div>
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Guests spend less time asking questions—and more time looking forward to the
              celebration.
            </p>
          </div>
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Beautifully organized.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              Guests shouldn&apos;t have to search through emails to find important information.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              Everything they need is always exactly where they expect it.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Lifestyle Photography ── */}
      <section className={`relative aspect-[16/10] w-full md:aspect-[1024/499] ${EDITORIAL_BLEED}`}>
        <Image
          src={FILM.guestCelebrate}
          alt="Candlelit reception table — when guests feel informed, they arrive ready to celebrate"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
      </section>

      {/* ── Section 7 · The Hello to Cheers Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            Less administration.
            <br />
            More hospitality.
          </h2>
          <div className="space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
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
