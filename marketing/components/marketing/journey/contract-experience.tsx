import Image from "next/image";
import { TrustRule } from "@/components/marketing/brand-accents";
import { ContractWorkspaceMock } from "@/components/marketing/journey/contract-workspace-mock";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { MarketingCta, WalkthroughCtas } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

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
 * Contract & Inventory chapter (nav: Booking) — trust.
 * Promises become preparation; sales and operations share one commitment.
 */
export function ContractExperience({ prev, next }: ContractExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <TrustRule className="mb-5" />
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 04
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Contract & Inventory
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            Every promise becomes something your team can deliver.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            E-signed Contracts, custom packages, and collaborative inventory selection stay
            connected from the moment a booking is confirmed. Nothing needs to be entered twice,
            and nothing gets forgotten between sales and operations.
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
        <div className={`relative mx-auto aspect-[16/10] max-w-6xl md:aspect-[2/1] ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.bookingPrep}
            alt="Booking — thank you, we're honored to be part of your celebration"
            fill
            className={EDITORIAL_IMAGE}
            sizes="100vw"
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
              A contract shouldn&apos;t disappear into a filing cabinet.
              <br />
              It should begin the work.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Most systems generate a signed document and stop there.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Hello to Cheers turns accepted agreements into the operational foundation for everything
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
          <ContractWorkspaceMock className={`min-h-[480px] ${EDITORIAL_FRAME} bg-[var(--true-white)]`} />
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Sales and operations finally speak the same language.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              The team preparing the event shouldn&apos;t have to interpret a contract.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              They should simply see what needs to happen.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Behind the Scenes (quote baked into image) ── */}
      <section
        className={`relative aspect-[16/10] w-full bg-[var(--taupe-light)] md:aspect-[1024/512] ${EDITORIAL_BLEED}`}
      >
        <Image
          src={FILM.bookingBehindScenes}
          alt="Booking agreement and celebration prep on a wooden table — preparation becomes effortless when every promise is already connected"
          fill
          className={EDITORIAL_IMAGE}
          sizes="100vw"
        />
      </section>

      {/* ── Section 7 · The Real Difference ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            Inventory isn&apos;t a separate module.
          </h2>
          <div className="space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            <p>The chairs selected in the proposal.</p>
            <p>The tables promised in the contract.</p>
            <p>The linens needed for the reception.</p>
            <p>The ceremony setup.</p>
            <p>
              They&apos;re all part of the same booking—not copied into another
              system later.
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
