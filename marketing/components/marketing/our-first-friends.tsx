import Image from "next/image";

import { FILM } from "@/lib/marketing/film";
import { OUR_FIRST_FRIENDS } from "@/lib/marketing/our-first-friends";
import { EDITORIAL_FRAME, EDITORIAL_IMAGE } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type OurFirstFriendsProps = {
  /** When true, render letter only. */
  letterOnly?: boolean;
  /** When true, render legacy program + eligibility only. */
  programOnly?: boolean;
  className?: string;
};

/**
 * Gratitude editorial — Our First Friends.
 * Quiet magazine lettering. Lives on Our Story.
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
      <div className="px-6 pt-[140px] pb-12 md:pb-14">
        <p className="mx-auto max-w-3xl text-[0.7125rem] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/82">
          A letter from Hello to Cheers
        </p>
      </div>
      <OurFirstFriends letterOnly />
    </div>
  );
}

function FirstFriendsLetter() {
  const { letter } = OUR_FIRST_FRIENDS;

  return (
    <section className="px-6 py-28 md:py-36">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-heading text-[2.52rem] font-medium leading-[1.16] text-[var(--forest-sage)] md:text-[4.2rem]">
          {letter.title}
        </h2>

        <div className={`relative mt-14 aspect-[16/10] w-full md:mt-16 md:aspect-[2.1/1] ${EDITORIAL_FRAME}`}>
          <Image
            src={FILM.firstFriendsMemory}
            alt="Printed memories, handwritten thank-yous, and a journal of ideas and plans — relationships kept"
            fill
            className={EDITORIAL_IMAGE}
            sizes="(max-width:768px) 100vw, 720px"
          />
        </div>

        <div className="mt-14 space-y-7 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:mt-16 md:space-y-8 md:text-lg max-w-[65ch]">
          {letter.paragraphs.map((paragraph, i) => {
            const isBelief = paragraph.startsWith(
              "Venue software should make hospitality",
            );
            const isLeadIn =
              paragraph === "While the technology is entirely new, the philosophy remains the same:";

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

            if (paragraph.startsWith("If we had the opportunity to work together before")) {
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
  );
}

function FoundingVenueProgram() {
  const { program, eligibility } = OUR_FIRST_FRIENDS;

  return (
    <>
      <section className="px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-[2.1rem] font-medium text-[var(--forest-sage)] md:text-[3.36rem]">
            {program.title}
          </h2>
          <p className="mt-6 text-base leading-[1.7] text-[var(--forest-sage)]/75 md:text-lg max-w-[65ch]">
            {program.intro}
          </p>
          <p className="mt-10 text-sm tracking-wide text-[var(--heritage-sage)]">
            {program.receivesLabel}
          </p>
          <ul className="mt-6 space-y-4">
            {program.benefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-3 text-base leading-[1.7] text-[var(--forest-sage)]/80 md:text-lg max-w-[65ch]"
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

      <section className="border-t border-[var(--taupe-medium)]/40 bg-[var(--linen)] px-6 py-28 md:py-36">
        <div className="mx-auto max-w-3xl">
          <h3 className="font-heading text-2xl text-[var(--forest-sage)] md:text-4xl">
            {eligibility.title}
          </h3>
          <p className="mt-5 text-base text-[var(--forest-sage)]/70 md:text-lg">
            {eligibility.intro}
          </p>
          <ul className="mt-8 space-y-4">
            {eligibility.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-base leading-[1.7] text-[var(--forest-sage)]/80 md:text-lg max-w-[65ch]"
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
