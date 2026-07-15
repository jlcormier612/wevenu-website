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
}: SectionProps) {
  const onSage = tone === "sage";

  return (
    <section id={id} className={cn("px-6 py-20 md:py-28", TONE[tone], className)}>
      <div className={cn("mx-auto", narrow ? "max-w-3xl" : "max-w-6xl")}>
        {(eyebrow || headline || intro) && (
          <header className={cn("mb-12 md:mb-16", narrow && "text-center")}>
            {eyebrow ? (
              <p
                className={cn(
                  "mb-4 text-xs font-medium uppercase tracking-[0.22em]",
                  onSage ? "text-[var(--true-white)]/70" : "text-[var(--heritage-sage)]",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            {headline ? (
              <h2
                className={cn(
                  "font-heading text-3xl font-medium tracking-tight md:text-5xl",
                  onSage ? "text-[var(--true-white)]" : "text-[var(--forest-sage)]",
                )}
              >
                {headline}
              </h2>
            ) : null}
            {intro ? (
              <p
                className={cn(
                  "mt-5 max-w-2xl text-base leading-relaxed md:text-lg",
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
