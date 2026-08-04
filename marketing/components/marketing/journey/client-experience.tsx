import Image from "next/image";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

const PRINCIPLES = [
  {
    n: "01",
    title: "It Feels Like Your Venue",
    body: "Your branding, personality, and hospitality continue long after the tour.",
  },
  {
    n: "02",
    title: "Everything in One Place",
    body: "Plans, documents, conversations, payments, and timelines stay beautifully organized together.",
  },
  {
    n: "03",
    title: "Less Confusion",
    body: "Instead of asking where something is, couples simply know where to go.",
  },
] as const;

const FLOW = [
  "Visit Venue",
  "Book Event",
  "Portal Opens",
  "Planning Continues",
  "Celebration",
] as const;

type ClientExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Client Experience journey chapter (formerly Client Portal & Website).
 * Hospitality that continues online — not another login.
 */
export function ClientExperience({ prev, next }: ClientExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 10
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Client Experience
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Your hospitality doesn&apos;t stop after the tour.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Every booking includes a beautiful planning experience that reflects your
            venue—bringing together details, planning, communication, and next steps in one calm
            place your couples will actually enjoy using.
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
            src={FILM.clientHome}
            alt="Guests celebrating together at a warm evening table — hospitality that continues"
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
              Hospitality shouldn&apos;t end when the meeting does.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Couples remember how a venue made them feel.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              That experience shouldn&apos;t disappear the moment they leave your property.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Hello to Cheers extends that same calm, thoughtful experience into every stage of planning.
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
              The feeling never changes.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 5 · Product Showcase ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.35fr_0.65fr] md:gap-16">
          <div>
            <div
              className={`relative aspect-[1024/987] ${EDITORIAL_FRAME} bg-[var(--linen)]`}
            >
              <Image
                src="/marketing/client-workspace-showcase-v3.jpg"
                alt="Willow & Hearth client portal — planning progress, upcoming tasks, messages, timeline, and documents"
                fill
                className="object-contain object-center"
                sizes="(max-width:768px) 100vw, 720px"
              />
            </div>
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every couple experiences your hospitality—even between conversations.
            </p>
          </div>
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Built for reassurance.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              Couples aren&apos;t looking for software.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              They&apos;re looking for confidence that everything is under control.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              The portal quietly provides that confidence every time they log in.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Photography ── */}
      <section className={`relative aspect-[16/10] w-full md:aspect-[1024/568] ${EDITORIAL_BLEED}`}>
        <Image
          src={FILM.clientWarm}
          alt="Bride and groom celebrate as guests toss petals — hospitality that begins long before the day"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
      </section>

      {/* ── Section 7 · The Hello to Cheers Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            A portal people actually enjoy using.
          </h2>
          <div className="space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            <p>Most client portals feel like administrative tools.</p>
            <p>Hello to Cheers feels like an extension of your hospitality.</p>
            <p>
              Every detail is designed to make planning feel calm, personal, and beautifully
              organized—so couples remember how easy it was to work with your venue.
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
