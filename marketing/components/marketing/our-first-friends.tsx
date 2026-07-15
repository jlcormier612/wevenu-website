import Image from "next/image";

import { FILM } from "@/lib/marketing/film";
import { OUR_FIRST_FRIENDS } from "@/lib/marketing/our-first-friends";
import { cn } from "@/lib/utils";

type OurFirstFriendsProps = {
  /** When true, render letter + reserved invitation only. */
  letterOnly?: boolean;
  /** When true, render program + eligibility only. */
  programOnly?: boolean;
  className?: string;
};

/**
 * Gratitude editorial — Our First Friends.
 * Quiet magazine lettering. Lives on Why Wevenu; program block also on Pricing.
 */
export function OurFirstFriends({
  letterOnly = false,
  programOnly = false,
  className,
}: OurFirstFriendsProps) {
  const showLetter = !programOnly;
  const showProgram = !letterOnly;

  return (
    <div className={cn(className)}>
      {showLetter ? <FirstFriendsLetter /> : null}
      {showProgram ? <FoundingVenueProgram /> : null}
    </div>
  );
}

/** Full-page composition for /our-first-friends */
export function OurFirstFriendsExperience() {
  return (
    <div className="bg-[var(--true-white)]">
      <div className="px-6 pt-[140px] pb-10 md:pb-14">
        <p className="mx-auto max-w-3xl text-xs tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
          A letter from Wevenu
        </p>
      </div>
      <OurFirstFriends />
    </div>
  );
}

function FirstFriendsLetter() {
  const { letter, reserved } = OUR_FIRST_FRIENDS;

  return (
    <>
      {/* ── Letter ── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-4xl font-medium leading-[1.1] text-[var(--forest-sage)] md:text-6xl">
            {letter.title}
          </h2>

          <div className="relative mt-14 aspect-[16/10] w-full overflow-hidden md:mt-16 md:aspect-[2.1/1]">
            <Image
              src={FILM.firstFriendsMemory}
              alt="Printed memories, handwritten thank-yous, and a journal of ideas and plans — relationships kept"
              fill
              className="object-cover object-center"
              sizes="(max-width:768px) 100vw, 720px"
            />
          </div>

          <div className="mt-14 space-y-7 text-base leading-relaxed text-[var(--forest-sage)]/75 md:mt-16 md:space-y-8 md:text-lg">
            {letter.paragraphs.map((paragraph, i) => {
              const isBelief =
                paragraph.startsWith("Our belief that venue software");
              const isLeadIn =
                paragraph === "While much has changed, one thing never has:";

              if (isBelief) {
                return (
                  <p
                    key={paragraph}
                    className="font-heading text-2xl leading-[1.35] text-[var(--forest-sage)] md:text-3xl"
                  >
                    {paragraph}
                  </p>
                );
              }

              if (isLeadIn) {
                return (
                  <p key={paragraph} className="pt-2">
                    {paragraph}
                  </p>
                );
              }

              // Extra breath before the closing gratitude
              if (paragraph.startsWith("If you were part of the Weven")) {
                return (
                  <p key={paragraph} className="pt-6">
                    {paragraph}
                  </p>
                );
              }

              return <p key={`${i}-${paragraph.slice(0, 24)}`}>{paragraph}</p>;
            })}
          </div>
        </div>
      </section>

      {/* ── A Place Reserved For You ── */}
      <section className="border-y border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <h3 className="font-heading text-3xl font-medium text-[var(--forest-sage)] md:text-5xl">
            {reserved.title}
          </h3>
          <div className="mt-10 space-y-6 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            {reserved.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className={
                  paragraph.startsWith("Because some relationships")
                    ? "pt-4 font-heading text-xl leading-snug text-[var(--forest-sage)] md:text-2xl"
                    : undefined
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function FoundingVenueProgram() {
  const { program, eligibility } = OUR_FIRST_FRIENDS;

  return (
    <>
      {/* ── Founding Venue Program ── */}
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-3xl font-medium text-[var(--forest-sage)] md:text-5xl">
            {program.title}
          </h2>
          <p className="mt-8 text-base leading-relaxed text-[var(--forest-sage)]/75 md:text-lg">
            {program.intro}
          </p>
          <p className="mt-10 text-sm tracking-wide text-[var(--heritage-sage)]">
            {program.receivesLabel}
          </p>
          <ul className="mt-6 space-y-4">
            {program.benefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-3 text-base leading-relaxed text-[var(--forest-sage)]/80 md:text-lg"
              >
                <span
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--heritage-sage)]"
                  aria-hidden
                />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <p className="mt-12 font-heading text-xl leading-snug text-[var(--forest-sage)] md:text-2xl">
            {program.close}
          </p>
        </div>
      </section>

      {/* ── Eligibility ── */}
      <section className="border-t border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <h3 className="font-heading text-2xl text-[var(--forest-sage)] md:text-4xl">
            {eligibility.title}
          </h3>
          <p className="mt-6 text-base text-[var(--forest-sage)]/70 md:text-lg">
            {eligibility.intro}
          </p>
          <ul className="mt-8 space-y-4">
            {eligibility.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-base leading-relaxed text-[var(--forest-sage)]/80 md:text-lg"
              >
                <span
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--heritage-sage)]"
                  aria-hidden
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
