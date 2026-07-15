import Image from "next/image";
import Link from "next/link";

import { ContractWorkspaceMock } from "@/components/marketing/journey/contract-workspace-mock";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";

const PRINCIPLES = [
  {
    n: "01",
    title: "One Agreement",
    body: "Packages, pricing, terms, and selections stay together inside the booking.",
  },
  {
    n: "02",
    title: "One Source of Truth",
    body: "Inventory isn't recreated by operations. It already exists because it was promised.",
  },
  {
    n: "03",
    title: "One Connected Team",
    body: "Sales, planners, and operations work from the same record—not separate spreadsheets.",
  },
] as const;

const FLOW = ["Proposal", "Contract", "Inventory", "Planning"] as const;

type ContractExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Contract & Inventory chapter (nav: Booking Confirmed) — trust.
 * Promises become preparation; sales and operations share one commitment.
 */
export function ContractExperience({ prev, next }: ContractExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className="px-6 pt-[140px] pb-28 md:pb-36">
        <div className="mx-auto max-w-[700px]">
          <p className="text-xs tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
            Connected journey · 04
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.05] text-[var(--forest-sage)] md:text-6xl lg:text-7xl">
            Contract & Inventory
          </h1>
          <p className="mt-6 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Every promise becomes something your team can deliver.
          </p>
          <p className="mt-10 max-w-[620px] text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
            Contracts, packages, and inventory stay connected from the moment a booking is
            confirmed. Nothing needs to be entered twice, and nothing gets forgotten between
            sales and operations.
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

      {/* ── Section 2 · Emotional Photography + Product ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-stretch gap-8 md:grid-cols-[3fr_2fr] md:gap-10">
          <div className="relative min-h-[420px] overflow-hidden md:min-h-[560px]">
            <Image
              src={FILM.bookingPrep}
              alt="Reception tables and chairs dressed and waiting — quiet preparation of what was promised"
              fill
              className="object-cover object-[center_40%]"
              sizes="(max-width:768px) 100vw, 60vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center">
            <ContractWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every accepted package becomes operational reality.
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
              A contract shouldn&apos;t disappear into a filing cabinet.
              <br />
              It should begin the work.
            </h2>
            <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Most systems generate a signed document and stop there.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
              Wevenu turns accepted agreements into the operational foundation for everything
              that follows—from inventory and floor plans to timelines and event execution.
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
            <p className="mt-8 text-sm tracking-wide text-[var(--forest-sage)]/50">
              Nothing duplicated.
            </p>
            <p className="mt-2 text-sm tracking-wide text-[var(--forest-sage)]/50">
              Everything connected.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 5 · Product Showcase ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.35fr_0.65fr] md:gap-16">
          <ContractWorkspaceMock className="min-h-[480px] overflow-hidden border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] shadow-[0_28px_80px_-48px_rgba(47,55,47,0.4)]" />
          <div>
            <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
              Sales and operations finally speak the same language.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              The team preparing the event shouldn&apos;t have to interpret a contract.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[var(--forest-sage)]/70 md:text-lg">
              They should simply see what needs to happen.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Behind the Scenes ── */}
      <section className="relative min-h-[70vh] md:min-h-[85vh]">
        <Image
          src={FILM.bookingBehindScenes}
          alt="Reception hall fully prepared — tables, florals, and quiet elegance before guests arrive"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[rgba(47,55,47,0.42)]" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center text-[var(--true-white)] md:min-h-[85vh]">
          <p className="font-heading text-3xl italic leading-snug md:text-5xl">
            “Great hospitality begins long before guests arrive.”
          </p>
          <p className="mt-8 text-sm tracking-wide text-white/70 md:text-base">
            Preparation becomes effortless when every promise is already connected.
          </p>
        </div>
      </section>

      {/* ── Section 7 · The Real Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-3xl text-[var(--forest-sage)] md:text-5xl">
            Inventory isn&apos;t a separate module.
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            <p>The chairs selected in the proposal.</p>
            <p>The tables promised in the contract.</p>
            <p>The linens needed for the reception.</p>
            <p>The ceremony setup.</p>
            <p>
              They&apos;re all part of the same booking—not copied into another system later.
            </p>
            <p className="border-t border-[var(--taupe-medium)]/60 pt-8 text-[var(--forest-sage)]/65">
              That&apos;s why Wevenu never asks your team to rebuild what already exists.
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
