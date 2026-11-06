import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";
import type { ProductStoryChapter } from "@/lib/marketing/product-story";
import { EDITORIAL_FRAME, EDITORIAL_IMAGE } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

export type JourneyChapterStatus = "active" | "past" | "upcoming";

type ProductJourneyChapterProps = {
  chapter: ProductStoryChapter;
  index: number;
  status?: JourneyChapterStatus;
};

/**
 * Seven-chapter Product Journey — editorial photo + contained product proof.
 */
export function ProductJourneyChapter({
  chapter,
  index,
  status = "upcoming",
}: ProductJourneyChapterProps) {
  const n = String(index + 1).padStart(2, "0");
  const isActive = status === "active";
  const immersive = chapter.product === null;

  const photo = immersive ? (
    <div className={cn("pj-photo pj-photo--immersive overflow-hidden", EDITORIAL_FRAME)}>
      <Image
        src={chapter.photo.src}
        alt={chapter.photo.alt}
        width={1600}
        height={1067}
        className="pj-photo-img--celebration h-auto w-full"
        sizes="100vw"
        priority={index === 0}
      />
    </div>
  ) : (
    <div
      className={cn(
        "pj-photo pj-photo--pair relative w-full overflow-hidden",
        EDITORIAL_FRAME,
      )}
    >
      <Image
        src={chapter.photo.src}
        alt={chapter.photo.alt}
        fill
        className={EDITORIAL_IMAGE}
        sizes="(max-width:768px) 100vw, 50vw"
        priority={index === 0}
      />
    </div>
  );

  const product =
    chapter.product == null ? null : (
      <figure
        className={cn(
          "pj-product",
          `pj-product--${chapter.product.frame}`,
          `pj-product-overlap--${chapter.product.overlap}`,
        )}
      >
        <div className="pj-product-frame">
          <Image
            src={chapter.product.src}
            alt={chapter.product.alt}
            width={1200}
            height={900}
            className="pj-product-img"
            sizes="(max-width:768px) 92vw, 48vw"
            unoptimized
          />
        </div>
        {"caption" in chapter.product && chapter.product.caption ? (
          <figcaption className="pj-product-caption">
            {chapter.product.caption}
          </figcaption>
        ) : null}
      </figure>
    );

  return (
    <section
      id={`ch-${chapter.id}`}
      data-journey-status={status}
      className={cn(
        "journey-chapter relative scroll-mt-28 py-16 md:py-20",
        status === "active" && "opacity-100",
        status === "past" && "opacity-[0.78]",
        status === "upcoming" && "opacity-[0.88]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "journey-chapter-node absolute top-20 -left-10 hidden h-2 w-2 -translate-x-1/2 rounded-full md:block",
          isActive
            ? "bg-[var(--heritage-sage)]"
            : status === "past"
              ? "bg-[var(--heritage-sage)]/40"
              : "bg-[var(--taupe-medium)]",
        )}
      />

      <Reveal>
        <p
          className={cn(
            "pj-eyebrow flex flex-wrap items-center gap-3 text-[0.7125rem] tracking-[0.22em] uppercase transition-colors duration-200 ease-out",
            isActive
              ? "text-[var(--heritage-sage)]"
              : "text-[var(--heritage-sage)]/82",
          )}
        >
          <span
            className={cn(
              "text-[15px] transition-colors duration-200 ease-out md:text-[1.05rem]",
              isActive
                ? "text-[var(--heritage-sage)]"
                : "text-[var(--heritage-sage)]/65",
            )}
          >
            {n}
          </span>
          <span aria-hidden className="text-[var(--taupe-dark)]">
            ·
          </span>
          <span>{chapter.eyebrow}</span>
        </p>
        <h2 className="pj-headline mt-6 max-w-3xl font-heading text-[2.1rem] font-normal tracking-[-0.02em] md:text-[3.1rem]">
          {chapter.headline}
        </h2>
        <div className="pj-body mt-5 max-w-[65ch] space-y-4 text-base leading-[1.7] md:text-lg">
          {chapter.body.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}
        </div>
      </Reveal>

      {immersive ? (
        <div className="pj-compose-immersive mt-10 md:mt-12">{photo}</div>
      ) : (
        <div
          className={cn(
            "pj-compose mt-10 md:mt-12",
            chapter.photoFirst ? "pj-compose--photo-first" : "pj-compose--product-first",
          )}
        >
          <div className="pj-compose-photo">{photo}</div>
          <div className="pj-compose-product">{product}</div>
        </div>
      )}
    </section>
  );
}
