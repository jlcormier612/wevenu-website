import Image from "next/image";
import Link from "next/link";

import { ClientWorkspaceMock } from "@/components/marketing/journey/client-workspace-mock";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";

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
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            Connected journey · 10
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl lg:text-7xl">
            Client Experience
          </h1>
          <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Your hospitality doesn&apos;t stop after the tour.
          </p>
          <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            Every booking includes a beautiful planning experience that reflects your
            venue—bringing together details, planning, communication, and next steps in one calm
            place your couples will actually enjoy using.
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
              src={FILM.clientHome}
              alt="Couple laughing together outdoors — planning that feels enjoyable, not administrative"
              fill
              className="object-cover object-[center_35%]"
              sizes="(max-width:768px) 100vw, 55vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <ClientWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every couple experiences your hospitality—even between conversations.
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
              Hospitality shouldn&apos;t end when the meeting does.
            </h2>
            <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Couples remember how a venue made them feel.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              That experience shouldn&apos;t disappear the moment they leave your property.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Wevenu extends that same calm, thoughtful experience into every stage of planning.
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
          <ClientWorkspaceMock className="min-h-[420px] overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-48px_rgba(47,55,47,0.4)] md:min-h-[520px]" />
          <div>
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Built for reassurance.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              Couples aren&apos;t looking for software.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              They&apos;re looking for confidence that everything is under control.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              The portal quietly provides that confidence every time they log in.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Photography ── */}
      <section className="relative min-h-[70vh] md:min-h-[85vh]">
        <Image
          src={FILM.clientWarm}
          alt="Couple together in warm evening light — connected and calm through planning"
          fill
          className="object-cover object-[center_30%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[rgba(47,55,47,0.42)]" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center text-[var(--true-white)] md:min-h-[85vh]">
          <p className="font-heading text-3xl italic leading-snug md:text-5xl">
            “The best guest experiences begin long before guests arrive.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-white/70 md:text-base">
            Every thoughtful interaction strengthens the relationship you&apos;ve already begun.
          </p>
        </div>
      </section>

      {/* ── Section 7 · The Wevenu Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            A portal people actually enjoy using.
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            <p>Most client portals feel like administrative tools.</p>
            <p>Wevenu feels like an extension of your hospitality.</p>
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
