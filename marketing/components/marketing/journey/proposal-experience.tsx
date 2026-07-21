import Image from "next/image";
import { JourneyNav } from "@/components/marketing/journey/journey-nav";
import { ProposalWorkspaceMock } from "@/components/marketing/journey/proposal-workspace-mock";
import { MarketingCta } from "@/components/marketing/marketing-cta";
import { FILM } from "@/lib/marketing/film";
import { EDITORIAL_BLEED, EDITORIAL_BREAK_Y, EDITORIAL_FRAME, EDITORIAL_IMAGE, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";

const WHY_YES = [
  {
    n: "01",
    title: "Beautifully Presented",
    body: "Packages, images, pricing, and details are presented with the same care as your venue itself.",
  },
  {
    n: "02",
    title: "Built From What They Loved",
    body: "Preferences, conversations, and tour notes already exist. Nothing has to be recreated.",
  },
  {
    n: "03",
    title: "Ready When They Are",
    body: "Accept online. Ask questions. Request changes. Everything continues inside the same relationship.",
  },
] as const;

const CONTINUITY_FLOW = ["Inquiry", "Tour", "Proposal"] as const;

type ProposalExperienceProps = {
  prev: { id: string; title: string };
  next: { id: string; title: string };
};

/**
 * Proposal journey chapter — confidence + continuity.
 * A living step in the relationship, not an output document.
 */
export function ProposalExperience({ prev, next }: ProposalExperienceProps) {
  return (
    <div className="bg-[var(--true-white)]">
      {/* ── Section 1 · Hero ── */}
      <section className={TYPE_HERO_SHELL}>
        <div className="mx-auto max-w-[65ch]">
          <p className="text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
            Connected journey · 03
          </p>
          <h1 className="mt-8 font-heading text-[3.36rem] font-medium leading-[1.1] tracking-tight text-[var(--forest-sage)] md:text-[4.2rem] lg:text-[5.04rem]">
            Proposal
          </h1>
          <p className="mt-4 font-heading text-2xl italic text-[var(--forest-sage)]/80 md:text-3xl">
            A beautiful yes begins with a beautiful proposal.
          </p>
          <p className="mt-8 max-w-[65ch] text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg">
            Your venue has already told its story. Hello to Cheers simply helps you present it
            clearly—with custom venue branded packages, pricing, imagery, and details that feel
            personal instead of transactional.
          </p>
          <div className="mt-14 flex flex-wrap items-center gap-4">
            <MarketingCta />
            <MarketingCta
              href="/product#connected-journey"
              label="Back to Journey"
              variant="ghost"
            />
          </div>
        </div>
      </section>

      {/* ── Section 2 · Lifestyle + Proposal ── */}
      <section className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl items-start gap-8 md:grid-cols-[3fr_2fr] md:gap-10">
          <div className={`relative aspect-[16/10] w-full md:aspect-[5/3] ${EDITORIAL_FRAME}`}>
            <Image
              src={FILM.proposalReview}
              alt="A Willow & Hearth proposal booklet for Elena & James — personal, clear, beautiful"
              fill
              className={EDITORIAL_IMAGE}
              sizes="(max-width:768px) 100vw, 60vw"
              priority
            />
          </div>
          <div className="flex flex-col justify-center self-stretch">
            <ProposalWorkspaceMock />
            <p className="mt-6 text-sm tracking-wide text-[var(--forest-sage)]/55">
              Every proposal reflects your venue—not generic software.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3 · Why Couples Say Yes ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3 md:gap-12">
          {WHY_YES.map((card) => (
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
              Most proposals start over.
              <br />
              Yours simply continues the story.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Other systems ask you to rebuild what you already know.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
              Hello to Cheers remembers the conversations, preferences, favorite spaces, and details
              from every interaction—so every proposal feels thoughtful without creating more
              work.
            </p>
          </div>
          <div>
            <ol className="space-y-0">
              {CONTINUITY_FLOW.map((label, i) => (
                <li key={label} className="flex flex-col items-start">
                  <span className="font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
                    {label}
                  </span>
                  {i < CONTINUITY_FLOW.length - 1 ? (
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
              Nothing resets.
            </p>
            <p className="mt-2 text-sm tracking-wide text-[var(--forest-sage)]/50">
              Nothing starts over.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 5 · Product Showcase ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.35fr_0.65fr] md:gap-16">
          <ProposalWorkspaceMock className={`min-h-[480px] ${EDITORIAL_FRAME} bg-[var(--true-white)]`} />
          <div>
            <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[2.52rem]">
              Confidence creates momentum.
            </h2>
            <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              When couples can clearly see themselves celebrating at your venue, decisions
              become easier.
            </p>
            <p className="mt-5 text-base leading-[1.7] text-[var(--forest-sage)]/70 md:text-lg max-w-[65ch]">
              Hello to Cheers helps you present that vision beautifully.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 6 · Hospitality Moment ── */}
      <section className={`px-6 ${EDITORIAL_BREAK_Y}`}>
        <div className={`relative mx-auto aspect-[16/10] max-w-6xl md:aspect-[2/1] ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.proposalHospitality}
            alt="Planning table with notebook and flowers — the proposal should feel like the next chapter"
            fill
            className={EDITORIAL_IMAGE}
            sizes="100vw"
          />
        </div>
      </section>

      {/* ── Section 7 · Continuity differentiator ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-start md:gap-20">
          <h2 className="font-heading text-[2.1rem] text-[var(--forest-sage)] md:text-[3.36rem]">
            Packages stay connected.
          </h2>
          <div className="space-y-5 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            <p>Your proposal isn&apos;t a disconnected document.</p>
            <p>
              Accepted packages automatically become part of planning, contracts, payments,
              inventory, timelines, and event execution.
            </p>
            <p>One decision flows naturally into everything that follows.</p>
            <div className="space-y-2 border-t border-[var(--taupe-medium)]/60 pt-8 text-sm tracking-wide text-[var(--forest-sage)]/55">
              <p>No duplicate entry.</p>
              <p>No rebuilding.</p>
              <p>No exporting.</p>
            </div>
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
