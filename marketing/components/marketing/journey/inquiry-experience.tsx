import Image from "next/image";
import Link from "next/link";

import { InquiryWorkspaceMock } from "@/components/marketing/journey/inquiry-workspace-mock";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Capture Everything",
    body: "Website forms, email inquiries, referrals, phone calls, and walk-ins all begin the same connected journey.",
  },
  {
    n: "02",
    title: "Know Your Couple",
    body: "Preferences, conversations, notes, and history stay together from day one.",
  },
  {
    n: "03",
    title: "Never Lose Context",
    body: "No searching through inboxes. No wondering who replied last. Everything lives together.",
  },
] as const;

const RELATIONSHIP_FLOW = [
  "Inquiry",
  "Tour",
  "Proposal",
  "Contract",
  "Planning",
  "Wedding Day",
] as const;

type InquiryExperienceProps = {
  prev?: { id: string; title: string } | null;
  next: { id: string; title: string };
};

/**
 * Inquiry journey chapter — welcoming, hopeful magazine piece.
 * Visual personality distinct from later chapters.
 */
export function InquiryExperience({ prev = null, next }: InquiryExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            Connected journey · 01
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl lg:text-7xl">
            Inquiry
          </h1>
          <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            A first hello that feels personal.
          </p>
          <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            Every conversation begins a relationship. Whether it arrives from your website,
            email, phone call, or referral, Wevenu keeps everything together from the very
            first moment.
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

      {/* ── Section 2 · Large Visual Story ── 60/40 */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-stretch gap-8 md:grid-cols-[3fr_2fr] md:gap-10">
          <div className="relative min-h-[420px] overflow-hidden md:min-h-[560px]">
            <Image
              src={FILM.inquiryWelcome}
              alt="Couple walking the grounds of an elegant venue on a warm, bright day"
              fill
              className="object-cover object-[center_40%]"
              sizes="(max-width:768px) 100vw, 60vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <InquiryWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every conversation becomes part of one living record.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3 · How It Works ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {HOW_IT_WORKS.map((card) => (
            <div
              key={card.n}
              className="border-t border-[var(--taupe-medium)]/70 pt-8"
            >
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

      {/* ── Quiet hospitality detail ── */}
      <section className="px-6 pb-8 md:pb-12">
        <div className="relative mx-auto aspect-[21/7] max-w-6xl overflow-hidden md:aspect-[21/6]">
          <Image
            src={FILM.inquiryConversation}
            alt="Coffee, notebook, and flowers on a quiet morning table"
            fill
            className="object-cover"
            sizes="100vw"
          />
        </div>
      </section>

      {/* ── Section 4 · Real Difference ── */}
      <section className="bg-[var(--warm-gray)] px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:gap-20 md:items-start">
          <h2 className="font-heading text-3xl font-medium leading-[1.15] text-[var(--forest-sage)] md:text-5xl">
            Most software tracks inquiries.
            <br />
            Wevenu remembers relationships.
          </h2>
          <div>
            <p className="text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Traditional CRMs create another contact.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Wevenu creates the beginning of a living booking that stays connected through
              planning, payments, guests, vendors, and celebration.
            </p>
            <ol className="mt-14 space-y-0">
              {RELATIONSHIP_FLOW.map((label, i) => (
                <li key={label} className="flex flex-col items-start">
                  <span className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                    {label}
                  </span>
                  {i < RELATIONSHIP_FLOW.length - 1 ? (
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
              One uninterrupted flow.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 5 · Screenshot Feature ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.35fr_0.65fr] md:gap-16">
          <InquiryWorkspaceMock className="min-h-[420px] overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-48px_rgba(47,55,47,0.4)] md:min-h-[480px]" />
          <div>
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Calm by design.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              The interface shouldn&apos;t compete for your attention.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              It quietly keeps every conversation organized so you can focus on people instead
              of paperwork.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Closing Quote ── */}
      <section className="px-6 py-32 md:py-44">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-heading text-3xl italic leading-snug text-[var(--forest-sage)] md:text-5xl">
            “The best hospitality begins long before the wedding day.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-[var(--forest-sage)]/55 md:text-base">
            Wevenu simply makes sure it never gets forgotten.
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
