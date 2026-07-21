import { SECTION_Y, TYPE_HERO_SHELL } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  headline?: string;
  intro?: string;
  children?: React.ReactNode;
  className?: string;
  tone?: "cream" | "white" | "sage" | "linen";
  narrow?: boolean;
  /** Page-opening section under sticky header */
  hero?: boolean;
};

const TONE: Record<NonNullable<SectionProps["tone"]>, string> = {
  cream: "bg-[var(--natural-cream)]",
  white: "bg-[var(--true-white)]",
  sage: "bg-[var(--heritage-sage)] text-[var(--true-white)]",
  linen: "bg-[var(--linen)]",
};

export function Section({
  id,
  eyebrow,
  headline,
  intro,
  children,
  className,
  tone = "cream",
  narrow = false,
  hero = false,
}: SectionProps) {
  const onSage = tone === "sage";

  return (
    <section
      id={id}
      className={cn(hero ? TYPE_HERO_SHELL : `px-6 ${SECTION_Y}`, TONE[tone], className)}
    >
      <div className={cn("mx-auto", narrow ? "max-w-3xl" : "max-w-6xl")}>
        {(eyebrow || headline || intro) && (
          <header className={cn("mb-12 md:mb-16", narrow && "text-center")}>
            {eyebrow ? (
              <p
                className={cn(
                  "mb-7 text-[0.7125rem] font-medium uppercase tracking-[0.22em]",
                  onSage ? "text-[var(--true-white)]/70" : "text-[var(--heritage-sage)]/82",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            {headline ? (
              <h2
                className={cn(
                  "font-heading text-[2.1rem] font-medium tracking-tight md:text-[3.36rem]",
                  onSage ? "text-[var(--true-white)]" : "text-[var(--forest-sage)]",
                )}
              >
                {headline}
              </h2>
            ) : null}
            {intro ? (
              <p
                className={cn(
                  "mt-4 max-w-[65ch] text-base leading-[1.7] whitespace-pre-line md:text-lg",
                  onSage ? "text-[var(--true-white)]/80" : "text-[var(--forest-sage)]/75",
                  narrow && "mx-auto",
                )}
              >
                {intro}
              </p>
            ) : null}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
